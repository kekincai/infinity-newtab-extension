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
    createFolder,
    deleteFolder,
    findBookmark,
    folderLabel,
    interceptExtensionLink,
    moveBookmark,
    openBookmarkDialog,
    renameFolder,
    siteMenu
} from './bookmark-actions';
import { ICONS } from './icons';
import { bindSiteIcons, hostOf, siteIcon } from './site-icon';
import { openMenu } from './ui-layer';

/** Rows every column starts with; more are added only when the columns would not fit the width. */
const MIN_ROWS = 4;
const ROW_HEIGHT = 28;
/** The index may grow up to this share of the window before it scrolls sideways instead. */
const MAX_HEIGHT_SHARE = 0.4;
const RECENT_LIMIT = 8;

type MenuAnchor = { x: number; y: number } | HTMLElement;

/**
 * Every bookmark at once, as a text index along the bottom of the wallpaper:
 * one group per folder, small favicons, no tabs to switch.
 */
export class BookmarkIndex extends StoreElement {
    protected readonly observedChanges = ['bookmarks', 'folders', 'settings.layout'] as const;
    private draggingId: Bookmark['id'] | null = null;
    /** Refits when the footer gives the index a different width, e.g. once the wallpaper caption appears. */
    private readonly resizeObserver = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width === this.fittedWidth) return;
        this.fit();
    });
    private fittedWidth = 0;
    private recent: { sites: RecentSite[]; state: 'idle' | 'loading' | 'ready' | 'error'; error: string } = { sites: [], state: 'idle', error: '' };

    connectedCallback(): void {
        this.addEventListener('click', this.onClick);
        this.addEventListener('contextmenu', this.onContextMenu);
        this.addEventListener('dragstart', this.onDragStart);
        this.addEventListener('dragover', this.onDragOver);
        this.addEventListener('dragleave', this.onDragLeave);
        this.addEventListener('drop', this.onDrop);
        this.addEventListener('dragend', this.onDragEnd);
        this.addEventListener('wheel', this.onWheel, { passive: false });
        window.addEventListener('resize', this.fit);
        this.resizeObserver.observe(this);
        super.connectedCallback();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener('resize', this.fit);
        this.resizeObserver.disconnect();
    }

    protected render(): void {
        const { showBookmarks, showRecent } = appStore.state.settings.layout;
        this.hidden = !showBookmarks;
        if (this.hidden) return;
        if (showRecent && this.recent.state === 'idle') void this.loadRecent();
        const folders = appStore.state.folders.filter((folder) => folder !== ROOT_FOLDER);
        this.innerHTML = `
            <nav class="index" aria-label="书签">
                ${this.groupTemplate(ROOT_FOLDER)}
                ${folders.map((folder) => this.groupTemplate(folder)).join('')}
                ${showRecent ? this.recentTemplate() : ''}
            </nav>`;
        bindSiteIcons(this);
        this.querySelector('.index')?.addEventListener('scroll', this.syncEdges, { passive: true });
        this.fit();
    }

    private groupTemplate(folder: string): string {
        const bookmarks = bookmarksIn(folder);
        const label = escapeHtml(folderLabel(folder));
        const empty = bookmarks.length ? ''
            : folder === ROOT_FOLDER && !appStore.state.bookmarks.length
                ? `<li><button class="index-link index-first" type="button" data-add-folder="${escapeHtml(folder)}">${ICONS.plus}添加第一个书签</button></li>`
                : '<li class="index-note">拖书签到这里</li>';
        return `
            <section class="index-group" data-folder="${escapeHtml(folder)}" aria-label="${label}">
                <h2 class="index-heading">
                    <span class="index-title">${label}</span>
                    <button class="index-action" type="button" data-add-folder="${escapeHtml(folder)}" aria-label="添加书签到“${label}”" title="添加书签">${ICONS.plus}</button>
                    <button class="index-action index-more" type="button" aria-label="“${label}”的更多操作" title="更多操作">${ICONS.more}</button>
                </h2>
                <ul class="index-list">
                    ${bookmarks.map((bookmark) => this.bookmarkTemplate(bookmark)).join('')}
                    ${empty}
                </ul>
            </section>`;
    }

    private bookmarkTemplate(bookmark: Bookmark): string {
        const name = bookmarkName(bookmark);
        return `
            <li><a class="index-link" href="${escapeHtml(bookmark.url)}" ${this.target()} rel="noopener noreferrer"
                data-bookmark-id="${escapeHtml(bookmark.id)}" draggable="true" title="${escapeHtml(name)}&#10;${escapeHtml(bookmark.url)}">
                ${siteIcon({ url: bookmark.url, name: bookmark.name, bookmark }, 'index-icon')}<span class="index-name">${escapeHtml(name)}</span>
            </a></li>`;
    }

    private recentTemplate(): string {
        const { sites, state } = this.recent;
        const items = state === 'ready'
            ? sites.slice(0, RECENT_LIMIT).map((site, index) => `
                <li><a class="index-link" href="${escapeHtml(site.url)}" ${this.target()} rel="noopener noreferrer" data-recent-index="${index}" title="${escapeHtml(hostOf(site.url))}">
                    ${siteIcon({ url: site.url, name: site.title }, 'index-icon')}<span class="index-name">${escapeHtml(site.title)}</span>
                </a></li>`).join('')
            : '';
        const note = state === 'error' ? escapeHtml(this.recent.error)
            : state === 'ready' && !items ? '最近 30 天没有记录'
                : state === 'ready' ? '' : '正在整理…';
        return `
            <section class="index-group is-recent" aria-label="常访问">
                <h2 class="index-heading"><span class="index-title">常访问</span></h2>
                <ul class="index-list">${items}${note ? `<li class="index-note">${note}</li>` : ''}</ul>
            </section>`;
    }

    private target(): string {
        return appStore.state.settings.layout.openInNewTab ? 'target="_blank"' : '';
    }

    /** Adds rows until every column fits the width, up to a share of the window; past that the index scrolls sideways. */
    private readonly fit = (): void => {
        const index = this.querySelector<HTMLElement>('.index');
        if (!index) return;
        this.fittedWidth = this.getBoundingClientRect().width;
        const longest = Math.max(MIN_ROWS, ...[...index.querySelectorAll('.index-list')].map((list) => list.childElementCount));
        const maxRows = Math.min(longest, Math.max(MIN_ROWS, Math.floor(window.innerHeight * MAX_HEIGHT_SHARE / ROW_HEIGHT)));
        let rows = MIN_ROWS;
        index.style.setProperty('--rows', String(rows));
        while (rows < maxRows && index.scrollWidth > index.clientWidth + 1) {
            rows += 1;
            index.style.setProperty('--rows', String(rows));
        }
        this.syncEdges();
    };

    /** Fades only the edges that have columns scrolled past them. */
    private readonly syncEdges = (): void => {
        const index = this.querySelector<HTMLElement>('.index');
        if (!index) return;
        index.classList.toggle('can-scroll-left', index.scrollLeft > 1);
        index.classList.toggle('can-scroll-right', index.scrollLeft + index.clientWidth < index.scrollWidth - 1);
    };

    /** A mouse wheel scrolls an overflowing index sideways. */
    private readonly onWheel = (event: WheelEvent): void => {
        const index = this.querySelector<HTMLElement>('.index');
        if (!index || index.scrollWidth <= index.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
        event.preventDefault();
        index.scrollLeft += event.deltaY;
    };

    private readonly onClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const add = target.closest<HTMLElement>('[data-add-folder]');
        if (add) {
            openBookmarkDialog(this, { folder: add.dataset.addFolder ?? ROOT_FOLDER });
            return;
        }
        const more = target.closest<HTMLElement>('.index-more');
        if (more) {
            this.openFolderMenu(more.closest<HTMLElement>('.index-group')?.dataset.folder ?? ROOT_FOLDER, more);
            return;
        }
        const link = target.closest<HTMLAnchorElement>('a.index-link');
        if (link) interceptExtensionLink(event, link.href);
    };

    private readonly onContextMenu = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        if (!target.closest('.index')) return;
        event.preventDefault();
        const link = target.closest<HTMLElement>('.index-link');
        const group = target.closest<HTMLElement>('.index-group');
        // Keyboard-triggered menus (Shift+F10 / Menu key) report 0,0; anchor to the element instead.
        const at: MenuAnchor = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : (link ?? group ?? target);
        if (link?.dataset.recentIndex !== undefined) {
            const site = this.recent.sites[Number(link.dataset.recentIndex)];
            if (site) siteMenu(this, site, at);
            return;
        }
        const bookmark = link?.dataset.bookmarkId ? findBookmark(link.dataset.bookmarkId) : undefined;
        if (bookmark) bookmarkMenu(this, bookmark, at);
        else if (group && !group.classList.contains('is-recent')) this.openFolderMenu(group.dataset.folder ?? ROOT_FOLDER, at);
    };

    private openFolderMenu(folder: string, at: MenuAnchor): void {
        const add = { label: '添加书签…', icon: ICONS.plus, action: () => openBookmarkDialog(this, { folder }) };
        const create = { label: '新建文件夹…', icon: ICONS.folderPlus, action: () => void createFolder() };
        if (folder === ROOT_FOLDER) {
            openMenu([add, create], at);
            return;
        }
        openMenu([
            add,
            { label: '重命名…', icon: ICONS.edit, action: () => void renameFolder(folder) },
            create,
            { separator: true },
            { label: '删除文件夹', icon: ICONS.trash, danger: true, action: () => void deleteFolder(folder) }
        ], at);
    }

    private readonly onDragStart = (event: DragEvent): void => {
        const link = (event.target as HTMLElement).closest<HTMLElement>('[data-bookmark-id]');
        if (!link) return;
        this.draggingId = link.dataset.bookmarkId ?? null;
        event.dataTransfer?.setData('text/plain', this.draggingId ?? '');
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        link.classList.add('is-dragging');
        this.classList.add('is-dragging');
    };

    /** A bookmark under the pointer takes the drop (reorder); otherwise its whole folder group does (move). */
    private readonly onDragOver = (event: DragEvent): void => {
        if (this.draggingId === null) return;
        const target = this.dropTarget(event);
        if (!target) return;
        event.preventDefault();
        if (target.classList.contains('drop-target')) return;
        this.clearDropTargets();
        target.classList.add('drop-target');
    };

    private readonly onDragLeave = (event: DragEvent): void => {
        if (!this.contains(event.relatedTarget as Node | null)) this.clearDropTargets();
    };

    private readonly onDrop = (event: DragEvent): void => {
        const target = this.dropTarget(event);
        const id = event.dataTransfer?.getData('text/plain') || this.draggingId;
        this.clearDropTargets();
        if (!target || id === null) return;
        event.preventDefault();
        const folder = target.closest<HTMLElement>('.index-group')?.dataset.folder ?? ROOT_FOLDER;
        const before = target.dataset.bookmarkId;
        void moveBookmark(id, before ? findBookmark(before)?.folder ?? folder : folder, before);
    };

    private readonly onDragEnd = (): void => {
        this.draggingId = null;
        this.classList.remove('is-dragging');
        this.querySelectorAll('.is-dragging').forEach((item) => item.classList.remove('is-dragging'));
        this.clearDropTargets();
    };

    private dropTarget(event: DragEvent): HTMLElement | null {
        const target = event.target as HTMLElement;
        const link = target.closest<HTMLElement>('[data-bookmark-id]');
        if (link) return String(link.dataset.bookmarkId) === String(this.draggingId) ? null : link;
        return target.closest<HTMLElement>('.index-group[data-folder]');
    }

    private clearDropTargets(): void {
        this.querySelectorAll('.drop-target').forEach((item) => item.classList.remove('drop-target'));
    }

    private async loadRecent(): Promise<void> {
        this.recent = { ...this.recent, state: 'loading', error: '' };
        try {
            this.recent = { sites: await loadRecentSites(), state: 'ready', error: '' };
        } catch (error) {
            this.recent = { sites: [], state: 'error', error: error instanceof Error && error.message ? error.message : '读取浏览记录失败' };
        }
        if (this.isConnected) this.render();
    }
}
