import { dataUrlToBlob, isRecord } from './backup';
import type { LocalMediaBackup } from './types';

export type MediaKind = 'image' | 'video';
/** The stored media at one moment, to put back if a later step fails. */
export type MediaSnapshot = Record<MediaKind, Blob | null>;

const DATABASE = 'infinity-wallpaper';
const STORE = 'wallpapers';
const KINDS: MediaKind[] = ['image', 'video'];

class MediaStore {
    private database: Promise<IDBDatabase> | null = null;

    async get(kind: MediaKind): Promise<Blob | null> {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(kind);
            request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
            request.onerror = () => reject(request.error ?? new Error('无法读取本地壁纸'));
        });
    }

    async set(kind: MediaKind, value: Blob): Promise<void> {
        await this.write((store) => store.put(value, kind), '无法保存本地壁纸', '本地壁纸存储已中止');
    }

    async clear(kind: MediaKind): Promise<void> {
        await this.write((store) => store.delete(kind), '无法删除本地壁纸', '本地壁纸删除已中止');
    }

    async clearAll(): Promise<void> {
        await Promise.all(KINDS.map((kind) => this.clear(kind)));
    }

    async snapshot(): Promise<MediaSnapshot> {
        const [image, video] = await Promise.all(KINDS.map((kind) => this.get(kind)));
        return { image, video };
    }

    async restore(snapshot: MediaSnapshot): Promise<void> {
        for (const kind of KINDS) {
            const blob = snapshot[kind];
            if (blob) await this.set(kind, blob);
            else await this.clear(kind);
        }
    }

    async export(): Promise<LocalMediaBackup> {
        const { image, video } = await this.snapshot();
        return {
            image: image ? await blobToDataUrl(image) : null,
            video: video ? await blobToDataUrl(video) : null
        };
    }

    async import(value: unknown): Promise<void> {
        if (!isRecord(value)) {
            await this.clearAll();
            return;
        }
        for (const kind of KINDS) {
            const blob = dataUrlToBlob(value[kind]);
            if (blob) await this.set(kind, blob);
            else await this.clear(kind);
        }
    }

    private async write(run: (store: IDBObjectStore) => void, failed: string, aborted: string): Promise<void> {
        const database = await this.open();
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(STORE, 'readwrite');
            run(transaction.objectStore(STORE));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error(failed));
            transaction.onabort = () => reject(transaction.error ?? new Error(aborted));
        });
    }

    /** One connection for the page; it is dropped if it fails or another page upgrades the database. */
    private open(): Promise<IDBDatabase> {
        this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DATABASE, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
            };
            request.onsuccess = () => {
                const database = request.result;
                database.onversionchange = () => {
                    database.close();
                    this.database = null;
                };
                database.onclose = () => { this.database = null; };
                resolve(database);
            };
            request.onerror = () => reject(request.error ?? new Error('无法打开壁纸数据库'));
        });
        this.database.catch(() => { this.database = null; });
        return this.database;
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
