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

            // Import data to chrome.storage.sync
            return new Promise((resolve, reject) => {
                chrome.storage.sync.set(jsonData.data, () => {
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
}

// Export singleton instance
const importExportManager = new ImportExportManager();
