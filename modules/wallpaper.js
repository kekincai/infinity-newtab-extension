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
        } else if (wallpaperConfig.type === 'preset' || wallpaperConfig.type === 'local') {
            this.applyWallpaper(wallpaperConfig.value, wallpaperConfig.blur, wallpaperConfig.overlay);
        }
    }

    /**
     * Apply gradient background (default)
     */
    applyGradient() {
        if (!this.bgElement) return;

        this.bgElement.style.backgroundImage = 'linear-gradient(135deg, #fff7fb 0%, #f8fbff 40%, #fef6ff 80%)';
        this.bgElement.style.filter = 'none';
    }

    /**
     * Apply wallpaper with blur and overlay
     */
    applyWallpaper(url, blur = 0, overlay = 30) {
        if (!this.bgElement) return;

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
                await this.setWallpaper('local', base64);
                resolve(base64);
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
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

        this.applyWallpaper(value, blur, overlay);
    }

    /**
     * Update blur intensity
     */
    async updateBlur(blur) {
        const settings = await settingsManager.getAllSettings();
        const wallpaperConfig = settings.wallpaper;

        await settingsManager.updateSetting('wallpaper', 'blur', blur);
        this.applyWallpaper(wallpaperConfig.value, blur, wallpaperConfig.overlay);
    }

    /**
     * Update overlay opacity
     */
    async updateOverlay(overlay) {
        const settings = await settingsManager.getAllSettings();
        const wallpaperConfig = settings.wallpaper;

        await settingsManager.updateSetting('wallpaper', 'overlay', overlay);
        this.applyWallpaper(wallpaperConfig.value, wallpaperConfig.blur, overlay);
    }

    /**
     * Reset to gradient
     */
    async resetToGradient() {
        await settingsManager.updateSetting('wallpaper', 'type', 'gradient');
        await settingsManager.updateSetting('wallpaper', 'value', '');
        this.applyGradient();
    }
}

// Export singleton instance
const wallpaperManager = new WallpaperManager();
