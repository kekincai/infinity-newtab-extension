import { backupService } from '../core/backup-service';
import { mediaStore } from '../core/media-store';
import { appStore } from '../core/store';
import type { AppSettings } from '../core/types';
import { resetWallpaper, useLocalWallpaper, useOnlineWallpaper, wallpaperLabel } from '../core/wallpaper-service';
import { StoreElement } from './base';
import { ICONS } from './icons';
import { ENGINES } from './search-command';
import { CLOSE_ICON, confirmAction, notify, notifyError, pushLayer } from './ui-layer';

type Tab = 'appearance' | 'widgets' | 'wallpaper' | 'data';
type Option = [value: string, label: string];

const TABS: Array<[Tab, string, string]> = [
    ['appearance', '外观', ICONS.palette],
    ['widgets', '组件', ICONS.widgets],
    ['wallpaper', '壁纸', ICONS.image],
    ['data', '数据', ICONS.database]
];

export class SettingsDrawer extends StoreElement {
    protected readonly observedChanges = ['settings.appearance', 'settings.wallpaper', 'settings.layout'] as const;
    private openState = false;
    private activeTab: Tab = 'appearance';
    private releaseLayer: (() => void) | null = null;
    private previewUrl = '';
    private previewToken = 0;

    open(): void {
        if (this.openState) return;
        this.openState = true;
        this.syncOpenState();
        this.releaseLayer = pushLayer(this.querySelector<HTMLElement>('.settings-drawer')!, () => this.close());
        void this.refreshPreview();
        window.requestAnimationFrame(() => this.querySelector<HTMLButtonElement>('.settings-tab.is-active')?.focus());
    }

    close(): void {
        if (!this.openState) return;
        this.openState = false;
        this.syncOpenState();
        const release = this.releaseLayer;
        this.releaseLayer = null;
        release?.();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    }

    protected handleStoreChange(): void {
        this.syncControls(appStore.state.settings);
    }

    protected render(): void {
        this.innerHTML = `
            <aside class="settings-drawer glass-panel" aria-label="设置" aria-hidden="true" inert>
                <header class="settings-header">
                    <h2>设置</h2>
                    <button class="icon-close settings-close" type="button" aria-label="关闭设置">${CLOSE_ICON}</button>
                </header>
                <nav class="settings-tabs" role="tablist" aria-label="设置分类">
                    ${TABS.map(([tab, label, icon]) => `<button type="button" role="tab" id="settings-tab-${tab}" aria-controls="settings-pane" data-tab="${tab}" data-liquid-item class="settings-tab">${icon}<span>${label}</span></button>`).join('')}
                </nav>
                <div class="settings-pane" id="settings-pane" role="tabpanel"></div>
            </aside>
            <div class="settings-scrim" aria-hidden="true"></div>
        `;
        this.querySelector('.settings-close')?.addEventListener('click', () => this.close());
        this.querySelector('.settings-scrim')?.addEventListener('click', () => this.close());
        this.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
            button.addEventListener('click', () => this.selectTab(button.dataset.tab as Tab));
        });
        this.querySelector('.settings-tabs')?.addEventListener('keydown', (event) => {
            const key = (event as KeyboardEvent).key;
            if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
            const index = TABS.findIndex(([tab]) => tab === this.activeTab);
            const next = TABS[(index + (key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length][0];
            this.selectTab(next);
            this.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
        });
        this.renderPane();
        this.syncOpenState();
    }

    /** Only the pane is rebuilt; the drawer shell and its listeners stay put. */
    private selectTab(tab: Tab): void {
        if (tab === this.activeTab) return;
        this.activeTab = tab;
        this.renderPane();
    }

    private renderPane(): void {
        const pane = this.querySelector<HTMLElement>('.settings-pane');
        if (!pane) return;
        this.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
            const active = button.dataset.tab === this.activeTab;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        pane.setAttribute('aria-labelledby', `settings-tab-${this.activeTab}`);
        pane.innerHTML = this.paneTemplate(appStore.state.settings);
        pane.scrollTop = 0;
        this.bindPane(pane);
        if (this.activeTab === 'wallpaper') void this.refreshPreview();
    }

    private syncOpenState(): void {
        const drawer = this.querySelector<HTMLElement>('.settings-drawer');
        drawer?.classList.toggle('is-open', this.openState);
        drawer?.setAttribute('aria-hidden', String(!this.openState));
        drawer?.toggleAttribute('inert', !this.openState);
        this.querySelector('.settings-scrim')?.classList.toggle('is-open', this.openState);
        document.body.classList.toggle('settings-open', this.openState);
    }

    private syncControls(settings: AppSettings): void {
        const segments: Record<string, string> = {
            theme: settings.appearance.theme,
            clockFormat: settings.appearance.clockFormat,
            dateFormat: settings.appearance.dateFormat,
            searchEngine: settings.layout.searchEngine
        };
        this.querySelectorAll<HTMLElement>('[data-segment]').forEach((group) => {
            const value = segments[group.dataset.segment ?? ''];
            group.querySelectorAll<HTMLButtonElement>('[data-value]').forEach((button) => {
                const checked = button.dataset.value === value;
                button.classList.toggle('is-active', checked);
                button.setAttribute('aria-checked', String(checked));
                button.tabIndex = checked ? 0 : -1;
            });
        });

        const toggles: Record<string, boolean> = {
            enhancedAnimations: settings.appearance.enhancedAnimations,
            hdrHighlights: settings.appearance.hdrHighlights,
            showClock: settings.layout.showClock,
            showSearch: settings.layout.showSearch,
            showBookmarks: settings.layout.showBookmarks,
            showStatus: settings.layout.showStatus,
            showRecent: settings.layout.showRecent,
            openInNewTab: settings.layout.openInNewTab
        };
        this.querySelectorAll<HTMLInputElement>('input[data-toggle]').forEach((input) => {
            input.checked = toggles[input.dataset.toggle ?? ''] ?? input.checked;
            input.closest('liquid-toggle')?.classList.toggle('is-checked', input.checked);
        });
        this.querySelectorAll<HTMLElement>('[data-depends]').forEach((row) => {
            row.classList.toggle('is-disabled', !toggles[row.dataset.depends ?? '']);
        });

        const ranges: Record<string, number> = { blur: settings.wallpaper.blur, overlay: settings.wallpaper.overlay };
        this.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
            const value = ranges[input.name];
            if (!Number.isFinite(value) || Number(input.value) === value) return;
            input.value = String(value);
            input.dispatchEvent(new Event('input', { bubbles: false }));
        });
        const label = this.querySelector('.wallpaper-kind');
        if (label) label.textContent = wallpaperLabel(settings.wallpaper);
        if (this.activeTab === 'wallpaper') void this.refreshPreview();
    }

    private paneTemplate(settings: AppSettings): string {
        const { appearance, layout, wallpaper } = settings;
        if (this.activeTab === 'appearance') return `
            ${group('主题', `
                ${segmentRow('theme', '文字配色', appearance.theme, [['auto', '自动'], ['light', '深色文字'], ['dark', '浅色文字']])}
                <p class="setting-hint">“自动”会根据壁纸明暗选择文字颜色。</p>
            `)}
            ${group('效果', `
                ${toggle('enhancedAnimations', '增强动画', appearance.enhancedAnimations, '进场动画与 Liquid Glass 形变')}
                ${toggle('hdrHighlights', 'HDR 高光', appearance.hdrHighlights, hdrDescription())}
            `)}
        `;
        if (this.activeTab === 'widgets') return `
            ${group('时钟', `
                ${toggle('showClock', '显示时钟', layout.showClock)}
                <div class="setting-sub" data-depends="showClock">
                    ${segmentRow('clockFormat', '时间格式', appearance.clockFormat, [['24h', '24 小时'], ['12h', '12 小时']])}
                    ${segmentRow('dateFormat', '日期格式', appearance.dateFormat, [['long', '9月26日 星期六'], ['short', '9/26 周六']])}
                </div>
            `)}
            ${group('搜索', `
                ${toggle('showSearch', '显示搜索框', layout.showSearch, '按 / 键随时聚焦')}
                <div class="setting-sub" data-depends="showSearch">
                    ${segmentRow('searchEngine', '搜索引擎', layout.searchEngine, Object.entries(ENGINES).map(([key, engine]) => [key, engine.label] as Option))}
                </div>
            `)}
            ${group('启动台', `
                ${toggle('showBookmarks', '书签与文件夹', layout.showBookmarks)}
                ${toggle('showRecent', '常访问网站', layout.showRecent, '根据最近 30 天浏览记录生成')}
                ${toggle('openInNewTab', '在新标签页打开', layout.openInNewTab, '点击书签时保留当前页面')}
            `)}
            ${group('状态', `
                ${toggle('showStatus', '活动状态', layout.showStatus, '有媒体播放、下载或使用电池时显示在左上角')}
            `)}
        `;
        if (this.activeTab === 'wallpaper') return `
            <section class="wallpaper-preview" aria-label="当前壁纸">
                <div class="wallpaper-preview-media"></div>
                <span class="wallpaper-kind">${wallpaperLabel(wallpaper)}</span>
            </section>
            ${group('更换', `
                <div class="settings-actions">
                    <button class="settings-action random-wallpaper" type="button" data-liquid-item>${ICONS.shuffle}<span>随机二次元壁纸<small>下载后保存在本地，打开新标签页不再闪烁</small></span></button>
                    <label class="settings-action upload-wallpaper" data-liquid-item>${ICONS.upload}<span>上传图片或视频<small>视频会静音循环播放</small></span><input type="file" accept="image/*,video/*" hidden></label>
                    <button class="settings-action reset-wallpaper" type="button" data-liquid-item>${ICONS.reset}<span>恢复默认渐变</span></button>
                </div>
            `)}
            ${group('调节', `
                ${range('blur', '模糊', wallpaper.blur, 0, 10, 'px')}
                ${range('overlay', '遮罩', wallpaper.overlay, 0, 80, '%')}
            `)}
        `;
        return `
            ${group('备份', `
                <div class="settings-actions">
                    <button class="settings-action export-data" type="button" data-liquid-item>${ICONS.download}<span>导出备份<small>书签、设置和本地壁纸，保存为 JSON</small></span></button>
                    <label class="settings-action import-data" data-liquid-item>${ICONS.upload}<span>从备份恢复<small>支持 1.0 与 2.0 备份，会覆盖当前数据</small></span><input type="file" accept="application/json,.json" hidden></label>
                </div>
            `)}
            ${group('危险操作', `
                <div class="settings-actions">
                    <button class="settings-action danger reset-data" type="button" data-liquid-item>${ICONS.trash}<span>清空所有数据<small>删除全部书签、文件夹、设置和本地壁纸</small></span></button>
                </div>
            `, 'is-danger')}
        `;
    }

    private bindPane(pane: HTMLElement): void {
        pane.querySelectorAll<HTMLElement>('[data-segment]').forEach((groupElement) => {
            const buttons = [...groupElement.querySelectorAll<HTMLButtonElement>('[data-value]')];
            buttons.forEach((button) => button.addEventListener('click', () => {
                void this.applySegment(groupElement.dataset.segment ?? '', button.dataset.value ?? '');
            }));
            groupElement.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const index = buttons.findIndex((button) => button.classList.contains('is-active'));
                const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
                next.focus();
                next.click();
            });
        });
        pane.querySelectorAll<HTMLInputElement>('input[data-toggle]').forEach((input) => {
            input.addEventListener('change', () => void this.applyToggle(input.dataset.toggle ?? '', input.checked));
        });
        pane.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
            input.addEventListener('input', () => {
                const output = input.closest('.range-row')?.querySelector('output');
                if (output) output.textContent = `${input.value}${input.dataset.unit ?? ''}`;
                // Preview live on the wallpaper; persisted on release to spare sync write quota.
                document.querySelector<HTMLElement>('wallpaper-surface')?.style.setProperty(
                    input.name === 'blur' ? '--wallpaper-blur' : '--wallpaper-overlay',
                    input.name === 'blur' ? `${input.value}px` : String(Number(input.value) / 100)
                );
            });
            input.addEventListener('change', () => void appStore.updateSettings('wallpaper', {
                [input.name]: Number(input.value)
            } as Partial<AppSettings['wallpaper']>).catch(notifyError));
        });
        pane.querySelector('.random-wallpaper')?.addEventListener('click', (event) => void this.withBusy(event.currentTarget as HTMLElement, useOnlineWallpaper));
        pane.querySelector<HTMLInputElement>('.upload-wallpaper input')?.addEventListener('change', (event) => {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = '';
            if (file) void this.withBusy(input.closest('label')!, () => useLocalWallpaper(file));
        });
        pane.querySelector('.reset-wallpaper')?.addEventListener('click', () => void resetWallpaper().catch(notifyError));
        pane.querySelector('.export-data')?.addEventListener('click', () => void backupService.createBackup().catch(notifyError));
        pane.querySelector<HTMLInputElement>('.import-data input')?.addEventListener('change', (event) => {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = '';
            if (file) void this.importData(file);
        });
        pane.querySelector('.reset-data')?.addEventListener('click', () => void this.resetData());
        this.syncControls(appStore.state.settings);
    }

    private async withBusy(control: HTMLElement, task: () => Promise<void>): Promise<void> {
        if (control.classList.contains('is-busy')) return;
        control.classList.add('is-busy');
        control.setAttribute('aria-busy', 'true');
        try {
            await task();
        } catch (error) {
            notifyError(error);
        } finally {
            control.classList.remove('is-busy');
            control.removeAttribute('aria-busy');
        }
    }

    private async applySegment(name: string, value: string): Promise<void> {
        try {
            if (name === 'theme') await appStore.updateSettings('appearance', { theme: value as AppSettings['appearance']['theme'] });
            else if (name === 'clockFormat') await appStore.updateSettings('appearance', { clockFormat: value as '12h' | '24h' });
            else if (name === 'dateFormat') await appStore.updateSettings('appearance', { dateFormat: value as 'long' | 'short' });
            else if (name === 'searchEngine') await appStore.updateSettings('layout', { searchEngine: value as AppSettings['layout']['searchEngine'] });
        } catch (error) { notifyError(error); }
    }

    private async applyToggle(name: string, checked: boolean): Promise<void> {
        try {
            if (name === 'enhancedAnimations' || name === 'hdrHighlights') await appStore.updateSettings('appearance', { [name]: checked });
            else await appStore.updateSettings('layout', { [name]: checked });
        } catch (error) { notifyError(error); }
    }

    /** Mirrors the live wallpaper into the preview card without re-downloading anything. */
    private async refreshPreview(): Promise<void> {
        const host = this.querySelector<HTMLElement>('.wallpaper-preview-media');
        if (!host || !this.openState) return;
        const token = ++this.previewToken;
        const { type, value } = appStore.state.settings.wallpaper;
        const key = `${type}:${value}`;
        if (host.dataset.key === key) return;
        let url = '';
        try {
            if (type === 'local' || type === 'video') {
                const blob = await mediaStore.get(type === 'video' ? 'video' : 'image');
                if (blob) url = URL.createObjectURL(blob);
            }
        } catch {
            // The preview is decorative; the wallpaper surface reports real failures.
        }
        if (token !== this.previewToken) {
            if (url) URL.revokeObjectURL(url);
            return;
        }
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = url;
        host.dataset.key = key;
        host.replaceChildren();
        host.style.backgroundImage = '';
        if (type === 'video' && url) {
            const video = document.createElement('video');
            Object.assign(video, { src: url, muted: true, loop: true, autoplay: true, playsInline: true });
            host.append(video);
        } else if (type === 'local' && url) {
            host.style.backgroundImage = `url("${url}")`;
        } else if (type === 'preset' && value) {
            host.style.backgroundImage = `url("${value.replaceAll('"', '%22')}")`;
        }
    }

    private async importData(file: File): Promise<void> {
        const confirmed = await confirmAction({
            title: '从备份恢复？',
            body: '当前的书签、文件夹、设置和本地壁纸会被备份中的内容替换。建议先导出一份当前数据。',
            confirmText: '恢复'
        });
        if (!confirmed) return;
        try {
            await backupService.importData(await backupService.read(file));
            notify('已从备份恢复', 'success');
        } catch (error) { notifyError(error); }
    }

    private async resetData(): Promise<void> {
        const confirmed = await confirmAction({
            title: '清空所有数据？',
            body: `将删除 ${appStore.state.bookmarks.length} 个书签、全部文件夹、设置和本地壁纸，且无法撤销。`,
            confirmText: '清空',
            danger: true
        });
        if (!confirmed) return;
        try {
            await mediaStore.clearAll();
            await appStore.reset();
            notify('已清空所有数据', 'success');
        } catch (error) { notifyError(error); }
    }
}

function group(title: string, body: string, className = ''): string {
    return `<section class="settings-group ${className}"><h3>${title}</h3><div class="settings-card">${body}</div></section>`;
}

function segmentRow(name: string, label: string, value: string, options: Option[]): string {
    return `
        <div class="segment-row">
            <span class="segment-label" id="segment-${name}">${label}</span>
            <div class="segmented" role="radiogroup" aria-labelledby="segment-${name}" data-segment="${name}" style="--segments:${options.length}">
                ${options.map(([optionValue, optionLabel]) => {
                    const checked = optionValue === value;
                    return `<button type="button" role="radio" aria-checked="${checked}" tabindex="${checked ? 0 : -1}" class="${checked ? 'is-active' : ''}" data-value="${optionValue}" data-liquid-item>${optionLabel}</button>`;
                }).join('')}
            </div>
        </div>`;
}

function toggle(name: string, label: string, checked: boolean, description = ''): string {
    return `<label class="toggle-row"><span class="toggle-copy"><strong>${label}</strong>${description ? `<small>${description}</small>` : ''}</span><liquid-toggle><input type="checkbox" role="switch" data-toggle="${name}" ${checked ? 'checked' : ''}><span class="liquid-toggle-track" aria-hidden="true"><span class="liquid-toggle-thumb"></span></span></liquid-toggle></label>`;
}

function hdrDescription(): string {
    const hdrDisplay = window.matchMedia('(dynamic-range: high)').matches
        && CSS.supports('dynamic-range-limit', 'no-limit');
    if (!hdrDisplay) return '当前为 SDR 屏幕，连接 HDR 屏幕后自动生效';
    return 'gpu' in navigator
        ? 'HDR 媒体与 WebGPU 玻璃高光均已启用'
        : 'HDR 媒体已启用，当前浏览器未开放动态 HDR 高光';
}

function range(name: string, label: string, value: number, min: number, max: number, unit: string): string {
    return `<label class="range-row"><span>${label}<output>${value}${unit}</output></span><liquid-range><span class="liquid-range-track" aria-hidden="true"><span class="liquid-range-fill"></span></span><span class="liquid-range-thumb" aria-hidden="true"></span><input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}" aria-label="${label}"></liquid-range></label>`;
}
