/**
 * Settings Module - Manages all application settings and preferences
 */

// Default settings configuration
const DEFAULT_SETTINGS = {
    layout: {
        showClock: true,
        showSearch: true,
        showBookmarks: true,
        showWeather: false,
        searchEngine: 'google'
    },
    wallpaper: {
        type: 'gradient', // 'gradient', 'preset', 'local', 'unsplash'
        value: '',
        blur: 0,
        overlay: 30
    },
    appearance: {
        clockFormat: '24h', // '12h' or '24h'
        dateFormat: 'long', // 'long' or 'short'
        enhancedAnimations: true
    }
};

class SettingsManager {
    constructor() {
        this.settings = null;
        this.listeners = [];
    }

    /**
     * Initialize settings from storage
     */
    async init() {
        this.settings = await this.loadSettings();
        return this.settings;
    }

    /**
     * Load settings from chrome.storage.sync
     */
    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['settings'], (result) => {
                const settings = result.settings || DEFAULT_SETTINGS;
                // Merge with defaults to ensure all properties exist
                resolve(this.mergeWithDefaults(settings));
            });
        });
    }

    /**
     * Merge current settings with defaults
     */
    mergeWithDefaults(settings) {
        return {
            layout: { ...DEFAULT_SETTINGS.layout, ...settings.layout },
            wallpaper: { ...DEFAULT_SETTINGS.wallpaper, ...settings.wallpaper },
            appearance: { ...DEFAULT_SETTINGS.appearance, ...settings.appearance }
        };
    }

    /**
     * Save settings to chrome.storage.sync
     */
    async saveSettings(settings) {
        this.settings = settings;
        return new Promise((resolve) => {
            chrome.storage.sync.set({ settings }, () => {
                this.notifyListeners(settings);
                resolve();
            });
        });
    }

    /**
     * Update a specific setting
     */
    async updateSetting(category, key, value) {
        if (!this.settings) {
            await this.init();
        }

        if (this.settings[category]) {
            this.settings[category][key] = value;
            await this.saveSettings(this.settings);
        }
    }

    /**
     * Get a specific setting
     */
    getSetting(category, key) {
        if (!this.settings) return null;
        return this.settings[category]?.[key];
    }

    /**
     * Get all settings
     */
    getAllSettings() {
        return this.settings;
    }

    /**
     * Reset to default settings
     */
    async resetToDefaults() {
        await this.saveSettings(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    }

    /**
     * Add a listener for settings changes
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Remove a listener
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    /**
     * Notify all listeners of settings change
     */
    notifyListeners(settings) {
        this.listeners.forEach(callback => callback(settings));
    }
}

// Export singleton instance
const settingsManager = new SettingsManager();
