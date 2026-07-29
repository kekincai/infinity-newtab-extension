import { backupService } from '../core/backup-service';
import { appStore } from '../core/store';
import { StoreElement } from './base';

const REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export class BackupToast extends StoreElement {
    private dismissed = false;

    protected render(): void {
        const due = Date.now() - appStore.state.lastBackupPrompt >= REMINDER_INTERVAL;
        this.hidden = !due || this.dismissed;
        this.innerHTML = `
            <div class="backup-toast glass-panel">
                <span>备份一下，书签会更安心</span>
                <liquid-surface class="backup-actions"><button class="glass-button primary backup-now" type="button" data-liquid-item>立即导出</button><button class="glass-button backup-later" type="button" data-liquid-item>稍后</button></liquid-surface>
            </div>
        `;
        this.querySelector('.backup-now')?.addEventListener('click', () => void this.finish(true));
        this.querySelector('.backup-later')?.addEventListener('click', () => void this.finish(false));
    }

    private async finish(exportNow: boolean): Promise<void> {
        try {
            if (exportNow) await backupService.createBackup();
            await appStore.setLastBackupPrompt();
            this.dismissed = true;
            this.render();
        } catch (error) {
            alert(error instanceof Error ? error.message : '备份失败');
        }
    }
}
