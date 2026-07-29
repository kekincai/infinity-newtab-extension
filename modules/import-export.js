/**
 * Import/Export Module - Data backup and restore
 */

class ImportExportManager {
    constructor() {
        this.managedKeys = [
            'bookmarks',
            'folders',
            'settings',
            'todos',
            'recentSearches',
            'lastBackupPrompt'
        ];
    }

    /**
     * Export all data to JSON
     */
    async exportData() {
        const data = await new Promise((resolve, reject) => {
            chrome.storage.sync.get(null, (data) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(data);
            });
        });
        const localMedia = await wallpaperManager.exportLocalMedia();
        return {
            version: '2.0',
            exportDate: new Date().toISOString(),
            data,
            localMedia
        };
    }

    /**
     * Import data from JSON
     */
    async importData(jsonData) {
        try {
            // Validate JSON structure
            if (!jsonData || typeof jsonData !== 'object' || !jsonData.version || !jsonData.data) {
                throw new Error('Invalid backup file format');
            }
            const sanitized = this.sanitizeImportedData(jsonData.data);
            if (Object.prototype.hasOwnProperty.call(jsonData, 'localMedia')) {
                await wallpaperManager.importLocalMedia(jsonData.localMedia, true);
            }
            await this.migrateLegacyLocalImage(sanitized);

            await new Promise((resolve, reject) => {
                chrome.storage.sync.set(sanitized, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });

            const staleKeys = this.managedKeys.filter((key) => !(key in sanitized));
            if (staleKeys.length) {
                await new Promise((resolve, reject) => {
                    chrome.storage.sync.remove(staleKeys, () => {
                        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                        else resolve();
                    });
                });
            }
        } catch (error) {
            throw new Error('Failed to import data: ' + error.message);
        }
    }

    /**
     * Download JSON file
     */
    downloadJSON(data, filename = 'infinity-newtab-backup.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Read JSON file
     */
    readJSONFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    resolve(json);
                } catch (error) {
                    reject(new Error('Invalid JSON file'));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Create automatic backup
     */
    async createBackup() {
        const data = await this.exportData();
        const timestamp = new Date().toISOString().split('T')[0];
        this.downloadJSON(data, `infinity-newtab-backup-${timestamp}.json`);
    }

    sanitizeImportedData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Backup data must be an object');
        }
        const sanitized = {};

        // Normalize bookmarks
        const rawBookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
        const urlKey = (url) => {
            try {
                const u = new URL(this.normalizeUrl(url));
                return `${u.origin}${u.pathname}`.toLowerCase();
            } catch {
                return null;
            }
        };

        const merged = new Map();
        rawBookmarks.forEach((b) => {
            if (!b || typeof b !== 'object') return;
            const key = urlKey(b.url);
            if (!key) return;
            const folder = this.cleanText(b.folder, 80) || '全部';
            const id = (typeof b.id === 'number' || typeof b.id === 'string')
                ? b.id
                : Date.now() + Math.floor(Math.random() * 1000);
            const existing = merged.get(`${folder}|${key}`);
            const next = existing || {};
            next.id = existing?.id || id;
            next.folder = folder;
            next.url = this.normalizeUrl(b.url);
            next.name = this.cleanText(b.name, 160) || new URL(next.url).hostname;
            const icon = this.sanitizeIcon(b.icon);
            if (icon) next.icon = icon;
            if (Number.isFinite(Number(b.order))) next.order = Number(b.order);
            merged.set(`${folder}|${key}`, next);
        });

        // Reassign order per folder
        const byFolder = {};
        merged.forEach((b) => {
            if (!byFolder[b.folder]) byFolder[b.folder] = [];
            byFolder[b.folder].push(b);
        });
        Object.values(byFolder).forEach((list) => {
            list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id - b.id));
            list.forEach((b, idx) => { b.order = idx; });
        });

        sanitized.bookmarks = Array.from(merged.values());

        // Normalize folders
        const folders = new Set(
            (Array.isArray(data.folders) ? data.folders : [])
                .map((folder) => this.cleanText(folder, 80))
                .filter(Boolean)
        );
        folders.add('全部');
        sanitized.bookmarks.forEach((b) => folders.add(b.folder || '全部'));
        sanitized.folders = Array.from(folders);

        if (data.settings !== undefined) {
            sanitized.settings = this.sanitizeSettings(data.settings);
        }
        if (Array.isArray(data.todos)) sanitized.todos = data.todos;
        if (Array.isArray(data.recentSearches)) {
            sanitized.recentSearches = data.recentSearches
                .map((value) => this.cleanText(value, 200))
                .filter(Boolean)
                .slice(0, 20);
        }
        if (Number.isFinite(Number(data.lastBackupPrompt))) {
            sanitized.lastBackupPrompt = Number(data.lastBackupPrompt);
        }

        return sanitized;
    }

    sanitizeSettings(settings) {
        const source = settings && typeof settings === 'object' ? settings : {};
        const defaults = settingsManager.mergeWithDefaults({});
        const layout = source.layout && typeof source.layout === 'object' ? source.layout : {};
        const wallpaper = source.wallpaper && typeof source.wallpaper === 'object' ? source.wallpaper : {};
        const appearance = source.appearance && typeof source.appearance === 'object' ? source.appearance : {};
        const engines = ['google', 'bing', 'baidu', 'duckduckgo'];
        const wallpaperTypes = ['gradient', 'preset', 'local', 'video'];

        return {
            layout: {
                showClock: this.booleanOrDefault(layout.showClock, defaults.layout.showClock),
                showSearch: this.booleanOrDefault(layout.showSearch, defaults.layout.showSearch),
                showBookmarks: this.booleanOrDefault(layout.showBookmarks, defaults.layout.showBookmarks),
                showStatus: this.booleanOrDefault(layout.showStatus, defaults.layout.showStatus),
                showRecent: this.booleanOrDefault(layout.showRecent, defaults.layout.showRecent),
                searchEngine: engines.includes(layout.searchEngine) ? layout.searchEngine : defaults.layout.searchEngine
            },
            wallpaper: {
                type: wallpaperTypes.includes(wallpaper.type) ? wallpaper.type : defaults.wallpaper.type,
                value: this.sanitizeWallpaperValue(wallpaper.value),
                blur: this.clampNumber(wallpaper.blur, 0, 10, defaults.wallpaper.blur),
                overlay: this.clampNumber(wallpaper.overlay, 0, 80, defaults.wallpaper.overlay)
            },
            appearance: {
                clockFormat: appearance.clockFormat === '12h' ? '12h' : '24h',
                dateFormat: appearance.dateFormat === 'short' ? 'short' : 'long',
                enhancedAnimations: this.booleanOrDefault(
                    appearance.enhancedAnimations,
                    defaults.appearance.enhancedAnimations
                ),
                theme: appearance.theme === 'light' ? 'light' : 'dark'
            }
        };
    }

    async migrateLegacyLocalImage(data) {
        const wallpaper = data.settings?.wallpaper;
        if (wallpaper?.type !== 'local' || !wallpaper.value?.startsWith('data:image/')) return;

        const image = wallpaperManager.dataUrlToBlob(wallpaper.value);
        if (!image) throw new Error('Invalid local image in legacy backup');
        await wallpaperManager.saveLocalImage(image);
        wallpaper.value = 'local';
    }

    sanitizeWallpaperValue(value) {
        if (value === 'local' || value === '') return value;
        if (typeof value !== 'string') return '';
        if (value.startsWith('data:image/')) return value;
        try {
            const url = new URL(value);
            return url.protocol === 'https:' ? value : '';
        } catch {
            return '';
        }
    }

    sanitizeIcon(value) {
        if (typeof value !== 'string') return '';
        if (value.startsWith('data:image/')) return value;
        try {
            const url = new URL(value);
            return url.protocol === 'https:' ? value : '';
        } catch {
            return '';
        }
    }

    cleanText(value, maxLength) {
        return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
    }

    booleanOrDefault(value, fallback) {
        return typeof value === 'boolean' ? value : fallback;
    }

    clampNumber(value, min, max, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }

    normalizeUrl(url) {
        if (typeof url !== 'string' || !url.trim()) return '';
        let value = url.trim();
        if (!value.match(/^[a-zA-Z]+:\/\//)) {
            value = 'https://' + value;
        }
        try {
            const parsed = new URL(value);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch {
            return '';
        }
    }

    async resetAllData() {
        await wallpaperManager.clearAllLocalMedia();
        await new Promise((resolve, reject) => {
            chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve();
            });
        });
    }
}

// Export singleton instance
const importExportManager = new ImportExportManager();
