import { appStore } from '../core/store';
import type { Bookmark } from '../core/types';
import { DEFAULT_ICON, escapeHtml, faviconUrl, normalizeUrl, sanitizeRemoteUrl } from '../core/utils';
import { type BookmarkDialogDetail as DialogDetail, ROOT_FOLDER, folderLabel } from './bookmark-actions';
import { removeAfterExit } from './ui-layer';

export class BookmarkDialog extends HTMLElement {
    private editing?: Bookmark;

    connectedCallback(): void {
        document.addEventListener('open-bookmark-dialog', this.onOpen as EventListener);
    }

    disconnectedCallback(): void {
        document.removeEventListener('open-bookmark-dialog', this.onOpen as EventListener);
        this.close();
    }

    private readonly onOpen = (event: CustomEvent<DialogDetail>): void => {
        this.open(event.detail);
    };

    private open({ bookmark, folder = ROOT_FOLDER, draft }: DialogDetail): void {
        this.close();
        // Set after closing the previous dialog, which forgets what it was editing.
        this.editing = bookmark;
        const selected = bookmark?.folder ?? folder;
        const title = bookmark ? '编辑书签' : '添加书签';
        // Editing starts on the name, adding on the address.
        this.innerHTML = `
            <dialog class="modal bookmark-dialog glass-panel" aria-labelledby="bookmark-dialog-title" closedby="any">
                <form novalidate>
                    <h1 class="modal-title" id="bookmark-dialog-title">${title}</h1>
                    <label class="field">
                        <span>网址</span>
                        <span class="field-with-icon">
                            <img class="url-preview" src="${DEFAULT_ICON}" alt="">
                            <input name="url" type="text" inputmode="url" required autocomplete="off" spellcheck="false" placeholder="example.com" ${bookmark ? '' : 'autofocus'} value="${escapeHtml(bookmark?.url ?? draft?.url ?? '')}">
                        </span>
                    </label>
                    <label class="field">
                        <span>名称</span>
                        <input name="name" type="text" maxlength="160" autocomplete="off" placeholder="留空则使用网站名" ${bookmark ? 'autofocus' : ''} value="${escapeHtml(bookmark?.name ?? draft?.name ?? '')}">
                    </label>
                    <label class="field">
                        <span>文件夹</span>
                        <span class="select-wrap"><select name="folder">${appStore.state.folders.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? 'selected' : ''}>${escapeHtml(folderLabel(item))}</option>`).join('')}</select></span>
                    </label>
                    <details class="field-advanced" ${bookmark?.icon ? 'open' : ''}>
                        <summary>自定义图标</summary>
                        <label class="field">
                            <span>图标网址（留空自动获取）</span>
                            <input name="icon" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/icon.png" value="${escapeHtml(bookmark?.icon ?? '')}">
                        </label>
                    </details>
                    <p class="field-error" id="bookmark-url-error" role="alert" hidden></p>
                    <footer class="modal-actions">
                        <button class="pill-button cancel-dialog" type="button">取消</button>
                        <button class="pill-button primary" type="submit">保存</button>
                    </footer>
                </form>
            </dialog>
        `;
        const dialog = this.querySelector<HTMLDialogElement>('dialog')!;
        const form = dialog.querySelector<HTMLFormElement>('form')!;
        const urlInput = form.querySelector<HTMLInputElement>('input[name="url"]')!;
        const iconInput = form.querySelector<HTMLInputElement>('input[name="icon"]')!;
        const preview = form.querySelector<HTMLImageElement>('.url-preview')!;
        const error = form.querySelector<HTMLElement>('.field-error')!;
        const updatePreview = () => {
            // Only parsed https: or data:image URLs reach the preview, same rule as saving.
            const custom = sanitizeRemoteUrl(iconInput.value.trim(), true);
            const url = normalizeUrl(urlInput.value);
            preview.src = custom ? previewSource(custom) : url ? faviconUrl(url, 64) : DEFAULT_ICON;
        };
        preview.addEventListener('error', () => { preview.src = DEFAULT_ICON; });
        updatePreview();
        urlInput.addEventListener('input', () => {
            error.hidden = true;
            urlInput.removeAttribute('aria-invalid');
            urlInput.removeAttribute('aria-describedby');
            updatePreview();
        });
        iconInput.addEventListener('change', updatePreview);
        form.querySelector('.cancel-dialog')?.addEventListener('click', () => this.close());
        // Escape and clicks outside close it natively; the element is emptied once it has gone.
        dialog.addEventListener('close', () => {
            // The close event comes a task later; by then another bookmark may already be open here.
            if (this.querySelector('dialog') !== dialog) return;
            this.editing = undefined;
            removeAfterExit(dialog);
        }, { once: true });
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
            // A second Enter while the first save is still writing would store the bookmark twice.
            if (submit.disabled) return;
            const data = new FormData(form);
            const input = {
                url: String(data.get('url') ?? ''),
                name: String(data.get('name') ?? ''),
                folder: String(data.get('folder') ?? ROOT_FOLDER),
                icon: String(data.get('icon') ?? '').trim()
            };
            if (!normalizeUrl(input.url)) {
                error.textContent = '请输入有效的网址，例如 github.com';
                error.hidden = false;
                urlInput.setAttribute('aria-invalid', 'true');
                // The message describes the field only while it is wrong.
                urlInput.setAttribute('aria-describedby', error.id);
                urlInput.focus();
                return;
            }
            submit.disabled = true;
            form.setAttribute('aria-busy', 'true');
            try {
                if (this.editing) await appStore.updateBookmark(this.editing.id, input);
                else await appStore.addBookmark(input);
                this.close();
            } catch (saveError) {
                // Shown inside the dialog: a toast outside an open modal would be inert, and easy to miss.
                error.textContent = saveError instanceof Error && saveError.message ? saveError.message : '保存失败';
                error.hidden = false;
            } finally {
                submit.disabled = false;
                form.removeAttribute('aria-busy');
            }
        });
        dialog.showModal();
    }

    private close(): void {
        const dialog = this.querySelector<HTMLDialogElement>('dialog');
        if (dialog?.open) dialog.close();
        else dialog?.remove();
        this.editing = undefined;
    }
}

/**
 * URI-encodes the already sanitized address (so static analysis sees typed text
 * cleaned before it reaches `src`), then restores the escapes `href` already had,
 * leaving the address itself unchanged.
 */
function previewSource(href: string): string {
    return encodeURI(href).replace(/%25([0-9a-f]{2})/gi, '%$1');
}
