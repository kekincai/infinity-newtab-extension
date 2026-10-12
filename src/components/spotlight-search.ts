import { loadRecentSites } from '../core/history';
import { appStore } from '../core/store';
import type { Bookmark, RecentSite, SearchEngineKey } from '../core/types';
import { escapeHtml, normalizeUrl } from '../core/utils';
import { bookmarkName, openInNewTab } from './bookmark-actions';
import { ICONS } from './icons';
import { bindSiteIcons, hostOf, siteIcon } from './site-icon';
import { pushLayer } from './ui-layer';

export const ENGINES: Record<SearchEngineKey, { label: string; url: string }> = {
    google: { label: 'Google', url: 'https://www.google.com/search?q=' },
    bing: { label: 'Bing', url: 'https://www.bing.com/search?q=' },
    baidu: { label: '百度', url: 'https://www.baidu.com/s?wd=' },
    duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' }
};

export const SHORTCUT_LABEL = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

const ENGINE_ORDER = Object.keys(ENGINES) as SearchEngineKey[];
const GROUP_TITLES = { url: '网址', bookmark: '书签', site: '常访问', web: '搜索网络', recent: '最近搜索' } as const;

type Row =
    | { kind: 'url'; title: string; subtitle: string; url: string }
    | { kind: 'bookmark'; title: string; subtitle: string; url: string; bookmark: Bookmark }
    | { kind: 'site'; title: string; subtitle: string; url: string; site: RecentSite }
    | { kind: 'web'; title: string; subtitle: string; query: string }
    | { kind: 'recent'; title: string; subtitle: string; query: string };

/** Spotlight-style command bar: bookmarks, frequent sites and recent searches in one list, with a web search fallback. */
export class SpotlightSearch extends HTMLElement {
    private engine: SearchEngineKey = 'google';
    private rows: Row[] = [];
    private selected = 0;
    private sites: RecentSite[] = [];
    private releaseLayer: (() => void) | null = null;

    connectedCallback(): void {
        this.hidden = true;
        this.innerHTML = `
            <div class="spotlight-backdrop" aria-hidden="true"></div>
            <section class="glass glass-thick spotlight" role="dialog" aria-modal="true" aria-label="搜索">
                <div class="spotlight-field">
                    ${ICONS.search}
                    <div class="spotlight-input">
                        <span class="spotlight-ghost" aria-hidden="true"><span class="ghost-typed"></span><span class="ghost-rest"></span></span>
                        <input type="text" autocomplete="off" spellcheck="false" placeholder="搜索或输入网址" aria-label="搜索或输入网址"
                            role="combobox" aria-expanded="true" aria-controls="spotlight-results" aria-autocomplete="list">
                    </div>
                    <span class="spotlight-scope"></span>
                </div>
                <div class="spotlight-results" id="spotlight-results" role="listbox" aria-label="搜索结果"></div>
                <footer class="spotlight-footer">
                    <div class="segmented spotlight-engines" role="radiogroup" aria-label="搜索引擎">
                        ${ENGINE_ORDER.map((key) => `<button type="button" role="radio" data-engine="${key}" data-liquid-item>${ENGINES[key].label}</button>`).join('')}
                    </div>
                    <div class="spotlight-hints" aria-hidden="true">
                        <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
                        <span><kbd>⇥</kbd> 切换引擎</span>
                        <span><kbd>esc</kbd> 关闭</span>
                    </div>
                </footer>
            </section>`;
        const input = this.input;
        input.addEventListener('input', () => {
            this.selected = 0;
            this.renderResults();
        });
        input.addEventListener('keydown', this.onKeyDown);
        this.querySelector('.spotlight-backdrop')?.addEventListener('pointerdown', () => this.close());
        const results = this.querySelector<HTMLElement>('.spotlight-results')!;
        // Keep focus in the field while picking with the mouse.
        results.addEventListener('pointerdown', (event) => event.preventDefault());
        results.addEventListener('click', (event) => {
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
        results.addEventListener('pointermove', (event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
            const index = row ? Number(row.dataset.index) : -1;
            if (index >= 0 && index !== this.selected) this.select(index);
        });
        const engines = this.querySelector<HTMLElement>('.spotlight-engines')!;
        engines.addEventListener('pointerdown', (event) => event.preventDefault());
        engines.addEventListener('click', (event) => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-engine]');
            if (button) this.setEngine(button.dataset.engine as SearchEngineKey);
        });
        engines.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            this.cycleEngine(event.key === 'ArrowRight' ? 1 : -1);
            this.querySelector<HTMLButtonElement>(`[data-engine="${this.engine}"]`)?.focus();
        });
    }

    disconnectedCallback(): void {
        this.close();
    }

    get isOpen(): boolean {
        return !this.hidden;
    }

    open(): void {
        if (this.isOpen) return;
        this.engine = appStore.state.settings.layout.searchEngine;
        this.input.value = '';
        this.selected = 0;
        this.hidden = false;
        document.body.classList.add('spotlight-open');
        this.releaseLayer = pushLayer(this.querySelector('.spotlight')!, () => this.close());
        this.syncEngines();
        this.renderResults();
        requestAnimationFrame(() => this.input.focus());
        void loadRecentSites().then((sites) => {
            this.sites = sites;
            if (this.isOpen) this.renderResults();
        }).catch(() => undefined);
    }

    close(): void {
        if (!this.isOpen) return;
        this.hidden = true;
        document.body.classList.remove('spotlight-open');
        const release = this.releaseLayer;
        this.releaseLayer = null;
        release?.();
    }

    private get input(): HTMLInputElement {
        return this.querySelector<HTMLInputElement>('.spotlight-field input')!;
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.isComposing) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.rows.length) this.select((this.selected + (event.key === 'ArrowDown' ? 1 : -1) + this.rows.length) % this.rows.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.activate(this.selected, event.metaKey || event.ctrlKey);
        } else if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            this.cycleEngine(1);
        } else if (event.key === 'ArrowRight' && this.ghostRest() && this.input.selectionStart === this.input.value.length) {
            event.preventDefault();
            this.input.value += this.ghostRest();
            this.selected = 0;
            this.renderResults();
        }
    };

    private buildRows(): Row[] {
        const raw = this.input.value.trim();
        const query = raw.toLowerCase();
        const rows: Row[] = [];
        const engine = ENGINES[this.engine].label;
        if (!query) {
            this.sites.slice(0, 4).forEach((site) => rows.push(siteRow(site)));
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
            subtitle: `${hostOf(bookmark.url)}${bookmark.folder !== '全部' ? ` · ${bookmark.folder} 文件夹` : ''}`,
            url: bookmark.url,
            bookmark
        }));
        const bookmarkedHosts = new Set(bookmarks.map(({ bookmark }) => hostOf(bookmark.url)));
        this.sites
            .filter((site) => !bookmarkedHosts.has(site.host) && matchScore(query, site.title, site.url) > 0)
            .slice(0, 3)
            .forEach((site) => rows.push(siteRow(site)));
        rows.push({ kind: 'web', title: raw, subtitle: `在 ${engine} 中搜索`, query: raw });
        appStore.state.recentSearches
            .filter((item) => item.toLowerCase().includes(query) && item.toLowerCase() !== query)
            .slice(0, 4)
            .forEach((item) => rows.push({ kind: 'recent', title: item, subtitle: '', query: item }));
        return rows;
    }

    private renderResults(): void {
        this.rows = this.buildRows();
        this.selected = Math.min(this.selected, Math.max(0, this.rows.length - 1));
        const results = this.querySelector<HTMLElement>('.spotlight-results')!;
        let previous = '';
        results.innerHTML = this.rows.map((row, index) => {
            const heading = row.kind !== previous ? `<h3 class="spotlight-heading" role="presentation">${GROUP_TITLES[row.kind]}</h3>` : '';
            previous = row.kind;
            return `${heading}
                <div class="spotlight-row" role="option" id="spotlight-option-${index}" data-index="${index}" aria-selected="false">
                    ${rowIcon(row)}
                    <span class="row-text"><strong>${escapeHtml(row.title)}</strong>${row.subtitle ? `<small>${escapeHtml(row.subtitle)}</small>` : ''}</span>
                    <span class="row-hint">${row.kind === 'web' || row.kind === 'recent' ? '搜索' : '打开'} <kbd>↵</kbd></span>
                    ${row.kind === 'recent' ? '<button class="row-remove" type="button" tabindex="-1" aria-label="删除这条记录">删除</button>' : ''}
                </div>`;
        }).join('') || '<p class="spotlight-empty">输入关键词搜索书签与网页</p>';
        results.hidden = false;
        bindSiteIcons(results);
        this.select(this.selected);
    }

    private select(index: number): void {
        this.selected = index;
        this.querySelectorAll<HTMLElement>('.spotlight-row').forEach((row) => {
            const active = Number(row.dataset.index) === index;
            row.classList.toggle('is-selected', active);
            row.setAttribute('aria-selected', String(active));
            if (active) row.scrollIntoView({ block: 'nearest' });
        });
        const row = this.rows[index];
        if (row) this.input.setAttribute('aria-activedescendant', `spotlight-option-${index}`);
        else this.input.removeAttribute('aria-activedescendant');
        const scope = this.querySelector<HTMLElement>('.spotlight-scope')!;
        scope.textContent = row && this.input.value.trim() ? GROUP_TITLES[row.kind] : '';
        scope.hidden = !scope.textContent;
        const typed = this.input.value;
        const rest = this.ghostRest();
        this.querySelector('.ghost-typed')!.textContent = rest ? typed : '';
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
            if (query) this.search(query);
            return;
        }
        if (row.kind === 'web' || row.kind === 'recent') {
            this.search(row.query);
            return;
        }
        const { openInNewTab: newTab } = appStore.state.settings.layout;
        if (background || newTab || new URL(row.url).protocol === 'chrome-extension:') {
            openInNewTab(row.url);
            this.close();
        } else {
            window.location.href = row.url;
        }
    }

    private search(query: string): void {
        const target = `${ENGINES[this.engine].url}${encodeURIComponent(query)}`;
        const save = appStore.state.settings.layout.saveSearches ? appStore.saveRecentSearch(query) : Promise.resolve();
        void save.finally(() => { window.location.href = target; });
    }

    private setEngine(engine: SearchEngineKey): void {
        this.engine = engine;
        this.syncEngines();
        this.renderResults();
    }

    private cycleEngine(step: number): void {
        const index = ENGINE_ORDER.indexOf(this.engine);
        this.setEngine(ENGINE_ORDER[(index + step + ENGINE_ORDER.length) % ENGINE_ORDER.length]);
    }

    private syncEngines(): void {
        this.querySelectorAll<HTMLButtonElement>('[data-engine]').forEach((button) => {
            const checked = button.dataset.engine === this.engine;
            button.classList.toggle('is-active', checked);
            button.setAttribute('aria-checked', String(checked));
            button.tabIndex = checked ? 0 : -1;
        });
    }
}

function siteRow(site: RecentSite): Row {
    return { kind: 'site', title: site.title, subtitle: `${site.host} · 近 30 天 ${site.count} 次`, url: site.url, site };
}

function rowIcon(row: Row): string {
    if (row.kind === 'web') return `<span class="row-icon row-icon-plain">${ICONS.search}</span>`;
    if (row.kind === 'recent') return `<span class="row-icon row-icon-plain">${ICONS.clock}</span>`;
    if (row.kind === 'url') return `<span class="row-icon row-icon-plain">${ICONS.open}</span>`;
    if (row.kind === 'bookmark') return siteIcon({ url: row.url, name: row.title, bookmark: row.bookmark }, 'row-icon');
    return siteIcon({ url: row.url, name: row.title }, 'row-icon');
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
        || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(value);
}
