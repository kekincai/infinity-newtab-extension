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
        wallpaper: { type: 'gradient', value: '', blur: 0, overlay: 12, idleHide: false },
        appearance: { clockFormat: '24h', dateFormat: 'long' }
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

async function installChromeMock(page, seed = initialData, options = {}) {
    await page.addInitScript(({ seed, history, options }) => {
        const syncKey = 'infinity-e2e-sync';
        const localKey = 'infinity-e2e-local';
        if (!sessionStorage.getItem('infinity-e2e-ready')) {
            // Stored the way the extension stores bookmarks: in numbered chunks.
            const { bookmarks, ...rest } = seed;
            localStorage.setItem(syncKey, JSON.stringify({ ...rest, bookmarkChunks: 1, 'bookmarks.0': bookmarks }));
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
        navigator.getBattery = async () => ({ level: 0.82, charging: false });
        if (options.failIndexedDB) {
            Object.defineProperty(indexedDB, 'open', {
                configurable: true,
                value() { throw new DOMException('模拟 IndexedDB 失败', 'InvalidStateError'); }
            });
        }
        const openedTabs = [];
        window.chrome = {
            runtime: { id: 'e2e-infinity-newtab', lastError: null, getURL: () => `${location.origin}/icons/icon-48.png` },
            storage: {
                sync: storageArea(syncKey),
                local: storageArea(localKey),
                onChanged: {
                    addListener(listener) {
                        window.addEventListener('storage', (event) => { if (event.key === syncKey) listener({}, 'sync'); });
                    }
                }
            },
            tabs: {
                query(_query, callback) { callback([]); },
                update() {},
                create(properties) { openedTabs.push(properties); return Promise.resolve({ id: openedTabs.length, ...properties }); }
            },
            downloads: { search(_query, callback) { callback([]); }, show() {} },
            history: { search(_query, callback) { callback(history); } }
        };
        window.__readMockSync = () => {
            const data = readArea(syncKey);
            // Mirror src/core/bookmark-storage.ts so assertions see one logical list.
            if (Number.isInteger(data.bookmarkChunks)) {
                data.bookmarks = Array.from({ length: data.bookmarkChunks }, (_, index) => data[`bookmarks.${index}`] || []).flat();
            }
            return data;
        };
        window.__readRawSync = () => readArea(syncKey);
        window.__readMockLocal = () => readArea(localKey);
        window.__readOpenedTabs = () => [...openedTabs];
    }, { seed, history: historyItems, options });
}

async function openExtension(page, seed = initialData, options = {}) {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await installChromeMock(page, seed, options);
    await page.goto('/newtab.html');
    await expect(page.locator('.index-group[data-folder="全部"] [data-bookmark-id]')).toHaveCount(seed.bookmarks.filter((bookmark) => (bookmark.folder || '全部') === '全部').length);
    return errors;
}

/** Waits for the home screen's entrance animation, so measured boxes stop moving. */
async function settleEntrance(page) {
    await page.evaluate(() => Promise.all(document.getAnimations()
        .filter((animation) => animation.animationName === 'rise-in')
        .map((animation) => animation.finished)));
}

/** Reports an emulated HDR screen so the WebGPU rim layer starts on an SDR test display. */
async function emulateHdrScreen(page) {
    await page.addInitScript(() => {
        const original = window.matchMedia.bind(window);
        window.matchMedia = (query) => original(query.includes('dynamic-range: high') ? '(min-width: 0px)' : query);
    });
}

async function glassFilter(locator) {
    return locator.evaluate((element) => {
        const filter = document.getElementById(element.dataset.glassFilter || '');
        return {
            id: element.dataset.glassFilter,
            backdrop: getComputedStyle(element).backdropFilter,
            width: element.offsetWidth,
            mapWidth: Number(filter?.querySelector('feImage')?.getAttribute('width')),
            mapHeight: Number(filter?.querySelector('feImage')?.getAttribute('height')),
            height: element.offsetHeight,
            bend: Number(filter?.querySelector('feDisplacementMap')?.getAttribute('scale'))
        };
    });
}

async function openSettings(page, pane = 'appearance') {
    await page.locator('.settings-trigger').click();
    await expect(page.locator('.settings-window')).toHaveClass(/is-open/);
    if (pane !== 'appearance') await page.locator(`.settings-nav-item[data-pane="${pane}"]`).click();
    await expect(page.locator(`.settings-pane[data-pane="${pane}"]`)).toBeVisible();
}

function overlaps(a, b) {
    return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

test('renders the clock, search and every bookmark on one screen', async ({ page }) => {
    const errors = await openExtension(page);
    await expect(page).toHaveTitle('Infinity New Tab');
    await expect(page.locator('infinity-newtab-app')).toHaveCount(1);
    // Bookmarks saved under their bare address show the site's name without the domain suffix.
    await expect(page.locator('[data-bookmark-id="1"] .index-name')).toHaveText('Google');
    await expect(page.locator('.battery-capsule')).toContainText('82%');
    await expect(page.locator('.media-capsule, .download-capsule')).toHaveCount(0);
    await expect(page.locator('.hero-time')).toHaveText(/^\d{2}:\d{2}$/);
    await expect(page.locator('wallpaper-badge')).not.toContainText('Twilight Bay');
    await expect(page.locator('.wallpaper-pause')).toBeVisible();
    await expect(page.locator('.wallpaper-media .scene')).toHaveCount(1);

    // Every group is listed at once: loose bookmarks, each folder, then the frequent sites.
    await expect(page.locator('.index-title')).toHaveText(['书签', 'POM', '常访问']);
    await expect(page.locator('.index-group[data-folder="POM"] [data-bookmark-id]')).toHaveCount(1);
    await expect(page.locator('.index-group.is-recent .index-link')).toHaveCount(2);
    await expect(page.locator('.index-group.is-recent .index-name')).toHaveText(['YouTube', 'V2EX']);
    // The clock sits top-left and the bookmarks along the bottom, leaving the middle to the wallpaper.
    const layout = await page.evaluate(() => {
        const hero = document.querySelector('.hero').getBoundingClientRect();
        const index = document.querySelector('.index').getBoundingClientRect();
        return {
            heroRight: hero.right,
            heroBottom: hero.bottom,
            indexTop: index.top,
            indexBottom: index.bottom,
            width: innerWidth,
            height: innerHeight,
            pageScroll: document.documentElement.scrollHeight > innerHeight
        };
    });
    expect(layout.heroRight).toBeLessThan(layout.width / 2);
    expect(layout.heroBottom).toBeLessThan(layout.height / 3);
    expect(layout.indexTop).toBeGreaterThan(layout.height * 0.6);
    expect(layout.indexBottom).toBeLessThanOrEqual(layout.height);
    expect(layout.pageScroll).toBe(false);

    // Every control on the wallpaper is its own refracting glass; there is no shared lens any more.
    await expect(page.locator('glass-system')).toHaveCount(1);
    await expect(page.locator('.hdr-glass-layer')).toHaveCount(1);
    const glass = await page.locator('[data-glass]').evaluateAll((elements) => elements
        .filter((element) => element.getClientRects().length)
        .map((element) => ({ filter: element.dataset.glassFilter, backdrop: getComputedStyle(element).backdropFilter })));
    expect(glass.length).toBeGreaterThanOrEqual(4);
    expect(glass.every((item) => item.filter && item.backdrop.includes(`url("#${item.filter}")`))).toBe(true);
    expect(await page.locator('.hero-time').evaluate((element) => getComputedStyle(element).textShadow)).not.toBe('none');
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(1440);
    expect(errors).toEqual([]);
});

test('adds another extension page as a bookmark', async ({ page }) => {
    const errors = await openExtension(page);
    const extensionPage = 'chrome-extension://hjekpdhdabgkokjbklegnfkogcpjhhhg/index.html';
    await page.locator('.index-group[data-folder="全部"] [data-add-folder]').click();
    const dialog = page.getByRole('dialog', { name: '添加书签' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="url"]').fill(extensionPage);
    await dialog.locator('input[name="name"]').fill('扩展工具');
    await dialog.getByRole('button', { name: '保存' }).click();
    const link = page.locator('.index-link', { hasText: '扩展工具' });
    await expect(link).toHaveAttribute('href', extensionPage);
    await link.click();
    const openedTabs = await page.evaluate(() => window.__readOpenedTabs());
    expect(openedTabs).toEqual([{ url: extensionPage }]);
    await expect(page).toHaveURL(/\/newtab\.html$/);
    const stored = await page.evaluate(() => window.__readMockSync().bookmarks);
    expect(stored.some((bookmark) => bookmark.url === extensionPage)).toBe(true);
    expect(errors).toEqual([]);
});

test('gives every glass control a refraction filter sized to it', async ({ page }) => {
    const errors = await openExtension(page);
    const shuffle = await glassFilter(page.locator('.shuffle-wallpaper'));
    const settings = await glassFilter(page.locator('.settings-trigger'));
    const search = await glassFilter(page.locator('.search-field'));
    for (const item of [shuffle, settings, search]) {
        expect(item.backdrop).toContain(`url("#${item.id}")`);
        expect(item.mapWidth).toBe(item.width);
        expect(item.mapHeight).toBe(item.height);
        expect(item.bend).toBeGreaterThan(4);
    }
    // Controls of the same size and corner share one filter.
    expect(settings.id).toBe(shuffle.id);
    expect(search.id).not.toBe(shuffle.id);
    expect(await page.locator('.glass-filters filter').count()).toBeLessThanOrEqual(await page.locator('[data-glass]').count());

    // A control that changes size releases the filter of its old shape.
    const field = page.locator('.search-field');
    for (let width = 300; width < 400; width += 5) {
        await field.evaluate((element, value) => { element.style.width = `${value}px`; }, width);
        await expect.poll(() => field.evaluate((element) => element.offsetWidth)).toBe(width);
    }
    await field.evaluate((element) => element.style.removeProperty('width'));
    await expect.poll(async () => page.locator('.glass-filters filter').count())
        .toBeLessThanOrEqual(await page.locator('[data-glass]').count());
    expect(errors).toEqual([]);
});

test('bends the backdrop at the rim of the glass', async ({ page }) => {
    const errors = await openExtension(page);
    await settleEntrance(page);
    await page.addStyleTag({ content: `
        body { background: repeating-linear-gradient(90deg, #101828 0 6px, #ff3f9f 6px 12px, #61d8ff 12px 18px) !important; }
        wallpaper-surface { display: none !important; }
    ` });
    await page.mouse.move(10, 500);
    const button = page.locator('.settings-trigger');
    const box = await button.boundingBox();
    const clip = { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4 };
    await page.waitForTimeout(200);
    const refracted = await page.screenshot({ clip });
    const backdrop = await button.evaluate((element) => element.style.getPropertyValue('--glass-backdrop'));
    await button.evaluate((element) => element.style.setProperty('--glass-backdrop', 'blur(1.2px) saturate(1.6) brightness(1.04)'));
    await page.waitForTimeout(200);
    const flat = await page.screenshot({ clip });
    await button.evaluate((element, value) => element.style.setProperty('--glass-backdrop', value), backdrop);
    expect(refracted.equals(flat), 'the SVG displacement must change rendered pixels').toBe(false);
    expect(errors).toEqual([]);
});

test('lights the glass under the pointer', async ({ page }) => {
    const errors = await openExtension(page);
    await settleEntrance(page);
    const field = page.locator('.search-field');
    const box = await field.boundingBox();
    await page.mouse.move(box.x + 60, box.y + 12);
    await expect.poll(() => field.evaluate((element) => Number.parseFloat(element.style.getPropertyValue('--glint-x')))).toBeCloseTo(60, 0);
    expect(await field.evaluate((element) => Number.parseFloat(element.style.getPropertyValue('--glint-y')))).toBeCloseTo(12, 0);
    await expect.poll(() => field.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('1');
    await page.mouse.move(720, 500);
    await expect.poll(() => field.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('0');
    expect(errors).toEqual([]);
});

test('draws HDR rims only for glass that is visible', async ({ page }) => {
    await emulateHdrScreen(page);
    const errors = await openExtension(page);
    const layer = page.locator('.hdr-glass-layer');
    await expect.poll(() => layer.getAttribute('data-hdr-renderer')).not.toBeNull();
    test.skip(await layer.getAttribute('data-hdr-renderer') !== 'webgpu', 'WebGPU is not available in this browser');
    await expect(layer).toHaveClass(/is-visible/);
    const visibleGlass = await page.locator('[data-glass]').evaluateAll((elements) => elements.filter((element) => element.getClientRects().length).length);
    await page.mouse.move(720, 500);
    await expect(layer).toHaveAttribute('data-hdr-count', String(visibleGlass));
    // The settings window covers the home screen, so its controls stop drawing rims.
    await page.locator('.settings-trigger').click();
    await expect(page.locator('.settings-window')).toHaveClass(/is-open/);
    await page.mouse.move(700, 400);
    await expect(layer).toHaveAttribute('data-hdr-count', '0');
    expect(errors).toEqual([]);
});

test('moves and reorders bookmarks without duplication', async ({ page }) => {
    const errors = await openExtension(page);
    const pom = page.locator('.index-group[data-folder="POM"]');
    await page.locator('[data-bookmark-id="1"]').dragTo(pom.locator('.index-heading'));
    await expect(page.locator('.index-group[data-folder="全部"] [data-bookmark-id]')).toHaveCount(1);
    await expect(pom.locator('[data-bookmark-id]')).toHaveCount(2);
    let stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(3);
    expect(stored.bookmarks.find((bookmark) => String(bookmark.id) === '1').folder).toBe('POM');

    // Dropping on a bookmark puts the dragged one above it.
    await pom.locator('[data-bookmark-id="1"]').dragTo(pom.locator('[data-bookmark-id="3"]'));
    await expect(pom.locator('[data-bookmark-id]').first()).toHaveAttribute('data-bookmark-id', '1');
    stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(3);
    const pomOrder = stored.bookmarks.filter((bookmark) => bookmark.folder === 'POM').sort((a, b) => a.order - b.order).map((bookmark) => String(bookmark.id));
    expect(pomOrder).toEqual(['1', '3']);
    expect(new Set(stored.bookmarks.map((bookmark) => String(bookmark.id))).size).toBe(3);
    expect(errors).toEqual([]);
});

test('persists layout, theme and local wallpaper controls', async ({ page }) => {
    const errors = await openExtension(page);
    await openSettings(page, 'widgets');
    const settingsLayout = await page.locator('.settings-window').evaluate((window) => {
        const sidebar = window.querySelector('.settings-sidebar').getBoundingClientRect();
        const content = window.querySelector('.settings-content').getBoundingClientRect();
        return {
            width: window.getBoundingClientRect().width,
            sidebarBeside: sidebar.right <= content.left + 1,
            overflowFree: window.scrollWidth <= window.clientWidth
        };
    });
    expect(settingsLayout.width).toBe(820);
    expect(settingsLayout.sidebarBeside).toBe(true);
    expect(settingsLayout.overflowFree).toBe(true);
    await page.locator('input[data-toggle="showStatus"]').uncheck();
    await expect(page.locator('status-strip')).toBeHidden();
    await page.locator('input[data-toggle="showBookmarks"]').uncheck();
    await expect(page.locator('bookmark-index')).toBeHidden();
    await page.locator('input[data-toggle="showBookmarks"]').check();
    await expect(page.locator('bookmark-index')).toBeVisible();

    await page.locator('.settings-nav-item[data-pane="appearance"]').click();
    await page.locator('[data-segment="clockFormat"] [data-value="12h"]').click();
    await expect(page.locator('[data-segment="clockFormat"] [data-value="12h"]')).toHaveAttribute('aria-checked', 'true');
    // The thumb slides under the chosen option.
    const clock = page.locator('[data-segment="clockFormat"]');
    const twelveHour = await clock.locator('[data-value="12h"]').evaluate((button) => button.offsetLeft);
    await expect.poll(() => clock.evaluate((element) => Number.parseFloat(element.style.getPropertyValue('--thumb-x')))).toBe(twelveHour);
    const switches = page.locator('.settings-pane[data-pane="appearance"] .switch');
    await expect(switches).toHaveCount(2);
    await switches.first().locator('input').evaluate((input) => { window.__retainedSwitch = input; });
    const hdrToggle = page.locator('input[data-toggle="hdrHighlights"]');
    await expect(hdrToggle).toBeChecked();
    await hdrToggle.uncheck();
    await expect(page.locator('body')).not.toHaveClass(/hdr-highlights/);
    await hdrToggle.check();
    await expect(page.locator('body')).toHaveClass(/hdr-highlights/);
    await page.locator('input[data-toggle="reduceTransparency"]').check();
    await expect(page.locator('body')).toHaveClass(/reduce-transparency/);
    await page.locator('[data-segment="theme"] [data-value="dark"]').click();
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
    await page.locator('.settings-close').click();
    await expect(page.locator('.settings-window')).not.toHaveClass(/is-open/);
    await page.locator('.settings-trigger').click();
    // Panes are built once: reopening keeps the same controls.
    expect(await page.evaluate(() => (
        window.__retainedSwitch?.isConnected
        && window.__retainedSwitch === document.querySelector('input[data-toggle="hdrHighlights"]')
    ))).toBe(true);

    await page.locator('.settings-nav-item[data-pane="wallpaper"]').click();
    const sliders = page.locator('.settings-pane[data-pane="wallpaper"] input.slider');
    await expect(sliders).toHaveCount(2);
    const overlayRange = page.locator('input[name="overlay"]');
    await overlayRange.fill('45');
    await expect(overlayRange).toHaveCSS('--progress', '75%');
    await expect(page.locator('.setting-row', { has: overlayRange }).locator('output')).toHaveText('45%');
    await page.locator('.upload-wallpaper input').setInputFiles({
        name: 'wallpaper.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    });
    await expect.poll(() => page.evaluate(() => window.__readMockSync().settings.wallpaper.type)).toBe('local');
    await expect(page.locator('.wallpaper-name')).toHaveText('本地图片');
    await expect(page.locator('[data-segment="wallpaperKind"] [data-value="image"]')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('.wallpaper-media')).toHaveCSS('background-image', /blob:/);
    await expect(page.locator('.wallpaper-pause')).toBeHidden();
    const stored = await page.evaluate(() => window.__readMockSync().settings);
    expect(stored.layout.showStatus).toBe(false);
    expect(stored.layout.showBookmarks).toBe(true);
    expect(stored.appearance.theme).toBe('dark');
    expect(stored.appearance.clockFormat).toBe('12h');
    expect(stored.appearance.hdrHighlights).toBe(true);
    expect(stored.appearance.reduceTransparency).toBe(true);
    expect(errors).toEqual([]);
});

const PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** A DataTransfer holding one file, as Photos hands over a dragged or copied picture. */
function fileTransfer(page, { name, type, base64 }) {
    return page.evaluateHandle(({ name, type, base64 }) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], name, { type }));
        return transfer;
    }, { name, type, base64 });
}

test('takes a wallpaper dropped onto or pasted into the wallpaper settings', async ({ page }) => {
    const errors = await openExtension(page);
    await openSettings(page, 'wallpaper');
    const card = page.locator('.wallpaper-card');
    await expect(page.locator('.wallpaper-hint')).toContainText('拖到这里');

    // A drop outside the wallpaper pane is caught (no navigation) but ignored.
    await page.locator('.settings-nav-item[data-pane="data"]').click();
    let transfer = await fileTransfer(page, { name: 'photo.png', type: 'image/png', base64: PIXEL_PNG });
    await page.locator('.settings-pane[data-pane="data"]').dispatchEvent('dragover', { dataTransfer: transfer });
    await page.locator('.settings-pane[data-pane="data"]').dispatchEvent('drop', { dataTransfer: transfer });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__readMockSync().settings.wallpaper.type)).toBe('gradient');
    await expect(page).toHaveURL(/\/newtab\.html$/);

    // Dragging over the card highlights it; dropping saves the picture.
    await page.locator('.settings-nav-item[data-pane="wallpaper"]').click();
    await card.dispatchEvent('dragover', { dataTransfer: transfer });
    await expect(card).toHaveClass(/is-drop-target/);
    await card.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(card).not.toHaveClass(/is-drop-target/);
    await expect.poll(() => page.evaluate(() => window.__readMockSync().settings.wallpaper.type)).toBe('local');
    await expect(page.locator('.wallpaper-name')).toHaveText('本地图片');
    const dropped = await page.evaluate(() => window.__readMockSync().settings.wallpaper.value);

    // A picture copied in Photos (⌘C) arrives as a pasted image file.
    transfer = await fileTransfer(page, { name: 'image.png', type: 'image/png', base64: PIXEL_PNG });
    await page.evaluate((clipboardData) => {
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, transfer);
    await expect.poll(() => page.evaluate(() => window.__readMockSync().settings.wallpaper.value)).not.toBe(dropped);

    // HEIC photos get a way out instead of a decoding error.
    transfer = await fileTransfer(page, { name: 'IMG_0001.HEIC', type: '', base64: PIXEL_PNG });
    await card.dispatchEvent('dragover', { dataTransfer: transfer });
    await card.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(page.locator('.toast.is-error')).toContainText('HEIC');

    // Text still pastes into the settings search.
    await page.locator('.settings-search input').focus();
    await page.evaluate(() => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', '暗化');
        document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    });
    expect(await page.evaluate(() => window.__readMockSync().settings.wallpaper.type)).toBe('local');
    expect(errors).toEqual([]);
});

test('moves through the wallpaper type buttons without opening anything', async ({ page }) => {
    const errors = await openExtension(page);
    await openSettings(page, 'wallpaper');
    let chooserOpened = false;
    page.on('filechooser', () => { chooserOpened = true; });
    const kinds = page.locator('[data-segment="wallpaperKind"] button');
    await kinds.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(kinds.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(kinds.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    expect(chooserOpened).toBe(false);
    expect(await page.evaluate(() => window.__readMockSync().settings.wallpaper.type)).toBe('gradient');
    // Enter is what starts the action.
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    expect((await chooser).isMultiple()).toBe(false);
    expect(errors).toEqual([]);
});

test('filters settings across every pane', async ({ page }) => {
    const errors = await openExtension(page);
    await openSettings(page);
    await page.locator('.settings-search input').fill('暂停');
    await expect(page.locator('.settings-pane:visible')).toHaveCount(1);
    await expect(page.locator('.setting-row:visible')).toHaveCount(2);
    await page.locator('.settings-search input').fill('新标签页');
    await expect(page.locator('.setting-row:visible').first()).toContainText('在新标签页打开书签');
    await page.locator('.settings-search input').fill('不存在的设置');
    await expect(page.locator('.settings-empty')).toBeVisible();
    await page.locator('.settings-nav-item[data-pane="data"]').click();
    await expect(page.locator('.settings-search input')).toHaveValue('');
    await expect(page.locator('.sync-summary')).toHaveText('3 个书签 · 1 个文件夹');
    expect(errors).toEqual([]);
});

test('keeps the previous wallpaper when IndexedDB storage fails', async ({ page }) => {
    const errors = await openExtension(page, initialData, { failIndexedDB: true });
    await openSettings(page, 'wallpaper');
    await page.locator('.upload-wallpaper input').setInputFiles({
        name: 'wallpaper.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    });
    await expect(page.locator('.toast.is-error')).toContainText('IndexedDB');
    const state = await page.evaluate(() => ({ sync: window.__readMockSync(), local: window.__readMockLocal() }));
    expect(state.sync.settings.wallpaper).toEqual(initialData.settings.wallpaper);
    expect(state.local).not.toHaveProperty('localImageWallpaper');
    expect(state.local).not.toHaveProperty('localVideoWallpaper');
    expect(errors).toEqual([]);
});

test('reports native video playback failures instead of swallowing them', async ({ page }) => {
    const videoBase64 = fs.readFileSync(require.resolve('../fixtures/wallpaper.webm')).toString('base64');
    await page.addInitScript(() => {
        Object.defineProperty(HTMLMediaElement.prototype, 'play', {
            configurable: true,
            value() { return Promise.reject(new DOMException('模拟播放失败', 'NotSupportedError')); }
        });
    });
    const errors = await openExtension(page);
    await page.evaluate(async (encodedVideo) => {
        const database = await new Promise((resolve, reject) => {
            const request = indexedDB.open('infinity-wallpaper', 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains('wallpapers')) request.result.createObjectStore('wallpapers');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const bytes = Uint8Array.from(atob(encodedVideo), (character) => character.charCodeAt(0));
        await new Promise((resolve, reject) => {
            const transaction = database.transaction('wallpapers', 'readwrite');
            transaction.objectStore('wallpapers').put(new Blob([bytes], { type: 'video/webm' }), 'video');
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
        database.close();
        const stored = window.__readMockSync();
        stored.settings.wallpaper = { ...stored.settings.wallpaper, type: 'video', value: 'local-1' };
        await new Promise((resolve) => chrome.storage.sync.set({ settings: stored.settings }, resolve));
    }, videoBase64);
    await page.reload();
    await expect(page.locator('.app-notice')).toBeVisible();
    await expect(page.locator('.app-notice')).toContainText('背景加载失败');
    await expect(page.locator('.app-notice')).toContainText('已保留原背景');
    await expect(page.locator('.wallpaper-media video')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('imports and exports 2.0 backups and refuses older ones', async ({ page }, testInfo) => {
    const errors = await openExtension(page);
    const importFile = async (name, backup) => {
        await page.locator('.import-data input').setInputFiles({
            name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
        });
        await expect(page.getByRole('alertdialog')).toContainText('从备份恢复');
        await page.getByRole('alertdialog').getByRole('button', { name: '恢复' }).click();
    };
    await openSettings(page, 'data');

    // A 1.0 backup is refused and nothing changes.
    await importFile('legacy-backup.json', {
        version: '1.0',
        data: { bookmarks: [{ id: 10, name: 'www.v2ex.com', url: 'https://www.v2ex.com/', order: 0 }], folders: ['全部'] }
    });
    await expect(page.locator('.toast.is-error')).toContainText('只支持 2.0 格式的备份');
    expect((await page.evaluate(() => window.__readMockSync())).bookmarks).toHaveLength(3);

    await importFile('backup.json', {
        version: '2.0',
        exportDate: '2026-11-11T08:00:00.000Z',
        data: {
            bookmarks: [{ id: 10, name: 'www.v2ex.com', url: 'https://www.v2ex.com/', icon: '', folder: '全部', order: 0 }],
            folders: ['全部'],
            settings: { wallpaper: { type: 'gradient', value: '', blur: 0, overlay: 12 } },
            recentSearches: [],
            lastBackupPrompt: 4102444800000
        },
        localMedia: { image: null, video: null }
    });
    await expect(page.locator('.toast.is-success')).toContainText('已从备份恢复');
    await expect(page.locator('[data-bookmark-id]')).toHaveCount(1);
    await expect(page.locator('[data-bookmark-id] .index-name')).toHaveText('V2EX');
    const stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(1);
    expect(stored.settings.layout.showStatus).toBe(true);
    const raw = await page.evaluate(() => window.__readRawSync());
    expect(raw.bookmarkChunks).toBe(1);
    expect(raw).not.toHaveProperty('bookmarks.1');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-data').click();
    const download = await downloadPromise;
    const path = testInfo.outputPath('backup.json');
    await download.saveAs(path);
    const exported = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(exported.version).toBe('2.0');
    expect(exported.data.bookmarks).toHaveLength(1);
    expect(exported.localMedia).toEqual({ image: null, video: null });

    // What was exported imports again unchanged.
    await importFile('round-trip.json', exported);
    await expect(page.locator('.toast.is-success').last()).toContainText('已从备份恢复');
    expect((await page.evaluate(() => window.__readMockSync())).bookmarks).toEqual(stored.bookmarks);
    expect(errors).toEqual([]);
});

test('keeps the backup reminder clear of the bookmarks and lets it be dismissed', async ({ page }) => {
    const errors = await openExtension(page, { ...initialData, lastBackupPrompt: 0 });
    for (const [width, height] of [[1440, 1000], [900, 1000]]) {
        await page.setViewportSize({ width, height });
        const toast = await page.locator('.backup-toast').boundingBox();
        const index = await page.locator('.index').boundingBox();
        const hero = await page.locator('.hero').boundingBox();
        const pause = await page.locator('wallpaper-badge').boundingBox();
        expect(toast).not.toBeNull();
        expect(index).not.toBeNull();
        expect(overlaps(toast, index)).toBe(false);
        expect(overlaps(toast, hero)).toBe(false);
        expect(overlaps(toast, pause)).toBe(false);
    }
    await page.locator('.backup-later').click();
    await expect(page.locator('backup-toast')).toBeHidden();
    expect(Date.now() - (await page.evaluate(() => window.__readMockSync().lastBackupPrompt))).toBeLessThan(60000);
    expect(errors).toEqual([]);
});

test('closes overlays with Escape and returns focus to the opener', async ({ page }) => {
    const errors = await openExtension(page);
    const add = page.locator('.index-group[data-folder="全部"] [data-add-folder]');
    await add.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '添加书签' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="url"]')).toBeFocused();
    // Focus stays trapped inside the dialog.
    for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();

    await page.locator('.settings-trigger').click();
    await expect(page.locator('.settings-window')).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.settings-window')).not.toHaveClass(/is-open/);
    await expect(page.locator('.settings-trigger')).toBeFocused();
    expect(errors).toEqual([]);
});

test('manages bookmarks and folders through the context menu and in-page dialogs', async ({ page }) => {
    const errors = await openExtension(page);
    page.on('dialog', () => { throw new Error('native browser dialogs must not be used'); });

    const root = page.locator('.index-group[data-folder="全部"]');
    await page.locator('[data-bookmark-id="2"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'POM' }).click();
    await expect(root.locator('[data-bookmark-id]')).toHaveCount(1);
    expect((await page.evaluate(() => window.__readMockSync())).bookmarks.find((bookmark) => String(bookmark.id) === '2').folder).toBe('POM');

    await root.locator('.index-more').click();
    await page.getByRole('menuitem', { name: '新建文件夹…' }).click();
    const prompt = page.getByRole('alertdialog');
    await prompt.locator('input').fill('阅读');
    await prompt.getByRole('button', { name: '创建' }).click();
    await expect(page.locator('.index-group[data-folder="阅读"] .index-note')).toHaveText('拖书签到这里');

    await page.locator('.index-group[data-folder="POM"] .index-heading').click({ button: 'right' });
    await page.getByRole('menuitem', { name: '重命名…' }).click();
    await page.getByRole('alertdialog').locator('input').fill('收藏');
    await page.getByRole('alertdialog').getByRole('button', { name: '保存' }).click();
    const renamed = page.locator('.index-group[data-folder="收藏"]');
    await expect(renamed.locator('.index-title')).toHaveText('收藏');
    await expect(renamed.locator('[data-bookmark-id]')).toHaveCount(2);

    await renamed.locator('[data-bookmark-id="3"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: '删除书签' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click();
    await expect(renamed.locator('[data-bookmark-id]')).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('searches straight from the home field', async ({ page }) => {
    const errors = await openExtension(page, { ...initialData, recentSearches: ['二次元壁纸', 'typescript'] });
    await page.keyboard.press('/');
    const input = page.locator('.search-field input');
    await expect(input).toBeFocused();
    // No separate window: the suggestions hang under the field itself.
    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    const results = page.locator('.search-results');
    await expect(results).toBeVisible();
    const fieldBox = await page.locator('.search-field').boundingBox();
    // Measured once the drop-in animation has settled.
    await expect.poll(async () => (await results.boundingBox()).x).toBeCloseTo(fieldBox.x, 0);
    expect((await results.boundingBox()).y).toBeGreaterThan(fieldBox.y + fieldBox.height);
    await expect(page.locator('.search-row', { hasText: '二次元壁纸' })).toHaveCount(1);

    await input.fill('git');
    const first = page.locator('.search-row').first();
    await expect(first).toContainText('GitHub');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.ghost-rest')).toHaveText('hub.com');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.search-row').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.search-row').nth(1)).toContainText('在 Google 中搜索');
    await page.keyboard.press('Tab');
    await expect(page.locator('.search-engine')).toHaveText('Bing');
    await expect(page.locator('.search-row').nth(1)).toContainText('在 Bing 中搜索');
    await expect(input).toBeFocused();

    await input.fill('youtube.com');
    await expect(page.locator('.search-row').first()).toContainText('youtube.com');
    await expect(page.locator('.search-heading').first()).toHaveText('网址');
    // Local servers and IP addresses are addresses too, opened over plain http.
    await input.fill('localhost:3000');
    await expect(page.locator('.search-row').first()).toContainText('http://localhost:3000/');
    await input.fill('192.168.1.1:8080');
    await expect(page.locator('.search-heading').first()).toHaveText('网址');
    await expect(page.locator('.search-row').first()).toContainText('http://192.168.1.1:8080/');

    // ⌘/Ctrl+Enter on a web search opens it in a new tab and keeps this page.
    await input.fill('liquid glass');
    await page.locator('.search-row', { hasText: '在 Bing 中搜索' }).click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
    await expect.poll(() => page.evaluate(() => window.__readOpenedTabs())).toEqual([{ url: 'https://www.bing.com/search?q=liquid%20glass' }]);
    await expect(page).toHaveURL(/\/newtab\.html$/);
    await page.keyboard.press('/');

    await input.fill('');
    const recent = page.locator('.search-row', { hasText: '二次元壁纸' });
    await recent.hover();
    await recent.locator('.row-remove').click();
    await expect(page.locator('.search-row', { hasText: '二次元壁纸' })).toHaveCount(0);
    expect((await page.evaluate(() => window.__readMockSync())).recentSearches).toEqual(['liquid glass', 'typescript']);
    expect((await page.evaluate(() => window.__readMockSync())).settings.layout.searchEngine).toBe('google');

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await expect(input).not.toBeFocused();
    await expect(results).toBeHidden();
    await page.locator('.search-field').click();
    await expect(input).toBeFocused();
    await input.fill('abc');
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(input).not.toBeFocused();
    expect(errors).toEqual([]);
});

test('summons a hidden search field with the shortcut', async ({ page }) => {
    const seed = structuredClone(initialData);
    seed.settings.layout = { ...seed.settings.layout, showSearch: false };
    const errors = await openExtension(page, seed);
    await expect(page.locator('search-box')).toBeHidden();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await expect(page.locator('.search-field input')).toBeFocused();
    await page.mouse.click(720, 500);
    await expect(page.locator('search-box')).toBeHidden();
    expect(errors).toEqual([]);
});

/** A trackpad pinch: Chrome reports it as wheel events with ctrl held. */
async function pinch(page, steps, deltaY) {
    await page.keyboard.down('Control');
    for (let index = 0; index < steps; index += 1) {
        await page.mouse.wheel(0, deltaY);
        await page.waitForTimeout(16);
    }
    await page.keyboard.up('Control');
}

const zoomOf = (page) => page.locator('wallpaper-surface').evaluate((element) => Number(element.dataset.zoom ?? 1));

test('zooms the wallpaper like a photo instead of the page', async ({ page }) => {
    const errors = await openExtension(page);
    await settleEntrance(page);
    await page.mouse.move(900, 450);

    // Pinching in scales the picture around the pointer; Chrome's own page zoom stays out.
    await pinch(page, 20, -6);
    expect(await zoomOf(page)).toBeGreaterThan(1.5);
    await expect(page.locator('body')).toHaveClass(/is-zoomed/);
    expect(await page.evaluate(() => visualViewport.scale)).toBe(1);
    await expect(page.locator('.top-bar')).toHaveCSS('opacity', '0');
    const anchored = await page.locator('.wallpaper-media').evaluate((media) => {
        const matrix = new DOMMatrix(getComputedStyle(media).transform);
        // The picture point under the pointer before the pinch is still under it.
        return {
            x: (900 - media.offsetLeft - matrix.m41) / matrix.a + media.offsetLeft,
            y: (450 - media.offsetTop - matrix.m42) / matrix.a + media.offsetTop
        };
    });
    expect(anchored.x).toBeCloseTo(900, -1);
    expect(anchored.y).toBeCloseTo(450, -1);

    // Past the limit it stretches a little, then springs back to 5×.
    await pinch(page, 60, -12);
    const stretched = await zoomOf(page);
    expect(stretched).toBeGreaterThan(5);
    expect(stretched).toBeLessThan(6.8);
    await expect.poll(() => zoomOf(page)).toBe(5);

    // Two-finger scrolling pans, and springs back so the picture's left edge meets the window's (past the blur margin).
    await page.mouse.wheel(-4000, 0);
    await expect.poll(() => page.locator('.wallpaper-media').evaluate((media) => Math.round(media.getBoundingClientRect().left))).toBe(-10);

    // Pinching out goes past the resting size to the whole picture, cropping nothing, on a pale backdrop.
    await pinch(page, 60, 12);
    await expect.poll(() => zoomOf(page)).toBeLessThan(1);
    await expect.poll(async () => {
        const rect = await page.locator('.wallpaper-media').evaluate((media) => media.getBoundingClientRect().toJSON());
        return rect.left >= -1 && rect.top >= -1 && rect.right <= 1441 && rect.bottom <= 1001 && (Math.abs(rect.width - 1440) < 2 || Math.abs(rect.height - 1000) < 2);
    }).toBe(true);
    await expect(page.locator('body')).toHaveClass(/is-zoomed/);
    await expect(page.locator('.wallpaper-tint')).toHaveCSS('opacity', '0');
    expect(await page.locator('wallpaper-surface').evaluate((element) => element.style.getPropertyValue('--wallpaper-backdrop'))).toContain('oklch(0.9');

    // Pinching back in to about the resting size snaps to it and brings the home screen back.
    await page.keyboard.down('Control');
    for (let step = 0; step < 200 && await zoomOf(page) < 0.98; step += 1) await page.mouse.wheel(0, -2);
    await page.keyboard.up('Control');
    await expect.poll(() => zoomOf(page)).toBe(1);
    await expect(page.locator('body')).not.toHaveClass(/is-zoomed/);
    await expect(page.locator('.top-bar')).toHaveCSS('opacity', '1');

    // Double-click on an empty part of the picture zooms in; Esc restores it.
    await page.mouse.dblclick(900, 450);
    await expect.poll(() => zoomOf(page)).toBe(2.5);
    await page.keyboard.press('Escape');
    await expect.poll(() => zoomOf(page)).toBe(1);

    // The search shortcut brings the home screen back too.
    await page.mouse.dblclick(900, 450);
    await expect.poll(() => zoomOf(page)).toBe(2.5);
    await page.keyboard.press('/');
    await expect(page.locator('.search-field input')).toBeFocused();
    await expect.poll(() => zoomOf(page)).toBe(1);
    await page.keyboard.press('Escape');

    // With settings open a pinch leaves the wallpaper alone.
    await page.locator('.settings-trigger').click();
    await expect(page.locator('.settings-window')).toHaveClass(/is-open/);
    await pinch(page, 10, -6);
    expect(await zoomOf(page)).toBe(1);
    expect(errors).toEqual([]);
});

test('fades to the clock alone when idle', async ({ page }) => {
    const seed = structuredClone(initialData);
    seed.settings.wallpaper.idleHide = true;
    // A fake clock keeps stray input on the headed window from restarting a real 8-second wait.
    await page.clock.install();
    const errors = await openExtension(page, seed);
    await page.mouse.move(10, 10);
    await page.clock.runFor(8500);
    await expect(page.locator('body')).toHaveClass(/is-idle/);
    await expect(page.locator('.home-footer')).toHaveCSS('opacity', '0');
    await expect(page.locator('dashboard-header')).toHaveCSS('opacity', '0.85');
    await page.mouse.move(200, 200);
    await expect(page.locator('body')).not.toHaveClass(/is-idle/);
    expect(errors).toEqual([]);
});

test('keeps history out of every view when frequent sites are turned off', async ({ page }) => {
    const seed = structuredClone(initialData);
    seed.settings.layout = { ...seed.settings.layout, showRecent: false };
    const errors = await openExtension(page, seed);
    await expect(page.locator('.index-group.is-recent')).toHaveCount(0);
    await page.keyboard.press('/');
    await expect(page.locator('.search-field input')).toBeFocused();
    await page.locator('.search-field input').fill('youtube');
    await expect(page.locator('.search-heading', { hasText: '常访问' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await openSettings(page, 'widgets');
    await page.locator('input[data-toggle="showRecent"]').check();
    await expect(page.locator('.index-group.is-recent .index-link')).toHaveCount(2);
    expect((await page.evaluate(() => window.__readMockSync())).settings.layout.showRecent).toBe(true);
    expect(errors).toEqual([]);
});
