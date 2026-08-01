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
                <header class="settings-header">
                    <span class="settings-brand" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                    <div><span class="section-kicker">Infinity 控制台</span><h2>设置</h2></div>
                    <button class="settings-close" type="button" aria-label="关闭">×</button>
                </header>
                <div class="settings-workspace">
                    <div class="settings-tabs" role="tablist">
                        ${tabButton('appearance', '外观', '◌', this.activeTab)}
                        ${tabButton('wallpaper', '壁纸', '◇', this.activeTab)}
                        ${tabButton('layout', '布局', '⊞', this.activeTab)}
                        ${tabButton('data', '数据', '⇄', this.activeTab)}
                    </div>
                    <div class="settings-pane">${this.paneTemplate(settings)}</div>
                </div>
            </aside>
            <button class="settings-scrim ${this.openState ? 'is-open' : ''}" type="button" aria-label="关闭设置"></button>
        `;
        this.bind();
    }

    private paneTemplate(settings: AppSettings): string {
        if (this.activeTab === 'appearance') return `
            ${paneHeader('外观', '决定时间、搜索和交互呈现方式。')}
            <section class="settings-group">
                <h3>基础偏好</h3>
                <label class="setting-field"><span>时钟格式</span><select data-setting="clockFormat"><option value="24h" ${settings.appearance.clockFormat === '24h' ? 'selected' : ''}>24 小时制</option><option value="12h" ${settings.appearance.clockFormat === '12h' ? 'selected' : ''}>12 小时制</option></select></label>
                <label class="setting-field"><span>搜索引擎</span><select data-setting="searchEngine"><option value="google" ${settings.layout.searchEngine === 'google' ? 'selected' : ''}>Google</option><option value="bing" ${settings.layout.searchEngine === 'bing' ? 'selected' : ''}>Bing</option><option value="baidu" ${settings.layout.searchEngine === 'baidu' ? 'selected' : ''}>百度</option><option value="duckduckgo" ${settings.layout.searchEngine === 'duckduckgo' ? 'selected' : ''}>DuckDuckGo</option></select></label>
            </section>
            <section class="settings-group settings-list">
                <h3>视觉体验</h3>
                ${toggle('enhancedAnimations', '增强动画', settings.appearance.enhancedAnimations, '启用进场动画与 Liquid Glass 形变')}
                ${toggle('hdrHighlights', 'HDR 高光', settings.appearance.hdrHighlights, hdrDescription())}
                ${toggle('darkText', '使用深色文字', settings.appearance.theme === 'light', '浅色壁纸推荐开启，深色壁纸可关闭')}
            </section>
        `;
        if (this.activeTab === 'wallpaper') return `
            ${paneHeader('壁纸', '让启动台适配图片、视频和不同明暗背景。')}
            <section class="settings-group">
                <h3>壁纸来源</h3>
                <div class="settings-button-stack">
                    <button class="settings-action settings-action-featured random-wallpaper" type="button" data-liquid-item><b>✦</b><span>换一张二次元壁纸<small>从在线图源随机获取</small></span></button>
                    <label class="settings-action upload-wallpaper" data-liquid-item><b>↑</b><span>上传本地图片或视频<small>视频会自动静音循环播放</small></span><input type="file" accept="image/*,video/*" hidden></label>
                    <button class="settings-action reset-wallpaper" type="button" data-liquid-item><b>↻</b><span>恢复默认背景</span></button>
                </div>
            </section>
            <section class="settings-group">
                <h3>画面调节</h3>
                ${range('blur', '模糊度', settings.wallpaper.blur, 0, 10, 'px')}
                ${range('overlay', '暗度', settings.wallpaper.overlay, 0, 80, '%')}
            </section>
        `;
        if (this.activeTab === 'layout') return `
            ${paneHeader('布局', '只保留你每天真正会看的区域。')}
            <section class="settings-group settings-list">
                <h3>桌面组件</h3>
                ${toggle('showClock', '时钟与日期', settings.layout.showClock, '显示在页面顶部左侧')}
                ${toggle('showSearch', '搜索框', settings.layout.showSearch, '使用斜杠键可快速聚焦')}
                ${toggle('showBookmarks', '书签与文件夹', settings.layout.showBookmarks, '启动台的主要工作区域')}
                ${toggle('showStatus', '活动与系统状态', settings.layout.showStatus, '媒体、下载、电池和设备信息')}
                ${toggle('showRecent', '最近常访问', settings.layout.showRecent, '根据本机浏览历史聚合网站')}
            </section>
        `;
        return `
            ${paneHeader('数据', '备份、迁移或恢复当前启动台。')}
            <section class="settings-group">
                <h3>备份与恢复</h3>
                <div class="settings-button-stack">
                    <button class="settings-action export-data" type="button" data-liquid-item><b>↓</b><span>导出数据<small>保存书签、设置和本地壁纸</small></span></button>
                    <label class="settings-action import-data" data-liquid-item><b>↑</b><span>导入数据<small>兼容旧版 1.0 与 2.0 备份</small></span><input type="file" accept="application/json,.json" hidden></label>
                    <button class="settings-action danger reset-data" type="button" data-liquid-item><b>↻</b><span>重置所有设置<small>清空后无法撤销</small></span></button>
                </div>
            </section>
            <div class="data-note"><strong>导入前建议先导出</strong><p>导入操作会覆盖当前书签、布局与壁纸设置。</p></div>
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
        const appearance = ['enhancedAnimations', 'hdrHighlights', 'darkText'];
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

function tabButton(tab: Tab, label: string, icon: string, active: Tab): string {
    return `<button type="button" role="tab" data-tab="${tab}" data-liquid-item class="settings-tab ${tab === active ? 'is-active' : ''}" aria-selected="${tab === active}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`;
}

function paneHeader(title: string, description: string): string {
    return `<header class="settings-pane-header"><h3>${title}</h3><p>${description}</p></header>`;
}

function toggle(name: string, label: string, checked: boolean, description = ''): string {
    return `<label class="toggle-row"><span class="toggle-copy"><strong>${label}</strong>${description ? `<small>${description}</small>` : ''}</span><input type="checkbox" data-toggle="${name}" ${checked ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
}

function hdrDescription(): string {
    const hdrDisplay = window.matchMedia('(dynamic-range: high)').matches
        && CSS.supports('dynamic-range-limit', 'no-limit');
    if (!hdrDisplay) return '当前为 SDR，连接 HDR 屏幕后自动启用';
    return CSS.supports('color', 'color(rec2100-pq 0.64 0.64 0.64)')
        ? 'HDR 媒体与 Rec.2100 PQ 玻璃高光均已启用'
        : 'HDR 媒体已启用，玻璃高光使用浏览器兼容色';
}

function range(name: string, label: string, value: number, min: number, max: number, unit: string): string {
    return `<label class="range-row"><span>${label}<output>${value}${unit}</output></span><input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}"></label>`;
}

function showError(error: unknown): void {
    alert(error instanceof Error ? error.message : '操作失败');
}
