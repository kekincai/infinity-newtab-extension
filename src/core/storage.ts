/**
 * Thin async wrappers over `chrome.storage`. Bookmarks and most settings live
 * in `sync`, shared by every device signed in to the Chrome account; the
 * wallpaper settings live in `local`, next to the picture or video they
 * describe, which never leaves this device.
 */
function sync(): any {
    return chrome.storage.sync;
}

function local(): any {
    return chrome.storage.local;
}

export async function storageGet<T extends Record<string, unknown>>(keys: string[] | string | null): Promise<T> {
    return (await sync().get(keys) ?? {}) as T;
}

export async function storageSet(values: Record<string, unknown>): Promise<void> {
    try {
        await sync().set(values);
    } catch (error) {
        throw new Error(describeWriteError(error instanceof Error ? error.message : String(error)), { cause: error });
    }
}

export async function storageRemove(keys: string[]): Promise<void> {
    await sync().remove(keys);
}

export async function storageClear(): Promise<void> {
    await sync().clear();
}

export async function localGet<T extends Record<string, unknown>>(keys: string[] | string | null): Promise<T> {
    return (await local().get(keys) ?? {}) as T;
}

export async function localSet(values: Record<string, unknown>): Promise<void> {
    try {
        await local().set(values);
    } catch (error) {
        throw new Error(error instanceof Error && error.message ? error.message : '保存失败', { cause: error });
    }
}

export async function localClear(): Promise<void> {
    await local().clear();
}

/** Bytes the synced data takes, or null where Chrome cannot tell. */
export async function storageBytesInUse(): Promise<number | null> {
    try {
        return typeof sync().getBytesInUse === 'function' ? await sync().getBytesInUse(null) : null;
    } catch {
        return null;
    }
}

/** Calls back whenever another tab, another device or this page changes stored data. */
export function onStorageChanged(callback: () => void): void {
    chrome.storage.onChanged?.addListener?.((_changes: unknown, areaName: string) => {
        if (areaName === 'sync' || areaName === 'local') callback();
    });
}

function describeWriteError(message = ''): string {
    if (/QUOTA_BYTES_PER_ITEM/i.test(message)) return '单项数据超过 Chrome 同步的 8 KB 上限，请缩短名称或改用图标网址后重试';
    if (/QUOTA_BYTES/i.test(message)) return 'Chrome 同步空间已满（上限约 100 KB），请删除部分书签或自定义图标后重试';
    if (/MAX_WRITE_OPERATIONS/i.test(message)) return '操作太频繁，Chrome 暂时限制了同步写入，请稍后再试';
    return message || '保存失败';
}
