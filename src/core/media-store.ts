import { dataUrlToBlob, isRecord } from './backup';
import { storageGet, storageRemove, storageSet } from './storage';
import type { LocalMediaBackup } from './types';

export type MediaKind = 'image' | 'video';

const DATABASE = 'infinity-wallpaper';
const STORE = 'wallpapers';

class MediaStore {
    async get(kind: MediaKind): Promise<Blob | null> {
        try {
            const database = await this.open();
            return await new Promise((resolve) => {
                const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(kind);
                request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
                request.onerror = () => resolve(null);
            });
        } catch {
            const key = fallbackKey(kind);
            const result = await storageGet<Record<string, unknown>>([key], 'local');
            return result[key] instanceof Blob ? result[key] as Blob : null;
        }
    }

    async set(kind: MediaKind, value: Blob): Promise<void> {
        try {
            const database = await this.open();
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction(STORE, 'readwrite');
                transaction.objectStore(STORE).put(value, kind);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error ?? new Error('无法保存本地壁纸'));
            });
        } catch {
            await storageSet({ [fallbackKey(kind)]: value }, 'local');
        }
    }

    async clear(kind: MediaKind): Promise<void> {
        try {
            const database = await this.open();
            await new Promise<void>((resolve) => {
                const transaction = database.transaction(STORE, 'readwrite');
                transaction.objectStore(STORE).delete(kind);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => resolve();
            });
        } catch {
            // The fallback is cleared below regardless of IndexedDB availability.
        }
        await storageRemove([fallbackKey(kind)], 'local');
    }

    async clearAll(): Promise<void> {
        await Promise.all([this.clear('image'), this.clear('video')]);
    }

    async export(): Promise<LocalMediaBackup> {
        const [image, video] = await Promise.all([this.get('image'), this.get('video')]);
        return {
            image: image ? await blobToDataUrl(image) : null,
            video: video ? await blobToDataUrl(video) : null
        };
    }

    async import(value: unknown, replace = true): Promise<void> {
        if (!isRecord(value)) {
            if (replace) await this.clearAll();
            return;
        }
        for (const kind of ['image', 'video'] as const) {
            const blob = dataUrlToBlob(value[kind]);
            if (blob) await this.set(kind, blob);
            else if (replace) await this.clear(kind);
        }
    }

    private open(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('无法打开壁纸数据库'));
        });
    }
}

function fallbackKey(kind: MediaKind): string {
    return kind === 'image' ? 'localImageWallpaper' : 'localVideoWallpaper';
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('无法读取本地壁纸'));
        reader.readAsDataURL(blob);
    });
}

export const mediaStore = new MediaStore();
