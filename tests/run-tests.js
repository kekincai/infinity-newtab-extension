const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadClass(file, className, globals = {}) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const context = vm.createContext({
        URL,
        Blob,
        Uint8Array,
        atob,
        decodeURIComponent,
        console,
        ...globals
    });
    vm.runInContext(`${source}\nglobalThis.TestClass = ${className};`, context);
    return context.TestClass;
}

const defaults = {
    layout: {
        showClock: true,
        showSearch: true,
        showBookmarks: true,
        showStatus: true,
        showRecent: true,
        searchEngine: 'google'
    },
    wallpaper: { type: 'gradient', value: '', blur: 0, overlay: 30 },
    appearance: {
        clockFormat: '24h',
        dateFormat: 'long',
        enhancedAnimations: true,
        theme: 'light'
    }
};

let savedLegacyImage = null;
const wallpaperMock = {
    dataUrlToBlob(dataUrl) {
        return dataUrl.startsWith('data:image/') ? new Blob(['image'], { type: 'image/png' }) : null;
    },
    async saveLocalImage(image) {
        savedLegacyImage = image;
    }
};
const ImportExportManager = loadClass('modules/import-export.js', 'ImportExportManager', {
    settingsManager: {
        mergeWithDefaults(settings) {
            return {
                layout: { ...defaults.layout, ...(settings.layout || {}) },
                wallpaper: { ...defaults.wallpaper, ...(settings.wallpaper || {}) },
                appearance: { ...defaults.appearance, ...(settings.appearance || {}) }
            };
        }
    },
    wallpaperManager: wallpaperMock
});

const importer = new ImportExportManager();
const legacy = importer.sanitizeImportedData({
    bookmarks: [
        { id: 1, name: 'www.google.com', url: 'https://www.google.com/', icon: 'https://example.com/g.png' },
        { id: 2, name: 'V2EX', url: 'www.v2ex.com', folder: '全部', order: 4 }
    ],
    folders: ['全部'],
    settings: {
        layout: { showClock: false, showTodo: true },
        wallpaper: {
            type: 'preset',
            value: 'https://images.unsplash.com/photo.jpg',
            blur: 99,
            overlay: -5
        },
        appearance: { clockFormat: '12h' }
    },
    todos: []
});

assert.equal(legacy.bookmarks.length, 2);
assert.equal(legacy.bookmarks[0].folder, '全部');
assert.equal(legacy.bookmarks[1].url, 'https://www.v2ex.com/');
assert.deepEqual(Array.from(legacy.folders), ['全部']);
assert.equal(legacy.settings.layout.showClock, false);
assert.equal(legacy.settings.layout.showStatus, true);
assert.equal('showTodo' in legacy.settings.layout, false);
assert.equal(legacy.settings.wallpaper.blur, 10);
assert.equal(legacy.settings.wallpaper.overlay, 0);
assert.equal(legacy.settings.appearance.clockFormat, '12h');

const unsafe = importer.sanitizeImportedData({
    bookmarks: [
        { id: 3, name: 'Unsafe', url: 'javascript:alert(1)', icon: 'javascript:alert(2)' }
    ],
    folders: ['全部'],
    settings: {
        wallpaper: { type: 'unknown', value: 'javascript:alert(3)' },
        appearance: { theme: 'unknown' }
    },
    unknownKey: 'not imported'
});

assert.equal(unsafe.bookmarks.length, 0);
assert.equal(unsafe.settings.wallpaper.type, 'gradient');
assert.equal(unsafe.settings.wallpaper.value, '');
assert.equal(unsafe.settings.appearance.theme, 'light');
assert.equal('unknownKey' in unsafe, false);

const WallpaperManager = loadClass('modules/wallpaper.js', 'WallpaperManager');
const wallpaper = new WallpaperManager();
const media = wallpaper.dataUrlToBlob('data:text/plain;base64,aGVsbG8=');
assert.equal(media.type, 'text/plain');
assert.equal(media.size, 5);

async function testBookmarkTransactions() {
    const legacyImageData = {
        settings: { wallpaper: { type: 'local', value: 'data:image/png;base64,aW1hZ2U=' } }
    };
    await importer.migrateLegacyLocalImage(legacyImageData);
    assert.equal(savedLegacyImage.type, 'image/png');
    assert.equal(legacyImageData.settings.wallpaper.value, 'local');

    let failWrite = true;
    const chromeMock = {
        runtime: { lastError: null },
        storage: {
            sync: {
                set(data, callback) {
                    chromeMock.runtime.lastError = failWrite ? { message: 'quota exceeded' } : null;
                    callback();
                    chromeMock.runtime.lastError = null;
                }
            }
        }
    };
    const BookmarksManager = loadClass('modules/bookmarks.js', 'BookmarksManager', { chrome: chromeMock });
    const bookmarks = new BookmarksManager();

    await assert.rejects(
        bookmarks.addBookmark('https://example.com/', 'Example', '', '全部'),
        /quota exceeded/
    );
    assert.equal(bookmarks.getAllBookmarks().length, 0);

    failWrite = false;
    await bookmarks.addBookmark('https://example.com/', 'Example', '', '全部');
    assert.equal(bookmarks.getAllBookmarks().length, 1);
}

testBookmarkTransactions()
    .then(() => console.log('All tests passed.'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
