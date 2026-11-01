import { ICONS } from './icons';
import type { WallpaperState, WallpaperSurface } from './wallpaper-surface';

/** A pause button for moving wallpapers, bottom-right; still pictures show nothing. */
export class WallpaperBadge extends HTMLElement {
    connectedCallback(): void {
        document.addEventListener('wallpaper-state', this.onState as EventListener);
        this.addEventListener('click', this.onClick);
        const surface = document.querySelector<WallpaperSurface>('wallpaper-surface');
        if (surface?.state) this.update(surface.state);
    }

    disconnectedCallback(): void {
        document.removeEventListener('wallpaper-state', this.onState as EventListener);
        this.removeEventListener('click', this.onClick);
    }

    private readonly onState = (event: CustomEvent<WallpaperState>): void => this.update(event.detail);

    private readonly onClick = (event: Event): void => {
        if (!(event.target as HTMLElement).closest('.wallpaper-pause')) return;
        document.querySelector<WallpaperSurface>('wallpaper-surface')?.togglePaused();
    };

    /** Updates in place so a keyboard user keeps focus on the pause button. */
    private update({ animated, paused }: WallpaperState): void {
        if (!this.querySelector('.wallpaper-pause')) {
            this.innerHTML = '<button class="glass round-button wallpaper-pause" type="button" data-glass></button>';
        }
        const action = paused ? '播放动态壁纸' : '暂停动态壁纸';
        const button = this.querySelector<HTMLButtonElement>('.wallpaper-pause')!;
        this.hidden = !animated;
        button.setAttribute('aria-label', action);
        button.title = action;
        button.setAttribute('aria-pressed', String(paused));
        button.innerHTML = paused ? ICONS.play : ICONS.pause;
    }
}
