import { loadRecentSites } from '../core/history';
import { appStore } from '../core/store';
import type { RecentSite } from '../core/types';
import { escapeHtml } from '../core/utils';
import { StoreElement } from './base';
import {
    ROOT_FOLDER,
    bookmarkMenu,
    bookmarkName,
    bookmarksIn,
    findBookmark,
    interceptExtensionLink,
    openBookmarkDialog,
    siteMenu
} from './bookmark-actions';
import { ICONS } from './icons';
import { bindSiteIcons, siteIcon } from './site-icon';

const MAX_ITEMS = 12;

/** Bottom Dock: the bookmarks kept in “全部” (or the most visited sites), then shortcuts into the launchpad. */
export class HomeDock extends StoreElement {
    protected readonly observedChanges = ['bookmarks', 'settings.layout'] as const;
    private sites: RecentSite[] | null = null;

    protected render(): void {
        const { showBookmarks, dockSource, dockSize, dockMagnify, openInNewTab } = appStore.state.settings.layout;
        this.hidden = !showBookmarks;
        if (this.hidden) {
            this.innerHTML = '';
            return;
        }
        this.style.setProperty('--dock-size', `${dockSize}px`);
        this.classList.toggle('is-magnifying', dockMagnify);
        const target = openInNewTab ? 'target="_blank"' : '';
        let items = '';
        if (dockSource === 'recent') {
            if (!this.sites) void this.loadSites();
            items = (this.sites ?? []).slice(0, MAX_ITEMS).map((site, index) => `
                <a class="dock-item" href="${escapeHtml(site.url)}" ${target} rel="noopener noreferrer" data-site-index="${index}" data-liquid-item aria-label="${escapeHtml(site.title)}" draggable="false">
                    ${siteIcon({ url: site.url, name: site.title })}
                    <span class="dock-label glass glass-dark" aria-hidden="true">${escapeHtml(site.title)}</span>
                </a>`).join('');
        } else {
            const bookmarks = bookmarksIn(ROOT_FOLDER).slice(0, MAX_ITEMS);
            items = bookmarks.map((bookmark) => `
                <a class="dock-item" href="${escapeHtml(bookmark.url)}" ${target} rel="noopener noreferrer" data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item aria-label="${escapeHtml(bookmarkName(bookmark))}" draggable="false">
                    ${siteIcon({ url: bookmark.url, name: bookmark.name, bookmark })}
                    <span class="dock-label glass glass-dark" aria-hidden="true">${escapeHtml(bookmarkName(bookmark))}</span>
                </a>`).join('');
            if (!bookmarks.length) items = `
                <button class="dock-item dock-add" type="button" data-liquid-item aria-label="添加书签">
                    <span class="app-icon app-icon-glass">${ICONS.plus}</span>
                    <span class="dock-label glass glass-dark" aria-hidden="true">添加书签</span>
                </button>`;
        }
        this.innerHTML = `
            <nav class="glass dock" aria-label="常用书签">
                ${items}
                <span class="dock-divider" aria-hidden="true"></span>
                    <button class="dock-item dock-recent" type="button" data-liquid-item aria-label="常访问">
                        <span class="app-icon app-icon-glass">${ICONS.clock}</span>
                        <span class="dock-label glass glass-dark" aria-hidden="true">常访问</span>
                    </button>
                    <button class="dock-item dock-all" type="button" data-liquid-item aria-label="全部书签">
                        <span class="app-icon app-icon-glass">${ICONS.grid}</span>
                        <span class="dock-label glass glass-dark" aria-hidden="true">全部书签</span>
                    </button>
            </nav>`;
        bindSiteIcons(this);
        this.bindEvents();
    }

    private bindEvents(): void {
        this.querySelector('.dock-recent')?.addEventListener('click', () => this.openLaunchpad('recent'));
        this.querySelector('.dock-all')?.addEventListener('click', () => this.openLaunchpad('bookmarks'));
        this.querySelector('.dock-add')?.addEventListener('click', (event) => openBookmarkDialog(event.currentTarget as HTMLElement, { folder: ROOT_FOLDER }));
        this.querySelectorAll<HTMLAnchorElement>('.dock-item[data-bookmark-id]').forEach((item) => {
            item.addEventListener('click', (event) => interceptExtensionLink(event, item.href));
        });
        this.querySelector('.dock')?.addEventListener('contextmenu', (event) => {
            const mouse = event as MouseEvent;
            const item = (mouse.target as HTMLElement).closest<HTMLElement>('.dock-item');
            const at = mouse.clientX || mouse.clientY ? { x: mouse.clientX, y: mouse.clientY } : item;
            if (!item || !at) return;
            const bookmark = item.dataset.bookmarkId ? findBookmark(item.dataset.bookmarkId) : undefined;
            const site = item.dataset.siteIndex !== undefined ? this.sites?.[Number(item.dataset.siteIndex)] : undefined;
            if (!bookmark && !site) return;
            event.preventDefault();
            if (bookmark) bookmarkMenu(this, bookmark, at);
            else if (site) siteMenu(this, site, at);
        });
    }

    private openLaunchpad(view: 'bookmarks' | 'recent'): void {
        this.dispatchEvent(new CustomEvent('open-launchpad', { bubbles: true, composed: true, detail: { view } }));
    }

    private async loadSites(): Promise<void> {
        this.sites = [];
        try {
            this.sites = await loadRecentSites();
        } catch {
            this.sites = [];
        }
        this.render();
    }
}
