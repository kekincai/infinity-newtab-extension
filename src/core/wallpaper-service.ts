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

/**
 * Before 2.5 the random API URL itself was stored, so every new tab fetched a
 * different picture. Cache one copy locally the first time 2.5 starts.
 */
export async function migrateLegacyWallpaper(): Promise<void> {
    const { type, value } = appStore.state.settings.wallpaper;
    if (type !== 'preset' || !value.startsWith(ONLINE_WALLPAPER)) return;
    try {
        await useOnlineWallpaper();
    } catch {
        // Offline or blocked: keep the remote URL and try again next time.
    }
}

export async function useLocalWallpaper(file: File): Promise<void> {
    const kind: MediaKind | null = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
    if (!kind) throw new Error('请选择图片或视频文件');
    await validateLocalMedia(file, kind);
    await storeWallpaper(file, kind, 'local');
}

export async function resetWallpaper(): Promise<void> {
    await appStore.updateSettings('wallpaper', { type: 'gradient', value: '', blur: 0, overlay: 30 });
    await mediaStore.clearAll();
}

export function wallpaperLabel(wallpaper: WallpaperSettings): string {
    if (wallpaper.type === 'video') return '本地视频';
    if (wallpaper.type === 'local') return wallpaper.value.startsWith('online') ? '在线壁纸' : '本地图片';
    if (wallpaper.type === 'preset') return '在线图片';
    return '默认渐变';
}

/** Saves the media first and rolls it back if the settings write fails. */
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
}

export async function toneOfBlob(blob: Blob): Promise<ResolvedTheme> {
    const bitmap = await createImageBitmap(blob, { resizeWidth: SAMPLE_SIZE, resizeHeight: SAMPLE_SIZE });
    try {
        return toneOf(bitmap);
    } finally {
        bitmap.close();
    }
}

export function toneOf(source: CanvasImageSource): ResolvedTheme {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return 'dark';
    context.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
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
