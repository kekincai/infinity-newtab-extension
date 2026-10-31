import { mediaStore } from '../core/media-store';
import { appStore } from '../core/store';
import type { ResolvedTheme } from '../core/types';
import { toneOf, toneOfBlob } from '../core/wallpaper-service';
import { StoreElement } from './base';

export type WallpaperState = { label: string; animated: boolean; paused: boolean };

type BatteryManager = EventTarget & { charging: boolean };

/**
 * Full-bleed wallpaper: the built-in Twilight Bay scene, a cached image or a
 * looping video. Playback pauses for the user, on battery or in hidden tabs.
 */
export class WallpaperSurface extends StoreElement {
    protected readonly observedChanges = ['settings.wallpaper'] as const;
    private objectUrl = '';
    private renderToken = 0;
    private appliedMediaKey = '';
    private pendingMediaKey = '';
    private userPaused = false;
    private battery: BatteryManager | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener('visibilitychange', this.syncPlayback);
        void navigator.getBattery?.().then((battery) => {
            this.battery = battery as unknown as BatteryManager;
            this.battery.addEventListener?.('chargingchange', this.syncPlayback);
            this.syncPlayback();
        }).catch(() => undefined);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('visibilitychange', this.syncPlayback);
        this.battery?.removeEventListener?.('chargingchange', this.syncPlayback);
        this.releaseObjectUrl();
    }

    get state(): WallpaperState {
        const { type, value } = appStore.state.settings.wallpaper;
        const label = type === 'gradient' ? 'Twilight Bay · 动态'
            : type === 'video' ? '本地视频 · 动态'
                : type === 'local' ? (value.startsWith('online') ? '在线壁纸' : '本地图片')
                    : '在线图片';
        return { label, animated: type === 'gradient' || type === 'video', paused: this.userPaused };
    }

    togglePaused(): void {
        this.userPaused = !this.userPaused;
        this.syncPlayback();
        this.reportState();
    }

    protected render(): void {
        const wallpaper = appStore.state.settings.wallpaper;
        if (!this.querySelector('.wallpaper-media')) {
            this.innerHTML = '<div class="wallpaper-media"></div><div class="wallpaper-tint"></div>';
        }
        this.style.setProperty('--wallpaper-blur', `${wallpaper.blur}px`);
        this.style.setProperty('--wallpaper-overlay', String(wallpaper.overlay / 100));
        this.syncPlayback();
        const mediaKey = `${wallpaper.type}:${wallpaper.value}`;
        if (mediaKey === this.appliedMediaKey || mediaKey === this.pendingMediaKey) return;
        this.pendingMediaKey = mediaKey;
        void this.applyMedia(++this.renderToken, mediaKey);
    }

    private readonly syncPlayback = (): void => {
        const { type, pauseOnBattery, pauseWhenHidden, sound } = appStore.state.settings.wallpaper;
        const paused = this.userPaused
            || (pauseWhenHidden && document.visibilityState === 'hidden')
            || (pauseOnBattery && this.battery !== null && !this.battery.charging);
        this.classList.toggle('is-paused', paused);
        const video = this.querySelector<HTMLVideoElement>('.wallpaper-media video');
        if (!video || type !== 'video') return;
        applySound(video, sound);
        if (paused) video.pause();
        else if (video.paused) void video.play().catch(() => undefined);
    };

    private async applyMedia(token: number, mediaKey: string): Promise<void> {
        const wallpaper = appStore.state.settings.wallpaper;
        const host = this.querySelector('.wallpaper-media') as HTMLDivElement | null;
        if (!host) return;
        let candidateUrl = '';
        let candidateVideo: HTMLVideoElement | null = null;
        let tone: Promise<ResolvedTheme> = Promise.resolve('dark');
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
                tone = Promise.resolve(safeTone(() => toneOf(candidateVideo!)));
                this.commitMedia(host, candidateVideo, candidateUrl, '');
                candidateUrl = '';
                candidateVideo = null;
            } else if (wallpaper.type === 'local') {
                const blob = await mediaStore.get('image');
                if (!blob) throw new Error('找不到已保存的图片背景');
                candidateUrl = URL.createObjectURL(blob);
                if (token !== this.renderToken) return;
                tone = toneOfBlob(blob).catch(() => 'dark' as const);
                this.commitMedia(host, null, candidateUrl, `url("${candidateUrl}")`);
                candidateUrl = '';
            } else {
                if (token !== this.renderToken) return;
                const preset = wallpaper.type === 'preset' && wallpaper.value;
                const background = preset ? `url("${wallpaper.value.replaceAll('"', '%22')}")` : '';
                // Remote presets from old versions cannot be sampled cross-origin; assume a busy, dark image.
                this.commitMedia(host, null, '', background);
                if (!preset) host.innerHTML = SCENE;
            }
            this.appliedMediaKey = mediaKey;
            this.syncPlayback();
            this.reportState();
            const resolved = await tone;
            if (token === this.renderToken) this.reportTone(resolved);
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
        host.querySelectorAll('video').forEach((item) => { if (item !== video) this.disposeVideo(item); });
        host.replaceChildren(...(video ? [video] : []));
        host.style.backgroundImage = background;
        this.objectUrl = objectUrl;
        if (previousUrl && previousUrl !== objectUrl) URL.revokeObjectURL(previousUrl);
    }

    private reportState(): void {
        this.dispatchEvent(new CustomEvent<WallpaperState>('wallpaper-state', { bubbles: true, composed: true, detail: this.state }));
    }

    private reportTone(tone: ResolvedTheme): void {
        this.dispatchEvent(new CustomEvent('wallpaper-tone', { bubbles: true, composed: true, detail: { tone } }));
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

/** Unmuting before any user gesture would make Chrome pause the video, so wait for one. */
function applySound(video: HTMLVideoElement, sound: boolean): void {
    if (!sound) {
        video.muted = true;
        return;
    }
    if (navigator.userActivation?.hasBeenActive) {
        video.muted = false;
        return;
    }
    const unmute = () => {
        window.removeEventListener('pointerdown', unmute, true);
        window.removeEventListener('keydown', unmute, true);
        if (video.isConnected && appStore.state.settings.wallpaper.sound) video.muted = false;
    };
    window.addEventListener('pointerdown', unmute, true);
    window.addEventListener('keydown', unmute, true);
}

function safeTone(sample: () => ResolvedTheme): ResolvedTheme {
    try {
        return sample();
    } catch {
        return 'dark';
    }
}

/** Twilight Bay: the built-in animated scene, drawn in SVG so it costs no download. */
const SCENE = `
<svg class="scene" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
        <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#121a3a"></stop>
            <stop offset="0.32" stop-color="#3a3f74"></stop>
            <stop offset="0.55" stop-color="#9a6390"></stop>
            <stop offset="0.7" stop-color="#e48b7f"></stop>
            <stop offset="0.8" stop-color="#ffc08e"></stop>
        </linearGradient>
        <radialGradient id="scene-sun-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#fff1d6" stop-opacity="1"></stop>
            <stop offset="0.25" stop-color="#ffd7a3" stop-opacity="0.8"></stop>
            <stop offset="1" stop-color="#ff9f7a" stop-opacity="0"></stop>
        </radialGradient>
        <linearGradient id="scene-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e9997f"></stop>
            <stop offset="0.35" stop-color="#8a5a82"></stop>
            <stop offset="1" stop-color="#1a1c3d"></stop>
        </linearGradient>
        <linearGradient id="scene-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8b6a9a"></stop>
            <stop offset="1" stop-color="#b47a8e"></stop>
        </linearGradient>
    </defs>
    <g class="scene-kb">
        <rect width="1440" height="720" fill="url(#scene-sky)"></rect>
        <g fill="#fff">
            <circle class="scene-star" cx="180" cy="80" r="1.4"></circle>
            <circle class="scene-star" cx="340" cy="150" r="1"></circle>
            <circle class="scene-star" cx="520" cy="60" r="1.2"></circle>
            <circle class="scene-star" cx="760" cy="110" r="0.9"></circle>
            <circle class="scene-star" cx="1010" cy="70" r="1.3"></circle>
            <circle class="scene-star" cx="1180" cy="160" r="1"></circle>
            <circle class="scene-star" cx="1320" cy="90" r="1.4"></circle>
            <circle class="scene-star" cx="90" cy="210" r="0.8"></circle>
            <circle class="scene-star" cx="1260" cy="240" r="0.8"></circle>
        </g>
        <circle class="scene-halo" cx="930" cy="612" r="260" fill="url(#scene-sun-glow)" opacity="0.7"></circle>
        <circle cx="930" cy="640" r="64" fill="#fff0d2"></circle>
        <g class="scene-cloud-a" fill="#ffd9c4" opacity="0.32">
            <ellipse cx="300" cy="380" rx="220" ry="16"></ellipse>
            <ellipse cx="420" cy="366" rx="140" ry="12"></ellipse>
            <ellipse cx="1100" cy="430" rx="260" ry="14"></ellipse>
        </g>
        <g class="scene-cloud-b" fill="#f6b9b0" opacity="0.28">
            <ellipse cx="700" cy="300" rx="300" ry="11"></ellipse>
            <ellipse cx="1240" cy="520" rx="200" ry="10"></ellipse>
            <ellipse cx="160" cy="520" rx="180" ry="9"></ellipse>
        </g>
        <path d="M0 600 L120 560 L230 585 L360 520 L470 566 L600 540 L720 590 L840 560 L980 600 L1100 548 L1230 580 L1340 540 L1440 572 L1440 700 L0 700 Z" fill="url(#scene-far)" opacity="0.75"></path>
        <path d="M0 640 L90 612 L210 650 L330 596 L440 640 L560 618 L680 664 L780 640 L900 676 L1040 630 L1160 668 L1290 620 L1440 650 L1440 712 L0 712 Z" fill="#4a3b6a"></path>
        <path d="M0 690 L140 660 L260 684 L400 650 L520 690 L1000 694 L1120 662 L1260 684 L1440 664 L1440 720 L0 720 Z" fill="#26234a"></path>
        <rect y="712" width="1440" height="188" fill="url(#scene-water)"></rect>
        <g fill="#fff3dc">
            <rect class="scene-glint" x="870" y="726" width="120" height="3" rx="1.5"></rect>
            <rect class="scene-glint" x="890" y="744" width="84" height="2.5" rx="1.2"></rect>
            <rect class="scene-glint" x="850" y="764" width="160" height="2" rx="1"></rect>
            <rect class="scene-glint" x="900" y="786" width="62" height="2" rx="1"></rect>
            <rect class="scene-glint" x="866" y="810" width="128" height="1.6" rx="0.8"></rect>
            <rect class="scene-glint" x="910" y="838" width="44" height="1.6" rx="0.8"></rect>
            <rect class="scene-glint" x="820" y="866" width="210" height="1.4" rx="0.7"></rect>
        </g>
        <path d="M0 760 C200 748 360 772 560 760 C760 748 980 776 1180 760 C1300 752 1380 756 1440 760" stroke="#ffd2b8" stroke-opacity="0.18" stroke-width="1.2" fill="none"></path>
        <path d="M0 820 C240 808 420 832 660 820 C880 808 1080 836 1300 820 C1360 816 1410 818 1440 820" stroke="#ffd2b8" stroke-opacity="0.12" stroke-width="1" fill="none"></path>
    </g>
</svg>`;
