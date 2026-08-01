import { appStore, type StoreChangeKey } from '../core/store';

export abstract class StoreElement extends HTMLElement {
    protected readonly observedChanges: readonly StoreChangeKey[] | null = null;
    private readonly onStoreChange = (event: Event) => {
        const changes = (event as CustomEvent<{ changes?: StoreChangeKey[] }>).detail?.changes;
        if (this.observedChanges && changes && !changes.some((change) => this.observedChanges?.includes(change))) return;
        this.handleStoreChange();
    };

    connectedCallback(): void {
        appStore.addEventListener('change', this.onStoreChange);
        this.render();
    }

    disconnectedCallback(): void {
        appStore.removeEventListener('change', this.onStoreChange);
    }

    protected handleStoreChange(): void {
        this.render();
    }

    protected abstract render(): void;
}
