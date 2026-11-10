import { loadRecentSites } from '../core/history';
import { appStore } from '../core/store';
import type { Bookmark, RecentSite, SearchEngineKey } from '../core/types';
import { escapeHtml, normalizeUrl } from '../core/utils';
import { ROOT_FOLDER, bookmarkName, folderLabel, openInNewTab } from './bookmark-actions';
import { StoreElement } from './base';
import { ICONS } from './icons';
import { bindSiteIcons, hostOf, siteIcon } from './site-icon';

export const ENGINES: Record<SearchEngineKey, { label: string; url: string }> = {
    google: { label: 'Google', url: 'https://www.google.com/search?q=' },
    bing: { label: 'Bing', url: 'https://www.bing.com/search?q=' },
    baidu: { label: '百度', url: 'https://www.baidu.com/s?wd=' },
    duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' }
};

export const SHORTCUT_LABEL = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

const ENGINE_ORDER = Object.keys(ENGINES) as SearchEngineKey[];
const GROUP_TITLES = { url: '网址', bookmark: '书签', site: '常访问', web: '搜索网络', recent: '最近搜索' } as const;
/** CSS size of a result's site icon, so the favicon picked from the srcset matches it. */
const ROW_ICON_SIZE = 20;

type Row =
    | { kind: 'url'; title: string; subtitle: string; url: string }
    | { kind: 'bookmark'; title: string; subtitle: string; url: string; bookmark: Bookmark }
    | { kind: 'site'; title: string; subtitle: string; url: string }
    | { kind: 'web'; title: string; subtitle: string; query: string }
    | { kind: 'recent'; title: string; subtitle: string; query: string };

/**
 * The home search field: type straight into it. Bookmarks, frequent sites and
 * recent searches drop down under it, with a web search for anything else.
 */
export class SearchBox extends StoreElement {
    protected readonly observedChanges = ['settings.layout'] as const;
    private engine: SearchEngineKey = 'google';
    private rows: Row[] = [];
    private selected = 0;
    private sites: RecentSite[] = [];
    /** Shown by the keyboard shortcut while the setting keeps the field hidden. */
    private summoned = false;

    protected render(): void {
        const { showSearch } = appStore.state.settings.layout;
        this.hidden = !showSearch && !this.summoned;
        if (this.querySelector('.search-field')) return;
        this.innerHTML = `
            <div class="search-box" role="search">
                <label class="glass search-field" data-glass>
                    ${ICONS.search}
                    <span class="search-input">
                        <span class="search-ghost" aria-hidden="true"><span class="ghost-typed"></span><span class="ghost-rest"></span></span>
                        <input type="text" autocomplete="off" spellcheck="false" placeholder="搜索或输入网址" aria-label="搜索或输入网址"
                            role="combobox" aria-expanded="false" aria-controls="search-results" aria-autocomplete="list"
                            aria-keyshortcuts="${SHORTCUT_LABEL === '⌘K' ? 'Meta+K' : 'Control+K'} /">
                    </span>
                    <button class="search-engine" type="button" tabindex="-1" title="切换搜索引擎（Tab）"></button>
                    <kbd class="search-shortcut">${SHORTCUT_LABEL}</kbd>
                </label>
                <div class="glass-panel search-results" id="search-results" role="listbox" aria-label="搜索建议" hidden></div>
            </div>`;
        this.bind();
    }

    /** Puts the caret in the field, showing it first when the setting hides it. */
    focusField(): void {
        if (this.hidden) {
            this.summoned = true;
            this.hidden = false;
        }
        this.input.focus();
    }

    get hasFocus(): boolean {
        return this.contains(document.activeElement);
    }

    private get input(): HTMLInputElement {
        return this.querySelector<HTMLInputElement>('.search-field input')!;
    }

    private get results(): HTMLElement {
        return this.querySelector<HTMLElement>('.search-results')!;
    }

    private bind(): void {
        const input = this.input;
        input.addEventListener('focus', this.onFocus);
        input.addEventListener('input', () => {
            this.selected = 0;
            this.renderResults();
        });
        input.addEventListener('keydown', this.onKeyDown);
        this.addEventListener('focusout', (event) => {
            if (this.contains(event.relatedTarget as Node | null)) return;
            this.closeResults();
            if (this.summoned && !input.value) {
                this.summoned = false;
                this.render();
            }
        });
        // Picking with the mouse keeps the caret in the field.
        this.results.addEventListener('pointerdown', (event) => event.preventDefault());
        this.results.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const row = target.closest<HTMLElement>('[data-index]');
            if (!row) return;
            const item = this.rows[Number(row.dataset.index)];
            if (target.closest('.row-remove') && item?.kind === 'recent') {
                void appStore.removeRecentSearch(item.query).then(() => this.renderResults());
                return;
            }
            this.activate(Number(row.dataset.index), event.metaKey || event.ctrlKey);
        });
        this.results.addEventListener('pointermove', (event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
            const index = row ? Number(row.dataset.index) : -1;
            if (index >= 0 && index !== this.selected) this.select(index);
        });
        const engine = this.querySelector<HTMLButtonElement>('.search-engine')!;
        engine.addEventListener('pointerdown', (event) => event.preventDefault());
        engine.addEventListener('click', () => this.cycleEngine(1));
    }

    private readonly onFocus = (): void => {
        this.engine = appStore.state.settings.layout.searchEngine;
        this.selected = 0;
        this.renderResults();
        if (!appStore.state.settings.layout.showRecent || this.sites.length) return;
        void loadRecentSites().then((sites) => {
            this.sites = sites;
            if (this.hasFocus) this.renderResults();
        }).catch(() => undefined);
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.isComposing) return;
        const input = this.input;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.rows.length) this.select((this.selected + (event.key === 'ArrowDown' ? 1 : -1) + this.rows.length) % this.rows.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.activate(this.selected, event.metaKey || event.ctrlKey);
        } else if (event.key === 'Tab' && !event.shiftKey && input.value.trim()) {
            event.preventDefault();
            this.cycleEngine(1);
        } else if (event.key === 'ArrowRight' && this.ghostRest() && input.selectionStart === input.value.length) {
            event.preventDefault();
            input.value += this.ghostRest();
            this.selected = 0;
            this.renderResults();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            if (input.value) {
                input.value = '';
                this.renderResults();
            } else {
                input.blur();
            }
        }
    };

    private buildRows(): Row[] {
        const raw = this.input.value.trim();
        const query = raw.toLowerCase();
        const rows: Row[] = [];
        const engine = ENGINES[this.engine].label;
        const showSites = appStore.state.settings.layout.showRecent;
        if (!query) {
            if (showSites) this.sites.slice(0, 4).forEach((site) => rows.push(siteRow(site)));
            appStore.state.recentSearches.slice(0, 5).forEach((item) => rows.push({ kind: 'recent', title: item, subtitle: '', query: item }));
            return rows;
        }

        if (looksLikeUrl(raw)) {
            const url = normalizeUrl(raw);
            if (url) rows.push({ kind: 'url', title: hostOf(url) || url, subtitle: url, url });
        }
        const bookmarks = appStore.state.bookmarks
            .map((bookmark) => ({ bookmark, score: matchScore(query, bookmarkName(bookmark), bookmark.url) }))
            .filter((item) => item.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, 5);
        bookmarks.forEach(({ bookmark }) => rows.push({
            kind: 'bookmark',
            title: bookmarkName(bookmark),
            subtitle: `${hostOf(bookmark.url)}${bookmark.folder !== ROOT_FOLDER ? ` · ${folderLabel(bookmark.folder)}` : ''}`,
            url: bookmark.url,
            bookmark
        }));
        if (showSites) {
            const bookmarkedHosts = new Set(bookmarks.map(({ bookmark }) => hostOf(bookmark.url)));
            this.sites
                .filter((site) => !bookmarkedHosts.has(site.host) && matchScore(query, site.title, site.url) > 0)
                .slice(0, 3)
                .forEach((site) => rows.push(siteRow(site)));
        }
        rows.push({ kind: 'web', title: raw, subtitle: `在 ${engine} 中搜索`, query: raw });
        appStore.state.recentSearches
            .filter((item) => item.toLowerCase().includes(query) && item.toLowerCase() !== query)
            .slice(0, 4)
            .forEach((item) => rows.push({ kind: 'recent', title: item, subtitle: '', query: item }));
        return rows;
    }

    private renderResults(): void {
        if (!this.hasFocus) return;
        this.rows = this.buildRows();
        this.selected = Math.min(this.selected, Math.max(0, this.rows.length - 1));
        let previous = '';
        this.results.innerHTML = this.rows.map((row, index) => {
            const heading = row.kind !== previous ? `<h3 class="search-heading" role="presentation">${GROUP_TITLES[row.kind]}</h3>` : '';
            previous = row.kind;
            return `${heading}
                <div class="search-row" role="option" id="search-option-${index}" data-index="${index}" aria-selected="false">
                    ${rowIcon(row)}
                    <span class="row-text"><strong>${escapeHtml(row.title)}</strong>${row.subtitle ? `<small>${escapeHtml(row.subtitle)}</small>` : ''}</span>
                    ${row.kind === 'recent' ? '<button class="row-remove" type="button" tabindex="-1" aria-label="删除这条记录">删除</button>' : ''}
                </div>`;
        }).join('');
        this.results.hidden = !this.rows.length;
        this.input.setAttribute('aria-expanded', String(!this.results.hidden));
        this.classList.toggle('is-open', !this.results.hidden);
        bindSiteIcons(this.results);
        this.syncEngine();
        this.select(this.selected);
    }

    private closeResults(): void {
        this.results.hidden = true;
        this.classList.remove('is-open');
        this.input.setAttribute('aria-expanded', 'false');
        this.input.removeAttribute('aria-activedescendant');
        this.querySelector('.ghost-typed')!.textContent = '';
        this.querySelector('.ghost-rest')!.textContent = '';
    }

    private select(index: number): void {
        this.selected = index;
        this.results.querySelectorAll<HTMLElement>('.search-row').forEach((row) => {
            const active = Number(row.dataset.index) === index;
            row.classList.toggle('is-selected', active);
            row.setAttribute('aria-selected', String(active));
            if (active) row.scrollIntoView({ block: 'nearest' });
        });
        if (this.rows[index]) this.input.setAttribute('aria-activedescendant', `search-option-${index}`);
        else this.input.removeAttribute('aria-activedescendant');
        const rest = this.ghostRest();
        this.querySelector('.ghost-typed')!.textContent = rest ? this.input.value : '';
        this.querySelector('.ghost-rest')!.textContent = rest;
    }

    /** Inline completion of the top hit's host name, accepted with →. */
    private ghostRest(): string {
        const typed = this.input.value;
        const row = this.rows[this.selected];
        if (this.selected !== 0 || !typed || /\s/.test(typed) || !row || (row.kind !== 'bookmark' && row.kind !== 'site')) return '';
        const host = hostOf(row.url);
        return host.toLowerCase().startsWith(typed.toLowerCase()) && host.length > typed.length ? host.slice(typed.length) : '';
    }

    private activate(index: number, background: boolean): void {
        const row = this.rows[index];
        if (!row) {
            const query = this.input.value.trim();
            if (query) this.search(query, background);
            return;
        }
        if (row.kind === 'web' || row.kind === 'recent') {
            this.search(row.query, background);
            return;
        }
        this.go(row.url, background || appStore.state.settings.layout.openInNewTab || new URL(row.url).protocol === 'chrome-extension:');
    }

    /** ⌘/Ctrl+Enter or ⌘/Ctrl-click opens the result in a background tab and keeps this page. */
    private go(url: string, newTab: boolean): void {
        if (!newTab) {
            window.location.href = url;
            return;
        }
        openInNewTab(url);
        this.input.value = '';
        this.input.blur();
    }

    /** A failed save of the recent search never stops the search itself. */
    private search(query: string, newTab = false): void {
        const target = `${ENGINES[this.engine].url}${encodeURIComponent(query)}`;
        const save = appStore.state.settings.layout.saveSearches ? appStore.saveRecentSearch(query) : Promise.resolve();
        void save.catch(() => undefined).then(() => this.go(target, newTab));
    }

    private cycleEngine(step: number): void {
        const index = ENGINE_ORDER.indexOf(this.engine);
        this.engine = ENGINE_ORDER[(index + step + ENGINE_ORDER.length) % ENGINE_ORDER.length];
        this.renderResults();
    }

    private syncEngine(): void {
        const button = this.querySelector<HTMLButtonElement>('.search-engine')!;
        button.textContent = ENGINES[this.engine].label;
        button.setAttribute('aria-label', `搜索引擎：${ENGINES[this.engine].label}，点按或按 Tab 切换`);
    }
}

function siteRow(site: RecentSite): Row {
    return { kind: 'site', title: site.title, subtitle: `${site.host} · 近 30 天 ${site.count} 次`, url: site.url };
}

function rowIcon(row: Row): string {
    if (row.kind === 'web') return `<span class="row-icon row-icon-plain">${ICONS.search}</span>`;
    if (row.kind === 'recent') return `<span class="row-icon row-icon-plain">${ICONS.clock}</span>`;
    if (row.kind === 'url') return `<span class="row-icon row-icon-plain">${ICONS.open}</span>`;
    if (row.kind === 'bookmark') return siteIcon({ url: row.url, name: row.title, bookmark: row.bookmark }, 'row-icon', ROW_ICON_SIZE);
    return siteIcon({ url: row.url, name: row.title }, 'row-icon', ROW_ICON_SIZE);
}

/** Host and name prefixes rank above matches in the middle of a URL. */
function matchScore(query: string, name: string, url: string): number {
    const host = hostOf(url).toLowerCase();
    const title = name.toLowerCase();
    if (host.startsWith(query) || title.startsWith(query)) return 3;
    if (host.includes(query) || title.includes(query)) return 2;
    return url.toLowerCase().includes(query) ? 1 : 0;
}

function looksLikeUrl(value: string): boolean {
    if (/\s/.test(value)) return false;
    return /^[a-z][a-z\d+.-]*:\/\//i.test(value)
        || /^localhost(:\d+)?(\/|$)/i.test(value)
        || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/\S*)?$/.test(value)
        || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(value);
}
