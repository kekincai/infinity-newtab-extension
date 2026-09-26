import { rankSites } from '../core/history';
import { appStore } from '../core/store';
import type { Bookmark, RecentSite } from '../core/types';
import {
    bookmarkIcon,
    bookmarkIconCanUpgrade,
    bookmarkIconFallback,
    bookmarkIconIsRaster,
    bookmarkIconSrcSet,
    cleanDisplayName,
    escapeHtml,
    faviconSrcSet,
    faviconUrl
} from '../core/utils';
import { StoreElement } from './base';
import { ICONS } from './icons';
import { confirmAction, notifyError, openMenu, promptText, type MenuItem } from './ui-layer';

const ROOT = '全部';
const FOLDER_COLORS = ['#ff8cc6', '#6fd3ff', '#ffc86b', '#86e0bd', '#b3a2ff'];
const VIEW_KEY = 'infinity-launchpad-view';

type View = 'bookmarks' | 'recent';

export class BookmarkLaunchpad extends StoreElement {
    protected readonly observedChanges = ['bookmarks', 'folders', 'settings.layout'] as const;
    private currentFolder = ROOT;
    private view: View = readView();
    private draggingId: Bookmark['id'] | null = null;
    /** Store-driven re-renders keep the grid scroll position; navigation resets it. */
    private keepScroll = true;
    private recent: { sites: RecentSite[]; state: 'idle' | 'loading' | 'ready' | 'error'; error: string } = { sites: [], state: 'idle', error: '' };

    protected render(): void {
        const { folders, settings } = appStore.state;
        const { showBookmarks, showRecent } = settings.layout;
        this.hidden = !showBookmarks && !showRecent;
        if (this.hidden) {
            this.innerHTML = '';
            return;
        }
        if (!folders.includes(this.currentFolder)) this.currentFolder = ROOT;
        if (!showRecent) this.view = 'bookmarks';
        if (!showBookmarks) this.view = 'recent';
        if (this.view === 'recent' && this.recent.state === 'idle') {
            this.recent.state = 'loading';
            void this.fetchRecent();
        }
        const scroll = this.querySelector('.launchpad-grid')?.scrollTop ?? 0;

        this.innerHTML = `
            <section class="launchpad glass-panel ${showBookmarks ? 'has-nav' : ''}" aria-label="启动台">
                ${showBookmarks ? this.navTemplate(showRecent) : ''}
                <div class="launchpad-main">
                    <header class="launchpad-toolbar">
                        ${this.headingTemplate()}
                        <div class="toolbar-actions">${this.actionsTemplate()}</div>
                    </header>
                    <div class="launchpad-grid" data-view="${this.view}">
                        ${this.view === 'recent' ? this.recentTemplate() : this.bookmarksTemplate()}
                    </div>
                </div>
            </section>
        `;
        const grid = this.querySelector('.launchpad-grid');
        if (grid && this.keepScroll) grid.scrollTop = scroll;
        this.keepScroll = true;
        this.bindEvents();
    }

    /** Sidebar: the two views on top, folders below; every folder is also a drop target. */
    private navTemplate(showRecent: boolean): string {
        const { bookmarks, folders } = appStore.state;
        const count = (folder: string) => bookmarks.filter((bookmark) => bookmark.folder === folder).length;
        const rootActive = this.view === 'bookmarks' && this.currentFolder === ROOT;
        return `
            <nav class="launchpad-nav" aria-label="书签分组">
                <div class="nav-group">
                    <button class="nav-item ${rootActive ? 'is-active' : ''}" type="button" data-folder="${ROOT}" data-drop-folder="${ROOT}" data-liquid-item ${rootActive ? 'aria-current="page"' : ''}>
                        <span class="nav-icon">${ICONS.bookmark}</span><span class="nav-label">书签</span><small>${count(ROOT)}</small>
                    </button>
                    ${showRecent ? `
                    <button class="nav-item ${this.view === 'recent' ? 'is-active' : ''}" type="button" data-view="recent" data-liquid-item ${this.view === 'recent' ? 'aria-current="page"' : ''}>
                        <span class="nav-icon">${ICONS.pulse}</span><span class="nav-label">常访问</span>
                    </button>` : ''}
                </div>
                <h3 class="nav-heading">文件夹</h3>
                <div class="nav-group nav-folders">
                    ${folders.filter((folder) => folder !== ROOT).map((folder, index) => {
                        const active = this.view === 'bookmarks' && this.currentFolder === folder;
                        return `
                    <button class="nav-item nav-folder ${active ? 'is-active' : ''}" type="button" data-folder="${escapeHtml(folder)}" data-drop-folder="${escapeHtml(folder)}" data-liquid-item
                        style="--folder-color:${FOLDER_COLORS[index % FOLDER_COLORS.length]}" ${active ? 'aria-current="page"' : ''}>
                        <span class="nav-icon folder-swatch">${ICONS.folder}</span><span class="nav-label">${escapeHtml(folder)}</span><small>${count(folder)}</small>
                    </button>`;
                    }).join('')}
                    <button class="nav-item nav-add create-folder" type="button" data-liquid-item>
                        <span class="nav-icon">${ICONS.plus}</span><span class="nav-label">新建文件夹</span>
                    </button>
                </div>
            </nav>`;
    }

    private headingTemplate(): string {
        if (this.view === 'recent') {
            return '<div class="launchpad-heading-wrap"><h2 class="launchpad-heading">常访问</h2><span class="launchpad-count">最近 30 天</span></div>';
        }
        const count = appStore.state.bookmarks.filter((bookmark) => bookmark.folder === this.currentFolder).length;
        const title = this.currentFolder === ROOT ? '书签' : this.currentFolder;
        return `<div class="launchpad-heading-wrap"><h2 class="launchpad-heading">${escapeHtml(title)}</h2><span class="launchpad-count">${count} 个</span></div>`;
    }

    private actionsTemplate(): string {
        if (this.view === 'recent') {
            return `<button class="toolbar-button refresh-recent" type="button" data-liquid-item title="重新读取浏览记录">${ICONS.refresh}<span>刷新</span></button>`;
        }
        const folderActions = this.currentFolder === ROOT ? '' : `
            <button class="toolbar-button rename-current" type="button" data-liquid-item>${ICONS.edit}<span>重命名</span></button>
            <button class="toolbar-button delete-current" type="button" data-liquid-item>${ICONS.trash}<span>删除文件夹</span></button>`;
        return `${folderActions}<button class="toolbar-button primary-action add-bookmark-action" type="button" data-liquid-item>${ICONS.plus}<span>添加书签</span></button>`;
    }

    private bookmarksTemplate(): string {
        const visible = appStore.state.bookmarks.filter((bookmark) => bookmark.folder === this.currentFolder).sort(compareBookmarks);
        const empty = !visible.length
            ? `<p class="launchpad-message">${this.currentFolder === ROOT ? '还没有书签，点击下方加号添加第一个' : '这个文件夹是空的，可以把书签拖到左侧的文件夹上'}</p>`
            : '';
        return `
            ${visible.map((bookmark) => this.bookmarkTemplate(bookmark)).join('')}
            <button class="tile add-tile add-bookmark" type="button" data-liquid-item>
                <span class="tile-icon">${ICONS.plus}</span>
                <span class="tile-name">添加书签</span>
            </button>
            ${empty}
        `;
    }

    private bookmarkTemplate(bookmark: Bookmark): string {
        const name = cleanDisplayName(bookmark.name) || cleanDisplayName(new URL(bookmark.url).hostname);
        const newTab = appStore.state.settings.layout.openInNewTab;
        return `
            <a class="tile bookmark-tile" href="${escapeHtml(bookmark.url)}" ${newTab ? 'target="_blank"' : ''} rel="noopener noreferrer"
                data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item draggable="true" title="${escapeHtml(name)}&#10;${escapeHtml(bookmark.url)}">
                <span class="tile-icon"><img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="64px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" data-icon-raster="${bookmarkIconIsRaster(bookmark)}" alt="" decoding="async"></span>
                <span class="tile-name">${escapeHtml(name)}</span>
                <button class="tile-more" type="button" tabindex="-1" aria-label="书签操作">${ICONS.more}</button>
            </a>
        `;
    }

    private recentTemplate(): string {
        if (this.recent.state === 'loading' || this.recent.state === 'idle') return '<p class="launchpad-message">正在整理浏览记录…</p>';
        if (this.recent.state === 'error') return `<p class="launchpad-message">${escapeHtml(this.recent.error)}</p>`;
        if (!this.recent.sites.length) return '<p class="launchpad-message">最近 30 天还没有可展示的网站</p>';
        const newTab = appStore.state.settings.layout.openInNewTab;
        return this.recent.sites.map((site, index) => `
            <a class="tile recent-tile" href="${escapeHtml(site.url)}" ${newTab ? 'target="_blank"' : ''} rel="noopener noreferrer" data-recent-index="${index}" data-liquid-item title="${escapeHtml(site.host)}">
                <span class="tile-icon"><img src="${escapeHtml(faviconUrl(site.url))}" srcset="${escapeHtml(faviconSrcSet(site.url))}" sizes="64px" alt="" loading="lazy" decoding="async"></span>
                <span class="tile-name">${escapeHtml(site.title)}</span>
            </a>
        `).join('');
    }

    private bindEvents(): void {
        this.querySelectorAll<HTMLButtonElement>('.nav-item[data-view]').forEach((button) => {
            button.addEventListener('click', () => this.setView(button.dataset.view as View));
        });
        this.querySelectorAll<HTMLButtonElement>('.nav-item[data-folder]').forEach((button) => {
            button.addEventListener('click', () => this.openFolder(button.dataset.folder ?? ROOT));
        });
        this.querySelector('.launchpad-nav')?.addEventListener('keydown', (event) => {
            const key = (event as KeyboardEvent).key;
            if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
            const items = [...this.querySelectorAll<HTMLButtonElement>('.nav-item')];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (index < 0) return;
            event.preventDefault();
            items[(index + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
        });
        this.querySelector('.create-folder')?.addEventListener('click', () => void this.createFolder());
        this.querySelector('.rename-current')?.addEventListener('click', () => void this.renameFolder(this.currentFolder));
        this.querySelector('.delete-current')?.addEventListener('click', () => void this.deleteFolder(this.currentFolder));
        this.querySelector('.refresh-recent')?.addEventListener('click', () => void this.loadRecent());
        this.querySelectorAll('.add-bookmark, .add-bookmark-action').forEach((button) => button.addEventListener('click', () => this.openDialog()));
        this.querySelectorAll<HTMLImageElement>('.bookmark-tile img').forEach((image) => bindIconFallback(image));
        this.querySelectorAll<HTMLImageElement>('.recent-tile img').forEach((image) => {
            image.addEventListener('error', () => image.classList.add('icon-unavailable'), { once: true });
        });

        this.querySelectorAll<HTMLAnchorElement>('.bookmark-tile').forEach((card) => this.bindBookmark(card));
        this.querySelectorAll<HTMLElement>('[data-drop-folder]').forEach((target) => this.bindFolderDrop(target));

        const grid = this.querySelector<HTMLElement>('.launchpad-grid');
        grid?.addEventListener('dragover', (event) => { if (this.draggingId !== null) event.preventDefault(); });
        grid?.addEventListener('drop', (event) => {
            if ((event.target as HTMLElement).closest('.bookmark-tile, [data-drop-folder]')) return;
            event.preventDefault();
            const id = this.dragId(event);
            if (id !== null) void this.moveBookmark(id, this.currentFolder);
        });

        this.querySelectorAll<HTMLElement>('.tile-more').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.openTileMenu(button.closest<HTMLElement>('.tile')!, button);
            });
        });
        this.querySelector('.launchpad')?.addEventListener('contextmenu', (event) => {
            const mouse = event as MouseEvent;
            const target = mouse.target as HTMLElement;
            const tile = target.closest<HTMLElement>('.tile, .nav-folder');
            if (tile?.classList.contains('add-tile') || (!tile && target.closest('.launchpad-nav'))) return;
            event.preventDefault();
            // Keyboard-triggered menus (Shift+F10 / Menu key) report 0,0; anchor to the tile instead.
            const at = mouse.clientX || mouse.clientY ? { x: mouse.clientX, y: mouse.clientY } : (tile ?? target);
            if (tile) this.openTileMenu(tile, at);
            else if (this.view === 'bookmarks') this.openMenuFor([
                { label: '添加书签', icon: ICONS.plus, action: () => this.openDialog() },
                { label: '新建文件夹', icon: ICONS.folderPlus, action: () => void this.createFolder() }
            ], at);
        });
    }

    private bindBookmark(card: HTMLAnchorElement): void {
        const id = card.dataset.bookmarkId ?? '';
        card.addEventListener('click', (event) => {
            const bookmark = findBookmark(id);
            if (!bookmark || event.defaultPrevented || new URL(bookmark.url).protocol !== 'chrome-extension:') return;
            // Extension pages cannot be opened through a plain link from another extension.
            event.preventDefault();
            void Promise.resolve(chrome.tabs.create({ url: bookmark.url })).catch(notifyError);
        });
        card.addEventListener('dragstart', (event) => {
            this.draggingId = id;
            event.dataTransfer?.setData('text/plain', id);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            card.classList.add('is-dragging');
            this.classList.add('is-dragging');
        });
        card.addEventListener('dragend', () => {
            this.draggingId = null;
            card.classList.remove('is-dragging');
            this.classList.remove('is-dragging');
            this.querySelectorAll('.drop-target').forEach((item) => item.classList.remove('drop-target'));
        });
        card.addEventListener('dragover', (event) => {
            if (this.draggingId === null || this.draggingId === id) return;
            event.preventDefault();
            card.classList.add('drop-target');
        });
        card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
        card.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();
            card.classList.remove('drop-target');
            const sourceId = this.dragId(event);
            if (sourceId !== null && sourceId !== id) void this.moveBookmark(sourceId, this.currentFolder, id);
        });
    }

    private bindFolderDrop(target: HTMLElement): void {
        const folder = target.dataset.dropFolder ?? ROOT;
        target.addEventListener('dragover', (event) => {
            if (this.draggingId === null) return;
            event.preventDefault();
            target.classList.add('drop-target');
        });
        target.addEventListener('dragleave', () => target.classList.remove('drop-target'));
        target.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();
            target.classList.remove('drop-target');
            const id = this.dragId(event);
            if (id !== null) void this.moveBookmark(id, folder);
        });
    }

    private openTileMenu(tile: HTMLElement, at: { x: number; y: number } | HTMLElement): void {
        if (tile.dataset.folder) {
            const folder = tile.dataset.folder;
            if (folder === ROOT) return;
            this.openMenuFor([
                { label: '打开', icon: ICONS.open, action: () => this.openFolder(folder) },
                { label: '重命名', icon: ICONS.edit, action: () => void this.renameFolder(folder) },
                { separator: true },
                { label: '删除文件夹', icon: ICONS.trash, danger: true, action: () => void this.deleteFolder(folder) }
            ], at);
            return;
        }
        if (tile.dataset.recentIndex !== undefined) {
            const site = this.recent.sites[Number(tile.dataset.recentIndex)];
            if (!site) return;
            this.openMenuFor([
                { label: '在新标签页打开', icon: ICONS.open, action: () => window.open(site.url, '_blank', 'noopener') },
                { label: '添加到书签', icon: ICONS.plus, action: () => this.openDialog(undefined, { url: site.url, name: site.title }) }
            ], at);
            return;
        }
        const bookmark = findBookmark(tile.dataset.bookmarkId ?? '');
        if (!bookmark) return;
        const destinations = appStore.state.folders.filter((folder) => folder !== bookmark.folder);
        this.openMenuFor([
            { label: '在新标签页打开', icon: ICONS.open, action: () => void Promise.resolve(chrome.tabs.create({ url: bookmark.url })).catch(notifyError) },
            { label: '编辑', icon: ICONS.edit, action: () => this.openDialog(bookmark) },
            ...(destinations.length ? [
                { separator: true } as const,
                { heading: '移动到' } as const,
                ...destinations.map((folder) => ({ label: folder, icon: ICONS.move, action: () => void this.moveBookmark(bookmark.id, folder) }))
            ] : []),
            { separator: true },
            { label: '删除', icon: ICONS.trash, danger: true, action: () => void this.deleteBookmark(bookmark) }
        ], at);
    }

    private openMenuFor(items: MenuItem[], at: { x: number; y: number } | HTMLElement): void {
        openMenu(items, at);
    }

    private setView(view: View): void {
        if (view === this.view) return;
        this.view = view;
        try { localStorage.setItem(VIEW_KEY, view); } catch { /* per-device convenience only */ }
        this.keepScroll = false;
        this.render();
        this.querySelector<HTMLElement>('.nav-item.is-active')?.focus({ preventScroll: true });
    }

    private openFolder(folder: string): void {
        const changed = this.currentFolder !== folder || this.view !== 'bookmarks';
        this.currentFolder = folder;
        if (this.view !== 'bookmarks') {
            this.view = 'bookmarks';
            try { localStorage.setItem(VIEW_KEY, 'bookmarks'); } catch { /* per-device convenience only */ }
        }
        if (!changed) return;
        this.keepScroll = false;
        this.render();
        this.querySelector<HTMLElement>('.nav-item.is-active')?.focus({ preventScroll: true });
    }

    private openDialog(bookmark?: Bookmark, draft?: { url: string; name: string }): void {
        this.dispatchEvent(new CustomEvent('open-bookmark-dialog', {
            bubbles: true,
            composed: true,
            detail: { bookmark, draft, folder: this.currentFolder }
        }));
    }

    private async loadRecent(): Promise<void> {
        this.recent = { ...this.recent, state: 'loading', error: '' };
        this.render();
        await this.fetchRecent();
    }

    private async fetchRecent(): Promise<void> {
        try {
            if (!chrome.history?.search) throw new Error('浏览器未开放历史记录访问');
            const items = await new Promise<any[]>((resolve, reject) => {
                chrome.history.search({ text: '', startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, maxResults: 3000 }, (result: any[]) => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(result ?? []);
                });
            });
            this.recent = { sites: rankSites(items), state: 'ready', error: '' };
        } catch (error) {
            this.recent = { sites: [], state: 'error', error: error instanceof Error && error.message ? error.message : '读取浏览记录失败' };
        }
        if (this.view === 'recent') this.render();
    }

    private async createFolder(): Promise<void> {
        const name = await promptText('新建文件夹', { label: '名称', placeholder: '例如：工作、娱乐' }, '创建');
        if (!name) return;
        try {
            if (!await appStore.addFolder(name)) notifyError(new Error(`已经有名为“${name}”的文件夹`));
        } catch (error) { notifyError(error); }
    }

    private async renameFolder(folder: string): Promise<void> {
        const name = await promptText('重命名文件夹', { label: '名称', value: folder });
        if (!name || name === folder) return;
        // Follow the rename before the store re-renders, or the view would fall back to the root.
        const inside = this.currentFolder === folder;
        if (inside) this.currentFolder = name;
        try {
            if (!await appStore.renameFolder(folder, name)) {
                if (inside) this.currentFolder = folder;
                notifyError(new Error(`已经有名为“${name}”的文件夹`));
            }
        } catch (error) {
            if (inside) this.currentFolder = folder;
            notifyError(error);
        }
    }

    private async deleteFolder(folder: string): Promise<void> {
        const count = appStore.state.bookmarks.filter((bookmark) => bookmark.folder === folder).length;
        const confirmed = await confirmAction({
            title: `删除文件夹“${folder}”？`,
            body: count ? `其中的 ${count} 个书签会移回“${ROOT}”，不会被删除。` : '这个文件夹是空的。',
            confirmText: '删除',
            danger: true
        });
        if (!confirmed) return;
        try {
            await appStore.deleteFolder(folder);
            if (this.currentFolder === folder) this.openFolder(ROOT);
        } catch (error) { notifyError(error); }
    }

    private async deleteBookmark(bookmark: Bookmark): Promise<void> {
        const confirmed = await confirmAction({
            title: `删除“${cleanDisplayName(bookmark.name) || bookmark.url}”？`,
            confirmText: '删除',
            danger: true
        });
        if (confirmed) await appStore.deleteBookmark(bookmark.id).catch(notifyError);
    }

    private async moveBookmark(id: Bookmark['id'], folder: string, targetId?: Bookmark['id']): Promise<void> {
        try { await appStore.moveBookmark(id, folder, targetId); } catch (error) { notifyError(error); }
    }

    private dragId(event: DragEvent): Bookmark['id'] | null {
        return event.dataTransfer?.getData('text/plain') || this.draggingId;
    }
}

function readView(): View {
    try { return localStorage.getItem(VIEW_KEY) === 'recent' ? 'recent' : 'bookmarks'; } catch { return 'bookmarks'; }
}

function findBookmark(id: string): Bookmark | undefined {
    return appStore.state.bookmarks.find((item) => String(item.id) === String(id));
}

function bindIconFallback(image: HTMLImageElement): void {
    const fallback = image.dataset.iconFallback;
    if (!fallback) return;
    const useFallback = () => {
        if (image.dataset.fallbackUsed === 'true') {
            image.classList.add('icon-unavailable');
            return;
        }
        image.dataset.fallbackUsed = 'true';
        image.removeAttribute('srcset');
        image.src = fallback;
    };
    image.addEventListener('load', () => {
        if (image.dataset.iconRaster === 'true') image.classList.add('icon-raster');
        if (image.dataset.iconCanUpgrade === 'true'
            && image.dataset.fallbackUsed !== 'true'
            && image.naturalWidth > 0
            && image.naturalWidth < 64) {
            useFallback();
        }
    });
    image.addEventListener('error', useFallback);
}

function compareBookmarks(left: Bookmark, right: Bookmark): number {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
}
