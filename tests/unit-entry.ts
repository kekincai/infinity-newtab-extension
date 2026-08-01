import assert from 'node:assert/strict';
import { sanitizeImportedData, sanitizeSettings } from '../src/core/backup';
import { rankSites } from '../src/core/history';
import { AppStore } from '../src/core/store';
import { convexSquircle, precalculateDisplacements } from '../src/components/liquid-optics';

const syncData: Record<string, unknown> = {};
const localData: Record<string, unknown> = {};
let failWrites = false;

const runtime = { lastError: null as { message: string } | null };
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

const ranked = rankSites([
    { url: 'https://www.youtube.com/watch?v=1', visitCount: 8, lastVisitTime: 200 },
    { url: 'https://youtube.com/watch?v=2', visitCount: 4, lastVisitTime: 300 },
    { url: 'https://www.v2ex.com/t/1', visitCount: 5, lastVisitTime: 100 },
    { url: 'https://www.google.com/search?q=noise', visitCount: 99, lastVisitTime: 500 }
]);
assert.equal(ranked.length, 2);
assert.equal(ranked[0].host, 'youtube.com');
assert.equal(ranked[0].url, 'https://youtube.com/');
assert.equal(ranked[0].count, 12);

const opticalSamples = precalculateDisplacements(55, 63, convexSquircle, 1.5, 128);
assert.equal(opticalSamples.length, 128, '折射场必须覆盖 SVG 颜色通道的 128 个径向取样位置');
assert.ok(opticalSamples.every(Number.isFinite));
assert.ok(Math.abs(opticalSamples.at(-1) ?? 0) < Math.abs(opticalSamples[0]), '位移应从玻璃边缘向平面区域平滑衰减');
assert.ok(Math.max(...opticalSamples.map(Math.abs)) > 70, '凸面 squircle 必须产生可见的物理位移');
assert.ok(convexSquircle(0.5) > 0.9, '凸面 squircle 应保持平滑的内侧曲率');

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
