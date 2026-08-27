import { mediaStore } from '../core/media-store';
import { appStore } from '../core/store';
import { StoreElement } from './base';

export class WallpaperSurface extends StoreElement {
    protected readonly observedChanges = ['settings.wallpaper'] as const;
    private objectUrl = '';
    private renderToken = 0;
    private appliedMediaKey = '';
    private pendingMediaKey = '';

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.releaseObjectUrl();
    }

    protected render(): void {
        const wallpaper = appStore.state.settings.wallpaper;
        if (!this.querySelector('.wallpaper-media')) {
            this.innerHTML = '<div class="wallpaper-media"></div><div class="wallpaper-tint"></div>';
        }
        this.style.setProperty('--wallpaper-blur', `${wallpaper.blur}px`);
        this.style.setProperty('--wallpaper-overlay', String(wallpaper.overlay / 100));
        const mediaKey = `${wallpaper.type}:${wallpaper.value}`;
        if (mediaKey === this.appliedMediaKey || mediaKey === this.pendingMediaKey) return;
        this.pendingMediaKey = mediaKey;
        void this.applyMedia(++this.renderToken, mediaKey);
    }

    private async applyMedia(token: number, mediaKey: string): Promise<void> {
        const wallpaper = appStore.state.settings.wallpaper;
        const host = this.querySelector('.wallpaper-media') as HTMLDivElement | null;
        if (!host) return;
        let candidateUrl = '';
        let candidateVideo: HTMLVideoElement | null = null;
        try {
            if (wallpaper.type === 'video') {
                const blob = await mediaStore.get('video');
                if (!blob) throw new Error('找不到已保存的视频背景');
                candidateUrl = URL.createObjectURL(blob);
                candidateVideo = document.createElement('video');
                candidateVideo.src = candidateUrl;
                candidateVideo.autoplay = true;
                candidateVideo.loop = true;
                candidateVideo.muted = true;
                candidateVideo.defaultMuted = true;
                candidateVideo.playsInline = true;
                candidateVideo.style.visibility = 'hidden';
                host.appendChild(candidateVideo);
                await candidateVideo.play();
                if (token !== this.renderToken) return;
                candidateVideo.style.removeProperty('visibility');
                this.commitMedia(host, candidateVideo, candidateUrl, '');
                candidateUrl = '';
                candidateVideo = null;
            } else if (wallpaper.type === 'local') {
                const blob = await mediaStore.get('image');
                if (!blob) throw new Error('找不到已保存的图片背景');
                candidateUrl = URL.createObjectURL(blob);
                if (token !== this.renderToken) return;
                this.commitMedia(host, null, candidateUrl, `url("${candidateUrl}")`);
                candidateUrl = '';
            } else {
                if (token !== this.renderToken) return;
                const background = wallpaper.type === 'preset' && wallpaper.value
                    ? `url("${wallpaper.value.replaceAll('"', '%22')}")`
                    : '';
                this.commitMedia(host, null, '', background);
            }
            this.appliedMediaKey = mediaKey;
        } catch (error) {
            if (token === this.renderToken) this.reportError(error);
        } finally {
            if (candidateVideo) this.disposeVideo(candidateVideo);
            if (candidateUrl) URL.revokeObjectURL(candidateUrl);
            if (this.pendingMediaKey === mediaKey) this.pendingMediaKey = '';
        }
    }

    private commitMedia(host: HTMLDivElement, video: HTMLVideoElement | null, objectUrl: string, background: string): void {
        const previousUrl = this.objectUrl;
        host.replaceChildren(...(video ? [video] : []));
        host.style.backgroundImage = background;
        this.objectUrl = objectUrl;
        if (previousUrl && previousUrl !== objectUrl) URL.revokeObjectURL(previousUrl);
    }

    private reportError(error: unknown): void {
        this.dispatchEvent(new CustomEvent('wallpaper-error', {
            bubbles: true,
            composed: true,
            detail: { message: error instanceof Error ? error.message : '背景媒体加载失败' }
        }));
    }

    private releaseObjectUrl(): void {
        this.querySelectorAll<HTMLVideoElement>('.wallpaper-media video').forEach((video) => this.disposeVideo(video));
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = '';
    }

    private disposeVideo(video: HTMLVideoElement): void {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
    }
}
