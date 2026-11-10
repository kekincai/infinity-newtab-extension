import { backupService } from '../core/backup-service';
import { mediaStore } from '../core/media-store';
import { appStore } from '../core/store';
import type { AppSettings } from '../core/types';
import { escapeHtml } from '../core/utils';
import { mediaKindOf, resetWallpaper, useLocalWallpaper, useOnlineWallpaper, wallpaperLabel } from '../core/wallpaper-service';
import { StoreElement } from './base';
import { formatDate } from './dashboard-header';
import { isHdrDisplay, onHdrDisplayChange } from './hdr-glass';
import { ICONS, SETTINGS_GLYPHS } from './icons';
import { ENGINES, SHORTCUT_LABEL } from './search-box';
import { afterMotion, confirmAction, notify, notifyError, pushLayer } from './ui-layer';

type Pane = 'appearance' | 'widgets' | 'wallpaper' | 'data';
type Option = [value: string, label: string];

const PASTE_LABEL = SHORTCUT_LABEL === '⌘K' ? '⌘V' : 'Ctrl+V';

const PANES: Array<[Pane, string]> = [
    ['appearance', '外观'],
    ['widgets', '组件'],
    ['wallpaper', '壁纸'],
    ['data', '数据']
];

/** A macOS-style settings window. Every pane is built once and only synced afterwards. */
export class SettingsPanel extends StoreElement {
    protected readonly observedChanges = ['settings.appearance', 'settings.wallpaper', 'settings.layout', 'bookmarks', 'folders'] as const;
    private openState = false;
    private activePane: Pane = 'appearance';
    private releaseLayer: (() => void) | null = null;
    private previewUrl = '';
    private previewToken = 0;
    private stopWatchingDisplay: (() => void) | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        this.stopWatchingDisplay = onHdrDisplayChange(() => this.syncHdrDescription());
        document.addEventListener('paste', this.onPaste);
    }

    open(): void {
        if (this.openState) return;
        this.openState = true;
        this.syncOpenState();
        this.syncHdrDescription();
        this.placeSegmentThumbs();
        this.releaseLayer = pushLayer(this.querySelector<HTMLElement>('.settings-window')!, () => this.close());
        void this.refreshPreview();
        void this.refreshData();
        const windowElement = this.querySelector<HTMLElement>('.settings-window')!;
        afterMotion(windowElement, () => {
            if (this.openState && !windowElement.contains(document.activeElement)) this.querySelector<HTMLButtonElement>('.settings-nav-item.is-active')?.focus();
        });
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
        this.stopWatchingDisplay?.();
        this.stopWatchingDisplay = null;
        document.removeEventListener('paste', this.onPaste);
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    }

    protected handleStoreChange(): void {
        this.syncControls(appStore.state.settings);
        if (this.openState) void this.refreshData();
    }

    protected render(): void {
        const settings = appStore.state.settings;
        this.innerHTML = `
            <div class="settings-scrim" aria-hidden="true"></div>
            <section class="glass-panel settings-window" role="dialog" aria-modal="true" aria-label="设置" aria-hidden="true" inert>
                <aside class="settings-sidebar">
                    <div class="settings-title">
                        <button class="settings-close" type="button" aria-label="关闭设置" aria-keyshortcuts="Escape" title="关闭（Esc）">${ICONS.close}</button>
                    </div>
                    <label class="settings-search">
                        ${ICONS.search}
                        <input type="search" placeholder="搜索" aria-label="搜索设置" autocomplete="off">
                    </label>
                    <nav class="settings-nav" aria-label="设置分类">
                        ${PANES.map(([pane, label]) => `
                            <button class="settings-nav-item" type="button" data-pane="${pane}">
                                <span class="nav-tile" data-tile="${pane}">${SETTINGS_GLYPHS[pane]}</span><span>${label}</span>
                            </button>`).join('')}
                    </nav>
                    <span class="settings-version">Infinity New Tab ${escapeHtml(chrome.runtime?.getManifest?.().version ?? '')}</span>
                </aside>
                <div class="settings-content">
                    ${this.appearancePane(settings)}
                    ${this.widgetsPane(settings)}
                    ${this.wallpaperPane(settings)}
                    ${this.dataPane()}
                    <p class="settings-empty" hidden></p>
                </div>
            </section>`;
        this.bindChrome();
        this.bindControls();
        this.syncControls(settings);
        this.selectPane(this.activePane);
        this.syncOpenState();
    }

    private appearancePane({ appearance }: AppSettings): string {
        const now = new Date();
        return pane('appearance', '外观', `
            ${group('', `
                ${segmentRow('theme', '文字颜色', appearance.theme, [['auto', '自动'], ['dark', '浅色'], ['light', '深色']], '自动：根据壁纸明暗选择')}
                ${segmentRow('glass', '玻璃材质', appearance.glass, [['clear', '清透'], ['tinted', '着色']])}
                ${toggleRow('hdrHighlights', 'HDR 高光', hdrDescription())}
                ${toggleRow('reduceTransparency', '降低透明度', '玻璃改为不透明底色，文字更易读')}
            `)}
            ${group('时间', `
                ${segmentRow('clockFormat', '时钟', appearance.clockFormat, [['24h', '24 小时'], ['12h', '12 小时']])}
                ${segmentRow('dateFormat', '日期', appearance.dateFormat, [['long', formatDate(now, 'long')], ['short', formatDate(now, 'short')]])}
            `)}
        `);
    }

    private widgetsPane({ layout }: AppSettings): string {
        return pane('widgets', '组件', `
            ${group('', `
                ${toggleRow('showClock', '时间与日期')}
                ${toggleRow('showSearch', '搜索栏', `关闭后仍可用 ${SHORTCUT_LABEL} 呼出`)}
                ${toggleRow('showBookmarks', '书签')}
                ${toggleRow('showStatus', '状态胶囊', '只在播放媒体、下载或使用电池时出现')}
            `)}
            ${group('书签', `
                ${toggleRow('showRecent', '常访问网站', '根据本机最近 30 天的浏览记录生成，排在书签最后，也出现在搜索中')}
                ${toggleRow('openInNewTab', '在新标签页打开书签')}
            `)}
            ${group('搜索', `
                ${segmentRow('searchEngine', '默认搜索引擎', layout.searchEngine, Object.entries(ENGINES).map(([key, engine]) => [key, engine.label] as Option))}
                ${toggleRow('saveSearches', '保存最近搜索')}
            `)}
        `);
    }

    private wallpaperPane({ wallpaper }: AppSettings): string {
        return pane('wallpaper', '壁纸', `
            <div class="settings-group wallpaper-card setting-row" data-search="壁纸 视频 图片 照片 在线 选择 拖放 粘贴 恢复默认">
                <div class="wallpaper-preview" aria-hidden="true"><div class="wallpaper-preview-media"></div><span class="wallpaper-duration" hidden></span></div>
                <div class="wallpaper-info">
                    <strong class="wallpaper-name"></strong>
                    <span class="row-sub wallpaper-meta"></span>
                    <div class="wallpaper-actions">
                        <label class="pill-button primary upload-wallpaper">选择视频或图片…<input type="file" accept="image/*,video/*" hidden></label>
                        <button class="pill-button random-wallpaper" type="button">换一个在线壁纸</button>
                        <button class="pill-button reset-wallpaper" type="button">恢复默认</button>
                    </div>
                    <span class="row-sub wallpaper-hint">也可以把照片或视频拖到这里，或复制后按 ${PASTE_LABEL} 粘贴</span>
                </div>
            </div>
            ${group('显示', `
                ${segmentRow('wallpaperKind', '类型', wallpaperKind(wallpaper), [['video', '视频'], ['image', '图片'], ['online', '在线']], '默认是内置的动态场景 Twilight Bay', 'actions')}
                ${rangeRow('blur', '模糊', wallpaper.blur, 0, 40, 'px')}
                ${rangeRow('overlay', '暗化', wallpaper.overlay, 0, 60, '%', '让白色文字在亮壁纸上也清楚')}
            `)}
            ${group('播放', `
                ${toggleRow('idleHide', '静止时隐藏界面', '8 秒无操作后只保留时间，移动鼠标即恢复')}
                ${toggleRow('pauseOnBattery', '使用电池时暂停动态壁纸')}
                ${toggleRow('pauseWhenHidden', '标签页不可见时暂停')}
                ${toggleRow('sound', '播放视频声音')}
            `)}
        `);
    }

    private dataPane(): string {
        return pane('data', '数据', `
            ${group('', `
                ${infoRow('Chrome 同步', '<span class="sync-summary"></span>', '<span class="row-value sync-usage"></span>')}
                ${infoRow('本地媒体', '视频与图片壁纸保存在本机，不占用同步空间', '<span class="row-value media-usage"></span>')}
            `)}
            ${group('备份', `
                ${infoRow('导出备份', '书签、设置和本地壁纸，一个 JSON 文件', '<button class="pill-button export-data" type="button">导出…</button>')}
                ${infoRow('从备份恢复', '会覆盖当前数据，建议先导出一份', '<label class="pill-button import-data">导入…<input type="file" accept="application/json,.json" hidden></label>')}
                ${toggleRow('backupReminder', '每月提醒我备份')}
            `)}
            ${group('', `
                ${infoRow('清空所有数据', '删除书签、设置与本地壁纸，无法撤销', '<button class="pill-button danger reset-data" type="button">清空…</button>')}
            `)}
        `);
    }

    private bindChrome(): void {
        this.querySelector('.settings-close')?.addEventListener('click', () => this.close());
        this.querySelector('.settings-scrim')?.addEventListener('click', () => this.close());
        const nav = this.querySelector<HTMLElement>('.settings-nav')!;
        nav.addEventListener('click', (event) => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pane]');
            if (!button) return;
            this.clearSearch();
            this.selectPane(button.dataset.pane as Pane);
        });
        nav.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const index = PANES.findIndex(([pane]) => pane === this.activePane);
            const next = PANES[(index + (event.key === 'ArrowDown' ? 1 : -1) + PANES.length) % PANES.length][0];
            this.clearSearch();
            this.selectPane(next);
            this.querySelector<HTMLButtonElement>(`[data-pane="${next}"]`)?.focus();
        });
        this.querySelector<HTMLInputElement>('.settings-search input')?.addEventListener('input', (event) => {
            this.filter((event.target as HTMLInputElement).value);
        });
    }

    private bindControls(): void {
        this.querySelectorAll<HTMLElement>('[data-segment]').forEach((groupElement) => {
            const buttons = [...groupElement.querySelectorAll<HTMLButtonElement>('[data-value]')];
            const actions = groupElement.dataset.kind === 'actions';
            buttons.forEach((button) => button.addEventListener('click', () => {
                void this.applySegment(groupElement.dataset.segment ?? '', button.dataset.value ?? '');
            }));
            // A radio group selects as the arrows move; buttons that start an action
            // (open a file picker, download a picture) only move focus and wait for Enter or Space.
            groupElement.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const current = actions
                    ? buttons.indexOf(document.activeElement as HTMLButtonElement)
                    : buttons.findIndex((button) => button.classList.contains('is-active'));
                const next = buttons[(current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
                if (actions) buttons.forEach((button) => { button.tabIndex = button === next ? 0 : -1; });
                next.focus();
                if (!actions) next.click();
            });
        });
        this.querySelectorAll<HTMLInputElement>('input[data-toggle]').forEach((input) => {
            input.addEventListener('change', () => void this.applyToggle(input.dataset.toggle ?? '', input.checked));
        });
        this.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
            input.addEventListener('input', () => {
                const output = input.closest('.setting-row')?.querySelector('output');
                if (output) output.textContent = `${input.value}${input.dataset.unit ?? ''}`;
                syncSlider(input);
                // Preview live; persisted on release to spare sync write quota.
                const [property, value] = input.name === 'blur'
                    ? ['--wallpaper-blur', `${input.value}px`]
                    : ['--wallpaper-overlay', String(Number(input.value) / 100)];
                document.querySelector<HTMLElement>('wallpaper-surface')?.style.setProperty(property, value);
            });
            input.addEventListener('change', () => {
                void appStore.updateSettings('wallpaper', { [input.name]: Number(input.value) }).catch(notifyError);
            });
        });
        const upload = this.querySelector<HTMLInputElement>('.upload-wallpaper input')!;
        upload.addEventListener('change', () => {
            const file = upload.files?.[0];
            upload.value = '';
            if (file) void this.withBusy(upload.closest('label')!, () => useLocalWallpaper(file));
        });
        this.querySelector('.random-wallpaper')?.addEventListener('click', (event) => void this.withBusy(event.currentTarget as HTMLElement, useOnlineWallpaper));
        const windowElement = this.querySelector<HTMLElement>('.settings-window')!;
        windowElement.addEventListener('dragover', this.onDragOver);
        windowElement.addEventListener('dragleave', this.onDragLeave);
        windowElement.addEventListener('drop', this.onDrop);
        this.querySelector('.reset-wallpaper')?.addEventListener('click', () => void resetWallpaper().catch(notifyError));
        this.querySelector('.export-data')?.addEventListener('click', () => void backupService.createBackup().catch(notifyError));
        this.querySelector<HTMLInputElement>('.import-data input')?.addEventListener('change', (event) => {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = '';
            if (file) void this.importData(file);
        });
        this.querySelector('.reset-data')?.addEventListener('click', () => void this.resetData());
    }

    private selectPane(target: Pane): void {
        this.activePane = target;
        this.querySelectorAll<HTMLButtonElement>('.settings-nav-item').forEach((button) => {
            const active = button.dataset.pane === target;
            button.classList.toggle('is-active', active);
            if (active) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        this.querySelectorAll<HTMLElement>('.settings-pane').forEach((element) => {
            element.hidden = element.dataset.pane !== target;
        });
        const content = this.querySelector<HTMLElement>('.settings-content');
        if (content) content.scrollTop = 0;
        this.placeSegmentThumbs();
        if (target === 'wallpaper') void this.refreshPreview();
    }

    /** Slides each visible segmented control's thumb under its selected option. */
    private placeSegmentThumbs(): void {
        this.querySelectorAll<HTMLElement>('[data-segment]').forEach((groupElement) => {
            const active = groupElement.querySelector<HTMLElement>('.is-active');
            if (!active || !groupElement.offsetWidth) return;
            groupElement.style.setProperty('--thumb-x', `${active.offsetLeft}px`);
            groupElement.style.setProperty('--thumb-width', `${active.offsetWidth}px`);
            groupElement.classList.toggle('has-thumb', true);
            // The first placement lands without sliding in from the left edge.
            if (!groupElement.classList.contains('is-placed')) requestAnimationFrame(() => groupElement.classList.add('is-placed'));
        });
    }

    /** Searching shows matching rows from every pane at once. */
    private filter(value: string): void {
        const query = value.trim().toLowerCase();
        if (!query) {
            this.querySelectorAll<HTMLElement>('.setting-row, .settings-group, .settings-heading').forEach((element) => { element.hidden = false; });
            this.querySelector<HTMLElement>('.settings-empty')!.hidden = true;
            this.selectPane(this.activePane);
            return;
        }
        this.querySelectorAll<HTMLElement>('.settings-nav-item').forEach((button) => {
            button.classList.remove('is-active');
            button.removeAttribute('aria-current');
        });
        let total = 0;
        this.querySelectorAll<HTMLElement>('.settings-pane').forEach((paneElement) => {
            let paneMatches = 0;
            paneElement.querySelectorAll<HTMLElement>('.setting-row').forEach((row) => {
                const match = (row.dataset.search ?? row.textContent ?? '').toLowerCase().includes(query);
                row.hidden = !match;
                if (match) paneMatches += 1;
            });
            paneElement.querySelectorAll<HTMLElement>('.settings-group').forEach((groupElement) => {
                const visible = groupElement.matches('.setting-row') ? !groupElement.hidden : Boolean(groupElement.querySelector('.setting-row:not([hidden])'));
                groupElement.hidden = !visible;
                const heading = groupElement.previousElementSibling;
                if (heading instanceof HTMLElement && heading.matches('.settings-heading')) heading.hidden = !visible;
            });
            paneElement.hidden = !paneMatches;
            total += paneMatches;
        });
        const empty = this.querySelector<HTMLElement>('.settings-empty')!;
        empty.hidden = total > 0;
        empty.textContent = `没有找到“${value.trim()}”`;
    }

    private clearSearch(): void {
        const input = this.querySelector<HTMLInputElement>('.settings-search input');
        if (!input?.value) return;
        input.value = '';
        this.filter('');
    }

    private syncOpenState(): void {
        const windowElement = this.querySelector<HTMLElement>('.settings-window');
        windowElement?.classList.toggle('is-open', this.openState);
        windowElement?.setAttribute('aria-hidden', String(!this.openState));
        windowElement?.toggleAttribute('inert', !this.openState);
        this.querySelector('.settings-scrim')?.classList.toggle('is-open', this.openState);
    }

    /** The screen can change while the page is open (a window moved to another display). */
    private syncHdrDescription(): void {
        const row = this.querySelector('input[data-toggle="hdrHighlights"]')?.closest('.setting-row');
        const sub = row?.querySelector('.row-sub');
        if (sub) sub.textContent = hdrDescription();
    }

    private syncControls(settings: AppSettings): void {
        const { appearance, layout, wallpaper } = settings;
        const segments: Record<string, string> = {
            theme: appearance.theme,
            glass: appearance.glass,
            clockFormat: appearance.clockFormat,
            dateFormat: appearance.dateFormat,
            searchEngine: layout.searchEngine,
            wallpaperKind: wallpaperKind(wallpaper)
        };
        this.querySelectorAll<HTMLElement>('[data-segment]').forEach((groupElement) => {
            const value = segments[groupElement.dataset.segment ?? ''];
            const buttons = [...groupElement.querySelectorAll<HTMLButtonElement>('[data-value]')];
            const hasValue = buttons.some((button) => button.dataset.value === value);
            const state = groupElement.dataset.kind === 'actions' ? 'aria-pressed' : 'aria-checked';
            buttons.forEach((button, index) => {
                const checked = button.dataset.value === value;
                button.classList.toggle('is-active', checked);
                button.setAttribute(state, String(checked));
                button.tabIndex = checked || (!hasValue && index === 0) ? 0 : -1;
            });
        });

        const toggles: Record<string, boolean> = {
            hdrHighlights: appearance.hdrHighlights,
            reduceTransparency: appearance.reduceTransparency,
            showClock: layout.showClock,
            showSearch: layout.showSearch,
            showBookmarks: layout.showBookmarks,
            showStatus: layout.showStatus,
            showRecent: layout.showRecent,
            openInNewTab: layout.openInNewTab,
            saveSearches: layout.saveSearches,
            backupReminder: layout.backupReminder,
            idleHide: wallpaper.idleHide,
            pauseOnBattery: wallpaper.pauseOnBattery,
            pauseWhenHidden: wallpaper.pauseWhenHidden,
            sound: wallpaper.sound
        };
        this.querySelectorAll<HTMLInputElement>('input[data-toggle]').forEach((input) => {
            input.checked = toggles[input.dataset.toggle ?? ''] ?? input.checked;
        });

        const ranges: Record<string, number> = { blur: wallpaper.blur, overlay: wallpaper.overlay };
        this.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
            const value = ranges[input.name];
            syncSlider(input);
            if (!Number.isFinite(value) || Number(input.value) === value) return;
            input.value = String(value);
            input.dispatchEvent(new Event('input', { bubbles: false }));
        });
        this.placeSegmentThumbs();
        const reset = this.querySelector<HTMLElement>('.reset-wallpaper');
        if (reset) reset.hidden = wallpaper.type === 'gradient';
        if (this.openState) void this.refreshPreview();
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
            else if (name === 'glass') await appStore.updateSettings('appearance', { glass: value as AppSettings['appearance']['glass'] });
            else if (name === 'clockFormat') await appStore.updateSettings('appearance', { clockFormat: value as '12h' | '24h' });
            else if (name === 'dateFormat') await appStore.updateSettings('appearance', { dateFormat: value as 'long' | 'short' });
            else if (name === 'searchEngine') await appStore.updateSettings('layout', { searchEngine: value as AppSettings['layout']['searchEngine'] });
            else if (name === 'wallpaperKind') this.pickWallpaper(value);
        } catch (error) { notifyError(error); }
    }

    /** True while the wallpaper card is on screen (its pane, or a settings search that shows it). */
    private get wallpaperCardVisible(): boolean {
        const card = this.querySelector<HTMLElement>('.wallpaper-card');
        return this.openState && Boolean(card?.getClientRects().length);
    }

    private useWallpaperFile(file: File): void {
        void this.withBusy(this.querySelector<HTMLElement>('.upload-wallpaper')!, () => useLocalWallpaper(file));
    }

    /**
     * Files dropped anywhere on the settings window are caught so Chrome does not
     * navigate away to them; only the wallpaper pane takes the drop.
     */
    private readonly onDragOver = (event: DragEvent): void => {
        if (!event.dataTransfer?.types.includes('Files')) return;
        event.preventDefault();
        const accepts = this.wallpaperCardVisible && Boolean((event.target as HTMLElement).closest('.settings-pane[data-pane="wallpaper"]'));
        event.dataTransfer.dropEffect = accepts ? 'copy' : 'none';
        this.querySelector('.wallpaper-card')?.classList.toggle('is-drop-target', accepts);
    };

    private readonly onDragLeave = (event: DragEvent): void => {
        const windowElement = this.querySelector('.settings-window');
        if (windowElement?.contains(event.relatedTarget as Node | null)) return;
        this.querySelector('.wallpaper-card')?.classList.remove('is-drop-target');
    };

    private readonly onDrop = (event: DragEvent): void => {
        if (!event.dataTransfer?.types.includes('Files')) return;
        event.preventDefault();
        const card = this.querySelector('.wallpaper-card');
        const accepts = card?.classList.contains('is-drop-target');
        card?.classList.remove('is-drop-target');
        if (!accepts) return;
        const files = [...event.dataTransfer.files];
        const file = files.find((item) => mediaKindOf(item)) ?? files[0];
        if (file) this.useWallpaperFile(file);
    };

    /** A picture copied in Photos (⌘C) and pasted while the wallpaper card is on screen becomes the wallpaper. */
    private readonly onPaste = (event: ClipboardEvent): void => {
        if (!this.wallpaperCardVisible) return;
        const file = [...(event.clipboardData?.files ?? [])].find((item) => mediaKindOf(item));
        if (!file) return; // Text pastes into the settings search as usual.
        event.preventDefault();
        this.useWallpaperFile(file);
    };

    /** The type control is a shortcut: video and image open the file picker, online fetches a new picture. */
    private pickWallpaper(kind: string): void {
        if (kind === 'online') {
            void this.withBusy(this.querySelector<HTMLElement>('.random-wallpaper')!, useOnlineWallpaper);
            return;
        }
        const input = this.querySelector<HTMLInputElement>('.upload-wallpaper input')!;
        input.accept = kind === 'video' ? 'video/*' : 'image/*';
        input.click();
        input.accept = 'image/*,video/*';
    }

    private async applyToggle(name: string, checked: boolean): Promise<void> {
        try {
            if (name === 'hdrHighlights' || name === 'reduceTransparency') await appStore.updateSettings('appearance', { [name]: checked });
            else if (['idleHide', 'pauseOnBattery', 'pauseWhenHidden', 'sound'].includes(name)) await appStore.updateSettings('wallpaper', { [name]: checked });
            else await appStore.updateSettings('layout', { [name]: checked });
        } catch (error) { notifyError(error); }
    }

    /** Mirrors the live wallpaper into the preview card without re-downloading anything. */
    private async refreshPreview(): Promise<void> {
        const host = this.querySelector<HTMLElement>('.wallpaper-preview-media');
        if (!host || !this.openState) return;
        const wallpaper = appStore.state.settings.wallpaper;
        const { type, value } = wallpaper;
        const key = `${type}:${value}`;
        if (host.dataset.key === key) return;
        const token = ++this.previewToken;
        let blob: Blob | null = null;
        try {
            if (type === 'local' || type === 'video') blob = await mediaStore.get(type === 'video' ? 'video' : 'image');
        } catch {
            // The preview is decorative; the wallpaper surface reports real failures.
        }
        if (token !== this.previewToken) return;
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = blob ? URL.createObjectURL(blob) : '';
        host.dataset.key = key;
        host.replaceChildren();
        host.style.backgroundImage = '';
        host.classList.toggle('is-scene', type === 'gradient');
        const name = this.querySelector('.wallpaper-name')!;
        const meta = this.querySelector('.wallpaper-meta')!;
        const duration = this.querySelector<HTMLElement>('.wallpaper-duration')!;
        duration.hidden = true;
        name.textContent = wallpaperLabel(wallpaper);
        const size = blob ? ` · ${formatBytes(blob.size)}` : '';
        meta.textContent = type === 'gradient' ? '内置动态场景 · 不占用任何存储'
            : `${type === 'video' ? '视频' : '图片'}${size} · 已保存到本机`;
        if (type === 'video' && this.previewUrl) {
            const video = document.createElement('video');
            Object.assign(video, { src: this.previewUrl, muted: true, loop: true, autoplay: true, playsInline: true });
            video.addEventListener('loadedmetadata', () => {
                meta.textContent = `视频 · ${video.videoWidth}×${video.videoHeight}${size} · 已保存到本机`;
                duration.textContent = `${formatDuration(video.duration)} 循环`;
                duration.hidden = !Number.isFinite(video.duration);
            }, { once: true });
            host.append(video);
        } else if (type === 'local' && this.previewUrl) {
            host.style.backgroundImage = `url("${this.previewUrl}")`;
            const image = new Image();
            image.onload = () => { meta.textContent = `${wallpaperLabel(wallpaper)} · ${image.naturalWidth}×${image.naturalHeight}${size} · 已保存到本机`; };
            image.src = this.previewUrl;
        }
    }

    private async refreshData(): Promise<void> {
        const { bookmarks, folders } = appStore.state;
        const summary = this.querySelector('.sync-summary');
        if (summary) summary.textContent = `${bookmarks.length} 个书签 · ${folders.length - 1} 个文件夹`;
        const [bytes, media] = await Promise.all([
            new Promise<number | null>((resolve) => {
                try {
                    if (!chrome.storage.sync.getBytesInUse) resolve(null);
                    else chrome.storage.sync.getBytesInUse(null, (value: number) => resolve(chrome.runtime.lastError ? null : value));
                } catch {
                    resolve(null);
                }
            }),
            mediaStore.snapshot().then(({ image, video }) => [image, video]).catch(() => [null, null])
        ]);
        const usage = this.querySelector('.sync-usage');
        if (usage) usage.textContent = bytes === null ? '' : `已用 ${formatBytes(bytes)} / 100 KB`;
        const mediaUsage = this.querySelector('.media-usage');
        if (mediaUsage) {
            const total = media.reduce((sum, blob) => sum + (blob?.size ?? 0), 0);
            mediaUsage.textContent = total ? formatBytes(total) : '无';
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

function pane(name: Pane, title: string, body: string): string {
    return `<section class="settings-pane" data-pane="${name}" aria-label="${title}" hidden><h2 class="settings-pane-title">${title}</h2>${body}</section>`;
}

function group(title: string, body: string): string {
    return `${title ? `<h3 class="settings-heading">${title}</h3>` : ''}<div class="settings-group">${body}</div>`;
}

function rowLabel(label: string, sub: string): string {
    return `<span class="row-label"><span class="row-title">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>`;
}

function infoRow(label: string, sub: string, control: string): string {
    return `<div class="setting-row">${rowLabel(label, sub)}${control}</div>`;
}

/**
 * A segmented control. `radio` picks a value; `actions` is a row of buttons that
 * each start something, with the current choice shown as pressed.
 */
function segmentRow(name: string, label: string, value: string, options: Option[], sub = '', kind: 'radio' | 'actions' = 'radio'): string {
    const radio = kind === 'radio';
    return `
        <div class="setting-row segment-row">
            <span class="row-label"><span class="row-title" id="segment-${name}">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>
            <div class="segmented" role="${radio ? 'radiogroup' : 'group'}" aria-labelledby="segment-${name}" data-segment="${name}" data-kind="${kind}">
                ${options.map(([optionValue, optionLabel], index) => {
                    const checked = optionValue === value;
                    const focusable = checked || (index === 0 && !options.some(([option]) => option === value));
                    const state = radio ? `role="radio" aria-checked="${checked}"` : `aria-pressed="${checked}"`;
                    return `<button type="button" ${state} tabindex="${focusable ? 0 : -1}" class="${checked ? 'is-active' : ''}" data-value="${optionValue}">${escapeHtml(optionLabel)}</button>`;
                }).join('')}
            </div>
        </div>`;
}

function toggleRow(name: string, label: string, sub = ''): string {
    return `<label class="setting-row toggle-row">${rowLabel(label, sub)}<span class="switch"><input type="checkbox" role="switch" data-toggle="${name}"><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></span></label>`;
}

function rangeRow(name: string, label: string, value: number, min: number, max: number, unit: string, sub = ''): string {
    return `
        <div class="setting-row">
            ${rowLabel(label, sub)}
            <span class="range-control">
                <input class="slider" type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}" aria-label="${label}">
                <output>${value}${unit}</output>
            </span>
        </div>`;
}

/** The filled part of a slider's track follows its value. */
function syncSlider(input: HTMLInputElement): void {
    const minimum = Number(input.min) || 0;
    const maximum = Number(input.max) || 100;
    const progress = maximum === minimum ? 0 : (Number(input.value) - minimum) / (maximum - minimum);
    input.style.setProperty('--progress', `${Math.max(0, Math.min(1, progress)) * 100}%`);
}

function wallpaperKind({ type, value }: AppSettings['wallpaper']): string {
    if (type === 'video') return 'video';
    if (type === 'local') return value.startsWith('online') ? 'online' : 'image';
    return '';
}

/** Reports what the HDR layer actually managed to start, not just what the browser advertises. */
function hdrDescription(): string {
    if (!isHdrDisplay()) return '当前为 SDR 屏幕，连接 HDR 屏幕后自动生效';
    const renderer = document.querySelector<HTMLElement>('.hdr-glass-layer')?.dataset.hdrRenderer;
    if (renderer === 'webgpu') return '当前屏幕支持 HDR · WebGPU 已启用';
    if (renderer === 'unavailable' || renderer === 'lost') return '当前屏幕支持 HDR · 浏览器未开放 WebGPU 高光';
    return '当前屏幕支持 HDR';
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatDuration(seconds: number): string {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
