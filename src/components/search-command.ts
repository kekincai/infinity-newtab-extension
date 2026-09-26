import { appStore } from '../core/store';
import type { SearchEngineKey } from '../core/types';
import { escapeHtml } from '../core/utils';
import { StoreElement } from './base';
import { ICONS } from './icons';

export const ENGINES: Record<SearchEngineKey, { label: string; url: string }> = {
    google: { label: 'Google', url: 'https://www.google.com/search?q=' },
    bing: { label: 'Bing', url: 'https://www.bing.com/search?q=' },
    baidu: { label: '百度', url: 'https://www.baidu.com/s?wd=' },
    duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' }
};

const ENGINE_ORDER = Object.keys(ENGINES) as SearchEngineKey[];
const MAX_SUGGESTIONS = 6;

export class SearchCommand extends StoreElement {
    protected readonly observedChanges = ['settings.layout', 'recentSearches'] as const;
    private activeIndex = -1;

    protected handleStoreChange(): void {
        // Keep the typed query and focus; only refresh the engine label and suggestions.
        if (!this.querySelector('form')) return this.render();
        const { layout } = appStore.state.settings;
        this.hidden = !layout.showSearch;
        const engine = this.querySelector('.search-engine');
        if (engine) engine.textContent = ENGINES[layout.searchEngine].label;
        if (this.contains(document.activeElement)) this.renderSuggestions();
    }

    protected render(): void {
        const { layout } = appStore.state.settings;
        this.hidden = !layout.showSearch;
        this.innerHTML = `
            <form class="search-shell glass-panel" role="search" data-liquid-item>
                ${ICONS.search}
                <input name="query" type="search" autocomplete="off" spellcheck="false" placeholder="搜索网络，或按 / 聚焦" aria-label="搜索网络"
                    role="combobox" aria-expanded="false" aria-controls="search-suggestions" aria-autocomplete="list">
                <button class="search-engine" type="button" title="切换搜索引擎">${ENGINES[layout.searchEngine].label}</button>
            </form>
            <ul class="search-suggestions glass-panel" id="search-suggestions" role="listbox" hidden></ul>
        `;
        const form = this.querySelector('form')!;
        const input = this.querySelector<HTMLInputElement>('input[name="query"]')!;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.search(input.value);
        });
        input.addEventListener('focus', () => this.renderSuggestions());
        input.addEventListener('input', () => {
            this.activeIndex = -1;
            this.renderSuggestions();
        });
        input.addEventListener('keydown', (event) => this.onKeyDown(event));
        this.addEventListener('focusout', (event) => {
            if (!this.contains(event.relatedTarget as Node)) this.hideSuggestions();
        });
        this.querySelector('.search-engine')?.addEventListener('click', () => {
            const next = ENGINE_ORDER[(ENGINE_ORDER.indexOf(appStore.state.settings.layout.searchEngine) + 1) % ENGINE_ORDER.length];
            void appStore.updateSettings('layout', { searchEngine: next });
        });
        this.querySelector('.search-suggestions')?.addEventListener('pointerdown', (event) => {
            // Keep focus in the input while picking a suggestion.
            event.preventDefault();
            const target = event.target as HTMLElement;
            const item = target.closest<HTMLElement>('[data-query]');
            if (!item) return;
            if (target.closest('.suggestion-remove')) void appStore.removeRecentSearch(item.dataset.query ?? '');
            else this.search(item.dataset.query ?? '');
        });
    }

    private suggestions(): string[] {
        const query = this.querySelector<HTMLInputElement>('input[name="query"]')?.value.trim().toLowerCase() ?? '';
        return appStore.state.recentSearches
            .filter((item) => !query || (item.toLowerCase().includes(query) && item.toLowerCase() !== query))
            .slice(0, MAX_SUGGESTIONS);
    }

    private renderSuggestions(): void {
        const list = this.querySelector<HTMLUListElement>('.search-suggestions');
        const input = this.querySelector<HTMLInputElement>('input[name="query"]');
        if (!list || !input) return;
        const items = this.suggestions();
        this.activeIndex = Math.min(this.activeIndex, items.length - 1);
        list.hidden = !items.length;
        input.setAttribute('aria-expanded', String(Boolean(items.length)));
        list.innerHTML = items.map((item, index) => `
            <li role="option" id="suggestion-${index}" data-query="${escapeHtml(item)}" aria-selected="${index === this.activeIndex}" class="${index === this.activeIndex ? 'is-active' : ''}">
                ${ICONS.clock}<span>${escapeHtml(item)}</span>
                <button class="suggestion-remove" type="button" tabindex="-1" aria-label="删除这条记录">${ICONS.close}</button>
            </li>`).join('');
        if (this.activeIndex >= 0) input.setAttribute('aria-activedescendant', `suggestion-${this.activeIndex}`);
        else input.removeAttribute('aria-activedescendant');
    }

    private hideSuggestions(): void {
        const list = this.querySelector<HTMLUListElement>('.search-suggestions');
        if (list) list.hidden = true;
        this.querySelector('input[name="query"]')?.setAttribute('aria-expanded', 'false');
        this.activeIndex = -1;
    }

    private onKeyDown(event: KeyboardEvent): void {
        const items = this.suggestions();
        const input = event.target as HTMLInputElement;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!items.length) return;
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            this.activeIndex = (this.activeIndex + step + items.length + 1) % (items.length + 1);
            if (this.activeIndex === items.length) this.activeIndex = -1;
            this.renderSuggestions();
        } else if (event.key === 'Enter' && this.activeIndex >= 0 && items[this.activeIndex]) {
            event.preventDefault();
            this.search(items[this.activeIndex]);
        } else if (event.key === 'Escape') {
            if (!this.querySelector<HTMLElement>('.search-suggestions')?.hidden) {
                event.preventDefault();
                this.hideSuggestions();
            } else if (input.value) {
                input.value = '';
            } else {
                input.blur();
            }
        }
    }

    private search(value: string): void {
        const query = value.trim();
        if (!query) return;
        const engine = ENGINES[appStore.state.settings.layout.searchEngine];
        void appStore.saveRecentSearch(query).finally(() => {
            window.location.href = `${engine.url}${encodeURIComponent(query)}`;
        });
    }
}
