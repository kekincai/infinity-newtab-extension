/** Promise wrappers over `chrome.storage.sync`, where every synced value lives. */
function sync(): any {
    return chrome.storage.sync;
}

export function storageGet<T extends Record<string, unknown>>(keys: string[] | string | null): Promise<T> {
    return new Promise((resolve, reject) => {
        sync().get(keys, (result: T) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(result ?? {} as T);
        });
    });
}

export function storageSet(values: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
        sync().set(values, () => {
            if (chrome.runtime.lastError) reject(new Error(describeWriteError(chrome.runtime.lastError.message)));
            else resolve();
        });
    });
}

export function storageRemove(keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        sync().remove(keys, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
        });
    });
}

export function storageClear(): Promise<void> {
    return new Promise((resolve, reject) => {
        sync().clear(() => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
        });
    });
}

/** Calls back whenever another tab, another device or this page changes synced data. */
export function onSyncChanged(callback: () => void): void {
    chrome.storage.onChanged?.addListener?.((_changes: unknown, areaName: string) => {
        if (areaName === 'sync') callback();
    });
}

function describeWriteError(message = ''): string {
    if (/QUOTA_BYTES/i.test(message)) return 'Chrome 同步空间已满（上限约 100 KB），请删除部分书签或自定义图标后重试';
    if (/MAX_WRITE_OPERATIONS/i.test(message)) return '操作太频繁，Chrome 暂时限制了同步写入，请稍后再试';
    return message || '保存失败';
}
