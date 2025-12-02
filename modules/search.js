/**
 * Search Module - Multi-engine search functionality
 */

const SEARCH_ENGINES = {
    google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        icon: '🔍'
    },
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        icon: '🔎'
    },
    baidu: {
        name: '百度',
        url: 'https://www.baidu.com/s?wd=',
        icon: '🔍'
    },
    duckduckgo: {
        name: 'DuckDuckGo',
        url: 'https://duckduckgo.com/?q=',
        icon: '🦆'
    }
};

class SearchManager {
    constructor() {
        this.currentEngine = 'google';
    }

    /**
     * Initialize search
     */
    async init() {
        const settings = await settingsManager.getAllSettings();
        this.currentEngine = settings.layout.searchEngine || 'google';
    }

    /**
     * Perform search
     */
    search(query) {
        const engine = SEARCH_ENGINES[this.currentEngine];
        const searchUrl = engine.url + encodeURIComponent(query);
        window.open(searchUrl, '_blank');
    }

    /**
     * Set search engine
     */
    async setSearchEngine(engineKey) {
        if (SEARCH_ENGINES[engineKey]) {
            this.currentEngine = engineKey;
            await settingsManager.updateSetting('layout', 'searchEngine', engineKey);
        }
    }

    /**
     * Get all available engines
     */
    getEngines() {
        return SEARCH_ENGINES;
    }

    /**
     * Get current engine
     */
    getCurrentEngine() {
        return SEARCH_ENGINES[this.currentEngine];
    }
}

// Export singleton instance
const searchManager = new SearchManager();
