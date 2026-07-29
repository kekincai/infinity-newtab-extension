/**
 * Bookmarks Module - Enhanced bookmark management
 */

class BookmarksManager {
    constructor() {
        this.bookmarks = [];
        this.folders = ['全部'];
        this.currentFolder = '全部';
    }

    /**
     * Initialize bookmarks
     */
    async init() {
        await this.loadBookmarks();
        return this.bookmarks;
    }

    /**
     * Load bookmarks from storage
     */
    async loadBookmarks() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['bookmarks', 'folders'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to load bookmarks:', chrome.runtime.lastError.message);
                    resolve(this.bookmarks);
                    return;
                }
                const sanitized = this.sanitizeBookmarks(result.bookmarks || []);
                this.bookmarks = sanitized;
                this.folders = this.normalizeFolders(result.folders || ['全部'], this.bookmarks);
                resolve(this.bookmarks);
            });
        });
    }

    /**
     * Save bookmarks to storage
     */
    async persistState(bookmarks, folders) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({
                bookmarks,
                folders
            }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                this.bookmarks = bookmarks;
                this.folders = folders;
                resolve();
            });
        });
    }

    async saveBookmarks() {
        await this.persistState(this.bookmarks, this.folders);
    }

    /**
     * Add a new bookmark
     */
    async addBookmark(url, name, icon, folder = '全部') {
        const bookmark = {
            id: Date.now(),
            url,
            name,
            icon,
            folder,
            order: this.bookmarks.length
        };

        await this.persistState([...this.bookmarks, bookmark], this.folders.slice());
        return bookmark;
    }

    /**
     * Delete a bookmark
     */
    async deleteBookmark(id) {
        const bookmarks = this.bookmarks.filter(b => b.id !== id);
        await this.persistState(bookmarks, this.folders.slice());
    }

    /**
     * Update a bookmark
     */
    async updateBookmark(id, updates) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            const bookmarks = this.bookmarks.map((bookmark, bookmarkIndex) => (
                bookmarkIndex === index ? { ...bookmark, ...updates } : bookmark
            ));
            await this.persistState(bookmarks, this.folders.slice());
        }
    }

    /**
     * Get bookmarks by folder
     */
    getBookmarksByFolder(folder = '全部') {
        if (folder === '全部') {
            return this.bookmarks;
        }
        return this.bookmarks.filter(b => b.folder === folder);
    }

    /**
     * Add a new folder
     */
    async addFolder(name) {
        if (!this.folders.includes(name)) {
            await this.persistState(this.bookmarks.slice(), [...this.folders, name]);
        }
    }

    /**
     * Delete a folder
     */
    async deleteFolder(name) {
        if (name === '全部') return; // Cannot delete default folder

        const folders = this.folders.filter(f => f !== name);
        const bookmarks = this.bookmarks.map((bookmark) => (
            bookmark.folder === name ? { ...bookmark, folder: '全部' } : bookmark
        ));
        await this.persistState(bookmarks, folders);
    }

    async renameFolder(oldName, newName) {
        const cleanName = String(newName || '').trim();
        if (oldName === '全部' || !cleanName || this.folders.includes(cleanName)) return false;

        const index = this.folders.indexOf(oldName);
        if (index === -1) return false;
        const folders = this.folders.slice();
        folders[index] = cleanName;
        const bookmarks = this.bookmarks.map((bookmark) => (
            bookmark.folder === oldName ? { ...bookmark, folder: cleanName } : bookmark
        ));
        await this.persistState(bookmarks, folders);
        return true;
    }

    /**
     * Reorder bookmarks
     */
    async reorderBookmarks(newOrder) {
        const bookmarks = this.sanitizeBookmarks(newOrder);
        await this.persistState(bookmarks, this.folders.slice());
    }

    /**
     * Get all bookmarks
     */
    getAllBookmarks() {
        return this.bookmarks;
    }

    /**
     * Get all folders
     */
    getAllFolders() {
        return this.folders;
    }

    normalizeBookmarks(bookmarks) {
        const folderOrders = {};
        return bookmarks.map((b, idx) => {
            const folder = b.folder || '全部';
            if (folderOrders[folder] === undefined) folderOrders[folder] = 0;
            const order = b.order !== undefined ? b.order : folderOrders[folder];
            folderOrders[folder] = order + 1;
            return {
                ...b,
                folder,
                order
            };
        });
    }

    normalizeFolders(folders, bookmarks) {
        const set = new Set(folders || []);
        set.add('全部');
        bookmarks.forEach(b => set.add(b.folder || '全部'));
        return Array.from(set);
    }

    sanitizeBookmarks(bookmarks) {
        const seen = new Set();
        const folderOrders = {};

        return (bookmarks || []).reduce((acc, raw) => {
            const folder = raw.folder || '全部';
            const orderBase = folderOrders[folder] || 0;
            const order = raw.order !== undefined ? raw.order : orderBase;
            const id = raw.id || Date.now() + Math.floor(Math.random() * 1000);

            if (seen.has(id)) {
                return acc; // drop duplicate IDs
            }
            seen.add(id);
            folderOrders[folder] = order + 1;

            acc.push({
                ...raw,
                id,
                folder,
                order
            });
            return acc;
        }, []);
    }
}

// Export singleton instance
const bookmarksManager = new BookmarksManager();
