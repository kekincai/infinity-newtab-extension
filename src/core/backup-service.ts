import { dataUrlToBlob, isRecord, sanitizeImportedData } from './backup';
import { mediaStore } from './media-store';
import { appStore } from './store';
import { storageGet } from './storage';
import type { BackupData } from './types';

export class BackupService {
    async exportData(): Promise<BackupData> {
        return {
            version: '2.0',
            exportDate: new Date().toISOString(),
            data: await storageGet<Record<string, unknown>>(null),
            localMedia: await mediaStore.export()
        };
    }

    async importData(value: unknown): Promise<void> {
        if (!isRecord(value) || !value.version || !isRecord(value.data)) {
            throw new Error('备份文件格式无效');
        }
        const data = sanitizeImportedData(value.data);
        if (Object.hasOwn(value, 'localMedia')) await mediaStore.import(value.localMedia, true);

        const settings = data.settings;
        if (isRecord(settings) && isRecord(settings.wallpaper)) {
            const wallpaper = settings.wallpaper;
            if (wallpaper.type === 'local' && typeof wallpaper.value === 'string' && wallpaper.value.startsWith('data:image/')) {
                const image = dataUrlToBlob(wallpaper.value);
                if (!image) throw new Error('旧备份中的本地壁纸无效');
                await mediaStore.set('image', image);
                wallpaper.value = 'local';
            }
        }
        await appStore.replaceImportedData(data);
    }

    download(data: BackupData, filename = `infinity-newtab-backup-${dateStamp()}.json`): void {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async read(file: File): Promise<unknown> {
        try {
            return JSON.parse(await file.text());
        } catch {
            throw new Error('无法读取 JSON 备份文件');
        }
    }

    async createBackup(): Promise<void> {
        this.download(await this.exportData());
    }
}

function dateStamp(): string {
    return new Date().toISOString().slice(0, 10);
}

export const backupService = new BackupService();
