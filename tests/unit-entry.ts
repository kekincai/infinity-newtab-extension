import assert from 'node:assert/strict';
import { sanitizeImportedData, sanitizeSettings } from '../src/core/backup';
import { BOOKMARK_CHUNKS_KEY, bookmarkChunkKey } from '../src/core/bookmark-storage';
import { rankSites } from '../src/core/history';
import { AppStore } from '../src/core/store';
import { convexSquircle, lipSquircle, precalculateDisplacements } from '../src/components/liquid-optics';
import { bookmarkIcon, bookmarkIconCanUpgrade, bookmarkIconFallback, bookmarkIconIsRaster, bookmarkIconSrcSet, faviconUrl, normalizeUrl } from '../src/core/utils';

const syncData: Record<string, unknown> = {};
const localData: Record<string, unknown> = {};
let failWrites = false;

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
            if (!failWrites) Object.assign(data, structuredClone(values));
            callback();
            runtime.lastError = null;
        },
        remove(keys: string[], callback: () => void) {
            keys.forEach((key) => delete data[key]);
            callback();
        },
        clear(callback: () => void) {
            Object.keys(data).forEach((key) => delete data[key]);
            callback();
        }
    };
}

(globalThis as any).chrome = { runtime, storage: { sync: area(syncData), local: area(localData) } };

const oldBackup = sanitizeImportedData({
    bookmarks: [
        { id: 1, name: 'www.google.com', url: 'https://www.google.com/' },
        { id: 2, name: 'www.v2ex.com', url: 'https://www.v2ex.com/', folder: '全部', order: 2 },
        { id: 3, name: 'Duplicate', url: 'https://www.v2ex.com/', folder: '全部', order: 9 }
    ],
    folders: ['全部'],
    settings: {
        layout: { showClock: true, showSearch: true, showBookmarks: true, showTodo: true },
        wallpaper: { type: 'preset', value: 'https://images.unsplash.com/photo.jpg', blur: 0, overlay: 30 },
        appearance: { clockFormat: '24h', dateFormat: 'long' }
    },
    todos: []
});

assert.equal((oldBackup.bookmarks as any[]).length, 2, '旧备份中的重复书签必须合并');
assert.equal((oldBackup.bookmarks as any[])[0].folder, '全部');
assert.equal((oldBackup.settings as any).layout.showStatus, true);
assert.equal((oldBackup.settings as any).layout.showRecent, true);
assert.equal((oldBackup.settings as any).appearance.hdrHighlights, true);
assert.equal('showTodo' in (oldBackup.settings as any).layout, false);
assert.equal((oldBackup.settings as any).appearance.theme, 'auto', '旧版本默认的配色应迁移为自动');
assert.equal(sanitizeSettings({ appearance: { theme: 'light' } }).appearance.theme, 'auto', '2.5 之前的 light 是默认值，应迁移为自动');
assert.equal(sanitizeSettings({ layout: { openInNewTab: false }, appearance: { theme: 'light' } }).appearance.theme, 'light', '2.5 之后主动选择的深色文字必须保留');
assert.equal(sanitizeSettings({ appearance: { theme: 'dark' } }).appearance.theme, 'dark');
assert.equal(sanitizeSettings({ wallpaper: { type: 'local', value: 'online-123' } }).wallpaper.value, 'online-123', '缓存的在线壁纸需要保留版本号以触发刷新');

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
assert.equal((unsafe.bookmarks as any[]).length, 0);
assert.equal((unsafe.settings as any).wallpaper.type, 'gradient');
assert.equal((unsafe.settings as any).wallpaper.value, '');
assert.equal((unsafe.settings as any).wallpaper.blur, 10);
assert.equal((unsafe.settings as any).wallpaper.overlay, 0);
assert.equal('unknown' in unsafe, false);

const extensionPage = 'chrome-extension://hjekpdhdabgkokjbklegnfkogcpjhhhg/index.html';
assert.equal(normalizeUrl(extensionPage), extensionPage, '其他扩展的页面应能作为书签地址');
assert.equal(normalizeUrl('chrome-extension:///index.html'), '', '缺少扩展 ID 的地址必须拒绝');
assert.equal(normalizeUrl('javascript:alert(1)'), '', '危险协议必须继续拒绝');

const extensionBackup = sanitizeImportedData({
    bookmarks: [{ id: 'extension-page', name: '扩展页面', url: extensionPage }],
    folders: ['全部']
});
assert.equal((extensionBackup.bookmarks as any[])[0].url, extensionPage, '导入备份时应保留扩展页面书签');

const managedBookmark = { id: 10, name: 'Google', url: 'https://www.google.com/', icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64', folder: '全部', order: 0 };
assert.ok(bookmarkIcon(managedBookmark).includes('size=128'), '旧 Google favicon 地址应切换到 Chrome 的高尺寸接口');
assert.ok(bookmarkIconSrcSet(managedBookmark).includes('size=256'), '高 DPI 显示应准备更高尺寸的 favicon');
assert.ok(bookmarkIconFallback(managedBookmark).startsWith('data:image/svg+xml;base64,PHN2Zy'), '托管 favicon 失败时应使用安全的本地占位图');
assert.ok(faviconUrl(managedBookmark.url, 64).includes('size=64'));

const customBookmark = { ...managedBookmark, icon: 'https://assets.example/icon.png' };
assert.equal(bookmarkIcon(customBookmark), customBookmark.icon, '自定义图标不能被导入流程覆盖');
assert.equal(bookmarkIconCanUpgrade(customBookmark), true, '自定义图标应允许检查实际分辨率');
assert.equal(bookmarkIconCanUpgrade(managedBookmark), false, 'Chrome 管理的 favicon 不需要重复升级');
assert.equal(bookmarkIconIsRaster(managedBookmark), true, 'Chrome favicon 应按位图显示策略处理');
assert.equal(bookmarkIconIsRaster({ ...managedBookmark, icon: 'data:image/svg+xml;base64,PHN2Zy' }), false, 'SVG 图标不应套用位图放大策略');
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
assert.equal(ranked[1].title, 'v2ex.com', '没有首页标题时显示完整域名，而不是只取第一段');
assert.equal(rankSites([{ url: 'https://news.ycombinator.com/item?id=1', visitCount: 3 }])[0].title, 'news.ycombinator.com');

const opticalSamples = precalculateDisplacements(55, 63, convexSquircle, 1.5, 128);
assert.equal(opticalSamples.length, 128, '折射场必须覆盖 SVG 颜色通道的 128 个径向取样位置');
assert.ok(opticalSamples.every(Number.isFinite));
assert.ok(Math.abs(opticalSamples.at(-1) ?? 0) < Math.abs(opticalSamples[0]), '位移应从玻璃边缘向平面区域平滑衰减');
assert.ok(Math.max(...opticalSamples.map(Math.abs)) > 70, '凸面 squircle 必须产生可见的物理位移');
assert.ok(convexSquircle(0.5) > 0.9, '凸面 squircle 应保持平滑的内侧曲率');

const lipSamples = precalculateDisplacements(55, 63, lipSquircle, 1.5, 128);
assert.ok(lipSamples.every(Number.isFinite));
assert.ok(Math.max(...lipSamples) > 50 && Math.min(...lipSamples) < -30, 'lip 表面必须同时产生凸缘和凹心折射');
assert.equal(lipSquircle(0), 0);
assert.equal(lipSquircle(1), 0);

async function testTransactions(): Promise<void> {
    Object.assign(syncData, {
        bookmarks: [
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

    assert.equal('bookmarks' in syncData, false, '保存后应移除旧的单键书签数组');
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

testTransactions()
    .then(() => console.log('TypeScript core tests passed.'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
