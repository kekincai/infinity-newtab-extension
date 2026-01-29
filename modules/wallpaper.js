/**
 * Wallpaper Module - Manages wallpaper system
 */

// Preset wallpaper collection
const PRESET_WALLPAPERS = [
    'https://api.ixiaowai.cn/api/api.php',
    'https://www.dmoe.cc/random.php',
    'https://api.ixiaowai.cn/mcapi/mcapi.php'
];

const ANIME_WALLPAPER_SOURCE = 'https://api.ixiaowai.cn/api/api.php';

class WallpaperManager {
    constructor() {
        this.currentWallpaper = null;
        this.bgElement = null;
        this.videoElement = null;
        this.overlayElement = null;
        this.videoData = null;
        this.videoUrl = null;
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
        } else if (wallpaperConfig.type === 'preset' || wallpaperConfig.type === 'local') {
            this.applyWallpaper(wallpaperConfig.value, wallpaperConfig.blur, wallpaperConfig.overlay);
        }
    }

    /**
     * Apply gradient background (default)
     */
    applyGradient() {
        if (!this.bgElement) return;

        this.removeVideoElements();
        this.bgElement.style.backgroundImage = 'linear-gradient(135deg, #fff7fb 0%, #f8fbff 40%, #fef6ff 80%)';
        this.bgElement.style.filter = 'none';
    }

    /**
     * Apply wallpaper with blur and overlay
     */
    applyWallpaper(url, blur = 0, overlay = 30) {
        if (!this.bgElement) return;

        this.removeVideoElements();
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

    async loadLocalVideo() {
        try {
            const db = await this.openVideoDB();
            return await new Promise((resolve) => {
                const tx = db.transaction('wallpapers', 'readonly');
                const store = tx.objectStore('wallpapers');
                const req = store.get('video');
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return new Promise((resolve) => {
                chrome.storage.local.get(['localVideoWallpaper'], (result) => {
                    resolve(result.localVideoWallpaper || null);
                });
            });
        }
    }

    async saveLocalVideo(data) {
        try {
            const db = await this.openVideoDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('wallpapers', 'readwrite');
                const store = tx.objectStore('wallpapers');
                const req = store.put(data, 'video');
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            return true;
        } catch (e) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ localVideoWallpaper: data }, () => {
                    resolve(!chrome.runtime.lastError);
                });
            });
        }
    }

    async clearLocalVideo() {
        try {
            const db = await this.openVideoDB();
            await new Promise((resolve) => {
                const tx = db.transaction('wallpapers', 'readwrite');
                const store = tx.objectStore('wallpapers');
                const req = store.delete('video');
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            });
        } catch (e) {
            await new Promise((resolve) => {
                chrome.storage.local.remove(['localVideoWallpaper'], () => resolve());
            });
        }
    }

    /**
     * Set random preset wallpaper
     */
    async setRandomPreset() {
        const randomUrl = PRESET_WALLPAPERS[Math.floor(Math.random() * PRESET_WALLPAPERS.length)];
        await this.applyRemoteWallpaper(randomUrl);
    }

    /**
     * Fetch anime wallpaper from remote source
     */
    async setRandomAnime() {
        await this.applyRemoteWallpaper(ANIME_WALLPAPER_SOURCE);
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
            console.warn('Wallpaper load failed, fallback to gradient.', e);
            await this.resetToGradient();
        }
    }

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
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
                const base64 = e.target.result;
                const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|ogg)$/i.test(file.name || '');

                if (isVideo) {
                    const settings = await settingsManager.getAllSettings();
                    const blur = settings?.wallpaper?.blur ?? 0;
                    const overlay = settings?.wallpaper?.overlay ?? 30;

                    const arrayBuffer = base64;
                    const blob = new Blob([arrayBuffer], { type: file.type || 'video/mp4' });
                    const url = URL.createObjectURL(blob);
                    this.videoUrl = url;

                    // Apply immediately even if storage fails due to size limits.
                    this.applyVideo(url, blur, overlay);
                    await this.setWallpaper('video', 'local', blur, overlay);
                    await this.saveLocalVideo(blob);
                } else {
                    await this.setWallpaper('local', base64);
                }
                resolve(base64);
            };

            reader.onerror = reject;
            if ((file.type && file.type.startsWith('video/')) || /\.(mp4|webm|ogg)$/i.test(file.name || '')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * Set wallpaper and save to settings
     */
    async setWallpaper(type, value, blur = 0, overlay = 30) {
        await settingsManager.updateSetting('wallpaper', 'type', type);
        await settingsManager.updateSetting('wallpaper', 'value', value);
        await settingsManager.updateSetting('wallpaper', 'blur', blur);
        await settingsManager.updateSetting('wallpaper', 'overlay', overlay);

        if (type === 'video') {
            const data = this.videoData || (await this.loadLocalVideo());
            if (data) {
                const url = data instanceof Blob ? URL.createObjectURL(data) : data;
                this.videoUrl = url;
                this.applyVideo(url, blur, overlay);
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
        await settingsManager.updateSetting('wallpaper', 'type', 'gradient');
        await settingsManager.updateSetting('wallpaper', 'value', '');
        await this.clearLocalVideo();
        this.applyGradient();
    }
}

// Export singleton instance
const wallpaperManager = new WallpaperManager();
