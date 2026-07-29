import { backupService } from '../core/backup-service';
import { mediaStore } from '../core/media-store';
import { appStore } from '../core/store';
import type { AppSettings } from '../core/types';
import { StoreElement } from './base';

type Tab = 'appearance' | 'wallpaper' | 'layout' | 'data';

export class SettingsDrawer extends StoreElement {
    private openState = false;
    private activeTab: Tab = 'appearance';

    open(): void {
        this.openState = true;
        this.render();
    }

    close(): void {
        this.openState = false;
        this.render();
    }

    protected render(): void {
        const settings = appStore.state.settings;
        this.innerHTML = `
            <aside class="settings-drawer glass-panel ${this.openState ? 'is-open' : ''}" aria-hidden="${!this.openState}" ${this.openState ? '' : 'inert'}>
                <header class="settings-header"><div><span class="section-kicker">个性化控制台</span><h2>设置</h2></div><button class="settings-close" type="button" aria-label="关闭">×</button></header>
                <liquid-surface class="settings-tabs" role="tablist">
                    ${tabButton('appearance', '外观', this.activeTab)}
                    ${tabButton('wallpaper', '壁纸', this.activeTab)}
                    ${tabButton('layout', '布局', this.activeTab)}
                    ${tabButton('data', '数据', this.activeTab)}
                </liquid-surface>
                <div class="settings-pane">${this.paneTemplate(settings)}</div>
            </aside>
            <button class="settings-scrim ${this.openState ? 'is-open' : ''}" type="button" aria-label="关闭设置"></button>
        `;
        this.bind();
    }

    private paneTemplate(settings: AppSettings): string {
        if (this.activeTab === 'appearance') return `
            <label class="setting-field"><span>时钟格式</span><select data-setting="clockFormat"><option value="24h" ${settings.appearance.clockFormat === '24h' ? 'selected' : ''}>24 小时制</option><option value="12h" ${settings.appearance.clockFormat === '12h' ? 'selected' : ''}>12 小时制</option></select></label>
            <label class="setting-field"><span>搜索引擎</span><select data-setting="searchEngine"><option value="google" ${settings.layout.searchEngine === 'google' ? 'selected' : ''}>Google</option><option value="bing" ${settings.layout.searchEngine === 'bing' ? 'selected' : ''}>Bing</option><option value="baidu" ${settings.layout.searchEngine === 'baidu' ? 'selected' : ''}>百度</option><option value="duckduckgo" ${settings.layout.searchEngine === 'duckduckgo' ? 'selected' : ''}>DuckDuckGo</option></select></label>
            ${toggle('enhancedAnimations', '增强动画', settings.appearance.enhancedAnimations)}
            ${toggle('darkText', '使用深色文字', settings.appearance.theme === 'light')}
        `;
        if (this.activeTab === 'wallpaper') return `
            <liquid-surface class="settings-button-stack">
                <button class="settings-action random-wallpaper" type="button" data-liquid-item>✦ 二次元随机壁纸</button>
                <label class="settings-action upload-wallpaper" data-liquid-item>↑ 上传本地图片或视频<input type="file" accept="image/*,video/*" hidden></label>
                <button class="settings-action reset-wallpaper" type="button" data-liquid-item>↻ 重置默认壁纸</button>
            </liquid-surface>
            ${range('blur', '模糊度', settings.wallpaper.blur, 0, 10, 'px')}
            ${range('overlay', '暗度', settings.wallpaper.overlay, 0, 80, '%')}
        `;
        if (this.activeTab === 'layout') return `
            ${toggle('showClock', '显示时钟与日期', settings.layout.showClock)}
            ${toggle('showSearch', '显示搜索框', settings.layout.showSearch)}
            ${toggle('showBookmarks', '显示书签与文件夹', settings.layout.showBookmarks)}
            ${toggle('showStatus', '显示活动与系统状态', settings.layout.showStatus)}
            ${toggle('showRecent', '显示最近常访问', settings.layout.showRecent)}
        `;
        return `
            <liquid-surface class="settings-button-stack">
                <button class="settings-action export-data" type="button" data-liquid-item>↓ 导出数据</button>
                <label class="settings-action import-data" data-liquid-item>↑ 导入数据<input type="file" accept="application/json,.json" hidden></label>
                <button class="settings-action danger reset-data" type="button" data-liquid-item>↻ 重置所有设置</button>
            </liquid-surface>
            <div class="data-note"><p>导出文件包含书签、设置和本地图片/视频壁纸。</p><p>兼容旧版 1.0 与 2.0 备份，导入会覆盖当前数据。</p></div>
        `;
    }

    private bind(): void {
        this.querySelector('.settings-close')?.addEventListener('click', () => this.close());
        this.querySelector('.settings-scrim')?.addEventListener('click', () => this.close());
        this.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                this.activeTab = button.dataset.tab as Tab;
                this.render();
            });
        });
        this.querySelector<HTMLSelectElement>('[data-setting="clockFormat"]')?.addEventListener('change', (event) => {
            void appStore.updateSettings('appearance', { clockFormat: (event.target as HTMLSelectElement).value as '12h' | '24h' });
        });
        this.querySelector<HTMLSelectElement>('[data-setting="searchEngine"]')?.addEventListener('change', (event) => {
            void appStore.updateSettings('layout', { searchEngine: (event.target as HTMLSelectElement).value as AppSettings['layout']['searchEngine'] });
        });
        this.querySelectorAll<HTMLInputElement>('input[data-toggle]').forEach((input) => {
            input.addEventListener('change', () => void this.applyToggle(input.dataset.toggle ?? '', input.checked));
        });
        this.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
            input.addEventListener('input', () => {
                const output = input.closest('label')?.querySelector('output');
                if (output) output.textContent = `${input.value}${input.dataset.unit ?? ''}`;
            });
            input.addEventListener('change', () => void appStore.updateSettings('wallpaper', {
                [input.name]: Number(input.value)
            } as Partial<AppSettings['wallpaper']>));
        });
        this.querySelector('.random-wallpaper')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('random-wallpaper', { bubbles: true, composed: true }));
        });
        this.querySelector<HTMLInputElement>('.upload-wallpaper input')?.addEventListener('change', (event) => {
            void this.uploadWallpaper((event.target as HTMLInputElement).files?.[0]);
        });
        this.querySelector('.reset-wallpaper')?.addEventListener('click', () => void this.resetWallpaper());
        this.querySelector('.export-data')?.addEventListener('click', () => void this.exportData());
        this.querySelector<HTMLInputElement>('.import-data input')?.addEventListener('change', (event) => {
            void this.importData((event.target as HTMLInputElement).files?.[0]);
        });
        this.querySelector('.reset-data')?.addEventListener('click', () => void this.resetData());
    }

    private async applyToggle(name: string, checked: boolean): Promise<void> {
        const appearance = ['enhancedAnimations', 'darkText'];
        try {
            if (name === 'darkText') await appStore.updateSettings('appearance', { theme: checked ? 'light' : 'dark' });
            else if (appearance.includes(name)) await appStore.updateSettings('appearance', { [name]: checked });
            else await appStore.updateSettings('layout', { [name]: checked });
        } catch (error) { showError(error); }
    }

    private async uploadWallpaper(file?: File): Promise<void> {
        if (!file) return;
        const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
        if (!kind) { alert('请选择图片或视频文件。'); return; }
        try {
            await mediaStore.set(kind, file);
            await appStore.updateSettings('wallpaper', { type: kind === 'video' ? 'video' : 'local', value: 'local' });
        } catch (error) { showError(error); }
    }

    private async resetWallpaper(): Promise<void> {
        try {
            await mediaStore.clearAll();
            await appStore.updateSettings('wallpaper', { type: 'gradient', value: '', blur: 0, overlay: 30 });
        } catch (error) { showError(error); }
    }

    private async exportData(): Promise<void> {
        try { await backupService.createBackup(); } catch (error) { showError(error); }
    }

    private async importData(file?: File): Promise<void> {
        if (!file || !confirm('导入会覆盖当前书签与设置，继续吗？')) return;
        try {
            await backupService.importData(await backupService.read(file));
            alert('导入完成，旧数据已经转换到新版本。');
        } catch (error) { showError(error); }
    }

    private async resetData(): Promise<void> {
        if (!confirm('确定清空所有书签、设置和本地壁纸吗？此操作无法撤销。')) return;
        try {
            await mediaStore.clearAll();
            await appStore.reset();
        } catch (error) { showError(error); }
    }
}

function tabButton(tab: Tab, label: string, active: Tab): string {
    return `<button type="button" role="tab" data-tab="${tab}" data-liquid-item class="settings-tab ${tab === active ? 'is-active' : ''}" aria-selected="${tab === active}">${label}</button>`;
}

function toggle(name: string, label: string, checked: boolean): string {
    return `<label class="toggle-row"><span>${label}</span><input type="checkbox" data-toggle="${name}" ${checked ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
}

function range(name: string, label: string, value: number, min: number, max: number, unit: string): string {
    return `<label class="range-row"><span>${label}<output>${value}${unit}</output></span><input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}"></label>`;
}

function showError(error: unknown): void {
    alert(error instanceof Error ? error.message : '操作失败');
}
