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
    await expect(page.locator('.bookmark-tile')).toHaveCount(seed.bookmarks.filter((bookmark) => (bookmark.folder || '全部') === '全部').length);
    return errors;
}

async function centerOf(locator) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function inspectArticleFilter(page, locator) {
    await locator.hover();
    const lens = page.locator('.liquid-glass-lens');
    await expect(lens).toHaveClass(/is-visible/);
    await expect.poll(() => lens.getAttribute('data-liquid-filter-id')).toBeTruthy();
    const info = await page.evaluate(() => {
        const lens = document.querySelector('.liquid-glass-lens');
        const id = lens?.dataset.liquidFilterId;
        const filter = id ? document.getElementById(id) : null;
        const rect = lens?.getBoundingClientRect();
        const magnifying = filter?.querySelector('feImage[data-optical-map="magnifying"]');
        const displacement = filter?.querySelector('feImage[data-optical-map="displacement"]');
        const specular = filter?.querySelector('feImage[data-optical-map="specular"]');
        const scales = [...(filter?.querySelectorAll('feDisplacementMap') || [])].map((node) => Number(node.getAttribute('scale')));
        const maximum = Number(filter?.dataset.maximumDisplacement || 0);
        return {
            id,
            width: Math.round(rect?.width || 0),
            height: Math.round(rect?.height || 0),
            backdrop: lens ? getComputedStyle(lens).backdropFilter : '',
            lensText: lens?.textContent,
            lensChildren: lens?.children.length,
            magnifyingWidth: Number(magnifying?.getAttribute('width')),
            magnifyingHeight: Number(magnifying?.getAttribute('height')),
            magnifyingHref: magnifying?.getAttribute('href'),
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
            scales,
            maximum
        };
    });
    expect(info.id).toBeTruthy();
    expect(info.backdrop).toContain(info.id);
    expect(info.lensText).toBe('');
    expect(info.lensChildren).toBe(0);
    expect(info.magnifyingWidth).toBe(info.width);
    expect(info.magnifyingHeight).toBe(info.height);
    expect(info.magnifyingHref).toMatch(/^data:image\/png;base64,/);
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
        'feimage',
        'fedisplacementmap',
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
    expect(Number(info.blur)).toBeCloseTo(0.2, 2);
    expect(Number(info.saturation)).toBeCloseTo(5, 2);
    expect(Number(info.specularOpacity)).toBeCloseTo(0.42, 2);
    expect(info.maximum).toBeGreaterThan(30);
    expect(info.scales[0]).toBe(26);
    expect(info.scales[1] / info.maximum).toBeCloseTo(0.92, 2);
    return info;
}

async function expectRenderedRefraction(page, locator) {
    await locator.hover();
    const lens = page.locator('.liquid-glass-lens');
    await expect(lens).toHaveClass(/is-visible/);
    await expect.poll(() => lens.getAttribute('data-liquid-filter-id')).toBeTruthy();
    const displacement = page.locator('.liquid-filter-defs feDisplacementMap');
    const activeScales = await displacement.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('scale')));
    expect(activeScales.some((scale) => Number(scale) > 30)).toBe(true);
    const clip = await lens.boundingBox();
    expect(clip).not.toBeNull();
    await page.waitForTimeout(180);
    const active = await page.screenshot({ clip });
    const activeFilter = await lens.evaluate((element) => getComputedStyle(element).backdropFilter);
    await lens.evaluate((element) => element.style.setProperty('--liquid-filter', 'none'));
    await page.waitForTimeout(150);
    const neutral = await page.screenshot({ clip });
    expect(active.equals(neutral), 'SVG displacement must change rendered pixels').toBe(false);
    await lens.evaluate((element, filter) => element.style.setProperty('--liquid-filter', filter), activeFilter);
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
    const coverage = await page.evaluate(() => {
        const items = [...document.querySelectorAll('[data-liquid-item]')];
        return {
            total: items.length,
            oldWrappers: document.querySelectorAll('liquid-surface, liquid-filter-bank').length,
            movedChildren: items.filter((item) => item.querySelector('.liquid-glass-content')).length,
            lenses: document.querySelectorAll('.liquid-glass-lens').length,
            hdrLayers: document.querySelectorAll('.hdr-glass-layer').length
        };
    });
    expect(coverage.total).toBeGreaterThan(10);
    expect(coverage.oldWrappers).toBe(0);
    expect(coverage.movedChildren).toBe(0);
    expect(coverage.lenses).toBe(1);
    expect(coverage.hdrLayers).toBe(1);
    expect(errors).toEqual([]);
});

test('uses one empty article precision lens over every real component', async ({ page }) => {
    const errors = await openExtension(page);
    const action = await inspectArticleFilter(page, page.locator('.anime-wallpaper'));
    const secondAction = await inspectArticleFilter(page, page.locator('.create-folder'));
    expect(secondAction.id).toBeTruthy();

    const folder = await inspectArticleFilter(page, page.locator('.folder-tile[data-folder="POM"]'));
    const bookmark = await inspectArticleFilter(page, page.locator('.bookmark-tile[data-bookmark-id="1"]'));
    expect(bookmark.id).toBeTruthy();

    await inspectArticleFilter(page, page.locator('.recent-card').first());
    await inspectArticleFilter(page, page.locator('.search-shell'));

    await page.mouse.move(10, 10);
    await expect(page.locator('.liquid-glass-lens')).not.toHaveClass(/is-visible/, { timeout: 1000 });
    expect(errors).toEqual([]);
});

test('renders real refraction pixels on hover', async ({ page }) => {
    const seed = structuredClone(initialData);
    seed.settings.appearance.enhancedAnimations = false;
    const errors = await openExtension(page, seed);
    await page.addStyleTag({ content: `
        body { background: repeating-linear-gradient(90deg, #101828 0 8px, #ff3f9f 8px 16px, #61d8ff 16px 24px) !important; }
        wallpaper-surface { display: none !important; }
        .search-shell, .folder-tile { transform: none !important; transition: none !important; }
    ` });
    await expectRenderedRefraction(page, page.locator('.search-shell'));
    await expectRenderedRefraction(page, page.locator('.folder-tile[data-folder="POM"]'));
    expect(errors).toEqual([]);
});

test('tracks the real pointer midway in both directions without flipping', async ({ page }) => {
    const errors = await openExtension(page);
    const first = page.locator('.anime-wallpaper');
    const second = page.locator('.create-folder');
    const from = await centerOf(first);
    const to = await centerOf(second);
    const midpoint = {
        x: (from.box.x + from.box.width + to.box.x) / 2,
        y: (from.y + to.y) / 2
    };
    const expectedProgress = (midpoint.x - from.x) / (to.x - from.x);
    await page.mouse.move(from.x, from.y);
    await page.mouse.move(midpoint.x, midpoint.y);
    const leftToRight = await page.locator('.liquid-glass-lens').evaluate((lens) => ({
        rect: lens.getBoundingClientRect().toJSON(),
        progress: Number(lens.dataset.liquidProgress),
        scaleX: new DOMMatrix(getComputedStyle(lens).transform).a,
        bridging: lens.classList.contains('is-bridging')
    }));
    const hdrGeometry = await page.locator('.hdr-glass-layer').evaluate((layer) => ({
        x: Number.parseFloat(layer.style.getPropertyValue('--hdr-glass-x')),
        y: Number.parseFloat(layer.style.getPropertyValue('--hdr-glass-y')),
        width: Number.parseFloat(layer.style.getPropertyValue('--hdr-glass-width')),
        height: Number.parseFloat(layer.style.getPropertyValue('--hdr-glass-height'))
    }));
    await page.mouse.move(to.x, to.y);
    await page.mouse.move(midpoint.x, midpoint.y);
    const rightToLeft = await page.locator('.liquid-glass-lens').evaluate((lens) => ({
        rect: lens.getBoundingClientRect().toJSON(),
        progress: Number(lens.dataset.liquidProgress),
        scaleX: new DOMMatrix(getComputedStyle(lens).transform).a,
        bridging: lens.classList.contains('is-bridging')
    }));
    expect(leftToRight.progress).toBeCloseTo(expectedProgress, 2);
    expect(rightToLeft.progress).toBeCloseTo(1 - expectedProgress, 2);
    expect(leftToRight.bridging).toBe(true);
    expect(rightToLeft.bridging).toBe(true);
    expect(leftToRight.rect.x).toBeCloseTo(rightToLeft.rect.x, 0);
    expect(leftToRight.rect.width).toBeCloseTo(rightToLeft.rect.width, 0);
    expect(leftToRight.rect.width).toBeGreaterThan(Math.max(from.box.width, to.box.width) + 16);
    expect(hdrGeometry.x).toBeCloseTo(leftToRight.rect.x, 0);
    expect(hdrGeometry.y).toBeCloseTo(leftToRight.rect.y, 0);
    expect(hdrGeometry.width).toBeCloseTo(leftToRight.rect.width, 0);
    expect(hdrGeometry.height).toBeCloseTo(leftToRight.rect.height, 0);
    expect(leftToRight.scaleX).toBeGreaterThan(0);
    expect(rightToLeft.scaleX).toBeGreaterThan(0);
    expect(await page.locator('.liquid-glass-lens').textContent()).toBe('');
    expect(errors).toEqual([]);
});

test('does not jump the glass lens to another row when the last row has no neighbour', async ({ page }) => {
    const seed = structuredClone(initialData);
    seed.bookmarks = [
        ...Array.from({ length: 7 }, (_, index) => ({
            id: index + 1,
            name: `Site ${index + 1}`,
            url: `https://site-${index + 1}.example.com/`,
            icon: '',
            folder: '全部',
            order: index
        })),
        { id: 99, name: 'POM site', url: 'https://pom.example.com/', icon: '', folder: 'POM', order: 0 }
    ];
    const errors = await openExtension(page, seed);
    const items = page.locator('.launchpad-grid > [data-liquid-item]');
    const rows = await items.evaluateAll((elements) => {
        const groups = [];
        elements.forEach((element, index) => {
            const top = element.getBoundingClientRect().top;
            const row = groups.find(([rowTop]) => Math.abs(rowTop - top) < 10);
            if (row) row[1].push(index);
            else groups.push([top, [index]]);
        });
        return groups.sort((left, right) => left[0] - right[0]);
    });
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.at(-1)[1]).toHaveLength(1);

    const source = items.nth(rows.at(-1)[1][0]);
    const box = await source.boundingBox();
    expect(box).not.toBeNull();
    await source.hover();
    await expect(page.locator('.liquid-glass-lens')).toHaveClass(/is-visible/);
    await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2);
    await page.waitForTimeout(35);
    const transient = await page.locator('.liquid-glass-lens').evaluate((lens) => ({
        visible: lens.classList.contains('is-visible'),
        top: lens.getBoundingClientRect().top
    }));
    if (transient.visible) expect(Math.abs(transient.top - (box.y - 8))).toBeLessThan(24);
    await expect(page.locator('.liquid-glass-lens')).not.toHaveClass(/is-visible/, { timeout: 500 });
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
    const settingsLayout = await page.locator('.settings-drawer').evaluate((drawer) => {
        const tabs = drawer.querySelector('.settings-tabs').getBoundingClientRect();
        const pane = drawer.querySelector('.settings-pane').getBoundingClientRect();
        return {
            width: drawer.getBoundingClientRect().width,
            navBeforePane: tabs.right < pane.left,
            overflowFree: drawer.scrollWidth <= drawer.clientWidth
        };
    });
    expect(settingsLayout.width).toBeGreaterThanOrEqual(600);
    expect(settingsLayout.navBeforePane).toBe(true);
    expect(settingsLayout.overflowFree).toBe(true);
    await page.locator('input[data-toggle="showStatus"]').uncheck();
    await expect(page.locator('.status-grid')).toBeHidden();
    await page.locator('[data-tab="appearance"]').click();
    await expect(page.locator('input[data-toggle="hdrHighlights"]')).toBeChecked();
    await page.locator('input[data-toggle="hdrHighlights"]').uncheck();
    await expect(page.locator('body')).not.toHaveClass(/hdr-highlights/);
    await page.locator('input[data-toggle="hdrHighlights"]').check();
    await expect(page.locator('body')).toHaveClass(/hdr-highlights/);
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
    expect(stored.appearance.hdrHighlights).toBe(true);
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
