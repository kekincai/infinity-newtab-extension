import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, sanitizeImportedData, sanitizeSettings } from '../src/core/backup';
import { BOOKMARK_CHUNKS_KEY, bookmarkChunkKey } from '../src/core/bookmark-storage';
import { rankSites } from '../src/core/history';
import { AppStore } from '../src/core/store';
import { convexSquircle, precalculateDisplacements } from '../src/components/liquid-optics';
import { bookmarkIcon, bookmarkIconCanUpgrade, bookmarkIconFallback, bookmarkIconSrcSet, faviconUrl, isAddressLike, normalizeUrl, siteLabel } from '../src/core/utils';

const syncData: Record<string, unknown> = {};
let failWrites = false;
type ChangeListener = (changes: Record<string, unknown>, areaName: string) => void;
const changeListeners: ChangeListener[] = [];
/** Like Chrome, change events reach every page after the write, this one included. */
function announceChange(keys: string[]): void {
    setTimeout(() => changeListeners.forEach((listener) => listener(Object.fromEntries(keys.map((key) => [key, {}])), 'sync')), 0);
}

const runtime = {
    lastError: null as { message: string } | null,
    getURL: (path: string) => `chrome-extension://unit-test${path}`
};
function area(data: Record<string, unknown>) {
    return {
        get(keys: string[] | string | null, callback: (value: Record<string, unknown>) => void) {
            if (keys === null) callback({ ...data });
            else if (typeof keys === 'string') callback({ [keys]: data[keys] });
            else callback(Object.fromEntries(keys.map((key) => [key, data[key]])));
        },
        set(values: Record<string, unknown>, callback: () => void) {
            runtime.lastError = failWrites ? { message: 'quota exceeded' } : null;
            if (!failWrites) {
                Object.assign(data, structuredClone(values));
                announceChange(Object.keys(values));
            }
            callback();
            runtime.lastError = null;
        },
        remove(keys: string[], callback: () => void) {
            keys.forEach((key) => delete data[key]);
            announceChange(keys);
            callback();
        },
        clear(callback: () => void) {
            const keys = Object.keys(data);
            keys.forEach((key) => delete data[key]);
            announceChange(keys);
            callback();
        }
    };
}

(globalThis as any).chrome = {
    runtime,
    storage: {
        sync: area(syncData),
        onChanged: { addListener: (listener: ChangeListener) => changeListeners.push(listener) }
    }
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

const backup = sanitizeImportedData({
    bookmarks: [
        { id: 1, name: 'www.google.com', url: 'https://www.google.com/', icon: '', folder: '全部', order: 0 },
        { id: 2, name: 'www.v2ex.com', url: 'https://www.v2ex.com/', icon: '', folder: '全部', order: 2 },
        { id: 3, name: 'Duplicate', url: 'https://www.v2ex.com/', icon: '', folder: '全部', order: 9 }
    ],
    folders: ['全部'],
    settings: {
        layout: { showClock: true, showSearch: true, showBookmarks: true, unknownSetting: true },
        wallpaper: { type: 'local', value: 'local-1700000000000', blur: 0, overlay: 30 },
        appearance: { clockFormat: '24h', dateFormat: 'long', theme: 'light' }
    }
});

assert.equal(backup.bookmarks.length, 2, '同一文件夹中完全相同的书签必须合并');
assert.equal(backup.bookmarks[0].folder, '全部');
assert.equal(backup.settings.wallpaper.value, 'local-1700000000000');
assert.equal(backup.settings.wallpaper.overlay, 30, '用户自己设的暗化保留');
assert.equal(backup.settings.appearance.theme, 'light', '选择的深色文字原样保留');
assert.equal(sanitizeSettings({}).wallpaper.overlay, 12, '暗化默认值统一为 12');
assert.deepEqual(sanitizeSettings({}).wallpaper.framing, { scale: 1, x: 0.5, y: 0.5 }, '默认取景是铺满屏幕、居中');
assert.deepEqual(sanitizeSettings({ wallpaper: { framing: { scale: 2.5, x: 0.2, y: 0.9 } } }).wallpaper.framing, { scale: 2.5, x: 0.2, y: 0.9 }, '保存的取景原样保留');
assert.deepEqual(sanitizeSettings({ wallpaper: { framing: { scale: 99, x: -3, y: 'bad' } } }).wallpaper.framing, { scale: 5, x: 0, y: 0.5 }, '越界或无效的取景被收回到范围内');
assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS, '缺省设置与 DEFAULT_SETTINGS 一致');

const queryBackup = sanitizeImportedData({
    bookmarks: [
        { id: 1, url: 'https://www.youtube.com/watch?v=AAA' },
        { id: 2, url: 'https://www.youtube.com/watch?v=BBB' },
        { id: 3, url: 'https://docs.google.com/document/d/Abc' },
        { id: 4, url: 'https://docs.google.com/document/d/abc' }
    ]
});
assert.equal(queryBackup.bookmarks.length, 4, '查询串或路径大小写不同的书签是不同的页面，不能合并');
assert.equal(backup.settings.layout.showStatus, true, '缺少的设置取默认值');
assert.equal(backup.settings.appearance.hdrHighlights, true);
assert.equal('unknownSetting' in backup.settings.layout, false, '不认识的设置丢弃');
assert.equal(sanitizeSettings({ appearance: { theme: 'light' } }).appearance.theme, 'light');
assert.equal(sanitizeSettings({ appearance: { theme: 'dark' } }).appearance.theme, 'dark');
assert.equal(sanitizeSettings({ wallpaper: { type: 'local', value: 'online-123' } }).wallpaper.value, 'online-123', '缓存的在线壁纸需要保留版本号以触发刷新');
assert.equal(sanitizeSettings({ wallpaper: { type: 'local', value: 'data:image/png;base64,AAAA' } }).wallpaper.value, '', '壁纸设置里不再接受内嵌图片');
assert.equal(sanitizeSettings({ wallpaper: { type: 'preset', value: 'https://www.dmoe.cc/random.php' } }).wallpaper.type, 'gradient', '不认识的壁纸类型回到默认场景');

const unsafe = sanitizeImportedData({
    bookmarks: [{ id: 1, name: 'bad', url: 'javascript:alert(1)', icon: 'javascript:alert(2)' }],
    folders: ['全部', '<script>'],
    settings: {
        wallpaper: { type: 'bad', value: 'javascript:alert(3)', blur: 99, overlay: -4 },
        appearance: { theme: 'bad' },
        layout: { searchEngine: 'bad' }
    },
    unknown: 'drop me'
});
assert.equal(unsafe.bookmarks.length, 0);
assert.equal((unsafe.settings as any).wallpaper.type, 'gradient');
assert.equal((unsafe.settings as any).wallpaper.value, '');
assert.equal((unsafe.settings as any).wallpaper.blur, 40);
assert.equal((unsafe.settings as any).wallpaper.overlay, 0);
assert.equal('unknown' in unsafe, false);

const extensionPage = 'chrome-extension://hjekpdhdabgkokjbklegnfkogcpjhhhg/index.html';
assert.equal(normalizeUrl(extensionPage), extensionPage, '其他扩展的页面应能作为书签地址');
assert.equal(normalizeUrl('chrome-extension:///index.html'), '', '缺少扩展 ID 的地址必须拒绝');
assert.equal(normalizeUrl('javascript:alert(1)'), '', '危险协议必须继续拒绝');
assert.equal(normalizeUrl('example.com'), 'https://example.com/', '公网地址默认补 https');
assert.equal(normalizeUrl('localhost:3000'), 'http://localhost:3000/', '本机服务默认补 http');
assert.equal(normalizeUrl('192.168.1.1:8080/admin'), 'http://192.168.1.1:8080/admin', 'IP 地址默认补 http');
assert.equal(normalizeUrl('nas.local'), 'http://nas.local/', '.local 地址默认补 http');
assert.equal(normalizeUrl('app.localhost'), 'http://app.localhost/');
assert.equal(normalizeUrl('[::1]:5173'), 'http://[::1]:5173/');
assert.equal(normalizeUrl('https://localhost:8443'), 'https://localhost:8443/', '写明的协议保持不变');

const extensionBackup = sanitizeImportedData({
    bookmarks: [{ id: 'extension-page', name: '扩展页面', url: extensionPage }],
    folders: ['全部']
});
assert.equal(extensionBackup.bookmarks[0].url, extensionPage, '导入备份时应保留扩展页面书签');

const managedBookmark = { id: 10, name: 'Google', url: 'https://www.google.com/', icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64', folder: '全部', order: 0 };
assert.ok(bookmarkIcon(managedBookmark).includes('size=128'), '旧 Google favicon 地址应切换到 Chrome 的高尺寸接口');
assert.ok(bookmarkIconSrcSet(managedBookmark).includes('size=256'), '高 DPI 显示应准备更高尺寸的 favicon');
assert.ok(bookmarkIconFallback(managedBookmark).startsWith('data:image/svg+xml;base64,PHN2Zy'), '托管 favicon 失败时应使用安全的本地占位图');
assert.ok(faviconUrl(managedBookmark.url, 64).includes('size=64'));

const customBookmark = { ...managedBookmark, icon: 'https://assets.example/icon.png' };
assert.equal(bookmarkIcon(customBookmark), customBookmark.icon, '自定义图标不能被导入流程覆盖');
assert.equal(bookmarkIconCanUpgrade(customBookmark), true, '自定义图标应允许检查实际分辨率');
assert.equal(bookmarkIconCanUpgrade(managedBookmark), false, 'Chrome 管理的 favicon 不需要重复升级');
assert.ok(bookmarkIconFallback(customBookmark).includes('size=128'), '自定义图标失败时应回退到本地 favicon');

const ranked = rankSites([
    { url: 'https://www.youtube.com/', title: 'YouTube', visitCount: 1, lastVisitTime: 150 },
    { url: 'https://www.youtube.com/watch?v=1', visitCount: 8, lastVisitTime: 200 },
    { url: 'https://youtube.com/watch?v=2', visitCount: 4, lastVisitTime: 300 },
    { url: 'https://www.v2ex.com/t/1', visitCount: 5, lastVisitTime: 100 },
    { url: 'https://www.google.com/search?q=noise', visitCount: 99, lastVisitTime: 500 }
]);
assert.equal(ranked.length, 2);
assert.equal(ranked[0].host, 'youtube.com');
assert.equal(ranked[0].url, 'https://www.youtube.com/', '应打开实际访问最多的主机名，而不是强行去掉 www');
assert.equal(ranked[0].count, 13);
assert.equal(ranked[0].title, 'YouTube', '首页标题可用时应作为网站名');
assert.equal(ranked[1].title, 'V2EX', '没有首页标题时显示去掉后缀的网站名');
assert.equal(rankSites([{ url: 'https://news.ycombinator.com/item?id=1', visitCount: 3 }])[0].title, 'Hacker News');
assert.equal(siteLabel('www.example.co.uk'), 'Example', '两段式后缀应整体去掉');
assert.equal(siteLabel('docs.python.org'), 'Python');
assert.equal(siteLabel('localhost'), 'localhost');
assert.equal(siteLabel('192.168.1.1'), '192.168.1.1', 'IP 地址保持原样');
assert.equal(isAddressLike('www.google.com'), true);
assert.equal(isAddressLike('Google'), false);

const opticalSamples = precalculateDisplacements(55, 63, convexSquircle, 1.5, 128);
assert.equal(opticalSamples.length, 128, '折射场必须覆盖 SVG 颜色通道的 128 个径向取样位置');
assert.ok(opticalSamples.every(Number.isFinite));
assert.ok(Math.abs(opticalSamples.at(-1) ?? 0) < Math.abs(opticalSamples[0]), '位移应从玻璃边缘向平面区域平滑衰减');
assert.ok(Math.max(...opticalSamples.map(Math.abs)) > 70, '凸面 squircle 必须产生可见的物理位移');
assert.ok(convexSquircle(0.5) > 0.9, '凸面 squircle 应保持平滑的内侧曲率');


async function testTransactions(): Promise<void> {
    Object.assign(syncData, {
        [BOOKMARK_CHUNKS_KEY]: 1,
        [bookmarkChunkKey(0)]: [
            { id: 'a', name: 'A', url: 'https://a.example/', icon: '', folder: '全部', order: 0 },
            { id: 'b', name: 'B', url: 'https://b.example/', icon: '', folder: '全部', order: 1 },
            { id: 'c', name: 'C', url: 'https://c.example/', icon: '', folder: 'POM', order: 0 }
        ],
        folders: ['全部', 'POM'],
        settings: sanitizeSettings({}),
        recentSearches: []
    });
    const store = new AppStore();
    await store.init();
    await store.moveBookmark('a', 'POM');
    assert.equal(store.state.bookmarks.length, 3, '移动不能复制书签');
    assert.deepEqual(store.state.bookmarks.filter((bookmark) => bookmark.folder === 'POM').map((bookmark) => bookmark.id).sort(), ['a', 'c']);
    assert.deepEqual(store.state.bookmarks.filter((bookmark) => bookmark.folder === '全部').map((bookmark) => bookmark.id), ['b']);

    await store.moveBookmark('a', 'POM', 'c');
    assert.deepEqual(
        store.state.bookmarks.filter((bookmark) => bookmark.folder === 'POM').sort((left, right) => left.order - right.order).map((bookmark) => bookmark.id),
        ['a', 'c'],
        '同文件夹排序不能复制数据'
    );

    const extensionBookmark = await store.addBookmark({ name: '扩展页面', url: extensionPage, icon: '', folder: '全部' });
    assert.equal(extensionBookmark.url, extensionPage, '新增书签应接受 chrome-extension 页面');

    assert.equal(syncData[BOOKMARK_CHUNKS_KEY], 1);

    for (let index = 0; index < 150; index += 1) {
        await store.addBookmark({ name: `站点 ${index}`, url: `https://site-${index}.example.com/some/longer/path?ref=${index}`, icon: '', folder: '全部' });
    }
    const chunkCount = Number(syncData[BOOKMARK_CHUNKS_KEY]);
    assert.ok(chunkCount > 1, '大量书签必须拆分为多个同步分片');
    for (let index = 0; index < chunkCount; index += 1) {
        const key = bookmarkChunkKey(index);
        const bytes = new TextEncoder().encode(key + JSON.stringify(syncData[key])).length;
        assert.ok(bytes < 8192, `分片 ${key} 超过 chrome.storage.sync 单项 8KB 上限：${bytes}`);
    }
    const reloaded = new AppStore();
    await reloaded.init();
    assert.equal(reloaded.state.bookmarks.length, store.state.bookmarks.length, '分片存储读回后书签数量必须一致');

    const trimmed = store.state.bookmarks.filter((bookmark) => String(bookmark.name).startsWith('站点'));
    for (const bookmark of trimmed) await store.deleteBookmark(bookmark.id);
    assert.equal(syncData[BOOKMARK_CHUNKS_KEY], 1);
    assert.equal(bookmarkChunkKey(1) in syncData, false, '书签减少后多余的分片应被清理');

    await assert.rejects(
        store.addBookmark({ name: 'Big icon', url: 'https://big.example/', icon: `data:image/png;base64,${'A'.repeat(5000)}`, folder: '全部' }),
        /图标过大/,
        '过大的内嵌图标会撑爆同步配额，必须拒绝'
    );

    const countBeforeFailure = store.state.bookmarks.length;
    failWrites = true;
    await assert.rejects(store.addBookmark({ name: 'D', url: 'https://d.example/', icon: '', folder: '全部' }), /quota exceeded/);
    failWrites = false;
    assert.equal(store.state.bookmarks.length, countBeforeFailure, '写入失败时内存状态必须回滚');
}

/** B1: two pages that differ only in the query must both survive a reload and later saves. */
async function testQueryBookmarksSurvive(): Promise<void> {
    const store = new AppStore();
    await store.init();
    await store.addBookmark({ name: '', url: 'https://www.youtube.com/watch?v=AAA', icon: '', folder: 'POM' });
    await store.addBookmark({ name: '', url: 'https://www.youtube.com/watch?v=BBB', icon: '', folder: 'POM' });
    const reloaded = new AppStore();
    await reloaded.init();
    const urls = () => reloaded.state.bookmarks.filter((bookmark) => bookmark.folder === 'POM').map((bookmark) => bookmark.url);
    assert.ok(urls().includes('https://www.youtube.com/watch?v=AAA') && urls().includes('https://www.youtube.com/watch?v=BBB'), '重新打开后两条都在');
    await reloaded.addFolder('稍后');
    await reloaded.renameFolder('POM', '收藏');
    const again = new AppStore();
    await again.init();
    assert.equal(again.state.bookmarks.filter((bookmark) => bookmark.url.includes('watch?v=')).length, 2, '之后的写入不能把其中一条从存储里删掉');
}

/** B6: a tab opened earlier must not overwrite what another tab saved since. */
async function testTabsDoNotOverwriteEachOther(): Promise<void> {
    const first = new AppStore();
    const second = new AppStore();
    await first.init();
    await second.init();
    await first.addBookmark({ name: 'From A', url: 'https://tab-a.example/', icon: '', folder: '全部' });
    await settle();
    assert.ok(second.state.bookmarks.some((bookmark) => bookmark.url === 'https://tab-a.example/'), '另一个标签页的修改要同步到这里');
    let changes: string[] = [];
    second.addEventListener('change', (event) => { changes = (event as CustomEvent).detail.changes; });
    await first.updateSettings('appearance', { glass: 'tinted' });
    await settle();
    assert.deepEqual(changes, ['settings.appearance'], '只通知实际变化的部分');
    await second.addBookmark({ name: 'From B', url: 'https://tab-b.example/', icon: '', folder: '全部' });
    await settle();
    const stored = new AppStore();
    await stored.init();
    const urls = stored.state.bookmarks.map((bookmark) => bookmark.url);
    assert.ok(urls.includes('https://tab-a.example/') && urls.includes('https://tab-b.example/'), '两个标签页的书签都要保留');
    assert.equal(stored.state.settings.appearance.glass, 'tinted');

    let otherTab = 0;
    let ownTab = 0;
    first.addEventListener('change', () => { otherTab += 1; });
    second.addEventListener('change', () => { ownTab += 1; });
    await second.saveRecentSearch('only once');
    await settle();
    assert.equal(otherTab, 1, '别的标签页的写入会通知这里');
    assert.equal(ownTab, 1, '自己写入的回声不会再次通知');
}

async function testImportDropsExtraChunks(): Promise<void> {
    const store = new AppStore();
    await store.init();
    const many = Array.from({ length: 120 }, (_, index) => ({ id: index, url: `https://many-${index}.example.com/a/long/path?ref=${index}`, folder: '全部', order: index }));
    await store.replaceImportedData(sanitizeImportedData({ bookmarks: many }));
    assert.ok(Number(syncData[BOOKMARK_CHUNKS_KEY]) > 1);
    await store.replaceImportedData(sanitizeImportedData({ bookmarks: [] }));
    assert.equal(syncData[BOOKMARK_CHUNKS_KEY], 0);
    assert.equal(bookmarkChunkKey(1) in syncData, false, '导入较少的书签时清掉多余的分片');
}

testTransactions()
    .then(testQueryBookmarksSurvive)
    .then(testTabsDoNotOverwriteEachOther)
    .then(testImportDropsExtraChunks)
    .then(() => console.log('TypeScript core tests passed.'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
