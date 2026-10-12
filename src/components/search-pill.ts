import { appStore } from '../core/store';
import { StoreElement } from './base';
import { ICONS } from './icons';
import { ENGINES, SHORTCUT_LABEL } from './spotlight-search';

/** The home search field is only a doorway: it opens Spotlight. */
export class SearchPill extends StoreElement {
    protected readonly observedChanges = ['settings.layout'] as const;

    protected render(): void {
        const { showSearch, searchEngine } = appStore.state.settings.layout;
        this.hidden = !showSearch;
        this.innerHTML = `
            <button class="glass search-pill" type="button" data-liquid-item aria-label="搜索或输入网址" aria-keyshortcuts="${SHORTCUT_LABEL === '⌘K' ? 'Meta+K' : 'Control+K'} /">
                ${ICONS.search}
                <span class="search-pill-text">搜索或输入网址</span>
                <span class="pill-chip">${ENGINES[searchEngine].label}</span>
                <span class="pill-chip">${SHORTCUT_LABEL}</span>
            </button>`;
        this.querySelector('button')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('open-spotlight', { bubbles: true, composed: true }));
        });
    }
}
