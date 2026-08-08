import { appStore } from '../core/store';
import type { Bookmark } from '../core/types';
import { bookmarkIcon, bookmarkIconCanUpgrade, bookmarkIconFallback, bookmarkIconIsRaster, bookmarkIconSrcSet, cleanDisplayName, escapeHtml } from '../core/utils';
import { StoreElement } from './base';

const FOLDER_COLORS = ['#ff92c8', '#80d8ff', '#ffd27d', '#9be7c4', '#b8a6ff'];

export class BookmarkLaunchpad extends StoreElement {
    protected readonly observedChanges = ['bookmarks', 'folders', 'settings.layout'] as const;
    private currentFolder = '全部';
    private draggingId: Bookmark['id'] | null = null;

    protected render(): void {
        const { bookmarks, folders, settings } = appStore.state;
        if (!folders.includes(this.currentFolder)) this.currentFolder = '全部';
        this.hidden = !settings.layout.showBookmarks;
        const visible = bookmarks.filter((bookmark) => bookmark.folder === this.currentFolder).sort(compareBookmarks);
        const folderCards = this.currentFolder === '全部'
            ? folders.filter((folder) => folder !== '全部').map((folder, index) => this.folderTemplate(folder, index)).join('')
            : this.backTemplate();
        this.innerHTML = `
            <section class="launchpad-section">
                <header class="launchpad-header">
                    <div>
                        <span class="section-kicker">当前文件夹</span>
                        <h2>${escapeHtml(this.currentFolder)}</h2>
                    </div>
                    <div class="launchpad-actions">
                        <button class="glass-button anime-wallpaper" type="button" data-liquid-item>换张二次元壁纸</button>
                        <button class="glass-button primary create-folder" type="button" data-liquid-item>新建文件夹</button>
                    </div>
                </header>
                <div class="launchpad-grid">
                    ${folderCards}
                    ${this.currentFolder === '全部' ? this.addFolderTemplate() : ''}
                    ${visible.map((bookmark) => this.bookmarkTemplate(bookmark)).join('')}
                    ${!folderCards && !visible.length ? '<div class="empty-launchpad">这里还没有书签</div>' : ''}
                </div>
                <button class="add-bookmark-fab" type="button" data-liquid-item aria-label="添加书签">+</button>
            </section>
        `;
        this.bindEvents();
    }

    private bookmarkTemplate(bookmark: Bookmark): string {
        const name = cleanDisplayName(bookmark.name) || cleanDisplayName(new URL(bookmark.url).hostname);
        return `
            <a class="bookmark-tile" href="${escapeHtml(bookmark.url)}" data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item draggable="true" rel="noreferrer">
                <span class="tile-actions">
                    <button class="tile-action edit-bookmark" type="button" aria-label="编辑书签" title="编辑">✎</button>
                    <button class="tile-action delete-bookmark" type="button" aria-label="删除书签" title="删除">×</button>
                </span>
                <span class="bookmark-icon"><img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="80px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" data-icon-raster="${bookmarkIconIsRaster(bookmark)}" alt="" loading="eager" decoding="async"></span>
                <span class="bookmark-name">${escapeHtml(name)}</span>
            </a>
        `;
    }

    private folderTemplate(folder: string, index: number): string {
        const bookmarks = appStore.state.bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks);
        const previews = bookmarks.slice(0, 4).map((bookmark) => (
            `<span class="folder-preview-icon"><img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="32px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" alt="" loading="lazy" decoding="async"></span>`
        )).join('');
        return `
            <article class="folder-tile" tabindex="0" role="button" data-folder="${escapeHtml(folder)}" data-liquid-item style="--folder-color:${FOLDER_COLORS[index % FOLDER_COLORS.length]}">
                <span class="tile-actions folder-actions">
                    <button class="tile-action rename-folder" type="button" aria-label="重命名文件夹" title="重命名">✎</button>
                    <button class="tile-action delete-folder" type="button" aria-label="删除文件夹" title="删除">×</button>
                </span>
                <span class="folder-preview">${previews || '<span class="folder-empty-dot">✦</span>'}</span>
                <strong>${escapeHtml(folder)}</strong>
                <small>${bookmarks.length} 个书签</small>
            </article>
        `;
    }

    private addFolderTemplate(): string {
        return `
            <button class="folder-tile add-folder-tile" type="button" data-liquid-item>
                <span class="add-folder-symbol">+</span>
                <strong>新建文件夹</strong>
                <small>把相关站点收进一个合集</small>
            </button>
        `;
    }

    private backTemplate(): string {
        return `
            <button class="folder-tile back-folder-tile" type="button" data-liquid-item>
                <span class="add-folder-symbol">←</span>
                <strong>返回全部</strong>
                <small>回到所有文件夹</small>
            </button>
        `;
    }

    private bindEvents(): void {
        this.querySelector('.anime-wallpaper')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('random-wallpaper', { bubbles: true, composed: true }));
        });
        this.querySelectorAll('.create-folder, .add-folder-tile').forEach((button) => {
            button.addEventListener('click', () => void this.createFolder());
        });
        this.querySelector('.back-folder-tile')?.addEventListener('click', () => {
            this.currentFolder = '全部';
            this.render();
        });
        this.querySelector('.add-bookmark-fab')?.addEventListener('click', () => this.openDialog());

        this.querySelectorAll<HTMLElement>('.folder-tile[data-folder]').forEach((card) => {
            const folder = card.dataset.folder ?? '全部';
            const enter = () => { this.currentFolder = folder; this.render(); };
            card.addEventListener('click', (event) => {
                if (!(event.target as HTMLElement).closest('.tile-action')) enter();
            });
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enter(); }
            });
            card.addEventListener('dragover', (event) => { event.preventDefault(); card.classList.add('drop-target'); });
            card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
            card.addEventListener('drop', (event) => {
                event.preventDefault();
                card.classList.remove('drop-target');
                const id = this.dragId(event);
                if (id !== null) void this.moveBookmark(id, folder);
            });
            card.querySelector('.rename-folder')?.addEventListener('click', (event) => {
                event.stopPropagation();
                void this.renameFolder(folder);
            });
            card.querySelector('.delete-folder')?.addEventListener('click', (event) => {
                event.stopPropagation();
                void this.deleteFolder(folder);
            });
        });

        this.querySelectorAll<HTMLAnchorElement>('.bookmark-tile').forEach((card) => {
            const id = card.dataset.bookmarkId ?? '';
            card.querySelectorAll<HTMLImageElement>('img').forEach((image) => this.bindIconFallback(image));
            card.addEventListener('dragstart', (event) => {
                this.draggingId = id;
                event.dataTransfer?.setData('text/plain', id);
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                card.classList.add('is-dragging');
            });
            card.addEventListener('dragend', () => {
                this.draggingId = null;
                card.classList.remove('is-dragging');
                this.querySelectorAll('.drop-target').forEach((item) => item.classList.remove('drop-target'));
            });
            card.addEventListener('dragover', (event) => { event.preventDefault(); card.classList.add('drop-target'); });
            card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
            card.addEventListener('drop', (event) => {
                event.preventDefault();
                event.stopPropagation();
                card.classList.remove('drop-target');
                const sourceId = this.dragId(event);
                if (sourceId !== null && sourceId !== id) void this.moveBookmark(sourceId, this.currentFolder, id);
            });
            card.querySelector('.edit-bookmark')?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const bookmark = appStore.state.bookmarks.find((item) => String(item.id) === String(id));
                if (bookmark) this.openDialog(bookmark);
            });
            card.querySelector('.delete-bookmark')?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (confirm('删除这个书签？')) void appStore.deleteBookmark(id).catch(showError);
            });
        });

        this.querySelectorAll<HTMLImageElement>('.folder-tile img').forEach((image) => this.bindIconFallback(image));

        this.querySelector('.launchpad-grid')?.addEventListener('dragover', (event) => event.preventDefault());
        this.querySelector('.launchpad-grid')?.addEventListener('drop', (event) => {
            if ((event.target as HTMLElement).closest('.bookmark-tile, .folder-tile[data-folder]')) return;
            event.preventDefault();
            const id = this.dragId(event as DragEvent);
            if (id !== null) void this.moveBookmark(id, this.currentFolder);
        });
    }

    private openDialog(bookmark?: Bookmark): void {
        this.dispatchEvent(new CustomEvent('open-bookmark-dialog', {
            bubbles: true,
            composed: true,
            detail: { bookmark, folder: this.currentFolder }
        }));
    }

    private async createFolder(): Promise<void> {
        const name = prompt('文件夹名称')?.trim();
        if (!name) return;
        try {
            if (!await appStore.addFolder(name)) alert('文件夹名称为空或已经存在。');
        } catch (error) { showError(error); }
    }

    private async renameFolder(folder: string): Promise<void> {
        const name = prompt('新的文件夹名称', folder)?.trim();
        if (!name || name === folder) return;
        try {
            if (!await appStore.renameFolder(folder, name)) alert('文件夹名称为空或已经存在。');
        } catch (error) { showError(error); }
    }

    private async deleteFolder(folder: string): Promise<void> {
        if (!confirm(`删除文件夹“${folder}”？其中的书签会移回“全部”。`)) return;
        try { await appStore.deleteFolder(folder); } catch (error) { showError(error); }
    }

    private async moveBookmark(id: Bookmark['id'], folder: string, targetId?: Bookmark['id']): Promise<void> {
        try { await appStore.moveBookmark(id, folder, targetId); } catch (error) { showError(error); }
    }

    private dragId(event: DragEvent): Bookmark['id'] | null {
        return event.dataTransfer?.getData('text/plain') || this.draggingId;
    }

    private bindIconFallback(image: HTMLImageElement): void {
        const fallback = image.dataset.iconFallback;
        if (!fallback) return;
        const useFallback = () => {
            if (image.dataset.fallbackUsed === 'true') {
                image.classList.add('icon-unavailable');
                return;
            }
            image.dataset.fallbackUsed = 'true';
            image.removeAttribute('srcset');
            image.src = fallback;
        };
        image.addEventListener('load', () => {
            if (image.dataset.iconRaster === 'true') image.classList.add('icon-raster');
            if (image.dataset.iconCanUpgrade === 'true'
                && image.dataset.fallbackUsed !== 'true'
                && image.naturalWidth > 0
                && image.naturalWidth < 64) {
                useFallback();
            }
        });
        image.addEventListener('error', useFallback);
    }
}

function compareBookmarks(left: Bookmark, right: Bookmark): number {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
}

function showError(error: unknown): void {
    alert(error instanceof Error ? error.message : '操作失败');
}
