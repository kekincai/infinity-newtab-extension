import { appStore } from '../core/store';
import type { Bookmark } from '../core/types';
import { DEFAULT_ICON, escapeHtml, faviconUrl, normalizeUrl } from '../core/utils';
import { ICONS } from './icons';
import { notifyError, pushLayer } from './ui-layer';

type DialogDetail = { bookmark?: Bookmark; folder?: string; draft?: { url: string; name: string } };

export class BookmarkDialog extends HTMLElement {
    private editing?: Bookmark;
    private releaseLayer: (() => void) | null = null;

    connectedCallback(): void {
        document.addEventListener('open-bookmark-dialog', this.onOpen as EventListener);
    }

    disconnectedCallback(): void {
        document.removeEventListener('open-bookmark-dialog', this.onOpen as EventListener);
        this.close();
    }

    private readonly onOpen = (event: CustomEvent<DialogDetail>): void => {
        this.editing = event.detail.bookmark;
        this.open(event.detail);
    };

    private open({ bookmark, folder = '全部', draft }: DialogDetail): void {
        this.close();
        const selected = bookmark?.folder ?? folder;
        const title = bookmark ? '编辑书签' : '添加书签';
        this.innerHTML = `
            <div class="modal-backdrop dialog-backdrop is-open">
                <form class="modal bookmark-dialog glass-panel" role="dialog" aria-modal="true" aria-label="${title}" novalidate>
                    <header class="modal-header">
                        <h2>${title}</h2>
                        <button class="icon-close dialog-close" type="button" aria-label="关闭">${ICONS.close}</button>
                    </header>
                    <label class="field">
                        <span>网址</span>
                        <span class="field-with-icon">
                            <img class="url-preview" src="${DEFAULT_ICON}" alt="">
                            <input name="url" type="text" inputmode="url" required autocomplete="off" spellcheck="false" placeholder="example.com" value="${escapeHtml(bookmark?.url ?? draft?.url ?? '')}">
                        </span>
                    </label>
                    <label class="field">
                        <span>名称</span>
                        <input name="name" type="text" maxlength="160" autocomplete="off" placeholder="留空则使用网站域名" value="${escapeHtml(bookmark?.name ?? draft?.name ?? '')}">
                    </label>
                    <label class="field">
                        <span>文件夹</span>
                        <span class="select-wrap"><select name="folder">${appStore.state.folders.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></span>
                    </label>
                    <details class="field-advanced" ${bookmark?.icon ? 'open' : ''}>
                        <summary>自定义图标</summary>
                        <label class="field">
                            <span>图标网址（留空自动获取）</span>
                            <input name="icon" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/icon.png" value="${escapeHtml(bookmark?.icon ?? '')}">
                        </label>
                    </details>
                    <p class="field-error" role="alert" hidden></p>
                    <footer class="modal-actions">
                        <button class="glass-button cancel-dialog" type="button" data-liquid-item>取消</button>
                        <button class="glass-button primary" type="submit" data-liquid-item>保存</button>
                    </footer>
                </form>
            </div>
        `;
        const backdrop = this.querySelector<HTMLElement>('.dialog-backdrop')!;
        const form = this.querySelector<HTMLFormElement>('form')!;
        const urlInput = form.querySelector<HTMLInputElement>('input[name="url"]')!;
        const iconInput = form.querySelector<HTMLInputElement>('input[name="icon"]')!;
        const preview = form.querySelector<HTMLImageElement>('.url-preview')!;
        const error = form.querySelector<HTMLElement>('.field-error')!;
        const updatePreview = () => {
            const custom = iconInput.value.trim();
            const url = normalizeUrl(urlInput.value);
            preview.src = custom.startsWith('https://') || custom.startsWith('data:image/') ? custom : url ? faviconUrl(url, 64) : DEFAULT_ICON;
        };
        preview.addEventListener('error', () => { preview.src = DEFAULT_ICON; });
        updatePreview();
        urlInput.addEventListener('input', () => {
            error.hidden = true;
            urlInput.removeAttribute('aria-invalid');
            updatePreview();
        });
        iconInput.addEventListener('change', updatePreview);
        this.querySelector('.dialog-close')?.addEventListener('click', () => this.close());
        this.querySelector('.cancel-dialog')?.addEventListener('click', () => this.close());
        backdrop.addEventListener('pointerdown', (event) => { if (event.target === backdrop) this.close(); });
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const input = {
                url: String(data.get('url') ?? ''),
                name: String(data.get('name') ?? ''),
                folder: String(data.get('folder') ?? '全部'),
                icon: String(data.get('icon') ?? '').trim()
            };
            if (!normalizeUrl(input.url)) {
                error.textContent = '请输入有效的网址，例如 github.com';
                error.hidden = false;
                urlInput.setAttribute('aria-invalid', 'true');
                urlInput.focus();
                return;
            }
            try {
                if (this.editing) await appStore.updateBookmark(this.editing.id, input);
                else await appStore.addBookmark(input);
                this.close();
            } catch (saveError) {
                notifyError(saveError, '保存失败');
            }
        });
        this.releaseLayer = pushLayer(form, () => this.close());
        requestAnimationFrame(() => (bookmark ? form.querySelector<HTMLInputElement>('input[name="name"]') : urlInput)?.focus());
    }

    private close(): void {
        this.editing = undefined;
        this.innerHTML = '';
        const release = this.releaseLayer;
        this.releaseLayer = null;
        release?.();
    }
}
