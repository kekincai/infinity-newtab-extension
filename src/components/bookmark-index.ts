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
import { bindSiteIcons, siteIcon } from './site-icon';
import { type MenuAnchor, openMenu } from './ui-layer';

/** Rows every column starts with; more are added only when the columns would not fit the width. */
const MIN_ROWS = 4;
const ROW_HEIGHT = 28;
/** The index may grow up to this share of the window before it scrolls sideways instead. */
const MAX_HEIGHT_SHARE = 0.4;
const RECENT_LIMIT = 8;
/** The dragged bookmark's id travels under its own type; text/plain keeps the link's address for drops outside the page. */
const BOOKMARK_TYPE = 'application/x-newtab-bookmark';
/** CSS size of the favicons in the index, so the browser picks a matching resolution. */
const ICON_SIZE = 16;

/**
 * Every bookmark at once, as a text index along the bottom of the wallpaper:
 * one group per folder, small favicons, no tabs to switch.
 */
export class BookmarkIndex extends StoreElement {
    protected readonly observedChanges = ['bookmarks', 'folders', 'settings.layout'] as const;
    private draggingId: Bookmark['id'] | null = null;
    private listeners: AbortController | null = null;
    /** The control that last had focus in the index, by its `data-focus-key`, and its folder. */
    private lastFocus: { key: string; folder: string } | null = null;
    /** Refits when the footer gives the index a different width, e.g. once the pause button appears. */
    private readonly resizeObserver = new ResizeObserver(() => this.refit());
    /** The width and window height the rows were last fitted to. */
    private fittedSize = '';
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
        this.addEventListener('focusin', this.onFocusIn);
        this.addEventListener('focusout', this.onFocusOut);
        this.listeners = new AbortController();
        const { signal } = this.listeners;
        window.addEventListener('resize', this.refit, { signal });
        // Dialogs fire `close`, menus `toggle`; neither bubbles, so they are caught on the way down.
        document.addEventListener('close', this.onOverlayClosed, { capture: true, signal });
        document.addEventListener('toggle', (event) => {
            if ((event as ToggleEvent).newState === 'closed') this.onOverlayClosed();
        }, { capture: true, signal });
        this.resizeObserver.observe(this);
        super.connectedCallback();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.listeners?.abort();
        this.listeners = null;
        this.resizeObserver.disconnect();
    }

    protected render(): void {
        const { showBookmarks, showRecent } = appStore.state.settings.layout;
        this.hidden = !showBookmarks;
        if (this.hidden) return;
        if (showRecent && this.recent.state === 'idle') void this.loadRecent();
        const folders = appStore.state.folders.filter((folder) => folder !== ROOT_FOLDER);
        // A redraw replaces every link and button; whichever had focus keeps it, so moving a bookmark from the keyboard can go on step by step.
        // Taken before the old index goes: removing the focused link fires a focusout that clears it.
        const focus = this.contains(document.activeElement) ? this.lastFocus : null;
        this.innerHTML = `
            <nav class="index" aria-label="书签">
                ${this.groupTemplate(ROOT_FOLDER)}
                ${folders.map((folder) => this.groupTemplate(folder)).join('')}
                ${showRecent ? this.recentTemplate() : ''}
            </nav>`;
        bindSiteIcons(this);
        this.fit();
        if (focus) {
            this.lastFocus = focus;
            this.restoreFocus();
        }
    }

    /** Remembers the focused control by what it stands for, since a redraw replaces the element itself. */
    private readonly onFocusIn = (event: FocusEvent): void => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-focus-key]');
        if (target) this.lastFocus = { key: target.dataset.focusKey!, folder: target.closest<HTMLElement>('.index-group')?.dataset.folder ?? ROOT_FOLDER };
    };

    /** Focus that leaves for a menu or dialog it opened will come back here; leaving for anywhere else ends that. */
    private readonly onFocusOut = (event: FocusEvent): void => {
        const next = event.relatedTarget as Element | null;
        if (!next || !(this.contains(next) || next.closest('dialog, .context-menu'))) this.lastFocus = null;
    };

    /**
     * A menu or dialog opened from the index returns focus to its opener when it
     * closes, but a save may have redrawn the index meanwhile; focus then goes to
     * the same control in the new index, or to its folder if that control is gone.
     */
    private readonly onOverlayClosed = (): void => {
        requestAnimationFrame(() => {
            if (this.lastFocus && (document.activeElement === document.body || !document.activeElement)) this.restoreFocus();
        });
    };

    private restoreFocus(): void {
        if (!this.lastFocus) return;
        const { key, folder } = this.lastFocus;
        const group = this.querySelector<HTMLElement>(`.index-group[data-folder="${CSS.escape(folder)}"]`);
        const target = this.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`)
            ?? group?.querySelector<HTMLElement>('[data-bookmark-id], .index-more, [data-add-folder]')
            ?? this.querySelector<HTMLElement>('[data-focus-key]');
        target?.focus({ preventScroll: true });
    }

    private groupTemplate(folder: string): string {
        const bookmarks = bookmarksIn(folder);
        const label = escapeHtml(folderLabel(folder));
        const key = escapeHtml(folder);
        const empty = bookmarks.length ? ''
            : folder === ROOT_FOLDER && !appStore.state.bookmarks.length
                ? `<li><button class="index-link index-first" type="button" data-add-folder="${key}" data-focus-key="first">${ICONS.plus}添加第一个书签</button></li>`
                : '<li class="index-note">拖书签到这里</li>';
        // The heading holds only the folder name; its buttons sit beside it, so they are not read as part of it.
        return `
            <section class="index-group" data-folder="${key}">
                <div class="index-heading">
                    <h2 class="index-title">${label}</h2>
                    <button class="index-action" type="button" data-add-folder="${key}" data-focus-key="add:${key}" aria-label="添加书签到“${label}”" title="添加书签">${ICONS.plus}</button>
                    <button class="index-action index-more" type="button" data-focus-key="more:${key}" aria-haspopup="menu" aria-expanded="false" aria-label="“${label}”的更多操作" title="更多操作">${ICONS.more}</button>
                </div>
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
                data-bookmark-id="${escapeHtml(bookmark.id)}" data-focus-key="bookmark:${escapeHtml(bookmark.id)}" draggable="true" title="${escapeHtml(name)}&#10;${escapeHtml(bookmark.url)}">
                ${siteIcon({ url: bookmark.url, name: bookmark.name, bookmark }, 'index-icon', ICON_SIZE)}<span class="index-name">${escapeHtml(name)}</span>
            </a></li>`;
    }

    private recentTemplate(): string {
        const { sites, state } = this.recent;
        const items = state === 'ready'
            ? sites.slice(0, RECENT_LIMIT).map((site, index) => `
                <li><a class="index-link" href="${escapeHtml(site.url)}" ${this.target()} rel="noopener noreferrer" data-recent-index="${index}" title="${escapeHtml(site.host)}">
                    ${siteIcon({ url: site.url, name: site.title }, 'index-icon', ICON_SIZE)}<span class="index-name">${escapeHtml(site.title)}</span>
                </a></li>`).join('')
            : '';
        const note = state === 'error' ? escapeHtml(this.recent.error)
            : state === 'ready' && !items ? '最近 30 天没有记录'
                : state === 'ready' ? '' : '正在整理…';
        return `
            <section class="index-group is-recent">
                <div class="index-heading"><h2 class="index-title">常访问</h2></div>
                <ul class="index-list">${items}${note ? `<li class="index-note">${note}</li>` : ''}</ul>
            </section>`;
    }

    private target(): string {
        return appStore.state.settings.layout.openInNewTab ? 'target="_blank"' : '';
    }

    private sizeKey(): string {
        return `${this.getBoundingClientRect().width}x${window.innerHeight}`;
    }

    /** A window resize and the resize observer both land here; only a real size change refits. */
    private readonly refit = (): void => {
        if (this.sizeKey() !== this.fittedSize) this.fit();
    };

    /**
     * The fewest rows (from MIN_ROWS, up to a share of the window) at which every
     * column fits the width; past that the index scrolls sideways. More rows only
     * ever narrow the index, so a binary search needs a few layouts, not one per row.
     */
    private fit(): void {
        const index = this.querySelector<HTMLElement>('.index');
        if (!index) return;
        this.fittedSize = this.sizeKey();
        const longest = Math.max(MIN_ROWS, ...[...index.querySelectorAll('.index-list')].map((list) => list.childElementCount));
        const maxRows = Math.min(longest, Math.max(MIN_ROWS, Math.floor(window.innerHeight * MAX_HEIGHT_SHARE / ROW_HEIGHT)));
        const fits = (rows: number) => {
            index.style.setProperty('--rows', String(rows));
            return index.scrollWidth <= index.clientWidth + 1;
        };
        let low = MIN_ROWS;
        let high = maxRows;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (fits(middle)) high = middle;
            else low = middle + 1;
        }
        index.style.setProperty('--rows', String(low));
    }

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
        const label = `“${folderLabel(folder)}”的操作`;
        if (folder === ROOT_FOLDER) {
            openMenu([add, create], at, label);
            return;
        }
        openMenu([
            add,
            { label: '重命名…', icon: ICONS.edit, action: () => void renameFolder(folder) },
            create,
            { separator: true },
            { label: '删除文件夹', icon: ICONS.trash, danger: true, action: () => void deleteFolder(folder) }
        ], at, label);
    }

    private readonly onDragStart = (event: DragEvent): void => {
        const link = (event.target as HTMLElement).closest<HTMLElement>('[data-bookmark-id]');
        if (!link) return;
        this.draggingId = link.dataset.bookmarkId ?? null;
        event.dataTransfer?.setData(BOOKMARK_TYPE, this.draggingId ?? '');
        // Copy and link let other apps take the address; inside the index the drop is always a move.
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
        link.classList.add('is-dragging');
        this.classList.add('is-dragging');
    };

    /**
     * A bookmark under the pointer takes the drop (reorder): its upper half puts
     * the dragged one above it, its lower half below. Elsewhere the whole folder
     * group takes it (move to the end).
     */
    private readonly onDragOver = (event: DragEvent): void => {
        if (this.draggingId === null) return;
        const target = this.dropTarget(event);
        if (!target) {
            this.clearDropTargets();
            return;
        }
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        const side = target.dataset.bookmarkId ? (this.dropsAfter(target, event) ? 'drop-after' : 'drop-before') : '';
        if (target.classList.contains('drop-target') && (!side || target.classList.contains(side))) return;
        this.clearDropTargets();
        target.classList.add('drop-target');
        if (side) target.classList.add(side);
    };

    private readonly onDragLeave = (event: DragEvent): void => {
        if (!this.contains(event.relatedTarget as Node | null)) this.clearDropTargets();
    };

    private readonly onDrop = (event: DragEvent): void => {
        const target = this.dropTarget(event);
        const id = event.dataTransfer?.getData(BOOKMARK_TYPE) || this.draggingId;
        this.clearDropTargets();
        if (!target || id === null) return;
        event.preventDefault();
        const group = target.closest<HTMLElement>('.index-group');
        let folder = group?.dataset.folder ?? ROOT_FOLDER;
        let before: string | undefined;
        if (target.dataset.bookmarkId) {
            folder = findBookmark(target.dataset.bookmarkId)?.folder ?? folder;
            // Below a bookmark means in front of the next one (skipping the dragged one), or at the end.
            const links = this.bookmarkLinks(group);
            before = this.dropsAfter(target, event)
                ? links.slice(links.indexOf(target) + 1).find((link) => String(link.dataset.bookmarkId) !== String(id))?.dataset.bookmarkId
                : target.dataset.bookmarkId;
        }
        this.placeDragged(String(id), group, before);
        void moveBookmark(id, folder, before).then((saved) => { if (!saved) this.render(); });
    };

    /** Lower half of a bookmark: the drop goes below it. */
    private dropsAfter(link: HTMLElement, event: DragEvent): boolean {
        const box = link.getBoundingClientRect();
        return event.clientY > box.top + box.height / 2;
    }

    private bookmarkLinks(group: HTMLElement | null): HTMLElement[] {
        return [...(group?.querySelectorAll<HTMLElement>('[data-bookmark-id]') ?? [])];
    }

    /**
     * Puts the dropped row where it landed straight away, rather than leaving it
     * at its old place until the save comes back and the index is redrawn.
     */
    private placeDragged(id: string, group: HTMLElement | null, before: string | undefined): void {
        const row = this.querySelector<HTMLElement>(`[data-bookmark-id="${CSS.escape(id)}"]`)?.closest('li');
        const list = group?.querySelector<HTMLElement>('.index-list');
        if (!row || !list) return;
        const anchor = before ? list.querySelector<HTMLElement>(`[data-bookmark-id="${CSS.escape(before)}"]`)?.closest('li') : null;
        if (anchor) list.insertBefore(row, anchor);
        else list.insertBefore(row, list.querySelector('.index-note, li:has(.index-first)'));
        row.querySelector('.is-dragging')?.classList.remove('is-dragging');
    }

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
        this.querySelectorAll('.drop-target').forEach((item) => item.classList.remove('drop-target', 'drop-before', 'drop-after'));
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
