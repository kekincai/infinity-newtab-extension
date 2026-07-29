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

test('renders the home screen without runtime errors', async ({ page }, testInfo) => {
    const errors = await openExtension(page);

    await expect(page).toHaveTitle('新标签页');
    await expect(page.locator('#currentFolderLabel')).toHaveText('全部');
    await expect(page.locator('.folder-card[data-folder="POM"]')).toHaveCount(1);
    await expect(page.locator('#recentTrack .recent-card')).toHaveCount(2);
    await expect(page.locator('#recentTrack')).toContainText('youtube');
    await expect(page.locator('#recentTrack')).not.toContainText('google');
    await expect(page.locator('#cpuInfo')).toHaveText('CPU: 8 线程');
    await expect(page.locator('#batteryInfo')).toContainText('82%');
    if (testInfo.project.name === 'desktop-chrome') {
        const backdropFilter = await page.locator('.status-card').first().evaluate(
            (element) => getComputedStyle(element).backdropFilter
        );
        expect(backdropFilter).toContain('liquidGlassRefraction');
    }

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
    await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
    await expect(page).toHaveScreenshot('settings.png', {
        mask: [page.locator('#time'), page.locator('#date')]
    });
    expect(errors).toEqual([]);
});

test('morphs one shared glass layer between buttons', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Hover morphing requires a fine pointer.');
    const errors = await openExtension(page);
    const group = page.locator('.header-actions');
    const indicator = group.locator('.liquid-button-indicator');
    await expect(indicator).toHaveCount(1);
    await expect(page.locator('#liquidPointerLens')).toHaveCount(0);
    await expect(page.locator('#addFolderBtn')).toHaveClass(/liquid-target/);

    const restingTransform = await indicator.evaluate((element) => getComputedStyle(element).transform);
    await page.locator('#animeWallpaperBtn').dispatchEvent('pointerover');
    await expect(page.locator('#animeWallpaperBtn')).toHaveClass(/liquid-target/);
    await expect.poll(async () => Number(
        await indicator.evaluate((element) => getComputedStyle(element).getPropertyValue('--liquid-stretch'))
    )).toBeGreaterThan(1);
    const movingTransform = await indicator.evaluate((element) => getComputedStyle(element).transform);
    expect(movingTransform).not.toBe(restingTransform);

    await page.waitForTimeout(550);
    await expect(page.locator('#animeWallpaperBtn')).toHaveClass(/liquid-target/);
    await expect(indicator).toHaveClass(/primary/);
    await expect.poll(async () => (
        await indicator.evaluate((element) => getComputedStyle(element).getPropertyValue('--liquid-angle').trim())
    )).toBe('0deg');
    await expect(page).toHaveScreenshot('button-morph.png', {
        mask: [page.locator('#time'), page.locator('#date')]
    });

    await page.locator('#settingsBtn').click();
    await page.locator('button[data-tab="wallpaper"]').click();
    await expect(page.locator('button[data-tab="wallpaper"]')).toHaveClass(/liquid-target/);
    expect(errors).toEqual([]);
});

test('persists layout and theme controls', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Interaction flow runs once on desktop.');
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

test('adds a bookmark and manages a folder', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Interaction flow runs once on desktop.');
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
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Data flow runs once on desktop.');
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
