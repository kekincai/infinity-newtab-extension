const { test, expect } = require('@playwright/test');

const initialData = {
    bookmarks: [
        { id: 1, name: 'www.google.com', url: 'https://www.google.com/', icon: '', folder: '全部', order: 0 },
        { id: 2, name: 'GitHub', url: 'https://github.com/', icon: '', folder: '全部', order: 1 },
        { id: 3, name: 'Bilibili', url: 'https://www.bilibili.com/', icon: '', folder: 'POM', order: 0 }
    ],
    folders: ['全部', 'POM'],
    settings: {
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
    },
    recentSearches: ['二次元壁纸'],
    lastBackupPrompt: 4102444800000
};

const historyItems = [
    { url: 'https://www.youtube.com/watch?v=1', title: 'YouTube One', visitCount: 8, lastVisitTime: 300 },
    { url: 'https://www.youtube.com/watch?v=2', title: 'YouTube Two', visitCount: 5, lastVisitTime: 200 },
    { url: 'https://www.v2ex.com/t/1', title: 'V2EX', visitCount: 4, lastVisitTime: 100 },
    { url: 'https://www.google.com/search?q=noise', title: 'Ignored', visitCount: 99, lastVisitTime: 400 }
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
            if (Array.isArray(keys)) {
                return Object.fromEntries(keys.map((key) => [key, data[key]]));
            }
            return Object.fromEntries(Object.keys(keys).map((key) => [key, data[key] ?? keys[key]]));
        };
        const storageArea = (key) => ({
            get(keys, callback) {
                callback(selectKeys(readArea(key), keys));
            },
            set(values, callback = () => {}) {
                writeArea(key, { ...readArea(key), ...values });
                callback();
            },
            remove(keys, callback = () => {}) {
                const data = readArea(key);
                for (const name of Array.isArray(keys) ? keys : [keys]) delete data[name];
                writeArea(key, data);
                callback();
            },
            clear(callback = () => {}) {
                writeArea(key, {});
                callback();
            }
        });

        Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 8 });
        navigator.getBattery = async () => ({ level: 0.82, charging: false });

        window.chrome = {
            runtime: {
                id: 'e2e-infinity-newtab',
                lastError: null,
                getURL() {
                    return `${location.origin}/icons/icon-48.png`;
                }
            },
            storage: {
                sync: storageArea(syncKey),
                local: storageArea(localKey)
            },
            tabs: {
                query(_query, callback) { callback([]); },
                update() {}
            },
            downloads: {
                search(_query, callback) { callback([]); },
                show() {}
            },
            history: {
                search(_query, callback) { callback(history); }
            }
        };
        window.__readMockSync = () => readArea(syncKey);
    }, { seed, history: historyItems });
}

async function openExtension(page, seed = initialData) {
    const errors = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await installChromeMock(page, seed);
    await page.goto('/newtab.html');
    await expect(page.locator('#bookmarksGrid .bookmark-card')).toHaveCount(2);
    return errors;
}

async function centerOf(locator) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test('renders the home screen without runtime errors', async ({ page }) => {
    const errors = await openExtension(page);

    await expect(page).toHaveTitle('新标签页');
    await expect(page.locator('#currentFolderLabel')).toHaveText('全部');
    await expect(page.locator('.folder-card[data-folder="POM"]')).toHaveCount(1);
    await expect(page.locator('#recentTrack .recent-card')).toHaveCount(2);
    await expect(page.locator('#recentTrack')).toContainText('youtube');
    await expect(page.locator('#recentTrack')).not.toContainText('google');
    await expect(page.locator('#cpuInfo')).toHaveText('CPU: 8 线程');
    await expect(page.locator('#batteryInfo')).toContainText('82%');
    await expect(page.locator('.liquid-glass-lens.is-visible')).toHaveCount(0);
    await expect(page.locator('.liquid-button-floating-label')).toHaveCount(0);
    const backdropFilter = await page.locator('.status-card').first().evaluate(
        (element) => getComputedStyle(element).backdropFilter
    );
    expect(backdropFilter).toContain('liquidGlassRefraction');

    await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
    await expect(page).toHaveScreenshot('home.png', {
        fullPage: true,
        mask: [page.locator('#time'), page.locator('#date')]
    });
    expect(errors).toEqual([]);
});

test('keeps the backup reminder clear of the add button', async ({ page }) => {
    const seed = { ...initialData, lastBackupPrompt: 0 };
    const errors = await openExtension(page, seed);
    const toast = page.locator('#backupToast');
    const addButton = page.locator('#addBtn');

    await expect(toast).toBeVisible();
    const toastBox = await toast.boundingBox();
    const addBox = await addButton.boundingBox();
    expect(toastBox).not.toBeNull();
    expect(addBox).not.toBeNull();
    const overlaps = !(
        toastBox.x + toastBox.width <= addBox.x
        || addBox.x + addBox.width <= toastBox.x
        || toastBox.y + toastBox.height <= addBox.y
        || addBox.y + addBox.height <= toastBox.y
    );
    expect(overlaps).toBe(false);
    expect(errors).toEqual([]);
});

test('renders the liquid glass settings panel', async ({ page }) => {
    const errors = await openExtension(page);

    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toHaveClass(/active/);
    await page.waitForTimeout(550);
    await expect(page.locator('.settings-tabs .liquid-glass-lens')).toHaveCount(1);
    await expect(page.locator('.settings-tabs .liquid-glass-lens')).not.toHaveClass(/is-visible/);
    await expect(page.locator('.settings-tabs .liquid-button-floating-label')).toHaveCount(0);
    await expect(page.locator('button[data-tab="appearance"]')).toBeVisible();
    await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
    await expect(page).toHaveScreenshot('settings.png', {
        mask: [page.locator('#time'), page.locator('#date')]
    });
    expect(errors).toEqual([]);
});

test('keeps liquid glass locked to the live pointer position between controls', async ({ page }) => {
    const errors = await openExtension(page);
    await page.waitForTimeout(900);
    const group = page.locator('.header-actions');
    const lens = group.locator('.liquid-glass-lens');
    await expect(lens).toHaveCount(1);
    await expect(page.locator('#liquidPointerLens')).toHaveCount(0);
    await expect(lens).not.toHaveClass(/is-visible/);
    await expect(lens).toHaveText('');
    const mapHref = await page.locator('feImage[data-liquid-map="bezel"]').first().getAttribute('href');
    expect(mapHref).toMatch(/^data:image\/png;base64,/);

    const wallpaperCenter = await centerOf(page.locator('#animeWallpaperBtn'));
    const addFolderCenter = await centerOf(page.locator('#addFolderBtn'));
    await page.mouse.move(wallpaperCenter.x, wallpaperCenter.y);
    await expect(lens).toHaveClass(/is-visible/);
    const initialLensBox = await lens.boundingBox();
    expect(initialLensBox.width).toBeGreaterThan(wallpaperCenter.box.width);
    expect(initialLensBox.height).toBeGreaterThan(wallpaperCenter.box.height);
    const lensFilter = await lens.evaluate((element) => getComputedStyle(element, '::before').backdropFilter);
    expect(lensFilter).toContain('liquid-glass-lens-');
    await page.waitForTimeout(180);

    const midpoint = {
        x: (
            wallpaperCenter.box.x
            + wallpaperCenter.box.width
            + addFolderCenter.box.x
        ) / 2,
        y: (wallpaperCenter.y + addFolderCenter.y) / 2
    };
    await page.mouse.move(midpoint.x, midpoint.y);
    await expect(lens).toHaveClass(/is-visible/);
    const pausedTransform = await lens.evaluate((element) => element.style.transform);
    const pausedBox = await lens.boundingBox();
    expect(pausedBox.width).toBeGreaterThan(
        Math.max(wallpaperCenter.box.width, addFolderCenter.box.width)
    );
    expect(pausedBox.x + pausedBox.width / 2).toBeGreaterThan(wallpaperCenter.x);
    expect(pausedBox.x + pausedBox.width / 2).toBeLessThan(addFolderCenter.x);
    expect(await lens.evaluate((element) => (
        element.getAnimations().filter((animation) => animation.effect?.getKeyframes().length === 3).length
    ))).toBe(0);

    await page.waitForTimeout(450);
    await expect(lens).toHaveClass(/is-visible/);
    expect(await lens.evaluate((element) => element.style.transform)).toBe(pausedTransform);

    const threeQuarterPoint = {
        x: wallpaperCenter.x + (addFolderCenter.x - wallpaperCenter.x) * 0.75,
        y: wallpaperCenter.y + (addFolderCenter.y - wallpaperCenter.y) * 0.75
    };
    await page.mouse.move(threeQuarterPoint.x, threeQuarterPoint.y);
    const laterBox = await lens.boundingBox();
    expect(laterBox.x + laterBox.width / 2).toBeGreaterThan(pausedBox.x + pausedBox.width / 2);
    await page.mouse.move(midpoint.x, midpoint.y);
    const reversedBox = await lens.boundingBox();
    expect(reversedBox.x + reversedBox.width / 2).toBeLessThan(laterBox.x + laterBox.width / 2);
    await page.mouse.move(addFolderCenter.x, addFolderCenter.y);
    const settledBox = await lens.boundingBox();
    expect(Math.abs(settledBox.x + settledBox.width / 2 - addFolderCenter.x)).toBeLessThan(2);

    await page.mouse.move(20, 20);
    await page.waitForTimeout(500);
    await expect(lens).not.toHaveClass(/is-visible/);

    const cardGroup = page.locator('#bookmarksGrid');
    const cardLens = cardGroup.locator('.liquid-glass-lens');
    const bookmarkCards = cardGroup.locator('.bookmark-card');
    const firstBookmark = bookmarkCards.nth(0);
    const secondBookmark = bookmarkCards.nth(1);
    const firstBookmarkCenter = await centerOf(firstBookmark);
    const secondBookmarkCenter = await centerOf(secondBookmark);
    await page.mouse.move(firstBookmarkCenter.x, firstBookmarkCenter.y);
    await expect(cardLens).toHaveClass(/is-visible/);
    await page.waitForTimeout(180);
    await page.mouse.move(
        (firstBookmarkCenter.x + secondBookmarkCenter.x) / 2,
        (firstBookmarkCenter.y + secondBookmarkCenter.y) / 2
    );
    const cardPausedTransform = await cardLens.evaluate((element) => element.style.transform);
    const cardPausedBox = await cardLens.boundingBox();
    expect(cardPausedBox.width).toBeGreaterThan(firstBookmarkCenter.box.width);
    await page.waitForTimeout(450);
    expect(await cardLens.evaluate((element) => element.style.transform)).toBe(cardPausedTransform);
    await page.mouse.move(secondBookmarkCenter.x, secondBookmarkCenter.y);
    const cardSettledBox = await cardLens.boundingBox();
    expect(Math.abs(
        cardSettledBox.x + cardSettledBox.width / 2 - secondBookmarkCenter.x
    )).toBeLessThan(2);

    await cardLens.evaluate((element) => element.remove());
    await expect(cardGroup.locator('.liquid-glass-lens')).toHaveCount(1);
    await firstBookmark.dispatchEvent('pointerover');
    await expect(cardGroup.locator('.liquid-glass-lens')).toHaveClass(/is-visible/);

    await page.locator('#settingsBtn').click();
    await page.locator('button[data-tab="wallpaper"]').dispatchEvent('pointerover');
    await expect(page.locator('.settings-tabs .liquid-glass-lens')).toHaveClass(/is-visible/);
    await expect(page.locator('.settings-tabs .liquid-glass-lens')).toHaveText('');
    expect(errors).toEqual([]);
});

test('keeps recent-site cards roomy and pointer-driven across their gap', async ({ page }) => {
    const errors = await openExtension(page);
    await page.waitForTimeout(900);
    const scroller = page.locator('#recentScroller');
    const header = page.locator('.recent-header');
    const cards = page.locator('#recentTrack .recent-card');
    const firstCard = cards.nth(0);
    const secondCard = cards.nth(1);
    const lens = page.locator('#recentTrack .liquid-glass-lens');
    const scrollerBox = await scroller.boundingBox();
    const headerBox = await header.boundingBox();
    const firstCenter = await centerOf(firstCard);
    const secondCenter = await centerOf(secondCard);

    expect(firstCenter.box.width).toBeGreaterThanOrEqual(205);
    await page.mouse.move(firstCenter.x, firstCenter.y);
    await expect(lens).toHaveClass(/is-visible/);
    await page.waitForTimeout(180);

    const hoveredBox = await firstCard.boundingBox();
    expect(hoveredBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height + 8);
    expect(hoveredBox.y + hoveredBox.height).toBeLessThanOrEqual(
        scrollerBox.y + scrollerBox.height
    );
    await page.mouse.move(
        (firstCenter.x + secondCenter.x) / 2,
        (firstCenter.y + secondCenter.y) / 2
    );
    const pausedTransform = await lens.evaluate((element) => element.style.transform);
    const pausedBox = await lens.boundingBox();
    expect(pausedBox.x + pausedBox.width / 2).toBeGreaterThan(firstCenter.x);
    expect(pausedBox.x + pausedBox.width / 2).toBeLessThan(secondCenter.x);
    await page.waitForTimeout(450);
    await expect(lens).toHaveClass(/is-visible/);
    expect(await lens.evaluate((element) => element.style.transform)).toBe(pausedTransform);
    await page.mouse.move(secondCenter.x, secondCenter.y);
    expect(await lens.evaluate((element) => element.style.transform)).not.toBe(pausedTransform);
    expect(errors).toEqual([]);
});

test('persists layout and theme controls', async ({ page }) => {
    const errors = await openExtension(page);

    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toHaveClass(/active/);
    await page.locator('button[data-tab="layout"]').click();

    const statusControl = page.locator('label.toggle-label').filter({ hasText: '显示状态概览' });
    await expect(statusControl).toHaveCount(1);
    await statusControl.click();
    await expect(page.locator('.status-strip')).toBeHidden();

    await page.locator('button[data-tab="appearance"]').click();
    const themeControl = page.locator('label.toggle-label').filter({ hasText: '白天模式' });
    await themeControl.click();
    await expect(page.locator('body')).not.toHaveClass(/theme-light/);

    const stored = await page.evaluate(() => window.__readMockSync().settings);
    expect(stored.layout.showStatus).toBe(false);
    expect(stored.appearance.theme).toBe('dark');
    expect(errors).toEqual([]);
});

test('adds a bookmark and manages a folder', async ({ page }) => {
    const errors = await openExtension(page);

    await page.locator('#addBtn').click();
    await page.locator('#urlInput').fill('https://example.com/docs');
    await page.locator('#nameInput').fill('Example Docs');
    await page.locator('#saveBtn').click();
    await expect(page.locator('#bookmarksGrid')).toContainText('Example Docs');

    page.once('dialog', (dialog) => dialog.accept('收藏'));
    await page.locator('.folder-card[data-folder="POM"] .folder-action[title="重命名文件夹"]').click();
    await expect(page.locator('.folder-card[data-folder="收藏"]')).toHaveCount(1);

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.folder-card[data-folder="收藏"] .folder-action[title="删除文件夹"]').click();
    await expect(page.locator('.folder-card[data-folder="收藏"]')).toHaveCount(0);

    const stored = await page.evaluate(() => window.__readMockSync());
    expect(stored.bookmarks.some((bookmark) => bookmark.name === 'Example Docs')).toBe(true);
    expect(stored.bookmarks.find((bookmark) => bookmark.id === 3).folder).toBe('全部');
    expect(errors).toEqual([]);
});

test('imports a version 1 backup and exports version 2', async ({ page }, testInfo) => {
    const errors = await openExtension(page);
    const backup = {
        version: '1.0',
        exportDate: '2026-01-24T14:12:46.859Z',
        data: {
            bookmarks: [
                { id: 10, name: 'www.v2ex.com', url: 'https://www.v2ex.com/', order: 0 }
            ],
            folders: ['全部'],
            settings: {
                layout: { showClock: true, showSearch: true, showBookmarks: true },
                wallpaper: { type: 'gradient', value: '', blur: 0, overlay: 30 },
                appearance: { clockFormat: '24h', dateFormat: 'long' }
            },
            todos: []
        }
    };

    page.once('dialog', (dialog) => dialog.accept());
    await Promise.all([
        page.waitForNavigation(),
        page.locator('#importInput').setInputFiles({
            name: 'legacy-backup.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(backup))
        })
    ]);
    await expect(page.locator('#bookmarksGrid')).toContainText('v2ex.com');
    await expect(page.locator('#bookmarksGrid .bookmark-card')).toHaveCount(1);

    await page.locator('#settingsBtn').click();
    await page.locator('button[data-tab="data"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportBtn').click();
    const download = await downloadPromise;
    const downloadPath = testInfo.outputPath('backup.json');
    await download.saveAs(downloadPath);
    const exported = JSON.parse(require('node:fs').readFileSync(downloadPath, 'utf8'));

    expect(exported.version).toBe('2.0');
    expect(exported.data.bookmarks).toHaveLength(1);
    expect(exported.localMedia).toEqual({ image: null, video: null });
    expect(errors).toEqual([]);
});
