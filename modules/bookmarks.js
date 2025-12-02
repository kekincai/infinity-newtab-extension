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
                this.bookmarks = result.bookmarks || [];
                this.folders = result.folders || ['全部'];
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
        this.bookmarks = newOrder;
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
}

// Export singleton instance
const bookmarksManager = new BookmarksManager();
