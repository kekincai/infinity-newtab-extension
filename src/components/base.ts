import { appStore } from '../core/store';

export abstract class StoreElement extends HTMLElement {
    private readonly onStoreChange = () => this.render();

    connectedCallback(): void {
        appStore.addEventListener('change', this.onStoreChange);
        this.render();
    }

    disconnectedCallback(): void {
        appStore.removeEventListener('change', this.onStoreChange);
    }

    protected abstract render(): void;
}
