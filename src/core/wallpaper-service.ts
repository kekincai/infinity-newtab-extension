import { DEFAULT_SETTINGS } from './backup';
import { mediaStore, type MediaKind } from './media-store';
import { appStore } from './store';
import type { ResolvedTheme, WallpaperSettings } from './types';

const ONLINE_WALLPAPER = 'https://www.dmoe.cc/random.php';
const SAMPLE_SIZE = 32;
/** Above this average luminance the page switches to dark text. */
const LIGHT_THRESHOLD = 0.58;

/**
 * Downloads one random image and keeps it in IndexedDB, so every new tab shows
 * the same picture instantly instead of re-hitting the online API.
 */
export async function useOnlineWallpaper(): Promise<void> {
    let response: Response;
    try {
        response = await fetch(`${ONLINE_WALLPAPER}?t=${Date.now()}`, { cache: 'no-store' });
    } catch {
        throw new Error('无法连接在线壁纸服务，请检查网络');
    }
    if (!response.ok) throw new Error(`在线壁纸服务暂时不可用（${response.status}）`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('在线壁纸服务返回的不是图片');
    await validateLocalMedia(blob, 'image');
    await storeWallpaper(blob, 'image', 'online');
}

/** Pictures and videos dragged or pasted from other apps can arrive without a type; the extension tells instead. */
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm|ogv)$/i;
/** iPhone photos are often HEIC, which Chrome cannot decode. */
const HEIC = /^image\/hei[cf]/i;
const HEIC_EXTENSIONS = /\.hei[cf]$/i;

export function mediaKindOf(file: File): MediaKind | null {
    if (file.type.startsWith('video/') || (!file.type && VIDEO_EXTENSIONS.test(file.name))) return 'video';
    if (file.type.startsWith('image/') || (!file.type && (IMAGE_EXTENSIONS.test(file.name) || HEIC_EXTENSIONS.test(file.name)))) return 'image';
    return null;
}

/** Files from the picker, a drop or the clipboard all take this path. */
export async function useLocalWallpaper(file: File): Promise<void> {
    if (HEIC.test(file.type) || HEIC_EXTENSIONS.test(file.name)) {
        throw new Error('Chrome 无法显示 HEIC 格式的照片。请在“照片”中选中它，按 ⌘C 复制后在这里粘贴，或用“文件 → 导出”存为 JPEG');
    }
    const kind = mediaKindOf(file);
    if (!kind) throw new Error('请选择图片或视频文件');
    await validateLocalMedia(file, kind);
    await storeWallpaper(file, kind, 'local');
}

export async function resetWallpaper(): Promise<void> {
    const { type, value, blur, overlay } = DEFAULT_SETTINGS.wallpaper;
    await appStore.updateSettings('wallpaper', { type, value, blur, overlay });
    await mediaStore.clearAll();
}

export function wallpaperLabel(wallpaper: WallpaperSettings): string {
    if (wallpaper.type === 'video') return '本地视频';
    if (wallpaper.type === 'local') return wallpaper.value.startsWith('online') ? '在线壁纸' : '本地图片';
    return 'Twilight Bay';
}

/**
 * Saves the media first and rolls it back if the settings write fails. Once the
 * new wallpaper is in use the other kind is dropped, so an old video does not
 * linger in local storage and in every backup.
 */
async function storeWallpaper(blob: Blob, kind: MediaKind, source: 'local' | 'online'): Promise<void> {
    const previous = await mediaStore.get(kind);
    await mediaStore.set(kind, blob);
    try {
        await appStore.updateSettings('wallpaper', {
            type: kind === 'video' ? 'video' : 'local',
            value: `${source}-${Date.now()}`
        });
    } catch (error) {
        try {
            if (previous) await mediaStore.set(kind, previous);
            else await mediaStore.clear(kind);
        } catch (rollbackError) {
            throw new Error(`${errorMessage(error)}；恢复原背景也失败：${errorMessage(rollbackError)}`);
        }
        throw error;
    }
    await mediaStore.clear(kind === 'video' ? 'image' : 'video').catch(() => undefined);
}

/**
 * A light, frosted backdrop for the space around a wallpaper shown whole:
 * colours from a thin strip along each edge of the picture (so the subject's
 * colours stay out), averaged per corner in OKLab and lifted to pale, muted
 * tints, laid out as soft corner glows over a pale base.
 */
export function backdropOf(source: CanvasImageSource): string {
    const data = sample(source);
    if (!data) return DEFAULT_BACKDROP;
    const ring = 4;
    const corners = Array.from({ length: 4 }, () => ({ l: 0, a: 0, b: 0, n: 0 }));
    const all = { l: 0, a: 0, b: 0, n: 0 };
    for (let y = 0; y < SAMPLE_SIZE; y += 1) {
        for (let x = 0; x < SAMPLE_SIZE; x += 1) {
            if (x >= ring && x < SAMPLE_SIZE - ring && y >= ring && y < SAMPLE_SIZE - ring) continue;
            const index = (y * SAMPLE_SIZE + x) * 4;
            const [l, a, b] = oklab(data[index], data[index + 1], data[index + 2]);
            const corner = corners[(y < SAMPLE_SIZE / 2 ? 0 : 2) + (x < SAMPLE_SIZE / 2 ? 0 : 1)];
            for (const total of [corner, all]) {
                total.l += l;
                total.a += a;
                total.b += b;
                total.n += 1;
            }
        }
    }
    const [topLeft, topRight, bottomLeft, bottomRight] = corners.map((corner) => paleTint(corner, 0.9, 0.06));
    const base = paleTint(all, 0.955, 0.025);
    return [
        `radial-gradient(70% 70% at 0% 0%, ${topLeft}, transparent)`,
        `radial-gradient(70% 70% at 100% 0%, ${topRight}, transparent)`,
        `radial-gradient(70% 70% at 0% 100%, ${bottomLeft}, transparent)`,
        `radial-gradient(70% 70% at 100% 100%, ${bottomRight}, transparent)`,
        `linear-gradient(${base}, ${base})`
    ].join(', ');
}

/** Twilight Bay's own edges: a night-blue sky over violet water. */
export const SCENE_BACKDROP = [
    'radial-gradient(70% 70% at 0% 0%, oklch(0.9 0.045 275), transparent)',
    'radial-gradient(70% 70% at 100% 0%, oklch(0.9 0.04 285), transparent)',
    'radial-gradient(70% 70% at 0% 100%, oklch(0.9 0.05 320), transparent)',
    'radial-gradient(70% 70% at 100% 100%, oklch(0.91 0.05 345), transparent)',
    'linear-gradient(oklch(0.955 0.02 300), oklch(0.955 0.02 300))'
].join(', ');

const DEFAULT_BACKDROP = 'linear-gradient(oklch(0.955 0.01 260), oklch(0.955 0.01 260))';

/** An average OKLab colour made pale: fixed high lightness, chroma capped, hue kept. */
function paleTint(total: { l: number; a: number; b: number; n: number }, lightness: number, maxChroma: number): string {
    if (!total.n) return `oklch(${lightness} 0 0)`;
    const a = total.a / total.n;
    const b = total.b / total.n;
    const chroma = Math.min(maxChroma, Math.hypot(a, b) * 0.6);
    const hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    return `oklch(${lightness} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

/** sRGB bytes to OKLab (Björn Ottosson's definition). */
function oklab(red: number, green: number, blue: number): [number, number, number] {
    const linear = (value: number) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const r = linear(red);
    const g = linear(green);
    const b = linear(blue);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ];
}

function sample(source: CanvasImageSource): Uint8ClampedArray | null {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
}

export function toneOf(source: CanvasImageSource): ResolvedTheme {
    const data = sample(source);
    if (!data) return 'dark';
    let total = 0;
    for (let index = 0; index < data.length; index += 4) {
        total += (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
    }
    return total / (data.length / 4) > LIGHT_THRESHOLD ? 'light' : 'dark';
}

export async function validateLocalMedia(file: Blob, kind: MediaKind): Promise<void> {
    const url = URL.createObjectURL(file);
    let video: HTMLVideoElement | null = null;
    try {
        if (kind === 'image') {
            const image = new Image();
            image.src = url;
            await image.decode().catch(() => { throw new Error('图片文件无法解码，背景没有更改'); });
            return;
        }

        video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = url;
        await waitForVideo(video);
        await video.play().catch(() => { throw new Error('视频无法播放，背景没有更改'); });
    } finally {
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        URL.revokeObjectURL(url);
    }
}

function waitForVideo(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
        let timeout = 0;
        const finish = (error?: Error) => {
            window.clearTimeout(timeout);
            video.removeEventListener('canplay', onReady);
            video.removeEventListener('error', onError);
            if (error) reject(error);
            else resolve();
        };
        const onReady = () => finish();
        const onError = () => finish(new Error('视频文件无法解码，背景没有更改'));
        video.addEventListener('canplay', onReady, { once: true });
        video.addEventListener('error', onError, { once: true });
        timeout = window.setTimeout(() => finish(new Error('读取视频超时，背景没有更改')), 10000);
        video.load();
    });
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : '操作失败';
}
