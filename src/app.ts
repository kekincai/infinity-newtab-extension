import { appStore } from './core/store';
import { installChromeFallback } from './core/chrome-fallback';
import type { ResolvedTheme } from './core/types';
import { escapeHtml } from './core/utils';
import { migrateLegacyWallpaper, useOnlineWallpaper } from './core/wallpaper-service';
import { BackupToast } from './components/backup-toast';
import { BookmarkDialog } from './components/bookmark-dialog';
import { BookmarkIndex } from './components/bookmark-index';
import { DashboardHeader } from './components/dashboard-header';
import { ICONS } from './components/icons';
import { GlassSystem } from './components/glass';
import { SearchBox } from './components/search-box';
import { SettingsPanel } from './components/settings-panel';
import { StatusStrip } from './components/status-strip';
import { hasOpenLayer, notify, notifyError } from './components/ui-layer';
import { WallpaperBadge } from './components/wallpaper-badge';
import { WallpaperSurface } from './components/wallpaper-surface';

installChromeFallback();

/** After this long without input the home screen fades to the clock alone. */
const IDLE_DELAY = 8000;

class InfinityNewTabApp extends HTMLElement {
    private readonly hdrMedia = window.matchMedia('(dynamic-range: high)');
    private wallpaperTone: ResolvedTheme = 'dark';
    private idleTimer = 0;

    private readonly updateClasses = () => {
        const { appearance } = appStore.state.settings;
        const hdrDisplay = this.hasHdrDisplay();
        const hdrCapable = hdrDisplay && 'gpu' in navigator;
        const theme = appearance.theme === 'auto' ? this.wallpaperTone : appearance.theme;
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
        document.body.classList.toggle('glass-tinted', appearance.glass === 'tinted');
        document.body.classList.toggle('reduce-transparency', appearance.reduceTransparency);
        document.body.classList.toggle('enhanced-animations', appearance.enhancedAnimations);
        document.body.classList.toggle('hdr-highlights', appearance.hdrHighlights);
        document.body.classList.toggle('hdr-display', hdrDisplay);
        document.body.classList.toggle('hdr-capable', hdrCapable);
        document.body.dataset.hdrOutput = hdrDisplay ? 'high' : 'standard';
    };

    private readonly onStoreChange = (event: Event) => {
        const changes = (event as CustomEvent<{ changes?: string[] }>).detail?.changes;
        if (!changes || changes.includes('settings.appearance')) this.updateClasses();
        if (!changes || changes.includes('settings.wallpaper')) this.wake();
    };

    async connectedCallback(): Promise<void> {
        this.innerHTML = '<div class="app-loading" role="status"><span></span><p>正在载入书签…</p></div>';
        try {
            await appStore.init();
            this.updateClasses();
            appStore.addEventListener('change', this.onStoreChange);
            this.hdrMedia.addEventListener('change', this.updateClasses);
            this.render();
            window.addEventListener('keydown', this.onKeyDown);
            ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin'].forEach((type) => {
                window.addEventListener(type, this.wake, { passive: true, capture: true });
            });
            this.wake();
            void migrateLegacyWallpaper();
        } catch (error) {
            this.innerHTML = `<div class="app-error"><h1>新标签页加载失败</h1><p>${escapeHtml(error instanceof Error ? error.message : '未知错误')}</p></div>`;
        }
    }

    disconnectedCallback(): void {
        appStore.removeEventListener('change', this.onStoreChange);
        this.hdrMedia.removeEventListener('change', this.updateClasses);
        window.removeEventListener('keydown', this.onKeyDown);
        ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin'].forEach((type) => {
            window.removeEventListener(type, this.wake, true);
        });
        window.clearTimeout(this.idleTimer);
    }

    private hasHdrDisplay(): boolean {
        return this.hdrMedia.matches && CSS.supports('dynamic-range-limit', 'no-limit');
    }

    private render(): void {
        this.innerHTML = `
            <wallpaper-surface></wallpaper-surface>
            <div class="home">
                <header class="top-bar">
                    <status-strip></status-strip>
                    <button class="glass round-button shuffle-wallpaper" type="button" data-glass aria-label="换一个在线壁纸" title="换一个在线壁纸">${ICONS.shuffle}</button>
                    <button class="glass round-button settings-trigger" type="button" data-glass aria-label="设置" title="设置">${ICONS.settings}</button>
                </header>
                <main class="hero">
                    <dashboard-header></dashboard-header>
                    <search-box></search-box>
                </main>
                <footer class="home-footer">
                    <bookmark-index></bookmark-index>
                    <wallpaper-badge></wallpaper-badge>
                </footer>
            </div>
            <settings-panel></settings-panel>
            <bookmark-dialog></bookmark-dialog>
            <backup-toast></backup-toast>
            <glass-system></glass-system>
        `;
        this.querySelector('.settings-trigger')?.addEventListener('click', () => this.settings?.open());
        this.querySelector('.shuffle-wallpaper')?.addEventListener('click', (event) => void this.shuffleWallpaper(event.currentTarget as HTMLButtonElement));
        this.addEventListener('wallpaper-error', this.onWallpaperError as EventListener);
        this.addEventListener('wallpaper-tone', this.onWallpaperTone as EventListener);
    }

    private get search(): SearchBox | null {
        return this.querySelector('search-box');
    }

    private get settings(): SettingsPanel | null {
        return this.querySelector('settings-panel');
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

    /** Any input brings the interface back and restarts the idle countdown. */
    private readonly wake = (): void => {
        document.body.classList.remove('is-idle');
        window.clearTimeout(this.idleTimer);
        if (!appStore.state.settings.wallpaper.idleHide) return;
        this.idleTimer = window.setTimeout(this.goIdle, IDLE_DELAY);
    };

    private readonly goIdle = (): void => {
        // Stay awake while something is open or being typed into.
        if (hasOpenLayer()
            || isTypingTarget(document.activeElement)
            || document.querySelector('.context-menu, .modal-backdrop')) {
            this.wake();
            return;
        }
        document.body.classList.add('is-idle');
    };

    private readonly onWallpaperTone = (event: CustomEvent<{ tone: ResolvedTheme }>): void => {
        this.wallpaperTone = event.detail.tone;
        this.updateClasses();
    };

    private readonly onWallpaperError = (event: CustomEvent<{ message?: string }>): void => {
        notify(`背景加载失败：${event.detail?.message || '未知错误'}。已保留原背景。`, 'error', 8000);
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const commandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
        if (commandK && this.search?.hasFocus) {
            event.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur();
            return;
        }
        if (hasOpenLayer()) return;
        if (commandK || (event.key === '/' && !isTypingTarget(event.target))) {
            event.preventDefault();
            this.search?.focusField();
        }
    };
}

function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
}

const elements: Array<[string, CustomElementConstructor]> = [
    ['glass-system', GlassSystem],
    ['wallpaper-surface', WallpaperSurface],
    ['wallpaper-badge', WallpaperBadge],
    ['status-strip', StatusStrip],
    ['dashboard-header', DashboardHeader],
    ['search-box', SearchBox],
    ['bookmark-index', BookmarkIndex],
    ['settings-panel', SettingsPanel],
    ['bookmark-dialog', BookmarkDialog],
    ['backup-toast', BackupToast],
    ['infinity-newtab-app', InfinityNewTabApp]
];

elements.forEach(([name, constructor]) => {
    if (!customElements.get(name)) customElements.define(name, constructor);
});
