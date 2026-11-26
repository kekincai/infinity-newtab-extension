import { escapeHtml } from '../core/utils';

/**
 * Overlays are native: dialogs open with `showModal()` and menus are `popover`
 * elements, so the browser makes the page inert, keeps focus inside, closes on
 * Escape (and outside clicks where wanted) and returns focus to the opener.
 */
const OPEN_OVERLAY = 'dialog:modal, .context-menu:popover-open';

/** True while a dialog or menu is open; the home screen then ignores its own shortcuts and gestures. */
export function hasOpenLayer(): boolean {
    return document.querySelector(OPEN_OVERLAY) !== null;
}

/**
 * A dialog or menu that is closed for good leaves the page once its exit
 * transition has played. Until then it takes no input and is hidden from
 * assistive technology, so it never reads as a second open dialog.
 */
export function removeAfterExit(element: HTMLElement): void {
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
    const running = element.getAnimations({ subtree: true });
    if (!running.length) {
        element.remove();
        return;
    }
    void Promise.allSettled(running.map((animation) => animation.finished)).then(() => element.remove());
}

type ModalOptions = {
    title: string;
    body?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    input?: { label: string; value?: string; placeholder?: string; maxLength?: number };
};

let modalCount = 0;

/** Resolves with the input value (or '' without input) on confirm, null on cancel. */
function openModal(options: ModalOptions): Promise<string | null> {
    return new Promise((resolve) => {
        const titleId = `modal-title-${++modalCount}`;
        const dialog = document.createElement('dialog');
        dialog.className = 'modal glass-panel';
        // Only a confirmation is an alert; a prompt for a name is an ordinary dialog.
        if (!options.input) dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-labelledby', titleId);
        dialog.setAttribute('closedby', 'any');
        // A destructive confirmation starts on the safe choice; otherwise on the field or the confirm button.
        const cancelFocus = options.danger ? 'autofocus' : '';
        const submitFocus = !options.danger && !options.input ? 'autofocus' : '';
        dialog.innerHTML = `
            <form method="dialog">
                <h1 class="modal-title" id="${titleId}">${escapeHtml(options.title)}</h1>
                ${options.body ? `<p class="modal-body">${escapeHtml(options.body)}</p>` : ''}
                ${options.input ? `<label class="field"><span>${escapeHtml(options.input.label)}</span><input name="value" type="text" autocomplete="off" autofocus maxlength="${options.input.maxLength ?? 80}" placeholder="${escapeHtml(options.input.placeholder ?? '')}" value="${escapeHtml(options.input.value ?? '')}"></label>` : ''}
                <footer class="modal-actions">
                    <button class="pill-button" type="submit" value="cancel" formnovalidate ${cancelFocus}>${escapeHtml(options.cancelText ?? '取消')}</button>
                    <button class="pill-button ${options.danger ? 'danger' : 'primary'}" type="submit" value="confirm" ${submitFocus}>${escapeHtml(options.confirmText ?? '确定')}</button>
                </footer>
            </form>`;
        const input = dialog.querySelector<HTMLInputElement>('input[name="value"]');
        // Enter in the field submits with no button, which counts as confirming.
        dialog.querySelector('form')!.addEventListener('submit', (event) => {
            if (!event.submitter) dialog.returnValue = 'confirm';
        });
        dialog.addEventListener('close', () => {
            // Escape and outside clicks set no return value: that is a cancel.
            const confirmed = dialog.returnValue === 'confirm';
            resolve(confirmed ? (input ? input.value.trim() : '') : null);
            removeAfterExit(dialog);
        }, { once: true });
        document.body.append(dialog);
        dialog.showModal();
        input?.select();
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

/**
 * Toasts live in one manual popover, so they show above an open dialog (the
 * top layer ignores z-index). They are announced with `ariaNotify()`, since a
 * live region outside an open modal dialog is inert and would stay silent.
 */
export function notify(message: string, kind: ToastKind = 'info', timeout = kind === 'error' ? 7000 : 3200): void {
    let region = document.querySelector<HTMLElement>('.toast-region');
    if (!region) {
        region = document.createElement('div');
        region.className = 'toast-region';
        region.popover = 'manual';
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', '通知');
        document.body.append(region);
    }
    const toast = document.createElement('div');
    toast.className = `toast glass-panel app-notice is-${kind}`;
    toast.textContent = message;
    region.append(toast);
    raise(region);
    document.ariaNotify(message, { priority: kind === 'error' ? 'high' : 'normal' });
    window.setTimeout(() => {
        toast.classList.add('is-leaving');
        // Reduced motion (or a tab in the background) may skip the transition; the toast still goes.
        const remove = () => {
            toast.remove();
            if (!region.childElementCount && region.matches(':popover-open')) region.hidePopover();
        };
        toast.addEventListener('transitionend', remove, { once: true });
        window.setTimeout(remove, 260);
    }, timeout);
}

/** Shown again only when a dialog has opened above it since, so the toasts already there do not flash. */
function raise(region: HTMLElement): void {
    if (!region.matches(':popover-open')) {
        region.showPopover();
        return;
    }
    const dialogs = [...document.querySelectorAll('dialog:modal')];
    if (dialogs.some((dialog) => region.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING || !region.dataset.raised)) {
        region.hidePopover();
        region.showPopover();
    }
    region.dataset.raised = dialogs.length ? 'true' : '';
}

export function notifyError(error: unknown, fallback = '操作失败'): void {
    notify(error instanceof Error && error.message ? error.message : fallback, 'error');
}

export type MenuItem =
    | { label: string; icon?: string; danger?: boolean; action: () => void }
    | { separator: true }
    | { heading: string };

/** A pointer position, or an element to open under (keyboard and button use). */
export type MenuAnchor = { x: number; y: number } | HTMLElement;

/**
 * Opens a context menu at a point, or under an element for keyboard / button
 * use. It is an auto popover: opening it closes any other menu, and an outside
 * click or Escape closes it and returns focus.
 */
export function openMenu(items: MenuItem[], at: MenuAnchor, label: string): void {
    const menu = document.createElement('div');
    menu.className = 'context-menu glass-panel';
    menu.popover = 'auto';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', label);
    menu.innerHTML = menuMarkup(items);
    // Focus starts on the first item. Letting the popover move it there (rather than calling focus()) is what
    // makes the browser hand focus back to the opener when the menu closes.
    menu.querySelector('button')?.setAttribute('autofocus', '');
    document.body.append(menu);
    const source = at instanceof HTMLElement ? at : null;
    menu.showPopover(source ? { source } : undefined);
    place(menu, at);
    // A menu button says whether its menu is open.
    if (source?.hasAttribute('aria-haspopup')) source.setAttribute('aria-expanded', 'true');

    const listening = new AbortController();
    const close = () => {
        if (menu.matches(':popover-open')) menu.hidePopover();
    };
    menu.addEventListener('toggle', (event) => {
        if ((event as ToggleEvent).newState !== 'closed') return;
        listening.abort();
        if (source?.hasAttribute('aria-haspopup')) source.setAttribute('aria-expanded', 'false');
        removeAfterExit(menu);
    }, { signal: listening.signal });
    window.addEventListener('blur', close, { signal: listening.signal });
    window.addEventListener('resize', close, { signal: listening.signal });
    // Tab leaves a menu rather than cycling inside it.
    menu.addEventListener('focusout', (event) => {
        if (!menu.contains(event.relatedTarget as Node | null)) close();
    }, { signal: listening.signal });

    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button')];
    menu.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
        const item = button ? items[Number(button.dataset.index)] : null;
        if (!item || !('action' in item)) return;
        close();
        item.action();
    });
    menu.addEventListener('keydown', (event) => {
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
        const jump = { Home: 0, End: buttons.length - 1 }[event.key];
        if (step === undefined && jump === undefined) return;
        event.preventDefault();
        buttons[jump ?? (index + step! + buttons.length) % buttons.length]?.focus();
    });
}

/** Items as menu items; a heading names the group of items that follows it, up to the next separator. */
function menuMarkup(items: MenuItem[]): string {
    let html = '';
    let inGroup = false;
    const endGroup = () => {
        if (inGroup) html += '</div>';
        inGroup = false;
    };
    items.forEach((item, index) => {
        if ('separator' in item) {
            endGroup();
            html += '<hr>';
        } else if ('heading' in item) {
            endGroup();
            html += `<div role="group" aria-labelledby="menu-heading-${index}"><span class="menu-heading" id="menu-heading-${index}" role="presentation">${escapeHtml(item.heading)}</span>`;
            inGroup = true;
        } else {
            html += `<button type="button" role="menuitem" data-index="${index}" class="${item.danger ? 'danger' : ''}">${item.icon ? `<i aria-hidden="true">${item.icon}</i>` : '<i></i>'}<span>${escapeHtml(item.label)}</span></button>`;
        }
    });
    endGroup();
    return html;
}

/** Opens at the pointer or under the anchor, flipped to stay on screen, growing from the nearest corner. */
function place(menu: HTMLElement, at: MenuAnchor): void {
    const anchor = at instanceof HTMLElement ? at.getBoundingClientRect() : null;
    const point = anchor ? { x: anchor.left, y: anchor.bottom + 6 } : at as { x: number; y: number };
    const { width, height } = menu.getBoundingClientRect();
    const flipsLeft = point.x > innerWidth - width - 8;
    const flipsUp = point.y + height > innerHeight - 8;
    menu.style.left = `${Math.max(8, Math.min(point.x, innerWidth - width - 8))}px`;
    menu.style.top = `${flipsUp ? Math.max(8, point.y - height - (anchor ? anchor.height + 12 : 0)) : point.y}px`;
    menu.style.transformOrigin = `${flipsLeft ? 'right' : 'left'} ${flipsUp ? 'bottom' : 'top'}`;
}

/**
 * Runs once an element's open animation or transition has settled, so focus
 * (and the glass lens that follows it) never measures a half-scaled layout.
 */
export function afterMotion(element: Element, run: () => void): void {
    requestAnimationFrame(() => {
        // A busy spinner loops forever; only motion that ends is worth waiting for.
        const running = element.getAnimations({ subtree: true })
            .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
        if (!running.length) {
            run();
            return;
        }
        void Promise.all(running.map((animation) => animation.finished.catch(() => undefined))).then(run);
    });
}
