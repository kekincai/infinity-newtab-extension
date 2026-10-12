import { backupService } from '../core/backup-service';
import { appStore } from '../core/store';
import { StoreElement } from './base';
import { notifyError } from './ui-layer';

const REMINDER_INTERVAL = 30 * 24 * 60 * 60 * 1000;

/** Monthly reminder, shown only once there is something worth backing up. */
export class BackupToast extends StoreElement {
    protected readonly observedChanges = ['lastBackupPrompt', 'bookmarks', 'settings.layout'] as const;
    private dismissed = false;

    protected render(): void {
        const due = Date.now() - appStore.state.lastBackupPrompt >= REMINDER_INTERVAL;
        this.hidden = !due || this.dismissed || !appStore.state.bookmarks.length || !appStore.state.settings.layout.backupReminder;
        if (this.hidden) {
            this.innerHTML = '';
            return;
        }
        this.innerHTML = `
            <div class="backup-toast glass glass-thick" role="status">
                <span>已经一个月没备份了，导出一份书签更安心</span>
                <div class="backup-actions">
                    <button class="pill-button backup-later" type="button" data-liquid-item>稍后</button>
                    <button class="pill-button primary backup-now" type="button" data-liquid-item>立即导出</button>
                </div>
            </div>
        `;
        this.querySelector('.backup-now')?.addEventListener('click', () => void this.finish(true));
        this.querySelector('.backup-later')?.addEventListener('click', () => void this.finish(false));
    }

    private async finish(exportNow: boolean): Promise<void> {
        try {
            if (exportNow) await backupService.createBackup();
            this.dismissed = true;
            await appStore.setLastBackupPrompt();
        } catch (error) {
            notifyError(error, '备份失败');
        }
    }
}
