import { loadRecentSites } from '../core/history';
import { appStore } from '../core/store';
import type { Bookmark, RecentSite } from '../core/types';
import { escapeHtml } from '../core/utils';
import { StoreElement } from './base';
import {
    ROOT_FOLDER,
    bookmarkMenu,
    bookmarkName,
    bookmarksIn,
    compareBookmarks,
    createFolder,
    deleteFolder,
    findBookmark,
    interceptExtensionLink,
    moveBookmark,
    openBookmarkDialog,
    renameFolder,
    siteMenu
} from './bookmark-actions';
import { ICONS } from './icons';
import { bindSiteIcons, hostOf, siteIcon } from './site-icon';
import { afterMotion, openMenu, pushLayer } from './ui-layer';

export type LaunchpadView = 'bookmarks' | 'recent';

/** Full-screen launchpad over the blurred wallpaper: folders as tabs, bookmarks as app icons. */
export class BookmarkLaunchpad extends StoreElement {
    protected readonly observedChanges = ['bookmarks', 'folders', 'settings.layout'] as const;
    private view: LaunchpadView = 'bookmarks';
    private folder = ROOT_FOLDER;
    private query = '';
    private draggingId: Bookmark['id'] | null = null;
    private recent: { sites: RecentSite[]; state: 'idle' | 'loading' | 'ready' | 'error'; error: string } = { sites: [], state: 'idle', error: '' };
    private releaseLayer: (() => void) | null = null;

    connectedCallback(): void {
        this.hidden = true;
        super.connectedCallback();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.close();
    }

    get isOpen(): boolean {
        return !this.hidden;
    }

    open(view: LaunchpadView = 'bookmarks', folder = ROOT_FOLDER): void {
        this.view = view;
        this.folder = folder;
        this.query = '';
        this.innerHTML = '';
        if (!this.isOpen) {
            this.hidden = false;
            document.body.classList.add('launchpad-open');
            this.releaseLayer = pushLayer(this, () => this.close());
        }
        this.render();
        afterMotion(this, () => {
            if (this.isOpen && !this.contains(document.activeElement)) this.querySelector<HTMLElement>('.launchpad-tab.is-active')?.focus({ preventScroll: true });
        });
    }

    close(): void {
        if (!this.isOpen) return;
        this.hidden = true;
        document.body.classList.remove('launchpad-open');
        this.innerHTML = '';
        const release = this.releaseLayer;
        this.releaseLayer = null;
        release?.();
    }

    protected render(): void {
        if (!this.isOpen) return;
        if (!appStore.state.folders.includes(this.folder)) this.folder = ROOT_FOLDER;
        if (this.view === 'recent' && this.recent.state === 'idle') void this.loadRecent();
        if (!this.querySelector('.launchpad')) this.renderShell();
        const grid = this.querySelector<HTMLElement>('.launchpad-grid')!;
        const scroll = grid.scrollTop;
        this.querySelector('.launchpad-tabs')!.innerHTML = this.tabsTemplate();
        grid.dataset.view = this.query ? 'search' : this.view;
        grid.innerHTML = this.gridTemplate();
        grid.scrollTop = scroll;
        bindSiteIcons(this);
        this.querySelectorAll<HTMLAnchorElement>('.bookmark-tile').forEach((card) => this.bindBookmark(card));
        this.querySelectorAll<HTMLElement>('[data-drop-folder]').forEach((target) => this.bindFolderDrop(target));
    }

    /** The shell (and its search field) is built once per opening so typing, including IME input, is never interrupted. */
    private renderShell(): void {
        this.innerHTML = `
            <div class="launchpad-backdrop" aria-hidden="true"></div>
            <section class="launchpad" role="dialog" aria-modal="true" aria-label="启动台">
                <header class="launchpad-top">
                    <label class="glass launchpad-search">
                        ${ICONS.search}
                        <input type="search" placeholder="在书签中搜索" aria-label="在书签中搜索" autocomplete="off" spellcheck="false">
                    </label>
                    <div class="glass launchpad-tabs" role="tablist" aria-label="书签分组"></div>
                </header>
                <button class="glass launchpad-done" type="button" data-liquid-item>完成</button>
                <div class="launchpad-grid"></div>
            </section>`;
        this.bindShell();
    }

    private tabsTemplate(): string {
        const { bookmarks, folders } = appStore.state;
        const tab = (label: string, active: boolean, attributes: string) => `
            <button class="launchpad-tab ${active ? 'is-active' : ''}" type="button" role="tab" aria-selected="${active}" tabindex="${active ? 0 : -1}" data-liquid-item ${attributes}>${label}</button>`;
        const browsing = !this.query;
        return `
                ${tab(`全部 · ${bookmarks.length}`, browsing && this.view === 'bookmarks' && this.folder === ROOT_FOLDER, `data-folder="${ROOT_FOLDER}" data-drop-folder="${ROOT_FOLDER}"`)}
                ${tab('常访问', browsing && this.view === 'recent', 'data-view="recent"')}
                ${folders.filter((folder) => folder !== ROOT_FOLDER).map((folder) => tab(
                    escapeHtml(folder),
                    browsing && this.view === 'bookmarks' && this.folder === folder,
                    `data-folder="${escapeHtml(folder)}" data-drop-folder="${escapeHtml(folder)}"`
                )).join('')}
                <button class="launchpad-tab create-folder" type="button" data-liquid-item aria-label="新建文件夹" title="新建文件夹">${ICONS.plus}</button>`;
    }

    private gridTemplate(): string {
        if (this.query) {
            const query = this.query.toLowerCase();
            const matches = [...appStore.state.bookmarks].sort(compareBookmarks).filter((bookmark) => (
                bookmarkName(bookmark).toLowerCase().includes(query) || bookmark.url.toLowerCase().includes(query)
            ));
            return matches.map((bookmark) => this.bookmarkTemplate(bookmark)).join('')
                || `<p class="launchpad-message">没有找到“${escapeHtml(this.query)}”</p>`;
        }
        if (this.view === 'recent') return this.recentTemplate();
        const folders = this.folder === ROOT_FOLDER
            ? appStore.state.folders.filter((folder) => folder !== ROOT_FOLDER).map((folder) => this.folderTemplate(folder)).join('')
            : '';
        const bookmarks = bookmarksIn(this.folder);
        const empty = !bookmarks.length && !folders
            ? `<p class="launchpad-message">${this.folder === ROOT_FOLDER ? '还没有书签，点击加号添加第一个' : '这个文件夹是空的，可以把书签拖到上方的文件夹标签上'}</p>`
            : '';
        return `
            ${folders}
            ${bookmarks.map((bookmark) => this.bookmarkTemplate(bookmark)).join('')}
            <button class="tile add-tile add-bookmark" type="button" data-liquid-item>
                <span class="app-icon app-icon-glass">${ICONS.plus}</span>
                <span class="tile-name">添加书签</span>
            </button>
            ${empty}`;
    }

    private folderTemplate(folder: string): string {
        const items = bookmarksIn(folder);
        const minis = items.slice(0, 4).map((bookmark) => siteIcon({ url: bookmark.url, name: bookmark.name, bookmark }, 'mini-icon')).join('');
        return `
            <button class="tile folder-tile" type="button" data-folder="${escapeHtml(folder)}" data-drop-folder="${escapeHtml(folder)}" data-liquid-item title="${escapeHtml(folder)} · ${items.length} 个书签">
                <span class="app-icon app-icon-glass folder-icon">${minis || ICONS.folder}</span>
                <span class="tile-name">${escapeHtml(folder)}</span>
            </button>`;
    }

    private bookmarkTemplate(bookmark: Bookmark): string {
        const name = bookmarkName(bookmark);
        const newTab = appStore.state.settings.layout.openInNewTab;
        return `
            <a class="tile bookmark-tile" href="${escapeHtml(bookmark.url)}" ${newTab ? 'target="_blank"' : ''} rel="noopener noreferrer"
                data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item draggable="true" title="${escapeHtml(name)}&#10;${escapeHtml(bookmark.url)}">
                ${siteIcon({ url: bookmark.url, name: bookmark.name, bookmark })}
                <span class="tile-name">${escapeHtml(name)}</span>
                <button class="tile-more" type="button" tabindex="-1" aria-label="书签操作">${ICONS.more}</button>
            </a>`;
    }

    private recentTemplate(): string {
        if (this.recent.state === 'loading' || this.recent.state === 'idle') return '<p class="launchpad-message">正在整理浏览记录…</p>';
        if (this.recent.state === 'error') return `<p class="launchpad-message">${escapeHtml(this.recent.error)}</p>`;
        if (!this.recent.sites.length) return '<p class="launchpad-message">最近 30 天还没有可展示的网站</p>';
        const newTab = appStore.state.settings.layout.openInNewTab;
        return this.recent.sites.map((site, index) => `
            <a class="tile recent-tile" href="${escapeHtml(site.url)}" ${newTab ? 'target="_blank"' : ''} rel="noopener noreferrer" data-recent-index="${index}" data-liquid-item title="${escapeHtml(hostOf(site.url))}">
                ${siteIcon({ url: site.url, name: site.title })}
                <span class="tile-name">${escapeHtml(site.title)}</span>
            </a>`).join('');
    }

    private bindShell(): void {
        this.querySelector('.launchpad-done')?.addEventListener('click', () => this.close());
        this.querySelector('.launchpad-backdrop')?.addEventListener('click', () => this.close());
        // Like Launchpad: a click on empty space closes it.
        this.querySelector('.launchpad')?.addEventListener('click', (event) => {
            if ((event.target as HTMLElement).matches('.launchpad, .launchpad-top')) this.close();
        });

        const search = this.querySelector<HTMLInputElement>('.launchpad-search input')!;
        search.addEventListener('input', () => {
            this.query = search.value.trim();
            this.render();
        });

        const tabs = this.querySelector<HTMLElement>('.launchpad-tabs')!;
        tabs.addEventListener('click', (event) => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.launchpad-tab');
            if (!button) return;
            if (button.classList.contains('create-folder')) void createFolder();
            else if (button.dataset.view === 'recent') this.show('recent', ROOT_FOLDER);
            else this.show('bookmarks', button.dataset.folder ?? ROOT_FOLDER);
        });
        tabs.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const items = [...tabs.querySelectorAll<HTMLButtonElement>('.launchpad-tab')];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (index < 0) return;
            event.preventDefault();
            items[(index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length].focus();
        });

        const grid = this.querySelector<HTMLElement>('.launchpad-grid')!;
        grid.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (target === grid) {
                this.close();
                return;
            }
            const more = target.closest<HTMLElement>('.tile-more');
            if (more) {
                event.preventDefault();
                event.stopPropagation();
                this.openTileMenu(more.closest<HTMLElement>('.tile')!, more);
                return;
            }
            const folder = target.closest<HTMLElement>('.folder-tile');
            if (folder) this.show('bookmarks', folder.dataset.folder ?? ROOT_FOLDER);
            else if (target.closest('.add-bookmark')) openBookmarkDialog(this, { folder: this.folder });
        });
        grid.addEventListener('dragover', (event) => { if (this.draggingId !== null) event.preventDefault(); });
        grid.addEventListener('drop', (event) => {
            if ((event.target as HTMLElement).closest('.bookmark-tile, [data-drop-folder]')) return;
            event.preventDefault();
            const id = this.dragId(event);
            if (id !== null) void moveBookmark(id, this.folder);
        });
        this.querySelector('.launchpad')?.addEventListener('contextmenu', (event) => {
            const mouse = event as MouseEvent;
            const target = mouse.target as HTMLElement;
            const tile = target.closest<HTMLElement>('.tile:not(.add-tile), .launchpad-tab[data-folder]');
            if (!tile && !target.closest('.launchpad-grid')) return;
            event.preventDefault();
            // Keyboard-triggered menus (Shift+F10 / Menu key) report 0,0; anchor to the tile instead.
            const at = mouse.clientX || mouse.clientY ? { x: mouse.clientX, y: mouse.clientY } : (tile ?? target);
            if (tile) this.openTileMenu(tile, at);
            else if (this.view === 'bookmarks' && !this.query) openMenu([
                { label: '添加书签', icon: ICONS.plus, action: () => openBookmarkDialog(this, { folder: this.folder }) },
                { label: '新建文件夹', icon: ICONS.folderPlus, action: () => void createFolder() }
            ], at);
        });
    }

    private bindBookmark(card: HTMLAnchorElement): void {
        const id = card.dataset.bookmarkId ?? '';
        card.addEventListener('click', (event) => interceptExtensionLink(event, card.href));
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
            const target = findBookmark(id);
            if (sourceId !== null && sourceId !== id && target) void moveBookmark(sourceId, target.folder, id);
        });
    }

    private bindFolderDrop(target: HTMLElement): void {
        const folder = target.dataset.dropFolder ?? ROOT_FOLDER;
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
            if (id !== null) void moveBookmark(id, folder);
        });
    }

    private openTileMenu(tile: HTMLElement, at: { x: number; y: number } | HTMLElement): void {
        const folder = tile.dataset.folder;
        if (folder !== undefined) {
            if (folder === ROOT_FOLDER) return;
            openMenu([
                { label: '打开', icon: ICONS.open, action: () => this.show('bookmarks', folder) },
                { label: '重命名…', icon: ICONS.edit, action: () => void renameFolder(folder, (name) => { if (this.folder === folder || this.folder === name) this.folder = name; }) },
                { separator: true },
                { label: '删除文件夹', icon: ICONS.trash, danger: true, action: () => void deleteFolder(folder) }
            ], at);
            return;
        }
        if (tile.dataset.recentIndex !== undefined) {
            const site = this.recent.sites[Number(tile.dataset.recentIndex)];
            if (site) siteMenu(this, site, at);
            return;
        }
        const bookmark = findBookmark(tile.dataset.bookmarkId ?? '');
        if (bookmark) bookmarkMenu(this, bookmark, at);
    }

    private show(view: LaunchpadView, folder: string): void {
        if (view === this.view && folder === this.folder && !this.query) return;
        this.view = view;
        this.folder = folder;
        this.query = '';
        const search = this.querySelector<HTMLInputElement>('.launchpad-search input');
        if (search) search.value = '';
        this.render();
        this.querySelector<HTMLElement>('.launchpad-tab.is-active')?.focus({ preventScroll: true });
    }

    private async loadRecent(): Promise<void> {
        this.recent = { ...this.recent, state: 'loading', error: '' };
        try {
            this.recent = { sites: await loadRecentSites(), state: 'ready', error: '' };
        } catch (error) {
            this.recent = { sites: [], state: 'error', error: error instanceof Error && error.message ? error.message : '读取浏览记录失败' };
        }
        if (this.view === 'recent') this.render();
    }

    private dragId(event: DragEvent): Bookmark['id'] | null {
        return event.dataTransfer?.getData('text/plain') || this.draggingId;
    }
}
