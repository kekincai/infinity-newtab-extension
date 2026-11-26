/** Thin async wrappers over `chrome.storage.sync`, where every synced value lives. */
function sync(): any {
    return chrome.storage.sync;
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

/** Bytes the synced data takes, or null where Chrome cannot tell. */
export async function storageBytesInUse(): Promise<number | null> {
    try {
        return typeof sync().getBytesInUse === 'function' ? await sync().getBytesInUse(null) : null;
    } catch {
        return null;
    }
}

/** Calls back whenever another tab, another device or this page changes synced data. */
export function onSyncChanged(callback: () => void): void {
    chrome.storage.onChanged?.addListener?.((_changes: unknown, areaName: string) => {
        if (areaName === 'sync') callback();
    });
}

function describeWriteError(message = ''): string {
    if (/QUOTA_BYTES_PER_ITEM/i.test(message)) return '单项数据超过 Chrome 同步的 8 KB 上限，请缩短名称或改用图标网址后重试';
    if (/QUOTA_BYTES/i.test(message)) return 'Chrome 同步空间已满（上限约 100 KB），请删除部分书签或自定义图标后重试';
    if (/MAX_WRITE_OPERATIONS/i.test(message)) return '操作太频繁，Chrome 暂时限制了同步写入，请稍后再试';
    return message || '保存失败';
}
