import { isRecord, sanitizeImportedData } from './backup';
import { mediaStore } from './media-store';
import { appStore } from './store';
import type { BackupData } from './types';

/** The one backup format: the store's state, flat, plus local media as data URLs. */
const BACKUP_VERSION = '2.0';

export class BackupService {
    /** Backups keep the flat 2.0 layout even though sync storage now chunks bookmarks. */
    async exportData(): Promise<BackupData> {
        return {
            version: BACKUP_VERSION,
            exportDate: new Date().toISOString(),
            data: structuredClone(appStore.state) as unknown as Record<string, unknown>,
            localMedia: await mediaStore.export()
        };
    }

    /** Media is replaced first; if saving the synced data then fails, the previous media comes back. */
    async importData(value: unknown): Promise<void> {
        if (!isRecord(value) || !isRecord(value.data)) throw new Error('备份文件格式无效');
        if (value.version !== BACKUP_VERSION) throw new Error(`只支持 ${BACKUP_VERSION} 格式的备份（这个文件是 ${String(value.version ?? '未知')}）`);
        const data = sanitizeImportedData(value.data);
        // Without IndexedDB there is no media to protect; a backup without media still imports.
        const previous = await mediaStore.snapshot().catch(() => null);
        try {
            if (Object.hasOwn(value, 'localMedia')) await mediaStore.import(value.localMedia);
            await appStore.replaceImportedData(data);
        } catch (error) {
            if (previous) await mediaStore.restore(previous).catch(() => undefined);
            throw error;
        }
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
