import { backupService } from '../core/backup-service';
import { mediaStore } from '../core/media-store';
import { storageBytesInUse } from '../core/storage';
import { appStore } from '../core/store';
import type { AppSettings } from '../core/types';
import { escapeHtml } from '../core/utils';
import { mediaKindOf, resetWallpaper, useLocalWallpaper, useOnlineWallpaper, wallpaperLabel } from '../core/wallpaper-service';
import { StoreElement } from './base';
import { isDefault } from './wallpaper-framing';
import type { WallpaperSurface } from './wallpaper-surface';
import { formatDate } from './dashboard-header';
import { isHdrDisplay, onHdrDisplayChange } from './hdr-glass';
import { ICONS, SETTINGS_GLYPHS } from './icons';
import { ENGINES, SHORTCUT_LABEL } from './search-box';
import { afterMotion, confirmAction, notify, notifyError } from './ui-layer';

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
    private previewUrl = '';
    private previewToken = 0;
    private dataToken = 0;
    private stopWatchingDisplay: (() => void) | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        this.stopWatchingDisplay = onHdrDisplayChange(() => this.syncHdrDescription());
        document.addEventListener('paste', this.onPaste);
    }

    open(): void {
        const dialog = this.dialog;
        if (this.openState || !dialog) return;
        this.openState = true;
        this.syncHdrDescription();
        this.syncDateExamples();
        dialog.showModal();
        void this.refreshPreview();
        void this.refreshData();
        // Focus waits for the window to finish scaling in, so the glass lens never measures it half-grown.
        afterMotion(dialog, () => {
            if (this.openState) this.querySelector<HTMLButtonElement>('.settings-nav-item[aria-selected="true"]')?.focus();
        });
    }

    close(): void {
        if (this.dialog?.open) this.dialog.close();
    }

    private get dialog(): HTMLDialogElement | null {
        return this.querySelector<HTMLDialogElement>('dialog.settings-window');
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
            <dialog class="glass-panel settings-window" aria-label="设置" closedby="any">
                <aside class="settings-sidebar">
                    <div class="settings-title">
                        <button class="settings-close" type="button" aria-label="关闭设置" aria-keyshortcuts="Escape" title="关闭（Esc）">${ICONS.close}</button>
                    </div>
                    <label class="settings-search">
                        ${ICONS.search}
                        <input type="search" placeholder="搜索" aria-label="搜索设置" aria-controls="settings-content" autocomplete="off">
                    </label>
                    <div class="settings-nav" role="tablist" aria-orientation="vertical" aria-label="设置分类">
                        ${PANES.map(([pane, label]) => `
                            <button class="settings-nav-item" type="button" role="tab" id="settings-tab-${pane}" aria-controls="settings-pane-${pane}" aria-selected="false" tabindex="-1" data-pane="${pane}">
                                <span class="nav-tile" data-tile="${pane}">${SETTINGS_GLYPHS[pane]}</span><span>${label}</span>
                            </button>`).join('')}
                    </div>
                    <span class="settings-version">Infinity New Tab ${escapeHtml(chrome.runtime?.getManifest?.().version ?? '')}</span>
                </aside>
                <div class="settings-content" id="settings-content">
                    ${this.appearancePane(settings)}
                    ${this.widgetsPane(settings)}
                    ${this.wallpaperPane(settings)}
                    ${this.dataPane()}
                    <p class="settings-empty" role="status"></p>
                </div>
            </dialog>`;
        this.bindChrome();
        this.bindControls();
        this.syncControls(settings);
        this.selectPane(this.activePane);
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
            <div class="settings-group wallpaper-card setting-row" data-search="壁纸 视频 图片 照片 在线 选择 拖放 粘贴 恢复默认 取景 缩放 重置">
                <div class="wallpaper-preview" aria-hidden="true"><div class="wallpaper-preview-media"></div><span class="wallpaper-duration" hidden></span></div>
                <div class="wallpaper-info">
                    <strong class="wallpaper-name"></strong>
                    <span class="row-sub wallpaper-meta"></span>
                    <div class="wallpaper-actions">
                        <span class="file-pick upload-wallpaper"><button class="pill-button primary" type="button">选择视频或图片…</button><input type="file" accept="image/*,video/*" hidden></span>
                        <button class="pill-button random-wallpaper" type="button">换一个在线壁纸</button>
                        <button class="pill-button reset-wallpaper" type="button">恢复默认</button>
                        <button class="pill-button reset-framing" type="button" hidden>重置取景</button>
                    </div>
                    <span class="row-sub wallpaper-hint">也可以把照片或视频拖到这里，或复制后按 ${PASTE_LABEL} 粘贴</span>
                    <span class="row-sub framing-hint">在主屏空白处双指捏合缩放、双指滑动来调整取景，双击空白处复原</span>
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
                ${infoRow('从备份恢复', '会覆盖当前数据，建议先导出一份', '<span class="file-pick import-data"><button class="pill-button" type="button">导入…</button><input type="file" accept="application/json,.json" hidden></span>')}
                ${toggleRow('backupReminder', '每月提醒我备份')}
            `)}
            ${group('', `
                ${infoRow('清空所有数据', '删除书签、设置与本地壁纸，无法撤销', '<button class="pill-button danger reset-data" type="button">清空…</button>')}
            `)}
        `);
    }

    private bindChrome(): void {
        const dialog = this.dialog!;
        // Escape, an outside click and the close button all end here; the browser returns focus to the opener.
        dialog.addEventListener('close', () => { this.openState = false; });
        this.querySelector('.settings-close')?.addEventListener('click', () => this.close());
        const nav = this.querySelector<HTMLElement>('.settings-nav')!;
        nav.addEventListener('click', (event) => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pane]');
            if (!button) return;
            this.clearSearch();
            this.selectPane(button.dataset.pane as Pane);
        });
        // A vertical tab list: the arrows (and Home / End) move between panes.
        nav.addEventListener('keydown', (event) => {
            const index = PANES.findIndex(([pane]) => pane === this.activePane);
            const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: PANES.length - 1 }[event.key];
            if (target === undefined) return;
            event.preventDefault();
            const next = PANES[(target + PANES.length) % PANES.length][0];
            this.clearSearch();
            this.selectPane(next);
            this.querySelector<HTMLButtonElement>(`[data-pane="${next}"]`)?.focus();
        });
        const search = this.querySelector<HTMLInputElement>('.settings-search input')!;
        search.addEventListener('input', () => this.filter(search.value));
        // Escape first empties a search with text in it; only then does it close the window.
        search.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || !search.value) return;
            event.preventDefault();
            this.clearSearch();
        });
    }

    private bindControls(): void {
        // Radio groups are native: the arrows move the choice and fire `change`.
        this.querySelectorAll<HTMLElement>('[data-segment][data-kind="radio"]').forEach((groupElement) => {
            groupElement.addEventListener('change', (event) => {
                void this.applySegment(groupElement.dataset.segment ?? '', (event.target as HTMLInputElement).value);
            });
        });
        // A toolbar of buttons that each start something (open a file picker, download a picture):
        // the arrows only move focus, and Enter or Space starts the action.
        this.querySelectorAll<HTMLElement>('[data-segment][data-kind="actions"]').forEach((groupElement) => {
            const buttons = [...groupElement.querySelectorAll<HTMLButtonElement>('[data-value]')];
            buttons.forEach((button) => button.addEventListener('click', () => {
                void this.applySegment(groupElement.dataset.segment ?? '', button.dataset.value ?? '');
            }));
            groupElement.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
                const next = buttons[(current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
                buttons.forEach((button) => { button.tabIndex = button === next ? 0 : -1; });
                next.focus();
            });
        });
        this.querySelectorAll<HTMLInputElement>('input[data-toggle]').forEach((input) => {
            input.addEventListener('change', () => void this.applyToggle(input.dataset.toggle ?? '', input.checked));
        });
        this.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
            input.addEventListener('input', (event) => {
                const output = input.closest('.setting-row')?.querySelector('output');
                const text = `${input.value}${input.dataset.unit ?? ''}`;
                if (output) output.textContent = text;
                input.setAttribute('aria-valuetext', text);
                syncSlider(input);
                // A value synced from the store (reset, import, another tab) is already on the wallpaper; only the user's own drag previews.
                if (!event.isTrusted) return;
                // Preview live; persisted on release to spare sync write quota.
                const surface = document.querySelector<WallpaperSurface>('wallpaper-surface');
                if (input.name === 'blur') surface?.previewBlur(Number(input.value));
                else surface?.previewOverlay(Number(input.value));
            });
            // Released on its starting value, a slider sends no change event; the live preview still ends.
            const endPreview = () => document.querySelector<WallpaperSurface>('wallpaper-surface')?.endPreview();
            input.addEventListener('pointerup', endPreview);
            input.addEventListener('blur', endPreview);
            input.addEventListener('change', () => {
                endPreview();
                void appStore.updateSettings('wallpaper', { [input.name]: Number(input.value) }).catch(notifyError);
            });
        });
        const upload = this.querySelector<HTMLInputElement>('.upload-wallpaper input')!;
        upload.addEventListener('change', () => {
            const file = upload.files?.[0];
            upload.value = '';
            if (file) this.useWallpaperFile(file);
        });
        // A real button opens each hidden file picker, so both can be reached from the keyboard.
        this.querySelectorAll<HTMLElement>('.file-pick').forEach((pick) => {
            const button = pick.querySelector('button');
            button?.addEventListener('click', () => {
                // Enter and Space still reach a busy button; a second file chosen now would only be dropped.
                if (button.classList.contains('is-busy')) return;
                pick.querySelector<HTMLInputElement>('input[type="file"]')?.click();
            });
        });
        this.querySelector('.random-wallpaper')?.addEventListener('click', (event) => void this.withBusy(event.currentTarget as HTMLElement, useOnlineWallpaper));
        const windowElement = this.querySelector<HTMLElement>('.settings-window')!;
        windowElement.addEventListener('dragover', this.onDragOver);
        windowElement.addEventListener('dragleave', this.onDragLeave);
        windowElement.addEventListener('drop', this.onDrop);
        this.querySelector('.reset-wallpaper')?.addEventListener('click', () => void resetWallpaper().catch(notifyError));
        this.querySelector('.reset-framing')?.addEventListener('click', () => {
            document.querySelector<WallpaperSurface>('wallpaper-surface')?.resetFraming();
            // The button hides once the framing is back to default; focus moves to its neighbour rather than being lost.
            this.querySelector<HTMLButtonElement>('.upload-wallpaper button')?.focus();
        });
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
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        this.querySelectorAll<HTMLElement>('.settings-pane').forEach((element) => {
            element.hidden = element.dataset.pane !== target;
        });
        const content = this.querySelector<HTMLElement>('.settings-content');
        if (content) content.scrollTop = 0;
        if (target === 'wallpaper') void this.refreshPreview();
    }

    /** The example dates on the 日期 buttons follow the day the window is opened, not the day the tab was. */
    private syncDateExamples(): void {
        const now = new Date();
        (['long', 'short'] as const).forEach((format) => {
            const label = this.querySelector(`[data-segment="dateFormat"] [data-value="${format}"] span`);
            if (label) label.textContent = formatDate(now, format);
        });
    }

    /** Searching shows matching rows from every pane at once. */
    private filter(value: string): void {
        const query = value.trim().toLowerCase();
        if (!query) {
            this.querySelectorAll<HTMLElement>('.setting-row, .settings-group, .settings-heading').forEach((element) => { element.hidden = false; });
            this.querySelector<HTMLElement>('.settings-empty')!.textContent = '';
            this.selectPane(this.activePane);
            return;
        }
        // Results come from every pane, so no tab is selected; the last one stays the list's Tab stop.
        this.querySelectorAll<HTMLElement>('.settings-nav-item').forEach((button) => {
            button.classList.remove('is-active');
            button.setAttribute('aria-selected', 'false');
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
        // A status line that stays in the page, so the result is announced as soon as its text changes.
        this.querySelector<HTMLElement>('.settings-empty')!.textContent = total ? '' : `没有找到“${value.trim()}”`;
    }

    private clearSearch(): void {
        const input = this.querySelector<HTMLInputElement>('.settings-search input');
        if (!input?.value) return;
        input.value = '';
        this.filter('');
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
            if (groupElement.dataset.kind === 'radio') {
                groupElement.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => {
                    input.checked = input.value === value;
                });
                return;
            }
            // The toolbar marks the current kind for the eye only; its buttons are actions, not states.
            const buttons = [...groupElement.querySelectorAll<HTMLButtonElement>('[data-value]')];
            const hasValue = buttons.some((button) => button.dataset.value === value);
            buttons.forEach((button, index) => {
                const current = button.dataset.value === value;
                button.classList.toggle('is-active', current);
                if (!groupElement.contains(document.activeElement)) button.tabIndex = current || (!hasValue && index === 0) ? 0 : -1;
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
        const reset = this.querySelector<HTMLElement>('.reset-wallpaper');
        if (reset) reset.hidden = wallpaper.type === 'gradient';
        const resetFraming = this.querySelector<HTMLElement>('.reset-framing');
        if (resetFraming) resetFraming.hidden = isDefault(wallpaper.framing);
        if (this.openState) void this.refreshPreview();
    }

    private async withBusy(control: HTMLElement, task: () => Promise<void>): Promise<void> {
        if (control.classList.contains('is-busy')) return;
        control.classList.add('is-busy');
        control.setAttribute('aria-busy', 'true');
        control.setAttribute('aria-disabled', 'true');
        try {
            await task();
        } catch (error) {
            notifyError(error);
        } finally {
            control.classList.remove('is-busy');
            control.removeAttribute('aria-busy');
            control.removeAttribute('aria-disabled');
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
        void this.withBusy(this.querySelector<HTMLElement>('.upload-wallpaper button')!, () => useLocalWallpaper(file));
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
        // Still reading the last file: a second picker would only have its choice dropped.
        if (this.querySelector('.upload-wallpaper button')?.classList.contains('is-busy')) return;
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
        // Overlapping refreshes (a save while the window opens) paint only the latest numbers.
        const token = ++this.dataToken;
        const { bookmarks, folders } = appStore.state;
        const summary = this.querySelector('.sync-summary');
        if (summary) summary.textContent = `${bookmarks.length} 个书签 · ${folders.length - 1} 个文件夹`;
        const [bytes, media] = await Promise.all([
            storageBytesInUse(),
            mediaStore.snapshot().then(({ image, video }) => [image, video]).catch(() => [null, null])
        ]);
        if (token !== this.dataToken) return;
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
            body: '当前的书签、文件夹、设置和本地壁纸会被备份中的内容替换，书签与设置的变化也会同步到登录同一 Chrome 账号的其他设备。建议先导出一份当前数据。',
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
            body: `将删除 ${appStore.state.bookmarks.length} 个书签、全部文件夹、设置和本地壁纸，且无法撤销。书签与设置也会从登录同一 Chrome 账号的其他设备上清除。`,
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
    return `<section class="settings-pane" id="settings-pane-${name}" role="tabpanel" aria-labelledby="settings-tab-${name}" data-pane="${name}" hidden><h2 class="settings-pane-title">${title}</h2>${body}</section>`;
}

function group(title: string, body: string): string {
    return `${title ? `<h3 class="settings-heading">${title}</h3>` : ''}<div class="settings-group">${body}</div>`;
}

function rowLabel(label: string, sub: string, id = ''): string {
    const ids = id ? { title: ` id="${id}-title"`, sub: ` id="${id}-sub"` } : { title: '', sub: '' };
    return `<span class="row-label"><span class="row-title"${ids.title}>${label}</span>${sub ? `<span class="row-sub"${ids.sub}>${sub}</span>` : ''}</span>`;
}

/** The row's title names a control and its sub-text describes it, rather than both making up its name. */
function describedBy(id: string, sub: string): string {
    return `aria-labelledby="${id}-title"${sub ? ` aria-describedby="${id}-sub"` : ''}`;
}

function infoRow(label: string, sub: string, control: string): string {
    return `<div class="setting-row">${rowLabel(label, sub)}${control}</div>`;
}

/**
 * A segmented control. `radio` picks a value with native radio buttons; `actions`
 * is a toolbar of buttons that each start something, the current kind marked only visually.
 */
function segmentRow(name: string, label: string, value: string, options: Option[], sub = '', kind: 'radio' | 'actions' = 'radio'): string {
    const id = `segment-${name}`;
    const items = options.map(([optionValue, optionLabel], index) => {
        const checked = optionValue === value;
        if (kind === 'radio') {
            return `<label data-value="${optionValue}"><input class="visually-hidden" type="radio" name="${id}" value="${optionValue}" ${checked ? 'checked' : ''}><span>${escapeHtml(optionLabel)}</span></label>`;
        }
        const focusable = checked || (index === 0 && !options.some(([option]) => option === value));
        return `<button type="button" tabindex="${focusable ? 0 : -1}" class="${checked ? 'is-active' : ''}" data-value="${optionValue}">${escapeHtml(optionLabel)}</button>`;
    }).join('');
    return `
        <div class="setting-row segment-row">
            ${rowLabel(label, sub, id)}
            <div class="segmented" role="${kind === 'radio' ? 'radiogroup' : 'toolbar'}" ${describedBy(id, sub)} data-segment="${name}" data-kind="${kind}">${items}</div>
        </div>`;
}

function toggleRow(name: string, label: string, sub = ''): string {
    const id = `toggle-${name}`;
    return `<label class="setting-row toggle-row">${rowLabel(label, sub, id)}<span class="switch"><input type="checkbox" role="switch" data-toggle="${name}" ${describedBy(id, sub)}><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></span></label>`;
}

function rangeRow(name: string, label: string, value: number, min: number, max: number, unit: string, sub = ''): string {
    const id = `range-${name}`;
    // The output shows the value; the slider speaks it (with its unit) through aria-valuetext instead of a live region.
    return `
        <div class="setting-row">
            ${rowLabel(label, sub, id)}
            <span class="range-control">
                <input class="slider" type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}" aria-valuetext="${value}${unit}" ${describedBy(id, sub)}>
                <output aria-hidden="true">${value}${unit}</output>
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
