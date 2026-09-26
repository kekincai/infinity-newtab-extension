import { appStore } from './core/store';
import { installChromeFallback } from './core/chrome-fallback';
import type { ResolvedTheme } from './core/types';
import { escapeHtml } from './core/utils';
import { migrateLegacyWallpaper, useOnlineWallpaper } from './core/wallpaper-service';
import { BackupToast } from './components/backup-toast';
import { BookmarkDialog } from './components/bookmark-dialog';
import { BookmarkLaunchpad } from './components/bookmark-launchpad';
import { DashboardHeader } from './components/dashboard-header';
import { ICONS } from './components/icons';
import { LiquidGlassSystem } from './components/liquid-glass';
import { LiquidRange, LiquidToggle } from './components/liquid-controls';
import { SearchCommand } from './components/search-command';
import { SettingsDrawer } from './components/settings-drawer';
import { StatusStrip } from './components/status-strip';
import { hasOpenLayer, notify, notifyError } from './components/ui-layer';
import { WallpaperSurface } from './components/wallpaper-surface';

installChromeFallback();

class InfinityNewTabApp extends HTMLElement {
    private readonly hdrMedia = window.matchMedia('(dynamic-range: high)');
    private wallpaperTone: ResolvedTheme = 'light';

    private readonly updateClasses = () => {
        const { appearance } = appStore.state.settings;
        const hdrDisplay = this.hasHdrDisplay();
        const hdrCapable = hdrDisplay && 'gpu' in navigator;
        const theme = appearance.theme === 'auto' ? this.wallpaperTone : appearance.theme;
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
        document.body.classList.toggle('enhanced-animations', appearance.enhancedAnimations);
        document.body.classList.toggle('hdr-highlights', appearance.hdrHighlights);
        document.body.classList.toggle('hdr-display', hdrDisplay);
        document.body.classList.toggle('hdr-capable', hdrCapable);
        document.body.dataset.hdrOutput = hdrDisplay ? 'high' : 'standard';
    };

    private readonly onStoreChange = (event: Event) => {
        const changes = (event as CustomEvent<{ changes?: string[] }>).detail?.changes;
        if (!changes || changes.includes('settings.appearance')) this.updateClasses();
    };

    async connectedCallback(): Promise<void> {
        this.innerHTML = '<div class="app-loading" role="status"><span></span><p>正在整理你的启动台…</p></div>';
        try {
            await appStore.init();
            this.updateClasses();
            appStore.addEventListener('change', this.onStoreChange);
            this.hdrMedia.addEventListener('change', this.updateClasses);
            this.render();
            window.addEventListener('keydown', this.onKeyDown);
            void migrateLegacyWallpaper();
        } catch (error) {
            this.innerHTML = `<div class="app-error"><h1>启动台加载失败</h1><p>${escapeHtml(error instanceof Error ? error.message : '未知错误')}</p></div>`;
        }
    }

    disconnectedCallback(): void {
        appStore.removeEventListener('change', this.onStoreChange);
        this.hdrMedia.removeEventListener('change', this.updateClasses);
        window.removeEventListener('keydown', this.onKeyDown);
    }

    private hasHdrDisplay(): boolean {
        return this.hdrMedia.matches && CSS.supports('dynamic-range-limit', 'no-limit');
    }

    private render(): void {
        this.innerHTML = `
            <wallpaper-surface></wallpaper-surface>
            <header class="top-bar">
                <status-strip></status-strip>
                <div class="top-actions">
                    <button class="top-button shuffle-wallpaper" type="button" data-liquid-item aria-label="换一张在线壁纸" title="换一张在线壁纸">${ICONS.shuffle}</button>
                    <button class="top-button settings-trigger" type="button" data-liquid-item aria-label="打开设置" title="设置">${ICONS.settings}</button>
                </div>
            </header>
            <main class="app-shell">
                <div class="hero">
                    <dashboard-header></dashboard-header>
                    <search-command></search-command>
                </div>
                <bookmark-launchpad></bookmark-launchpad>
            </main>
            <settings-drawer></settings-drawer>
            <bookmark-dialog></bookmark-dialog>
            <backup-toast></backup-toast>
            <liquid-glass-system></liquid-glass-system>
        `;
        this.querySelector('.settings-trigger')?.addEventListener('click', () => {
            this.querySelector<SettingsDrawer>('settings-drawer')?.open();
        });
        this.querySelector('.shuffle-wallpaper')?.addEventListener('click', (event) => void this.shuffleWallpaper(event.currentTarget as HTMLButtonElement));
        this.addEventListener('wallpaper-error', this.onWallpaperError as EventListener);
        this.addEventListener('wallpaper-tone', this.onWallpaperTone as EventListener);
    }

    private async shuffleWallpaper(button: HTMLButtonElement): Promise<void> {
        if (button.classList.contains('is-busy')) return;
        button.classList.add('is-busy');
        button.setAttribute('aria-busy', 'true');
        try {
            await useOnlineWallpaper();
        } catch (error) {
            notifyError(error);
        } finally {
            button.classList.remove('is-busy');
            button.removeAttribute('aria-busy');
        }
    }

    private readonly onWallpaperTone = (event: CustomEvent<{ tone: ResolvedTheme }>): void => {
        this.wallpaperTone = event.detail.tone;
        this.updateClasses();
    };

    private readonly onWallpaperError = (event: CustomEvent<{ message?: string }>): void => {
        notify(`背景加载失败：${event.detail?.message || '未知错误'}。已保留原背景。`, 'error', 8000);
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== '/' || isTypingTarget(event.target) || hasOpenLayer()) return;
        const input = this.querySelector<HTMLInputElement>('search-command input');
        if (!input || input.closest('[hidden]')) return;
        event.preventDefault();
        input.focus();
    };
}

function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
}

const elements: Array<[string, CustomElementConstructor]> = [
    ['liquid-glass-system', LiquidGlassSystem],
    ['liquid-range', LiquidRange],
    ['liquid-toggle', LiquidToggle],
    ['wallpaper-surface', WallpaperSurface],
    ['status-strip', StatusStrip],
    ['dashboard-header', DashboardHeader],
    ['search-command', SearchCommand],
    ['bookmark-launchpad', BookmarkLaunchpad],
    ['settings-drawer', SettingsDrawer],
    ['bookmark-dialog', BookmarkDialog],
    ['backup-toast', BackupToast],
    ['infinity-newtab-app', InfinityNewTabApp]
];

elements.forEach(([name, constructor]) => {
    if (!customElements.get(name)) customElements.define(name, constructor);
});
