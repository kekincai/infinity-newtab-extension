import { dataUrlToBlob, isRecord } from './backup';
import type { LocalMediaBackup } from './types';

export type MediaKind = 'image' | 'video';

const DATABASE = 'infinity-wallpaper';
const STORE = 'wallpapers';

class MediaStore {
    async get(kind: MediaKind): Promise<Blob | null> {
        const database = await this.open();
        try {
            return await new Promise((resolve, reject) => {
                const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(kind);
                request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
                request.onerror = () => reject(request.error ?? new Error('无法读取本地壁纸'));
            });
        } finally {
            database.close();
        }
    }

    async set(kind: MediaKind, value: Blob): Promise<void> {
        const database = await this.open();
        try {
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction(STORE, 'readwrite');
                transaction.objectStore(STORE).put(value, kind);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error ?? new Error('无法保存本地壁纸'));
                transaction.onabort = () => reject(transaction.error ?? new Error('本地壁纸存储已中止'));
            });
        } finally {
            database.close();
        }
    }

    async clear(kind: MediaKind): Promise<void> {
        const database = await this.open();
        try {
            await new Promise<void>((resolve, reject) => {
                const transaction = database.transaction(STORE, 'readwrite');
                transaction.objectStore(STORE).delete(kind);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error ?? new Error('无法删除本地壁纸'));
                transaction.onabort = () => reject(transaction.error ?? new Error('本地壁纸删除已中止'));
            });
        } finally {
            database.close();
        }
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

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('无法读取本地壁纸'));
        reader.readAsDataURL(blob);
    });
}

export const mediaStore = new MediaStore();
