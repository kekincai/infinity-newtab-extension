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
    async saveBookmarks() {
        return new Promise((resolve) => {
            chrome.storage.sync.set({
                bookmarks: this.bookmarks,
                folders: this.folders
            }, resolve);
        });
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

        this.bookmarks.push(bookmark);
        await this.saveBookmarks();
        return bookmark;
    }

    /**
     * Delete a bookmark
     */
    async deleteBookmark(id) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        await this.saveBookmarks();
    }

    /**
     * Update a bookmark
     */
    async updateBookmark(id, updates) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            this.bookmarks[index] = { ...this.bookmarks[index], ...updates };
            await this.saveBookmarks();
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
            this.folders.push(name);
            await this.saveBookmarks();
        }
    }

    /**
     * Delete a folder
     */
    async deleteFolder(name) {
        if (name === '全部') return; // Cannot delete default folder

        this.folders = this.folders.filter(f => f !== name);
        // Move bookmarks from deleted folder to default
        this.bookmarks.forEach(b => {
            if (b.folder === name) {
                b.folder = '全部';
            }
        });
        await this.saveBookmarks();
    }

    /**
     * Reorder bookmarks
     */
    async reorderBookmarks(newOrder) {
        this.bookmarks = this.sanitizeBookmarks(newOrder);
        await this.saveBookmarks();
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
