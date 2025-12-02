/**
 * Wallpaper Module - Manages wallpaper system
 */

// Preset wallpaper collection
const PRESET_WALLPAPERS = [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
    'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=1920&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
    'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&q=80'
];

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

        this.bgElement.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
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
        await this.setWallpaper('preset', randomUrl);
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
