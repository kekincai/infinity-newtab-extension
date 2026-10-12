import { appStore } from '../core/store';
import type { Bookmark, RecentSite } from '../core/types';
import { cleanDisplayName } from '../core/utils';
import { ICONS } from './icons';
import { confirmAction, notifyError, openMenu, promptText } from './ui-layer';

export const ROOT_FOLDER = '全部';

type MenuAnchor = { x: number; y: number } | HTMLElement;

export function findBookmark(id: string): Bookmark | undefined {
    return appStore.state.bookmarks.find((item) => String(item.id) === String(id));
}

export function compareBookmarks(left: Bookmark, right: Bookmark): number {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
}

export function bookmarksIn(folder: string): Bookmark[] {
    return appStore.state.bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks);
}

export function bookmarkName(bookmark: Bookmark): string {
    return cleanDisplayName(bookmark.name) || cleanDisplayName(new URL(bookmark.url).hostname);
}

/** Extension pages cannot be opened through a plain link from another extension, so they go through the tabs API. */
export function interceptExtensionLink(event: MouseEvent, url: string): void {
    if (event.defaultPrevented || new URL(url).protocol !== 'chrome-extension:') return;
    event.preventDefault();
    void Promise.resolve(chrome.tabs.create({ url })).catch(notifyError);
}

export function openInNewTab(url: string): void {
    void Promise.resolve(chrome.tabs.create({ url })).catch(notifyError);
}

export function openBookmarkDialog(source: HTMLElement, detail: { bookmark?: Bookmark; folder?: string; draft?: { url: string; name: string } }): void {
    source.dispatchEvent(new CustomEvent('open-bookmark-dialog', { bubbles: true, composed: true, detail }));
}

export function bookmarkMenu(source: HTMLElement, bookmark: Bookmark, at: MenuAnchor): void {
    const destinations = appStore.state.folders.filter((folder) => folder !== bookmark.folder);
    openMenu([
        { label: '在新标签页打开', icon: ICONS.open, action: () => openInNewTab(bookmark.url) },
        { label: '编辑…', icon: ICONS.edit, action: () => openBookmarkDialog(source, { bookmark }) },
        ...(destinations.length ? [
            { separator: true } as const,
            { heading: '移动到文件夹' } as const,
            ...destinations.map((folder) => ({ label: folder, icon: ICONS.move, action: () => void moveBookmark(bookmark.id, folder) }))
        ] : []),
        { separator: true },
        { label: '删除书签', icon: ICONS.trash, danger: true, action: () => void deleteBookmark(bookmark) }
    ], at);
}

export function siteMenu(source: HTMLElement, site: RecentSite, at: MenuAnchor): void {
    openMenu([
        { label: '在新标签页打开', icon: ICONS.open, action: () => openInNewTab(site.url) },
        { label: '添加到书签', icon: ICONS.plus, action: () => openBookmarkDialog(source, { draft: { url: site.url, name: site.title } }) }
    ], at);
}

export async function moveBookmark(id: Bookmark['id'], folder: string, targetId?: Bookmark['id']): Promise<void> {
    try { await appStore.moveBookmark(id, folder, targetId); } catch (error) { notifyError(error); }
}

export async function deleteBookmark(bookmark: Bookmark): Promise<void> {
    const confirmed = await confirmAction({
        title: `删除“${bookmarkName(bookmark) || bookmark.url}”？`,
        confirmText: '删除',
        danger: true
    });
    if (confirmed) await appStore.deleteBookmark(bookmark.id).catch(notifyError);
}

export async function createFolder(): Promise<string | null> {
    const name = await promptText('新建文件夹', { label: '名称', placeholder: '例如：工作、娱乐' }, '创建');
    if (!name) return null;
    try {
        if (await appStore.addFolder(name)) return name;
        notifyError(new Error(`已经有名为“${name}”的文件夹`));
    } catch (error) { notifyError(error); }
    return null;
}

/** `follow` runs before the store re-renders so an open view can move with the rename (and back on failure). */
export async function renameFolder(folder: string, follow: (name: string) => void = () => undefined): Promise<void> {
    const name = await promptText('重命名文件夹', { label: '名称', value: folder });
    if (!name || name === folder) return;
    follow(name);
    try {
        if (await appStore.renameFolder(folder, name)) return;
        follow(folder);
        notifyError(new Error(`已经有名为“${name}”的文件夹`));
    } catch (error) {
        follow(folder);
        notifyError(error);
    }
}

export async function deleteFolder(folder: string): Promise<boolean> {
    const count = bookmarksIn(folder).length;
    const confirmed = await confirmAction({
        title: `删除文件夹“${folder}”？`,
        body: count ? `其中的 ${count} 个书签会移回“${ROOT_FOLDER}”，不会被删除。` : '这个文件夹是空的。',
        confirmText: '删除',
        danger: true
    });
    if (!confirmed) return false;
    try {
        await appStore.deleteFolder(folder);
        return true;
    } catch (error) {
        notifyError(error);
        return false;
    }
}
