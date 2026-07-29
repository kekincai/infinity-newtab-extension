/**
 * Wallpaper Module - Manages wallpaper system
 */

// Preset wallpaper collection
const PRESET_WALLPAPERS = [
    'https://www.dmoe.cc/random.php'
];

const ANIME_WALLPAPER_SOURCE = 'https://www.dmoe.cc/random.php';

class WallpaperManager {
    constructor() {
        this.currentWallpaper = null;
        this.bgElement = null;
        this.videoElement = null;
        this.overlayElement = null;
        this.videoData = null;
        this.videoUrl = null;
        this.imageUrl = null;
    }

    /**
     * Initialize wallpaper system
     */
    init(bgElement) {
        this.bgElement = bgElement;
        this.loadWallpaper();
    }

    /**
     * Load current wallpaper from settings
     */
    async loadWallpaper() {
        const settings = await settingsManager.getAllSettings();
        const wallpaperConfig = settings.wallpaper;

        if (wallpaperConfig.type === 'gradient') {
            this.applyGradient();
        } else if (wallpaperConfig.type === 'video') {
            const videoData = await this.loadLocalVideo();
            if (videoData) {
                const url = videoData instanceof Blob ? URL.createObjectURL(videoData) : videoData;
                this.videoUrl = url;
                this.applyVideo(url, wallpaperConfig.blur, wallpaperConfig.overlay);
            } else {
                this.applyGradient();
            }
        } else if (wallpaperConfig.type === 'local') {
            if (wallpaperConfig.value && wallpaperConfig.value !== 'local') {
                // Version 1 backups stored local images directly in sync storage.
                this.applyWallpaper(wallpaperConfig.value, wallpaperConfig.blur, wallpaperConfig.overlay);
                return;
            }
            const imageData = await this.loadLocalImage();
            if (imageData) {
                this.imageUrl = imageData instanceof Blob ? URL.createObjectURL(imageData) : imageData;
                this.applyWallpaper(this.imageUrl, wallpaperConfig.blur, wallpaperConfig.overlay);
            } else {
                this.applyGradient();
            }
        } else if (wallpaperConfig.type === 'preset') {
            this.applyWallpaper(wallpaperConfig.value, wallpaperConfig.blur, wallpaperConfig.overlay);
        }
    }

    /**
     * Apply gradient background (default)
     */
    applyGradient() {
        if (!this.bgElement) return;

        this.removeVideoElements();
        this.revokeLocalImageUrl();
        this.bgElement.style.backgroundImage = 'linear-gradient(135deg, #fff7fb 0%, #f8fbff 40%, #fef6ff 80%)';
        this.bgElement.style.filter = 'none';
    }

    /**
     * Apply wallpaper with blur and overlay
     */
    applyWallpaper(url, blur = 0, overlay = 30) {
        if (!this.bgElement) return;

        this.removeVideoElements();
        if (this.imageUrl && this.imageUrl !== url) {
            this.revokeLocalImageUrl();
        }
        this.bgElement.style.backgroundImage = `
            linear-gradient(rgba(0, 0, 0, ${overlay / 100}), rgba(0, 0, 0, ${overlay / 100})),
            url(${url})
        `;
        this.bgElement.style.backgroundSize = 'cover';
        this.bgElement.style.backgroundPosition = 'center';
        this.bgElement.style.backgroundRepeat = 'no-repeat';
        this.bgElement.style.filter = `blur(${blur}px)`;

        this.currentWallpaper = url;
    }

    ensureVideoElements() {
        if (!this.bgElement) return;
        if (!this.videoElement) {
            const video = document.createElement('video');
            video.className = 'background-video';
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;
            video.setAttribute('muted', '');
            video.setAttribute('loop', '');
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            this.videoElement = video;
            this.bgElement.appendChild(video);
        }
        if (!this.overlayElement) {
            const overlay = document.createElement('div');
            overlay.className = 'background-overlay';
            this.overlayElement = overlay;
            this.bgElement.appendChild(overlay);
        }
    }

    removeVideoElements() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.remove();
            this.videoElement = null;
        }
        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
        }
        if (this.videoUrl) {
            URL.revokeObjectURL(this.videoUrl);
            this.videoUrl = null;
        }
        this.videoData = null;
    }

    revokeLocalImageUrl() {
        if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(this.imageUrl);
        }
        this.imageUrl = null;
    }

    applyVideo(dataUrl, blur = 0, overlay = 30) {
        if (!this.bgElement) return;

        this.ensureVideoElements();
        this.bgElement.style.backgroundImage = 'none';
        this.bgElement.style.filter = `blur(${blur}px)`;
        if (this.overlayElement) {
            this.overlayElement.style.background = `rgba(0, 0, 0, ${overlay / 100})`;
        }

        this.videoData = dataUrl;
        if (this.videoUrl && this.videoUrl !== dataUrl) {
            URL.revokeObjectURL(this.videoUrl);
            this.videoUrl = null;
        }
        if (this.videoElement) {
            this.videoElement.src = dataUrl;
            const playPromise = this.videoElement.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        }
    }

    async openVideoDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('infinity-wallpaper', 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('wallpapers')) {
                    db.createObjectStore('wallpapers');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getFallbackStorageKey(kind) {
        return kind === 'image' ? 'localImageWallpaper' : 'localVideoWallpaper';
    }

    async loadLocalMedia(kind) {
        try {
            const db = await this.openVideoDB();
            return await new Promise((resolve) => {
                const tx = db.transaction('wallpapers', 'readonly');
                const store = tx.objectStore('wallpapers');
                const req = store.get(kind);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return new Promise((resolve) => {
                const key = this.getFallbackStorageKey(kind);
                chrome.storage.local.get([key], (result) => {
                    resolve(result[key] || null);
                });
            });
        }
    }

    async saveLocalMedia(kind, data) {
        try {
            const db = await this.openVideoDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('wallpapers', 'readwrite');
                const store = tx.objectStore('wallpapers');
                const req = store.put(data, kind);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            return true;
        } catch (e) {
            return new Promise((resolve, reject) => {
                const key = this.getFallbackStorageKey(kind);
                chrome.storage.local.set({ [key]: data }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(true);
                });
            });
        }
    }

    async clearLocalMedia(kind) {
        try {
            const db = await this.openVideoDB();
            await new Promise((resolve) => {
                const tx = db.transaction('wallpapers', 'readwrite');
                const store = tx.objectStore('wallpapers');
                const req = store.delete(kind);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            });
        } catch (e) {
            console.warn(`Failed to clear ${kind} from IndexedDB.`, e);
        }
        await new Promise((resolve) => {
            chrome.storage.local.remove([this.getFallbackStorageKey(kind)], () => resolve());
        });
    }

    loadLocalVideo() {
        return this.loadLocalMedia('video');
    }

    loadLocalImage() {
        return this.loadLocalMedia('image');
    }

    saveLocalVideo(data) {
        return this.saveLocalMedia('video', data);
    }

    saveLocalImage(data) {
        return this.saveLocalMedia('image', data);
    }

    clearLocalVideo() {
        return this.clearLocalMedia('video');
    }

    clearLocalImage() {
        return this.clearLocalMedia('image');
    }

    async clearAllLocalMedia() {
        await Promise.all([this.clearLocalImage(), this.clearLocalVideo()]);
        this.revokeLocalImageUrl();
        this.removeVideoElements();
    }

    /**
     * Set random preset wallpaper
     */
    async setRandomPreset() {
        const randomUrl = PRESET_WALLPAPERS[Math.floor(Math.random() * PRESET_WALLPAPERS.length)];
        return this.applyRemoteWallpaper(randomUrl);
    }

    /**
     * Fetch anime wallpaper from remote source
     */
    async setRandomAnime() {
        return this.applyRemoteWallpaper(ANIME_WALLPAPER_SOURCE);
    }

    /**
     * Preload and apply remote wallpaper with cache-busting
     */
    async applyRemoteWallpaper(url) {
        const withTimestamp = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
        try {
            await this.preloadImage(withTimestamp);
            await this.setWallpaper('preset', withTimestamp, 2, 35);
        } catch (e) {
            console.warn('Wallpaper load failed; keeping the current background.', e);
            return false;
        }
        return true;
    }

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = reject;
            img.src = url;
        });
    }

    /**
     * Upload local wallpaper
     */
    async uploadLocal(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                const fileData = e.target.result;
                const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|ogg)$/i.test(file.name || '');
                const blob = new Blob([fileData], { type: file.type || (isVideo ? 'video/mp4' : 'image/jpeg') });
                const settings = await settingsManager.getAllSettings();
                const blur = settings?.wallpaper?.blur ?? 0;
                const overlay = settings?.wallpaper?.overlay ?? 30;

                if (isVideo) await this.saveLocalVideo(blob);
                else await this.saveLocalImage(blob);

                await this.setWallpaper(isVideo ? 'video' : 'local', 'local', blur, overlay);
                resolve(true);
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Set wallpaper and save to settings
     */
    async setWallpaper(type, value, blur = 0, overlay = 30) {
        await settingsManager.updateCategory('wallpaper', { type, value, blur, overlay });

        if (type === 'video') {
            const data = this.videoData || (await this.loadLocalVideo());
            if (data) {
                const url = data instanceof Blob ? URL.createObjectURL(data) : data;
                this.videoUrl = url;
                this.applyVideo(url, blur, overlay);
            } else {
                this.applyGradient();
            }
        } else if (type === 'local' && value === 'local') {
            const data = await this.loadLocalImage();
            if (data) {
                this.imageUrl = data instanceof Blob ? URL.createObjectURL(data) : data;
                this.applyWallpaper(this.imageUrl, blur, overlay);
            } else {
                this.applyGradient();
            }
        } else {
            this.applyWallpaper(value, blur, overlay);
        }
    }

    /**
     * Update blur intensity
     */
    async updateBlur(blur) {
        const settings = await settingsManager.getAllSettings();
        const wallpaperConfig = settings.wallpaper;

        await settingsManager.updateSetting('wallpaper', 'blur', blur);
        if (wallpaperConfig.type === 'video') {
            const data = this.videoData || (await this.loadLocalVideo());
            if (data) {
                const url = data instanceof Blob ? URL.createObjectURL(data) : data;
                this.videoUrl = url;
                this.applyVideo(url, blur, wallpaperConfig.overlay);
            }
        } else {
            this.applyWallpaper(wallpaperConfig.value, blur, wallpaperConfig.overlay);
        }
    }

    /**
     * Update overlay opacity
     */
    async updateOverlay(overlay) {
        const settings = await settingsManager.getAllSettings();
        const wallpaperConfig = settings.wallpaper;

        await settingsManager.updateSetting('wallpaper', 'overlay', overlay);
        if (wallpaperConfig.type === 'video') {
            const data = this.videoData || (await this.loadLocalVideo());
            if (data) {
                const url = data instanceof Blob ? URL.createObjectURL(data) : data;
                this.videoUrl = url;
                this.applyVideo(url, wallpaperConfig.blur, overlay);
            }
        } else {
            this.applyWallpaper(wallpaperConfig.value, wallpaperConfig.blur, overlay);
        }
    }

    /**
     * Reset to gradient
     */
    async resetToGradient() {
        await settingsManager.updateCategory('wallpaper', { type: 'gradient', value: '' });
        await this.clearAllLocalMedia();
        this.applyGradient();
    }

    blobToDataUrl(blob) {
        if (!blob) return Promise.resolve(null);
        if (typeof blob === 'string') return Promise.resolve(blob);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read wallpaper data'));
            reader.readAsDataURL(blob);
        });
    }

    async exportLocalMedia() {
        const [image, video] = await Promise.all([this.loadLocalImage(), this.loadLocalVideo()]);
        return {
            image: await this.blobToDataUrl(image),
            video: await this.blobToDataUrl(video)
        };
    }

    dataUrlToBlob(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
        const [header, payload] = dataUrl.split(',', 2);
        if (!payload) return null;
        const mime = header.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream';
        const bytes = header.includes(';base64') ? atob(payload) : decodeURIComponent(payload);
        const array = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
        return new Blob([array], { type: mime });
    }

    async importLocalMedia(media, replace = false) {
        if (!media || typeof media !== 'object') return;
        const image = this.dataUrlToBlob(media.image);
        const video = this.dataUrlToBlob(media.video);
        if (image) await this.saveLocalImage(image);
        else if (replace) await this.clearLocalImage();
        if (video) await this.saveLocalVideo(video);
        else if (replace) await this.clearLocalVideo();
    }
}

// Export singleton instance
const wallpaperManager = new WallpaperManager();
