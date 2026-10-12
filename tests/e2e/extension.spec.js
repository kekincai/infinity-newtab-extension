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
        wallpaper: { type: 'gradient', value: '', blur: 0, overlay: 30, idleHide: false },
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

async function installChromeMock(page, seed = initialData, options = {}) {
    await page.addInitScript(({ seed, history, options }) => {
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
        if (options.failIndexedDB) {
            Object.defineProperty(indexedDB, 'open', {
                configurable: true,
                value() { throw new DOMException('模拟 IndexedDB 失败', 'InvalidStateError'); }
            });
        }
        const openedTabs = [];
        window.chrome = {
            runtime: { id: 'e2e-infinity-newtab', lastError: null, getURL: () => `${location.origin}/icons/icon-48.png` },
            storage: { sync: storageArea(syncKey), local: storageArea(localKey) },
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
    await expect(page.locator('.dock-item[data-bookmark-id]')).toHaveCount(Math.min(12, seed.bookmarks.filter((bookmark) => (bookmark.folder || '全部') === '全部').length));
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
    expect(Number(info.blur)).toBeCloseTo(0, 2);
    expect(Number(info.saturation)).toBeCloseTo(9, 2);
    expect(Number(info.specularOpacity)).toBeCloseTo(0.5, 2);
    expect(info.maximum).toBeGreaterThan(30);
    expect(info.scales[0]).toBe(24);
    expect(info.scales[1] / info.maximum).toBeCloseTo(1, 2);
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

async function openLaunchpad(page, view = 'bookmarks') {
    await page.locator(view === 'recent' ? '.dock-recent' : '.dock-all').click();
    await expect(page.locator('.launchpad')).toBeVisible();
    if (view === 'recent') await expect(page.locator('.recent-tile').first()).toBeVisible();
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

test('renders the home screen, Dock and launchpad', async ({ page }) => {
    const errors = await openExtension(page);
    await expect(page).toHaveTitle('Infinity New Tab');
    await expect(page.locator('infinity-newtab-app')).toHaveCount(1);
    await expect(page.locator('.dock-item[data-bookmark-id]').first()).toHaveAttribute('aria-label', 'google.com');
    await expect(page.locator('.battery-capsule')).toContainText('82%');
    await expect(page.locator('.media-capsule, .download-capsule')).toHaveCount(0);
    await expect(page.locator('.hero-time')).toHaveText(/^\d{2}:\d{2}$/);
    await expect(page.locator('wallpaper-badge')).toContainText('Twilight Bay');
    await expect(page.locator('.wallpaper-media .scene')).toHaveCount(1);

    await openLaunchpad(page);
    await expect(page.locator('.launchpad-tab[data-folder="全部"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.launchpad-tab[data-folder="全部"]')).toHaveText('全部 · 3');
    await expect(page.locator('.folder-tile[data-folder="POM"]')).toHaveCount(1);
    await expect(page.locator('.bookmark-tile')).toHaveCount(2);
    await expect(page.locator('.home')).toBeHidden();
    await page.locator('.launchpad-tab[data-view="recent"]').click();
    await expect(page.locator('.recent-tile')).toHaveCount(2);
    await expect(page.locator('.launchpad-grid')).toContainText('youtube.com');
    await expect(page.locator('.launchpad-grid')).not.toContainText('google');
    await page.locator('.launchpad-done').click();
    await expect(page.locator('bookmark-launchpad')).toBeHidden();

    await expect(page.locator('liquid-glass-system')).toHaveCount(1);
    const coverage = await page.evaluate(() => {
        const items = [...document.querySelectorAll('[data-liquid-item]')];
        return {
            total: items.length,
            movedChildren: items.filter((item) => item.querySelector('.liquid-glass-content')).length,
            lenses: document.querySelectorAll('.liquid-glass-lens').length,
            hdrLayers: document.querySelectorAll('.hdr-glass-layer').length
        };
    });
    expect(coverage.total).toBeGreaterThan(10);
    expect(coverage.movedChildren).toBe(0);
    expect(coverage.lenses).toBe(1);
    expect(coverage.hdrLayers).toBe(1);
    expect(await page.locator('.hero-time').evaluate((element) => getComputedStyle(element).textShadow)).not.toBe('none');
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(1440);
    expect(errors).toEqual([]);
});

test('adds another extension page as a bookmark', async ({ page }) => {
    const errors = await openExtension(page);
    const extensionPage = 'chrome-extension://hjekpdhdabgkokjbklegnfkogcpjhhhg/index.html';
    await openLaunchpad(page);
    await page.locator('.add-bookmark').click();
    const dialog = page.getByRole('dialog', { name: '添加书签' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="url"]').fill(extensionPage);
    await dialog.locator('input[name="name"]').fill('扩展工具');
    await dialog.getByRole('button', { name: '保存' }).click();
    const tile = page.locator('.bookmark-tile', { hasText: '扩展工具' });
    await expect(tile).toHaveAttribute('href', extensionPage);
    await tile.click();
    const openedTabs = await page.evaluate(() => window.__readOpenedTabs());
    expect(openedTabs).toEqual([{ url: extensionPage }]);
    await expect(page).toHaveURL(/\/newtab\.html$/);
    const stored = await page.evaluate(() => window.__readMockSync().bookmarks);
    expect(stored.some((bookmark) => bookmark.url === extensionPage)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.dock-item[aria-label="扩展工具"]')).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('uses one empty article precision lens over every real component', async ({ page }) => {
    const errors = await openExtension(page);
    const action = await inspectArticleFilter(page, page.locator('.shuffle-wallpaper'));
    const secondAction = await inspectArticleFilter(page, page.locator('.settings-trigger'));
    expect(secondAction.id).toBeTruthy();
    expect(action.id).toBeTruthy();

    const dockItem = await inspectArticleFilter(page, page.locator('.dock-item[data-bookmark-id="1"]'));
    expect(dockItem.id).toBeTruthy();
    await inspectArticleFilter(page, page.locator('.dock-all'));
    await inspectArticleFilter(page, page.locator('.search-pill'));

    await page.mouse.move(720, 600);
    await expect(page.locator('.liquid-glass-lens')).not.toHaveClass(/is-visible/, { timeout: 1000 });

    await openLaunchpad(page);
    await inspectArticleFilter(page, page.locator('.launchpad-tab[data-folder="POM"]'));
    await inspectArticleFilter(page, page.locator('.bookmark-tile[data-bookmark-id="1"]'));
    await inspectArticleFilter(page, page.locator('.add-bookmark'));
    expect(errors).toEqual([]);
});

test('renders real refraction pixels on hover', async ({ page }) => {
    const seed = structuredClone(initialData);
    seed.settings.appearance.enhancedAnimations = false;
    const errors = await openExtension(page, seed);
    await page.addStyleTag({ content: `
        body { background: repeating-linear-gradient(90deg, #101828 0 8px, #ff3f9f 8px 16px, #61d8ff 16px 24px) !important; }
        wallpaper-surface { display: none !important; }
        .search-pill, .dock, .dock-item .app-icon { transform: none !important; transition: none !important; }
    ` });
    await expectRenderedRefraction(page, page.locator('.search-pill'));
    await expectRenderedRefraction(page, page.locator('.dock-item[data-bookmark-id="2"]'));
    expect(errors).toEqual([]);
});

test('tracks the real pointer midway in both directions without flipping', async ({ page }) => {
    const errors = await openExtension(page);
    const first = page.locator('.shuffle-wallpaper');
    const second = page.locator('.settings-trigger');
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
    let errors = await openExtension(page, seed);
    await openLaunchpad(page);
    const columns = await page.locator('.launchpad-grid').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    // The root grid holds the POM folder tile, the bookmarks and the add tile: fill one row plus one item.
    seed.bookmarks = [
        ...Array.from({ length: columns - 1 }, (_, index) => ({
            id: index + 1,
            name: `Site ${index + 1}`,
            url: `https://site-${index + 1}.example.com/`,
            icon: '',
            folder: '全部',
            order: index
        })),
        { id: 99, name: 'POM site', url: 'https://pom.example.com/', icon: '', folder: 'POM', order: 0 }
    ];
    await page.evaluate((bookmarks) => new Promise((resolve) => chrome.storage.sync.set({ bookmarks }, resolve)), seed.bookmarks);
    await page.reload();
    await openLaunchpad(page);
    await expect(page.locator('.bookmark-tile')).toHaveCount(columns - 1);
    errors = [];
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
    await openLaunchpad(page);
    await page.locator('.bookmark-tile[data-bookmark-id="1"]').dragTo(page.locator('.launchpad-tab[data-folder="POM"]'));
    await expect(page.locator('.bookmark-tile')).toHaveCount(1);
    let stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(3);
    expect(stored.bookmarks.find((bookmark) => String(bookmark.id) === '1').folder).toBe('POM');

    await page.locator('.folder-tile[data-folder="POM"]').click();
    await expect(page.locator('.launchpad-tab[data-folder="POM"]')).toHaveAttribute('aria-selected', 'true');
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
    expect(settingsLayout.width).toBe(920);
    expect(settingsLayout.sidebarBeside).toBe(true);
    expect(settingsLayout.overflowFree).toBe(true);
    await page.locator('input[data-toggle="showStatus"]').uncheck();
    await expect(page.locator('status-strip')).toBeHidden();
    await page.locator('input[data-toggle="showBookmarks"]').uncheck();
    await expect(page.locator('.setting-row[data-depends="showBookmarks"]').first()).toHaveClass(/is-disabled/);
    await expect(page.locator('home-dock')).toBeHidden();
    await page.locator('input[data-toggle="showBookmarks"]').check();
    await expect(page.locator('home-dock')).toBeVisible();
    await page.locator('[data-segment="dockSource"] [data-value="recent"]').click();
    await expect(page.locator('.dock-item[data-site-index]')).toHaveCount(2);

    await page.locator('.settings-nav-item[data-pane="appearance"]').click();
    await page.locator('[data-segment="clockFormat"] [data-value="12h"]').click();
    await expect(page.locator('[data-segment="clockFormat"] [data-value="12h"]')).toHaveAttribute('aria-checked', 'true');
    const appearanceToggles = page.locator('.settings-pane[data-pane="appearance"] liquid-toggle');
    await expect(appearanceToggles).toHaveCount(2);
    await expect(page.locator('.settings-pane[data-pane="appearance"] .liquid-toggle-thumb[data-liquid-profile="lip"]')).toHaveCount(2);
    const toggleMapCount = await page.locator('liquid-toggle feImage[result="displacement_map"]').evaluateAll((images) => (
        new Set(images.map((image) => image.getAttribute('href'))).size
    ));
    expect(toggleMapCount).toBe(1);
    await appearanceToggles.first().evaluate((control) => { window.__retainedLiquidControl = control; });
    await appearanceToggles.first().hover();
    await expect(page.locator('.hdr-glass-layer')).toHaveAttribute('data-hdr-target', 'liquid-toggle');
    const controlHdrSize = await page.locator('.hdr-glass-layer').evaluate((canvas) => ({
        width: Number.parseFloat(canvas.style.getPropertyValue('--hdr-glass-width')),
        height: Number.parseFloat(canvas.style.getPropertyValue('--hdr-glass-height'))
    }));
    expect(controlHdrSize.width).toBeGreaterThan(20);
    expect(controlHdrSize.height).toBeGreaterThan(20);
    await expect(appearanceToggles.first().locator('feDisplacementMap')).toHaveAttribute('scale', String(55.65161904498752 * 0.4));
    const hdrToggle = page.locator('input[data-toggle="hdrHighlights"]');
    await hdrToggle.dispatchEvent('pointerdown');
    await expect(appearanceToggles.first()).toHaveClass(/is-active/);
    await expect(appearanceToggles.first().locator('feDisplacementMap')).toHaveAttribute('scale', String(55.65161904498752 * 0.9));
    await hdrToggle.dispatchEvent('pointerup');
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
    expect(await page.evaluate(() => (
        window.__retainedLiquidControl?.isConnected
        && window.__retainedLiquidControl === document.querySelector('.settings-pane[data-pane="appearance"] liquid-toggle')
    ))).toBe(true);

    await page.locator('.settings-nav-item[data-pane="wallpaper"]').click();
    const wallpaperRanges = page.locator('.settings-pane[data-pane="wallpaper"] liquid-range');
    await expect(wallpaperRanges).toHaveCount(2);
    await expect(page.locator('.liquid-range-thumb[data-liquid-profile="convex"]')).toHaveCount(3);
    const rangeMapCount = await page.locator('liquid-range feImage[result="displacement_map"]').evaluateAll((images) => (
        new Set(images.map((image) => image.getAttribute('href'))).size
    ));
    expect(rangeMapCount).toBe(1);
    const overlayRange = page.locator('input[name="overlay"]');
    await overlayRange.fill('45');
    await expect(wallpaperRanges.nth(1)).toHaveCSS('--liquid-progress', '75%');
    await overlayRange.dispatchEvent('pointerdown');
    await expect(wallpaperRanges.nth(1)).toHaveClass(/is-active/);
    await expect(wallpaperRanges.nth(1).locator('feDisplacementMap')).toHaveAttribute('scale', String(83.88118841653394 * 0.9));
    await overlayRange.dispatchEvent('pointerup');
    await page.locator('.upload-wallpaper input').setInputFiles({
        name: 'wallpaper.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    });
    await expect.poll(() => page.evaluate(() => window.__readMockSync().settings.wallpaper.type)).toBe('local');
    await expect(page.locator('.wallpaper-name')).toHaveText('本地图片');
    await expect(page.locator('[data-segment="wallpaperKind"] [data-value="image"]')).toHaveAttribute('aria-checked', 'true');
    await page.reload();
    await expect(page.locator('.wallpaper-media')).toHaveCSS('background-image', /blob:/);
    await expect(page.locator('.wallpaper-pause')).toBeHidden();
    const stored = await page.evaluate(() => window.__readMockSync().settings);
    expect(stored.layout.showStatus).toBe(false);
    expect(stored.layout.dockSource).toBe('recent');
    expect(stored.appearance.theme).toBe('dark');
    expect(stored.appearance.clockFormat).toBe('12h');
    expect(stored.appearance.hdrHighlights).toBe(true);
    expect(stored.appearance.reduceTransparency).toBe(true);
    expect(errors).toEqual([]);
});

test('filters settings across every pane', async ({ page }) => {
    const errors = await openExtension(page);
    await openSettings(page);
    await page.locator('.settings-search input').fill('暂停');
    await expect(page.locator('.settings-pane:visible')).toHaveCount(1);
    await expect(page.locator('.setting-row:visible')).toHaveCount(2);
    await page.locator('.settings-search input').fill('Dock');
    await expect(page.locator('.setting-row:visible').first()).toContainText('Dock');
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
        stored.settings.wallpaper = { ...stored.settings.wallpaper, type: 'video', value: 'local' };
        await new Promise((resolve) => chrome.storage.sync.set({ settings: stored.settings }, resolve));
    }, videoBase64);
    await page.reload();
    await expect(page.locator('.app-notice')).toBeVisible();
    await expect(page.locator('.app-notice')).toContainText('背景加载失败');
    await expect(page.locator('.app-notice')).toContainText('已保留原背景');
    await expect(page.locator('.wallpaper-media video')).toHaveCount(0);
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
    await page.locator('.import-data input').setInputFiles({
        name: 'legacy-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
    });
    await expect(page.getByRole('alertdialog')).toContainText('从备份恢复');
    await page.getByRole('alertdialog').getByRole('button', { name: '恢复' }).click();
    await expect(page.locator('.toast.is-success')).toContainText('已从备份恢复');
    await expect(page.locator('.dock-item[data-bookmark-id]')).toHaveCount(1);
    await expect(page.locator('.dock-item[data-bookmark-id]')).toHaveAttribute('aria-label', 'v2ex.com');
    const stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks).toHaveLength(1);
    expect(stored.bookmarks[0].folder).toBe('全部');
    expect(stored.settings.layout.showStatus).toBe(true);
    expect(stored.settings.layout.dockSize).toBe(56);
    const raw = await page.evaluate(() => window.__readRawSync());
    expect(raw).not.toHaveProperty('bookmarks');
    expect(raw.bookmarkChunks).toBe(1);

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

test('keeps the backup reminder clear of the Dock and lets it be dismissed', async ({ page }) => {
    const errors = await openExtension(page, { ...initialData, lastBackupPrompt: 0 });
    for (const width of [1440, 900]) {
        await page.setViewportSize({ width, height: 1000 });
        const toast = await page.locator('.backup-toast').boundingBox();
        const dock = await page.locator('.dock').boundingBox();
        expect(toast).not.toBeNull();
        expect(dock).not.toBeNull();
        expect(overlaps(toast, dock)).toBe(false);
    }
    await page.locator('.backup-later').click();
    await expect(page.locator('backup-toast')).toBeHidden();
    expect(Date.now() - (await page.evaluate(() => window.__readMockSync().lastBackupPrompt))).toBeLessThan(60000);
    expect(errors).toEqual([]);
});

test('closes overlays with Escape and returns focus to the opener', async ({ page }) => {
    const errors = await openExtension(page);
    await page.locator('.dock-all').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.launchpad')).toBeVisible();
    const add = page.locator('.add-bookmark');
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
    await page.keyboard.press('Escape');
    await expect(page.locator('bookmark-launchpad')).toBeHidden();
    await expect(page.locator('.dock-all')).toBeFocused();

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
    await openLaunchpad(page);

    await page.locator('.bookmark-tile[data-bookmark-id="2"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'POM' }).click();
    await expect(page.locator('.bookmark-tile')).toHaveCount(1);
    expect((await page.evaluate(() => window.__readMockSync())).bookmarks.find((bookmark) => String(bookmark.id) === '2').folder).toBe('POM');

    await page.locator('.launchpad-tab.create-folder').click();
    const prompt = page.getByRole('alertdialog');
    await prompt.locator('input').fill('阅读');
    await prompt.getByRole('button', { name: '创建' }).click();
    await expect(page.locator('.launchpad-tab[data-folder="阅读"]')).toHaveCount(1);
    await expect(page.locator('.folder-tile[data-folder="阅读"]')).toHaveCount(1);

    await page.locator('.launchpad-tab[data-folder="POM"]').click();
    await expect(page.locator('.bookmark-tile')).toHaveCount(2);
    await page.locator('.launchpad-tab[data-folder="POM"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: '重命名…' }).click();
    await page.getByRole('alertdialog').locator('input').fill('收藏');
    await page.getByRole('alertdialog').getByRole('button', { name: '保存' }).click();
    await expect(page.locator('.launchpad-tab[data-folder="收藏"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.bookmark-tile')).toHaveCount(2);

    await page.locator('.bookmark-tile[data-bookmark-id="3"] .tile-more').click({ force: true });
    await page.getByRole('menuitem', { name: '删除书签' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click();
    await expect(page.locator('.bookmark-tile')).toHaveCount(1);

    await page.locator('.launchpad-search input').fill('git');
    await expect(page.locator('.launchpad-grid')).toHaveAttribute('data-view', 'search');
    await expect(page.locator('.bookmark-tile')).toHaveCount(1);
    await expect(page.locator('.launchpad-search input')).toBeFocused();
    expect(errors).toEqual([]);
});

test('Spotlight searches bookmarks, history and recent searches', async ({ page }) => {
    const errors = await openExtension(page, { ...initialData, recentSearches: ['二次元壁纸', 'typescript'] });
    await page.keyboard.press('/');
    const input = page.locator('.spotlight-field input');
    await expect(input).toBeFocused();
    await expect(page.locator('body')).toHaveClass(/spotlight-open/);
    await expect(page.locator('.spotlight-row', { hasText: '二次元壁纸' })).toHaveCount(1);

    await input.fill('git');
    const first = page.locator('.spotlight-row').first();
    await expect(first).toContainText('GitHub');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.ghost-rest')).toHaveText('hub.com');
    await expect(page.locator('.spotlight-scope')).toHaveText('书签');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.spotlight-row').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.spotlight-row').nth(1)).toContainText('在 Google 中搜索');
    await page.keyboard.press('Tab');
    await expect(page.locator('.spotlight-engines [data-engine="bing"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.spotlight-row').nth(1)).toContainText('在 Bing 中搜索');
    await expect(input).toBeFocused();

    await input.fill('youtube.com');
    await expect(page.locator('.spotlight-row').first()).toContainText('youtube.com');
    await expect(page.locator('.spotlight-heading').first()).toHaveText('网址');

    await input.fill('');
    const recent = page.locator('.spotlight-row', { hasText: '二次元壁纸' });
    await recent.hover();
    await recent.locator('.row-remove').click();
    await expect(page.locator('.spotlight-row', { hasText: '二次元壁纸' })).toHaveCount(0);
    expect((await page.evaluate(() => window.__readMockSync())).recentSearches).toEqual(['typescript']);
    expect((await page.evaluate(() => window.__readMockSync())).settings.layout.searchEngine).toBe('google');

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await expect(page.locator('spotlight-search')).toBeHidden();
    await page.locator('.search-pill').click();
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('spotlight-search')).toBeHidden();
    expect(errors).toEqual([]);
});

test('fades to the clock alone when idle', async ({ page }) => {
    const seed = structuredClone(initialData);
    seed.settings.wallpaper.idleHide = true;
    const errors = await openExtension(page, seed);
    await page.mouse.move(10, 10);
    await expect(page.locator('body')).toHaveClass(/is-idle/, { timeout: 10000 });
    await expect(page.locator('home-dock')).toHaveCSS('opacity', '0');
    await expect(page.locator('dashboard-header')).toHaveCSS('opacity', '0.85');
    await page.mouse.move(200, 200);
    await expect(page.locator('body')).not.toHaveClass(/is-idle/);
    expect(errors).toEqual([]);
});
