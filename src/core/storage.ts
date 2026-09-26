export type StorageAreaName = 'sync' | 'local';

function area(name: StorageAreaName): any {
    return chrome.storage[name];
}

export function storageGet<T extends Record<string, unknown>>(
    keys: string[] | string | null,
    areaName: StorageAreaName = 'sync'
): Promise<T> {
    return new Promise((resolve, reject) => {
        area(areaName).get(keys, (result: T) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(result ?? {} as T);
        });
    });
}

export function storageSet(
    values: Record<string, unknown>,
    areaName: StorageAreaName = 'sync'
): Promise<void> {
    return new Promise((resolve, reject) => {
        area(areaName).set(values, () => {
            if (chrome.runtime.lastError) reject(new Error(describeWriteError(chrome.runtime.lastError.message)));
            else resolve();
        });
    });
}

export function storageRemove(
    keys: string[],
    areaName: StorageAreaName = 'sync'
): Promise<void> {
    return new Promise((resolve, reject) => {
        area(areaName).remove(keys, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
        });
    });
}

export function storageClear(areaName: StorageAreaName = 'sync'): Promise<void> {
    return new Promise((resolve, reject) => {
        area(areaName).clear(() => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
        });
    });
}

function describeWriteError(message = ''): string {
    if (/QUOTA_BYTES/i.test(message)) return 'Chrome 同步空间已满（上限约 100 KB），请删除部分书签或自定义图标后重试';
    if (/MAX_WRITE_OPERATIONS/i.test(message)) return '操作太频繁，Chrome 暂时限制了同步写入，请稍后再试';
    return message || '保存失败';
}
