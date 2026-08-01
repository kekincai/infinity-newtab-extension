import { mediaStore } from '../core/media-store';
import { appStore } from '../core/store';
import { StoreElement } from './base';

export class WallpaperSurface extends StoreElement {
    protected readonly observedChanges = ['settings.wallpaper'] as const;
    private objectUrl = '';
    private renderToken = 0;

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.releaseObjectUrl();
    }

    protected render(): void {
        const token = ++this.renderToken;
        const wallpaper = appStore.state.settings.wallpaper;
        this.innerHTML = '<div class="wallpaper-media"></div><div class="wallpaper-tint"></div>';
        this.style.setProperty('--wallpaper-blur', `${wallpaper.blur}px`);
        this.style.setProperty('--wallpaper-overlay', String(wallpaper.overlay / 100));
        void this.applyMedia(token);
    }

    private async applyMedia(token: number): Promise<void> {
        const wallpaper = appStore.state.settings.wallpaper;
        const host = this.querySelector('.wallpaper-media') as HTMLDivElement | null;
        if (!host) return;
        this.releaseObjectUrl();
        if (wallpaper.type === 'video') {
            const blob = await mediaStore.get('video');
            if (!blob || token !== this.renderToken) return;
            this.objectUrl = URL.createObjectURL(blob);
            const video = document.createElement('video');
            video.src = this.objectUrl;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            host.appendChild(video);
            void video.play().catch(() => undefined);
            return;
        }
        if (wallpaper.type === 'local') {
            const blob = await mediaStore.get('image');
            if (!blob || token !== this.renderToken) return;
            this.objectUrl = URL.createObjectURL(blob);
            host.style.backgroundImage = `url("${this.objectUrl}")`;
            return;
        }
        if (wallpaper.type === 'preset' && wallpaper.value) {
            host.style.backgroundImage = `url("${wallpaper.value.replaceAll('"', '%22')}")`;
        }
    }

    private releaseObjectUrl(): void {
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = '';
    }
}
