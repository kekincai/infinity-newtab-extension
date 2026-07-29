const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const initialData = {
    bookmarks: [
        { id: 1, name: 'www.google.com', url: 'https://www.google.com/', icon: '', folder: '全部', order: 0 },
        { id: 2, name: 'GitHub', url: 'https://github.com/', icon: '', folder: '全部', order: 1 },
        { id: 3, name: 'Bilibili', url: 'https://www.bilibili.com/', icon: '', folder: 'POM', order: 0 }
    ],
    folders: ['全部', 'POM'],
    settings: {
        layout: { showClock: true, showSearch: true, showBookmarks: true, showStatus: true, showRecent: true, searchEngine: 'google' },
        wallpaper: { type: 'gradient', value: '', blur: 0, overlay: 30 },
        appearance: { clockFormat: '24h', dateFormat: 'long', enhancedAnimations: true, theme: 'light' }
    },
    recentSearches: ['二次元壁纸'],
    lastBackupPrompt: 4102444800000
};

const historyItems = [
    { url: 'https://www.youtube.com/watch?v=1', visitCount: 8, lastVisitTime: 300 },
    { url: 'https://www.youtube.com/watch?v=2', visitCount: 5, lastVisitTime: 200 },
    { url: 'https://www.v2ex.com/t/1', visitCount: 4, lastVisitTime: 100 },
    { url: 'https://www.google.com/search?q=noise', visitCount: 99, lastVisitTime: 400 }
];

async function installChromeMock(page, seed = initialData) {
    await page.addInitScript(({ seed, history }) => {
        const syncKey = 'infinity-e2e-sync';
        const localKey = 'infinity-e2e-local';
        if (!sessionStorage.getItem('infinity-e2e-ready')) {
            localStorage.setItem(syncKey, JSON.stringify(seed));
            localStorage.setItem(localKey, '{}');
            sessionStorage.setItem('infinity-e2e-ready', '1');
        }
        const readArea = (key) => JSON.parse(localStorage.getItem(key) || '{}');
        const writeArea = (key, value) => localStorage.setItem(key, JSON.stringify(value));
        const selectKeys = (data, keys) => {
            if (keys === null || keys === undefined) return { ...data };
            if (typeof keys === 'string') return { [keys]: data[keys] };
            if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, data[key]]));
            return {};
        };
        const storageArea = (key) => ({
            get(keys, callback) { callback(selectKeys(readArea(key), keys)); },
            set(values, callback = () => {}) { writeArea(key, { ...readArea(key), ...values }); callback(); },
            remove(keys, callback = () => {}) {
                const data = readArea(key);
                for (const name of Array.isArray(keys) ? keys : [keys]) delete data[name];
                writeArea(key, data);
                callback();
            },
            clear(callback = () => {}) { writeArea(key, {}); callback(); }
        });
        Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 8 });
        navigator.getBattery = async () => ({ level: 0.82, charging: false });
        window.chrome = {
            runtime: { id: 'e2e-infinity-newtab', lastError: null, getURL: () => `${location.origin}/icons/icon-48.png` },
            storage: { sync: storageArea(syncKey), local: storageArea(localKey) },
            tabs: { query(_query, callback) { callback([]); }, update() {} },
            downloads: { search(_query, callback) { callback([]); }, show() {} },
            history: { search(_query, callback) { callback(history); } }
        };
        window.__readMockSync = () => readArea(syncKey);
    }, { seed, history: historyItems });
}

async function openExtension(page, seed = initialData) {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await installChromeMock(page, seed);
    await page.goto('/newtab.html');
    await expect(page.locator('.bookmark-tile')).toHaveCount(2);
    return errors;
}

async function centerOf(locator) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function openSettings(page, tab = 'appearance') {
    await page.locator('.settings-trigger').click();
    await expect(page.locator('.settings-drawer')).toHaveClass(/is-open/);
    if (tab !== 'appearance') await page.locator(`[data-tab="${tab}"]`).click();
}

test('renders the TypeScript Web Component home screen', async ({ page }) => {
    const errors = await openExtension(page);
    await expect(page).toHaveTitle('Infinity New Tab');
    await expect(page.locator('infinity-newtab-app')).toHaveCount(1);
    await expect(page.locator('bookmark-launchpad')).toContainText('全部');
    await expect(page.locator('.folder-tile[data-folder="POM"]')).toHaveCount(1);
    await expect(page.locator('.recent-card')).toHaveCount(2);
    await expect(page.locator('.recent-track')).toContainText('youtube');
    await expect(page.locator('.recent-track')).not.toContainText('google');
    await expect(page.locator('.cpu-chip')).toHaveText('CPU: 8 线程');
    await expect(page.locator('.battery-chip')).toContainText('82%');
    await expect(page.locator('liquid-glass-layer')).toHaveCount(1);
    await expect(page.locator('.liquid-lens')).toHaveText('');
    await expect(page.locator('.liquid-lens')).not.toHaveClass(/is-visible/);
    expect(errors).toEqual([]);
});

test('drives one real optical droplet directly from pointer position', async ({ page }) => {
    const errors = await openExtension(page);
    const first = await centerOf(page.locator('.anime-wallpaper'));
    const second = await centerOf(page.locator('.create-folder'));
    const lens = page.locator('.liquid-lens');
    const mapHref = await page.locator('feImage').getAttribute('href');
    expect(mapHref).toMatch(/^data:image\/png;base64,/);

    await page.mouse.move(first.x, first.y);
    await expect(lens).toHaveClass(/is-visible/);
    await page.waitForTimeout(180);
    const firstLens = await lens.boundingBox();
    expect(firstLens.width).toBeLessThan(first.box.width);
    expect(firstLens.width).toBeGreaterThan(55);
    expect(await lens.evaluate((element) => getComputedStyle(element).backdropFilter)).toContain('infinity-liquid-refraction');

    const midpoint = { x: (first.box.x + first.box.width + second.box.x) / 2, y: (first.y + second.y) / 2 };
    await page.mouse.move(midpoint.x, midpoint.y);
    await page.waitForTimeout(650);
    const paused = await lens.boundingBox();
    const pausedTransform = await lens.evaluate((element) => element.style.transform);
    expect(Math.abs(paused.x + paused.width / 2 - midpoint.x)).toBeLessThan(2);
    expect(paused.x + paused.width / 2).toBeGreaterThan(first.x);
    expect(paused.x + paused.width / 2).toBeLessThan(second.x);
    await page.waitForTimeout(250);
    expect(await lens.evaluate((element) => element.style.transform)).toBe(pausedTransform);

    const later = { x: first.x + (second.x - first.x) * 0.78, y: first.y };
    await page.mouse.move(later.x, later.y);
    await page.waitForTimeout(120);
    const laterBox = await lens.boundingBox();
    expect(laterBox.x + laterBox.width / 2).toBeGreaterThan(paused.x + paused.width / 2);
    await page.mouse.move(midpoint.x, midpoint.y);
    await page.waitForTimeout(120);
    const reversed = await lens.boundingBox();
    expect(reversed.x + reversed.width / 2).toBeLessThan(laterBox.x + laterBox.width / 2);

    const bookmarkOne = await centerOf(page.locator('.bookmark-tile[data-bookmark-id="1"]'));
    const bookmarkTwo = await centerOf(page.locator('.bookmark-tile[data-bookmark-id="2"]'));
    await page.mouse.move(bookmarkOne.x, bookmarkOne.y);
    await page.mouse.move((bookmarkOne.x + bookmarkTwo.x) / 2, bookmarkOne.y, { steps: 8 });
    await page.waitForTimeout(350);
    await expect(lens).toHaveClass(/is-visible/);
    const gridGap = await lens.boundingBox();
    expect(gridGap.x + gridGap.width / 2).toBeGreaterThan(bookmarkOne.x);
    expect(gridGap.x + gridGap.width / 2).toBeLessThan(bookmarkTwo.x);

    await page.mouse.move(10, 10);
    await page.waitForTimeout(180);
    await expect(lens).not.toHaveClass(/is-visible/);
    expect(errors).toEqual([]);
});

test('moves and reorders bookmarks without duplication', async ({ page }) => {
    const errors = await openExtension(page);
    await page.locator('.bookmark-tile[data-bookmark-id="1"]').dragTo(page.locator('.folder-tile[data-folder="POM"]'));
    await expect(page.locator('.bookmark-tile')).toHaveCount(1);
    let stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(3);
    expect(stored.bookmarks.find((bookmark) => String(bookmark.id) === '1').folder).toBe('POM');

    await page.locator('.folder-tile[data-folder="POM"]').click();
    await expect(page.locator('.bookmark-tile')).toHaveCount(2);
    await page.locator('.bookmark-tile[data-bookmark-id="3"]').dragTo(page.locator('.bookmark-tile[data-bookmark-id="1"]'));
    stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(3);
    const pomOrder = stored.bookmarks.filter((bookmark) => bookmark.folder === 'POM').sort((a, b) => a.order - b.order).map((bookmark) => String(bookmark.id));
    expect(pomOrder).toEqual(['3', '1']);
    expect(new Set(stored.bookmarks.map((bookmark) => String(bookmark.id))).size).toBe(3);
    expect(errors).toEqual([]);
});

test('persists layout, theme and local wallpaper controls', async ({ page }) => {
    const errors = await openExtension(page);
    await openSettings(page, 'layout');
    await page.locator('input[data-toggle="showStatus"]').uncheck();
    await expect(page.locator('.status-grid')).toBeHidden();
    await page.locator('[data-tab="appearance"]').click();
    await page.locator('input[data-toggle="darkText"]').uncheck();
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
    await page.locator('[data-tab="wallpaper"]').click();
    await page.locator('.upload-wallpaper input').setInputFiles({
        name: 'wallpaper.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    });
    await expect.poll(() => page.evaluate(() => window.__readMockSync().settings.wallpaper.type)).toBe('local');
    await page.reload();
    await expect(page.locator('.wallpaper-media')).toHaveCSS('background-image', /blob:/);
    const stored = await page.evaluate(() => window.__readMockSync().settings);
    expect(stored.layout.showStatus).toBe(false);
    expect(stored.appearance.theme).toBe('dark');
    expect(errors).toEqual([]);
});

test('imports a version 1 backup and exports version 2', async ({ page }, testInfo) => {
    const errors = await openExtension(page);
    const backup = {
        version: '1.0',
        exportDate: '2026-01-24T14:12:46.859Z',
        data: {
            bookmarks: [{ id: 10, name: 'www.v2ex.com', url: 'https://www.v2ex.com/', order: 0 }],
            folders: ['全部'],
            settings: {
                layout: { showClock: true, showSearch: true, showBookmarks: true },
                wallpaper: { type: 'gradient', value: '', blur: 0, overlay: 30 },
                appearance: { clockFormat: '24h', dateFormat: 'long' }
            },
            todos: []
        }
    };
    await openSettings(page, 'data');
    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('.import-data input').setInputFiles({
        name: 'legacy-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
    });
    await expect(page.locator('.bookmark-tile')).toHaveCount(1);
    await expect(page.locator('bookmark-launchpad')).toContainText('v2ex.com');
    const stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(1);
    expect(stored.bookmarks[0].folder).toBe('全部');
    expect(stored.settings.layout.showStatus).toBe(true);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-data').click();
    const download = await downloadPromise;
    const path = testInfo.outputPath('backup.json');
    await download.saveAs(path);
    const exported = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(exported.version).toBe('2.0');
    expect(exported.data.bookmarks).toHaveLength(1);
    expect(exported.localMedia).toEqual({ image: null, video: null });
    expect(errors).toEqual([]);
});

test('keeps backup reminder clear of the add button', async ({ page }) => {
    const errors = await openExtension(page, { ...initialData, lastBackupPrompt: 0 });
    const toast = await page.locator('.backup-toast').boundingBox();
    const add = await page.locator('.add-bookmark-fab').boundingBox();
    expect(toast).not.toBeNull();
    expect(add).not.toBeNull();
    const overlaps = !(toast.x + toast.width <= add.x || add.x + add.width <= toast.x || toast.y + toast.height <= add.y || add.y + add.height <= toast.y);
    expect(overlaps).toBe(false);
    expect(errors).toEqual([]);
});
