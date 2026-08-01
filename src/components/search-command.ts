import { appStore } from '../core/store';
import { escapeHtml } from '../core/utils';
import { StoreElement } from './base';

const ENGINES = {
    google: { label: 'Google', url: 'https://www.google.com/search?q=' },
    bing: { label: 'Bing', url: 'https://www.bing.com/search?q=' },
    baidu: { label: '百度', url: 'https://www.baidu.com/s?wd=' },
    duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' }
} as const;

export class SearchCommand extends StoreElement {
    protected readonly observedChanges = ['settings.layout', 'recentSearches'] as const;
    protected render(): void {
        const { layout } = appStore.state.settings;
        const engine = ENGINES[layout.searchEngine];
        this.hidden = !layout.showSearch;
        this.innerHTML = `
            <form class="search-shell glass-panel" role="search" data-liquid-item>
                <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                <input name="query" type="search" autocomplete="off" list="search-history" placeholder="搜索网络..." aria-label="搜索网络">
                <span class="search-engine">${engine.label}</span>
                <datalist id="search-history">${appStore.state.recentSearches.slice(0, 8).map((item) => `<option value="${escapeHtml(item)}"></option>`).join('')}</datalist>
            </form>
        `;
        this.querySelector('form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const input = this.querySelector<HTMLInputElement>('input[name="query"]');
            const query = input?.value.trim() ?? '';
            if (!query) return;
            void appStore.saveRecentSearch(query);
            window.location.href = `${engine.url}${encodeURIComponent(query)}`;
        });
    }
}
