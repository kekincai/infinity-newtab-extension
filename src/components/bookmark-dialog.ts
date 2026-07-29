import { appStore } from '../core/store';
import type { Bookmark } from '../core/types';
import { escapeHtml, faviconUrl, normalizeUrl } from '../core/utils';

type DialogDetail = { bookmark?: Bookmark; folder?: string };

export class BookmarkDialog extends HTMLElement {
    private editing?: Bookmark;
    private folder = '全部';

    connectedCallback(): void {
        document.addEventListener('open-bookmark-dialog', this.onOpen as EventListener);
        this.render();
    }

    disconnectedCallback(): void {
        document.removeEventListener('open-bookmark-dialog', this.onOpen as EventListener);
    }

    private readonly onOpen = (event: CustomEvent<DialogDetail>): void => {
        this.editing = event.detail.bookmark;
        this.folder = event.detail.folder ?? '全部';
        this.render(true);
    };

    private render(open = false): void {
        const bookmark = this.editing;
        const selected = bookmark?.folder ?? this.folder;
        this.innerHTML = `
            <div class="dialog-backdrop ${open ? 'is-open' : ''}" role="presentation">
                <form class="bookmark-dialog glass-panel" role="dialog" aria-modal="true" aria-label="${bookmark ? '编辑书签' : '添加书签'}">
                    <header><div><span class="section-kicker">快捷入口</span><h2>${bookmark ? '编辑书签' : '添加书签'}</h2></div><button class="dialog-close" type="button" aria-label="关闭">×</button></header>
                    <label>网址<input name="url" type="url" required placeholder="https://example.com" value="${escapeHtml(bookmark?.url ?? '')}"></label>
                    <label>名称<input name="name" type="text" maxlength="160" placeholder="自动使用网站名称" value="${escapeHtml(bookmark?.name ?? '')}"></label>
                    <label>文件夹<select name="folder">${appStore.state.folders.map((folder) => `<option value="${escapeHtml(folder)}" ${folder === selected ? 'selected' : ''}>${escapeHtml(folder)}</option>`).join('')}</select></label>
                    <label>图标地址（可选）<input name="icon" type="url" placeholder="https://example.com/favicon.ico" value="${escapeHtml(bookmark?.icon ?? '')}"></label>
                    <div class="dialog-preview"><img alt=""><span>输入网址后预览图标</span></div>
                    <div class="dialog-actions"><button class="glass-button cancel-dialog" type="button" data-liquid-item>取消</button><button class="glass-button primary" type="submit" data-liquid-item>保存</button></div>
                </form>
            </div>
        `;
        if (!open) return;
        const backdrop = this.querySelector('.dialog-backdrop');
        const form = this.querySelector<HTMLFormElement>('form');
        const urlInput = this.querySelector<HTMLInputElement>('input[name="url"]');
        const preview = this.querySelector<HTMLImageElement>('.dialog-preview img');
        const close = () => { this.editing = undefined; this.render(false); };
        const updatePreview = () => {
            const url = normalizeUrl(urlInput?.value);
            if (preview && url) preview.src = faviconUrl(url);
        };
        updatePreview();
        urlInput?.addEventListener('input', updatePreview);
        this.querySelector('.dialog-close')?.addEventListener('click', close);
        this.querySelector('.cancel-dialog')?.addEventListener('click', close);
        backdrop?.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const input = {
                url: String(data.get('url') ?? ''),
                name: String(data.get('name') ?? ''),
                folder: String(data.get('folder') ?? '全部'),
                icon: String(data.get('icon') ?? '')
            };
            try {
                if (this.editing) await appStore.updateBookmark(this.editing.id, input);
                else await appStore.addBookmark(input);
                close();
            } catch (error) {
                alert(error instanceof Error ? error.message : '保存失败');
            }
        });
        window.setTimeout(() => urlInput?.focus(), 0);
    }
}
