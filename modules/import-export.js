/**
 * Import/Export Module - Data backup and restore
 */

class ImportExportManager {
    /**
     * Export all data to JSON
     */
    async exportData() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (data) => {
                const exportData = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    data: data
                };
                resolve(exportData);
            });
        });
    }

    /**
     * Import data from JSON
     */
    async importData(jsonData) {
        try {
            // Validate JSON structure
            if (!jsonData.version || !jsonData.data) {
                throw new Error('Invalid backup file format');
            }
            const sanitized = this.sanitizeImportedData(jsonData.data);

            // Import data to chrome.storage.sync
            return new Promise((resolve, reject) => {
                chrome.storage.sync.set(sanitized, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
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

        URL.revokeObjectURL(url);
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
        const sanitized = { ...data };

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
            const key = urlKey(b.url);
            if (!key) return;
            const folder = b.folder || '全部';
            const id = b.id || Date.now() + Math.floor(Math.random() * 1000);
            const existing = merged.get(`${folder}|${key}`);
            const next = existing || { ...b };
            next.id = existing?.id || id;
            next.folder = folder;
            next.url = this.normalizeUrl(b.url);
            if (b.name) next.name = b.name;
            if (b.icon) next.icon = b.icon;
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
        const folders = new Set(Array.isArray(data.folders) ? data.folders : []);
        folders.add('全部');
        sanitized.bookmarks.forEach((b) => folders.add(b.folder || '全部'));
        sanitized.folders = Array.from(folders);

        return sanitized;
    }

    normalizeUrl(url) {
        if (!url) return '';
        let value = url.trim();
        if (!value.match(/^[a-zA-Z]+:\/\//)) {
            value = 'https://' + value;
        }
        return value;
    }
}

// Export singleton instance
const importExportManager = new ImportExportManager();
