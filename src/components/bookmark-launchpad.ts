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

        this.innerHTML = `
            <section class="launchpad glass-panel" aria-label="启动台">
                <header class="launchpad-toolbar">
                    ${this.leadingTemplate(showBookmarks, showRecent)}
                    <div class="toolbar-actions">${this.actionsTemplate()}</div>
                </header>
                <div class="launchpad-grid" data-view="${this.view}">
                    ${this.view === 'recent' ? this.recentTemplate() : this.bookmarksTemplate()}
                </div>
            </section>
        `;
        this.bindEvents();
    }

    private leadingTemplate(showBookmarks: boolean, showRecent: boolean): string {
        if (this.view === 'bookmarks' && this.currentFolder !== ROOT) {
            return `
                <nav class="breadcrumb" aria-label="文件夹路径">
                    <button class="toolbar-button crumb-back" type="button" data-liquid-item data-drop-folder="${ROOT}" title="返回全部（也可把书签拖到这里移出文件夹）">${ICONS.back}<span>${ROOT}</span></button>
                    <span class="crumb-separator" aria-hidden="true">/</span>
                    <h2 class="crumb-current">${escapeHtml(this.currentFolder)}</h2>
                </nav>`;
        }
        if (showBookmarks && showRecent) {
            return `
                <div class="view-switch" role="tablist" aria-label="启动台视图">
                    ${viewButton('bookmarks', '书签', this.view)}
                    ${viewButton('recent', '常访问', this.view)}
                </div>`;
        }
        return `<h2 class="launchpad-title">${showBookmarks ? '书签' : '常访问'}</h2>`;
    }

    private actionsTemplate(): string {
        if (this.view === 'recent') {
            return `<button class="toolbar-button refresh-recent" type="button" data-liquid-item title="重新读取浏览记录">${ICONS.refresh}<span>刷新</span></button>`;
        }
        if (this.currentFolder !== ROOT) {
            return `
                <button class="toolbar-button rename-current" type="button" data-liquid-item>${ICONS.edit}<span>重命名</span></button>
                <button class="toolbar-button delete-current" type="button" data-liquid-item>${ICONS.trash}<span>删除文件夹</span></button>`;
        }
        return `<button class="toolbar-button create-folder" type="button" data-liquid-item>${ICONS.folderPlus}<span>新建文件夹</span></button>`;
    }

    private bookmarksTemplate(): string {
        const { bookmarks, folders } = appStore.state;
        const visible = bookmarks.filter((bookmark) => bookmark.folder === this.currentFolder).sort(compareBookmarks);
        const folderTiles = this.currentFolder === ROOT
            ? folders.filter((folder) => folder !== ROOT).map((folder, index) => this.folderTemplate(folder, index)).join('')
            : '';
        return `
            ${folderTiles}
            ${visible.map((bookmark) => this.bookmarkTemplate(bookmark)).join('')}
            <button class="tile add-tile add-bookmark" type="button" data-liquid-item>
                <span class="tile-icon">${ICONS.plus}</span>
                <span class="tile-name">添加书签</span>
            </button>
        `;
    }

    private bookmarkTemplate(bookmark: Bookmark): string {
        const name = cleanDisplayName(bookmark.name) || cleanDisplayName(new URL(bookmark.url).hostname);
        const newTab = appStore.state.settings.layout.openInNewTab;
        return `
            <a class="tile bookmark-tile" href="${escapeHtml(bookmark.url)}" ${newTab ? 'target="_blank"' : ''} rel="noopener noreferrer"
                data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item draggable="true" title="${escapeHtml(name)}&#10;${escapeHtml(bookmark.url)}">
                <span class="tile-icon"><img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="56px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" data-icon-raster="${bookmarkIconIsRaster(bookmark)}" alt="" decoding="async"></span>
                <span class="tile-name">${escapeHtml(name)}</span>
                <button class="tile-more" type="button" tabindex="-1" aria-label="书签操作">${ICONS.more}</button>
            </a>
        `;
    }

    private folderTemplate(folder: string, index: number): string {
        const bookmarks = appStore.state.bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks);
        const previews = bookmarks.slice(0, 4).map((bookmark) => (
            `<span class="folder-mini"><img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="20px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" alt="" loading="lazy" decoding="async"></span>`
        )).join('');
        return `
            <div class="tile folder-tile" tabindex="0" role="button" data-folder="${escapeHtml(folder)}" data-drop-folder="${escapeHtml(folder)}" data-liquid-item
                style="--folder-color:${FOLDER_COLORS[index % FOLDER_COLORS.length]}" aria-label="文件夹 ${escapeHtml(folder)}，${bookmarks.length} 个书签">
                <span class="tile-icon folder-icon">${previews ? `<span class="folder-grid">${previews}</span>` : ICONS.bookmark}</span>
                <span class="tile-name">${escapeHtml(folder)}</span>
                <button class="tile-more" type="button" tabindex="-1" aria-label="文件夹操作">${ICONS.more}</button>
            </div>
        `;
    }

    private recentTemplate(): string {
        if (this.recent.state === 'loading' || this.recent.state === 'idle') return '<p class="launchpad-message">正在整理浏览记录…</p>';
        if (this.recent.state === 'error') return `<p class="launchpad-message">${escapeHtml(this.recent.error)}</p>`;
        if (!this.recent.sites.length) return '<p class="launchpad-message">最近 30 天还没有可展示的网站</p>';
        const newTab = appStore.state.settings.layout.openInNewTab;
        return this.recent.sites.map((site, index) => `
            <a class="tile recent-tile" href="${escapeHtml(site.url)}" ${newTab ? 'target="_blank"' : ''} rel="noopener noreferrer" data-recent-index="${index}" data-liquid-item title="${escapeHtml(site.host)}">
                <span class="tile-icon"><img src="${escapeHtml(faviconUrl(site.url))}" srcset="${escapeHtml(faviconSrcSet(site.url))}" sizes="56px" alt="" loading="lazy" decoding="async"></span>
                <span class="tile-name">${escapeHtml(site.title)}</span>
            </a>
        `).join('');
    }

    private bindEvents(): void {
        this.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
            button.addEventListener('click', () => this.setView(button.dataset.view as View));
        });
        this.querySelector('.view-switch')?.addEventListener('keydown', (event) => {
            const key = (event as KeyboardEvent).key;
            if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
            this.setView(this.view === 'bookmarks' ? 'recent' : 'bookmarks');
            this.querySelector<HTMLButtonElement>(`[data-view="${this.view}"]`)?.focus();
        });
        this.querySelector('.crumb-back')?.addEventListener('click', () => this.openFolder(ROOT));
        this.querySelector('.create-folder')?.addEventListener('click', () => void this.createFolder());
        this.querySelector('.rename-current')?.addEventListener('click', () => void this.renameFolder(this.currentFolder));
        this.querySelector('.delete-current')?.addEventListener('click', () => void this.deleteFolder(this.currentFolder));
        this.querySelector('.refresh-recent')?.addEventListener('click', () => void this.loadRecent());
        this.querySelector('.add-bookmark')?.addEventListener('click', () => this.openDialog());
        this.querySelectorAll<HTMLImageElement>('.bookmark-tile img, .folder-tile img').forEach((image) => bindIconFallback(image));
        this.querySelectorAll<HTMLImageElement>('.recent-tile img').forEach((image) => {
            image.addEventListener('error', () => image.classList.add('icon-unavailable'), { once: true });
        });

        this.querySelectorAll<HTMLElement>('.folder-tile').forEach((card) => {
            const folder = card.dataset.folder ?? ROOT;
            card.addEventListener('click', (event) => {
                if ((event.target as HTMLElement).closest('.tile-more')) return;
                this.openFolder(folder);
            });
            card.addEventListener('keydown', (event) => {
                if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    this.openFolder(folder);
                }
            });
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
            const tile = (mouse.target as HTMLElement).closest<HTMLElement>('.tile');
            if (tile?.classList.contains('add-tile')) return;
            event.preventDefault();
            // Keyboard-triggered menus (Shift+F10 / Menu key) report 0,0; anchor to the tile instead.
            const at = mouse.clientX || mouse.clientY ? { x: mouse.clientX, y: mouse.clientY } : (tile ?? mouse.target as HTMLElement);
            if (tile) this.openTileMenu(tile, at);
            else if (this.view === 'bookmarks') this.openMenuFor([
                { label: '添加书签', icon: ICONS.plus, action: () => this.openDialog() },
                ...(this.currentFolder === ROOT ? [{ label: '新建文件夹', icon: ICONS.folderPlus, action: () => void this.createFolder() }] : [])
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
        this.render();
    }

    private openFolder(folder: string): void {
        this.currentFolder = folder;
        this.render();
        const focusTarget = folder === ROOT ? '.create-folder' : '.crumb-back';
        this.querySelector<HTMLElement>(focusTarget)?.focus({ preventScroll: true });
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

function viewButton(view: View, label: string, active: View): string {
    const selected = view === active;
    return `<button type="button" role="tab" class="view-tab ${selected ? 'is-active' : ''}" data-view="${view}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-liquid-item>${label}</button>`;
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
