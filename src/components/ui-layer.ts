import { escapeHtml } from '../core/utils';

/**
 * One stack for every overlay (drawer, dialogs, menus): Escape closes the top
 * layer, Tab stays inside it and focus returns to whatever opened it.
 */
type Layer = { element: HTMLElement; close: () => void; restoreFocus: HTMLElement | null };

const layers: Layer[] = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

document.addEventListener('keydown', (event) => {
    const top = layers.at(-1);
    if (!top) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        top.close();
        return;
    }
    if (event.key === 'Tab') trapFocus(top.element, event);
}, true);

export function pushLayer(element: HTMLElement, close: () => void): () => void {
    const layer: Layer = {
        element,
        close,
        restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null
    };
    layers.push(layer);
    return () => {
        const index = layers.indexOf(layer);
        if (index < 0) return;
        layers.splice(index, 1);
        if (layer.restoreFocus?.isConnected && element.contains(document.activeElement)) layer.restoreFocus.focus();
        else if (layer.restoreFocus?.isConnected && document.activeElement === document.body) layer.restoreFocus.focus();
    };
}

export function hasOpenLayer(): boolean {
    return layers.length > 0;
}

function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getClientRects().length);
    if (!focusable.length) {
        event.preventDefault();
        return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    const active = document.activeElement;
    if (!container.contains(active)) {
        event.preventDefault();
        first.focus();
    } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}

type ModalOptions = {
    title: string;
    body?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    input?: { label: string; value?: string; placeholder?: string; maxLength?: number };
};

/** Resolves with the input value (or '' without input) on confirm, null on cancel. */
function openModal(options: ModalOptions): Promise<string | null> {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop is-open';
        backdrop.innerHTML = `
            <form class="modal glass-panel" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
                <header class="modal-header">
                    <h2 id="modal-title">${escapeHtml(options.title)}</h2>
                    <button class="icon-close" type="button" aria-label="关闭" data-action="cancel">${CLOSE_ICON}</button>
                </header>
                ${options.body ? `<p class="modal-body">${escapeHtml(options.body)}</p>` : ''}
                ${options.input ? `<label class="field"><span>${escapeHtml(options.input.label)}</span><input name="value" type="text" autocomplete="off" maxlength="${options.input.maxLength ?? 80}" placeholder="${escapeHtml(options.input.placeholder ?? '')}" value="${escapeHtml(options.input.value ?? '')}"></label>` : ''}
                <footer class="modal-actions">
                    <button class="glass-button" type="button" data-action="cancel" data-liquid-item>${escapeHtml(options.cancelText ?? '取消')}</button>
                    <button class="glass-button ${options.danger ? 'danger' : 'primary'}" type="submit" data-liquid-item>${escapeHtml(options.confirmText ?? '确定')}</button>
                </footer>
            </form>`;
        document.body.append(backdrop);
        const form = backdrop.querySelector('form')!;
        const input = form.querySelector<HTMLInputElement>('input[name="value"]');
        let release = () => {};
        const finish = (value: string | null) => {
            release();
            backdrop.remove();
            resolve(value);
        };
        release = pushLayer(form, () => finish(null));
        form.querySelectorAll('[data-action="cancel"]').forEach((button) => button.addEventListener('click', () => finish(null)));
        backdrop.addEventListener('pointerdown', (event) => { if (event.target === backdrop) finish(null); });
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            finish(input ? input.value.trim() : '');
        });
        requestAnimationFrame(() => {
            if (input) {
                input.focus();
                input.select();
            } else {
                form.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
            }
        });
    });
}

export async function confirmAction(options: Omit<ModalOptions, 'input'>): Promise<boolean> {
    return await openModal(options) !== null;
}

export async function promptText(title: string, input: NonNullable<ModalOptions['input']>, confirmText = '保存'): Promise<string | null> {
    const value = await openModal({ title, input, confirmText });
    return value || null;
}

type ToastKind = 'info' | 'success' | 'error';

export function notify(message: string, kind: ToastKind = 'info', timeout = kind === 'error' ? 7000 : 3200): void {
    let region = document.querySelector<HTMLElement>('.toast-region');
    if (!region) {
        region = document.createElement('div');
        region.className = 'toast-region';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        document.body.append(region);
    }
    const toast = document.createElement('div');
    toast.className = `toast app-notice is-${kind}`;
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 220);
    }, timeout);
}

export function notifyError(error: unknown, fallback = '操作失败'): void {
    notify(error instanceof Error && error.message ? error.message : fallback, 'error');
}

export type MenuItem =
    | { label: string; icon?: string; danger?: boolean; disabled?: boolean; action: () => void }
    | { separator: true }
    | { heading: string };

/** Opens a context menu at a point, or anchored under an element for keyboard / button use. */
export function openMenu(items: MenuItem[], at: { x: number; y: number } | HTMLElement): void {
    document.querySelector('.context-menu')?.dispatchEvent(new Event('menu-close'));
    const menu = document.createElement('div');
    menu.className = 'context-menu glass-panel';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map((item, index) => {
        if ('separator' in item) return '<hr>';
        if ('heading' in item) return `<span class="menu-heading">${escapeHtml(item.heading)}</span>`;
        return `<button type="button" role="menuitem" data-index="${index}" class="${item.danger ? 'danger' : ''}" ${item.disabled ? 'disabled' : ''}>${item.icon ? `<i aria-hidden="true">${item.icon}</i>` : '<i></i>'}<span>${escapeHtml(item.label)}</span></button>`;
    }).join('');
    document.body.append(menu);

    const anchor = at instanceof HTMLElement ? at.getBoundingClientRect() : null;
    const point = anchor ? { x: anchor.left, y: anchor.bottom + 6 } : at as { x: number; y: number };
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(point.x, innerWidth - width - 8))}px`;
    menu.style.top = `${point.y + height > innerHeight - 8 ? Math.max(8, point.y - height - (anchor ? anchor.height + 12 : 0)) : point.y}px`;

    let release = () => {};
    const close = () => {
        document.removeEventListener('pointerdown', onOutside, true);
        window.removeEventListener('blur', close);
        window.removeEventListener('resize', close);
        release();
        menu.remove();
    };
    const onOutside = (event: Event) => { if (!menu.contains(event.target as Node)) close(); };
    release = pushLayer(menu, close);
    menu.addEventListener('menu-close', close);
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);

    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    menu.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
        const item = button ? items[Number(button.dataset.index)] : null;
        if (!item || !('action' in item)) return;
        close();
        item.action();
    });
    menu.addEventListener('keydown', (event) => {
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            buttons[(index + step + buttons.length) % buttons.length]?.focus();
        }
    });
    buttons[0]?.focus({ preventScroll: true });
}

export const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
