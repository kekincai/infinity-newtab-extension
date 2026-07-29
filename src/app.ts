import { appStore } from './core/store';
import { installChromeFallback } from './core/chrome-fallback';
import { escapeHtml } from './core/utils';
import { BackupToast } from './components/backup-toast';
import { BookmarkDialog } from './components/bookmark-dialog';
import { BookmarkLaunchpad } from './components/bookmark-launchpad';
import { DashboardHeader } from './components/dashboard-header';
import { LiquidGlassLayer, LiquidSurface } from './components/liquid-glass';
import { RecentSites } from './components/recent-sites';
import { SearchCommand } from './components/search-command';
import { SettingsDrawer } from './components/settings-drawer';
import { WallpaperSurface } from './components/wallpaper-surface';

const ANIME_WALLPAPER = 'https://www.dmoe.cc/random.php';

installChromeFallback();

class InfinityNewTabApp extends HTMLElement {
    private readonly updateClasses = () => {
        const { appearance } = appStore.state.settings;
        document.body.classList.toggle('theme-light', appearance.theme === 'light');
        document.body.classList.toggle('theme-dark', appearance.theme === 'dark');
        document.body.classList.toggle('enhanced-animations', appearance.enhancedAnimations);
    };

    async connectedCallback(): Promise<void> {
        this.innerHTML = '<div class="app-loading"><span></span><p>正在整理你的启动台…</p></div>';
        try {
            await appStore.init();
            this.updateClasses();
            appStore.addEventListener('change', this.updateClasses);
            this.render();
            window.addEventListener('keydown', this.onKeyDown);
        } catch (error) {
            this.innerHTML = `<div class="app-error"><h1>启动台加载失败</h1><p>${escapeHtml(error instanceof Error ? error.message : '未知错误')}</p></div>`;
        }
    }

    disconnectedCallback(): void {
        appStore.removeEventListener('change', this.updateClasses);
        window.removeEventListener('keydown', this.onKeyDown);
    }

    private render(): void {
        this.innerHTML = `
            <wallpaper-surface></wallpaper-surface>
            <div class="ambient-orb orb-one"></div><div class="ambient-orb orb-two"></div>
            <liquid-surface class="floating-settings-surface"><button class="settings-trigger" type="button" data-liquid-item aria-label="打开设置" title="设置"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"></path><circle cx="16" cy="6" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="13" cy="18" r="2"></circle></svg></button></liquid-surface>
            <main class="app-shell">
                <dashboard-header></dashboard-header>
                <search-command></search-command>
                <bookmark-launchpad></bookmark-launchpad>
                <recent-sites></recent-sites>
            </main>
            <settings-drawer></settings-drawer>
            <bookmark-dialog></bookmark-dialog>
            <backup-toast></backup-toast>
            <liquid-glass-layer></liquid-glass-layer>
        `;
        this.querySelector('.settings-trigger')?.addEventListener('click', () => {
            this.querySelector<SettingsDrawer>('settings-drawer')?.open();
        });
        this.addEventListener('random-wallpaper', () => void appStore.updateSettings('wallpaper', {
            type: 'preset',
            value: `${ANIME_WALLPAPER}?t=${Date.now()}`
        }));
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === '/' && !isTypingTarget(event.target)) {
            event.preventDefault();
            this.querySelector<HTMLInputElement>('search-command input')?.focus();
        }
        if (event.key === 'Escape') this.querySelector<SettingsDrawer>('settings-drawer')?.close();
    };
}

function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

const elements: Array<[string, CustomElementConstructor]> = [
    ['liquid-surface', LiquidSurface],
    ['liquid-glass-layer', LiquidGlassLayer],
    ['wallpaper-surface', WallpaperSurface],
    ['dashboard-header', DashboardHeader],
    ['search-command', SearchCommand],
    ['bookmark-launchpad', BookmarkLaunchpad],
    ['recent-sites', RecentSites],
    ['settings-drawer', SettingsDrawer],
    ['bookmark-dialog', BookmarkDialog],
    ['backup-toast', BackupToast],
    ['infinity-newtab-app', InfinityNewTabApp]
];

elements.forEach(([name, constructor]) => {
    if (!customElements.get(name)) customElements.define(name, constructor);
});
