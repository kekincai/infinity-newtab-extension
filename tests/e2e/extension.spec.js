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

async function inspectArticleFilter(page, locator) {
    await expect(locator).toHaveClass(/liquid-glass-host/);
    const before = await locator.evaluate((element) => {
        const filter = element.querySelector('filter');
        return {
            backdrop: getComputedStyle(element.querySelector('.liquid-glass-layer')).backdropFilter,
            scale: Number(filter?.querySelector('feDisplacementMap')?.getAttribute('scale') || 0),
            state: element.dataset.liquidState
        };
    });
    await locator.hover();
    await expect.poll(() => locator.evaluate((element) => Number(
        getComputedStyle(element).getPropertyValue('--liquid-presence') || 0
    ))).toBeGreaterThan(0.999);
    const info = await locator.evaluate((element) => {
        const id = element.dataset.liquidFilterId;
        const filter = id ? element.querySelector(`#${id}`) : null;
        const displacement = filter?.querySelector('feImage[data-optical-map="displacement"]');
        const specular = filter?.querySelector('feImage[data-optical-map="specular"]');
        const scale = Number(filter?.querySelector('feDisplacementMap')?.getAttribute('scale') || 0);
        const maximum = Number(filter?.dataset.maximumDisplacement || 0);
        return {
            id,
            width: element.offsetWidth,
            height: element.offsetHeight,
            backdrop: getComputedStyle(element.querySelector('.liquid-glass-layer')).backdropFilter,
            coLocated: filter?.closest('svg')?.parentElement === element,
            displacementWidth: Number(displacement?.getAttribute('width')),
            displacementHeight: Number(displacement?.getAttribute('height')),
            displacementHref: displacement?.getAttribute('href'),
            specularWidth: Number(specular?.getAttribute('width')),
            specularHeight: Number(specular?.getAttribute('height')),
            specularHref: specular?.getAttribute('href'),
            compositeCount: filter?.querySelectorAll('feComposite').length,
            transferCount: filter?.querySelectorAll('feComponentTransfer').length,
            blendCount: filter?.querySelectorAll('feBlend').length,
            nodeOrder: filter ? [...filter.children].map((node) => node.tagName.toLowerCase()) : [],
            xChannel: filter?.querySelector('feDisplacementMap')?.getAttribute('xChannelSelector'),
            yChannel: filter?.querySelector('feDisplacementMap')?.getAttribute('yChannelSelector'),
            blur: filter?.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'),
            saturation: filter?.querySelector('feColorMatrix')?.getAttribute('values'),
            specularOpacity: filter?.querySelector('feFuncA')?.getAttribute('slope'),
            scale,
            maximum
        };
    });
    expect(info.id).toBeTruthy();
    expect(before.backdrop).toContain(info.id);
    expect(before.scale).toBe(0);
    expect(before.state).toBe('idle');
    expect(info.backdrop).toContain(info.id);
    expect(info.coLocated).toBe(true);
    expect(info.displacementWidth).toBe(info.width);
    expect(info.displacementHeight).toBe(info.height);
    expect(info.specularWidth).toBe(info.width);
    expect(info.specularHeight).toBe(info.height);
    expect(info.displacementHref).toMatch(/^data:image\/png;base64,/);
    expect(info.specularHref).toMatch(/^data:image\/png;base64,/);
    expect(info.compositeCount).toBe(1);
    expect(info.transferCount).toBe(1);
    expect(info.blendCount).toBe(2);
    expect(info.nodeOrder).toEqual([
        'fegaussianblur',
        'feimage',
        'fedisplacementmap',
        'fecolormatrix',
        'feimage',
        'fecomposite',
        'fecomponenttransfer',
        'feblend',
        'feblend'
    ]);
    expect(info.xChannel).toBe('R');
    expect(info.yChannel).toBe('G');
    expect(Number(info.blur)).toBeCloseTo(1, 2);
    expect(Number(info.saturation)).toBeCloseTo(4, 2);
    expect(Number(info.specularOpacity)).toBeCloseTo(0.2, 2);
    expect(info.maximum).toBeGreaterThan(30);
    expect(info.scale / info.maximum).toBeCloseTo(0.7, 2);
    return info;
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
    await expect(page.locator('liquid-glass-system')).toHaveCount(1);
    await expect(page.locator('.bookmark-tile').first()).toHaveClass(/liquid-glass-host/);
    const coverage = await page.evaluate(() => {
        const items = [...document.querySelectorAll('[data-liquid-item]')];
        return {
            total: items.length,
            oldWrappers: document.querySelectorAll('liquid-surface, liquid-filter-bank').length,
            withoutFilter: items.filter((item) => item.getClientRects().length && (!item.classList.contains('liquid-glass-host') || !item.dataset.liquidFilterId)).length,
            withoutLocalFilter: items.filter((item) => item.getClientRects().length && !item.querySelector('svg.liquid-filter-defs filter')).length
        };
    });
    expect(coverage.total).toBeGreaterThan(10);
    expect(coverage.oldWrappers).toBe(0);
    expect(coverage.withoutFilter).toBe(0);
    expect(coverage.withoutLocalFilter).toBe(0);
    expect(errors).toEqual([]);
});

test('co-locates the article optical pipeline inside every real component', async ({ page }) => {
    const errors = await openExtension(page);
    const action = await inspectArticleFilter(page, page.locator('.anime-wallpaper'));
    const secondAction = await inspectArticleFilter(page, page.locator('.create-folder'));
    expect(secondAction.id).not.toBe(action.id);

    const folder = await inspectArticleFilter(page, page.locator('.folder-tile[data-folder="POM"]'));
    const bookmark = await inspectArticleFilter(page, page.locator('.bookmark-tile[data-bookmark-id="1"]'));
    expect(bookmark.id).not.toBe(folder.id);

    await inspectArticleFilter(page, page.locator('.recent-card').first());
    await inspectArticleFilter(page, page.locator('.search-shell'));

    await page.mouse.move(10, 10);
    await expect.poll(() => page.locator('.anime-wallpaper').evaluate((element) => Number(
        element.querySelector('feDisplacementMap')?.getAttribute('scale') || 0
    ))).toBeLessThan(0.2);
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
