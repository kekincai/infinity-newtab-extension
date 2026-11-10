import {
    DEFAULT_SETTINGS,
    MAX_INLINE_ICON_LENGTH,
    finiteNumber,
    normalizeFolders,
    normalizeRecentSearches,
    sanitizeBookmarks,
    sanitizeSettings
} from './backup';
import {
    LEGACY_BOOKMARKS_KEY,
    decodeBookmarks,
    encodeBookmarks,
    staleBookmarkKeys,
    storedChunkCount
} from './bookmark-storage';
import { onSyncChanged, storageClear, storageGet, storageRemove, storageSet } from './storage';
import type { AppSettings, AppState, Bookmark, SettingsSection } from './types';
import { ROOT_FOLDER, cleanText, compareBookmarks, normalizeUrl, sanitizeRemoteUrl } from './utils';

export type StoreChangeKey = keyof AppState | `settings.${SettingsSection}`;
const ALL_CHANGES: StoreChangeKey[] = [
    'bookmarks',
    'folders',
    'recentSearches',
    'lastBackupPrompt',
    'settings.appearance',
    'settings.wallpaper',
    'settings.layout'
];
/** Keys older versions wrote that nothing reads any more; an import clears them. */
const RETIRED_KEYS = ['todos'];

function initialState(): AppState {
    return {
        bookmarks: [],
        folders: [ROOT_FOLDER],
        settings: structuredClone(DEFAULT_SETTINGS),
        recentSearches: [],
        lastBackupPrompt: 0
    };
}

/**
 * The page's copy of everything in sync storage. Writes run one at a time, and
 * changes made by other tabs or devices are reloaded so a later save here never
 * overwrites them with stale data.
 */
export class AppStore extends EventTarget {
    private stateValue = initialState();
    private initialized: Promise<void> | null = null;
    private bookmarkChunks = 0;
    private hasLegacyBookmarks = false;
    private queue: Promise<unknown> = Promise.resolve();
    private reloadQueued = false;

    get state(): Readonly<AppState> {
        return this.stateValue;
    }

    init(): Promise<void> {
        this.initialized ??= this.serial(async () => {
            this.stateValue = await this.read();
            this.emit(ALL_CHANGES);
            onSyncChanged(this.queueReload);
        });
        this.initialized.catch(() => { this.initialized = null; });
        return this.initialized;
    }

    async updateSettings<S extends SettingsSection>(
        section: S,
        patch: Partial<AppSettings[S]>
    ): Promise<void> {
        await this.commit((draft) => {
            draft.settings = sanitizeSettings({
                ...draft.settings,
                [section]: { ...draft.settings[section], ...patch }
            });
        }, ['settings'], [`settings.${section}`]);
    }

    async addFolder(value: string): Promise<boolean> {
        const name = cleanText(value, 80);
        let added = false;
        await this.commit((draft) => {
            if (!name || draft.folders.includes(name)) return false;
            draft.folders.push(name);
            added = true;
        }, ['folders']);
        return added;
    }

    async renameFolder(from: string, to: string): Promise<boolean> {
        const name = cleanText(to, 80);
        let renamed = false;
        await this.commit((draft) => {
            if (!name || from === ROOT_FOLDER || (name !== from && draft.folders.includes(name))) return false;
            draft.folders = draft.folders.map((folder) => folder === from ? name : folder);
            draft.bookmarks.forEach((bookmark) => {
                if (bookmark.folder === from) bookmark.folder = name;
            });
            normalizeOrders(draft.bookmarks);
            renamed = true;
        }, ['folders', 'bookmarks']);
        return renamed;
    }

    async deleteFolder(folder: string): Promise<void> {
        if (folder === ROOT_FOLDER) return;
        await this.commit((draft) => {
            draft.folders = draft.folders.filter((item) => item !== folder);
            draft.bookmarks.forEach((bookmark) => {
                if (bookmark.folder === folder) bookmark.folder = ROOT_FOLDER;
            });
            normalizeOrders(draft.bookmarks);
        }, ['folders', 'bookmarks']);
    }

    async addBookmark(input: Pick<Bookmark, 'name' | 'url' | 'icon' | 'folder'>): Promise<Bookmark> {
        let bookmark: Bookmark | null = null;
        await this.commit((draft) => {
            bookmark = normalizeBookmarkInput(input, draft);
            draft.bookmarks.push(bookmark);
        }, ['bookmarks']);
        return bookmark!;
    }

    async updateBookmark(id: Bookmark['id'], input: Pick<Bookmark, 'name' | 'url' | 'icon' | 'folder'>): Promise<void> {
        await this.commit((draft) => {
            const index = draft.bookmarks.findIndex((bookmark) => String(bookmark.id) === String(id));
            if (index < 0) throw new Error('找不到该书签');
            const previous = draft.bookmarks[index];
            const next = normalizeBookmarkInput(input, draft, previous.id);
            next.order = previous.folder === next.folder
                ? previous.order
                : draft.bookmarks.filter((bookmark) => bookmark.folder === next.folder).length;
            draft.bookmarks[index] = next;
            normalizeOrders(draft.bookmarks);
        }, ['bookmarks']);
    }

    async deleteBookmark(id: Bookmark['id']): Promise<void> {
        await this.commit((draft) => {
            draft.bookmarks = draft.bookmarks.filter((bookmark) => String(bookmark.id) !== String(id));
            normalizeOrders(draft.bookmarks);
        }, ['bookmarks']);
    }

    async moveBookmark(id: Bookmark['id'], targetFolder: string, targetId?: Bookmark['id']): Promise<void> {
        await this.commit((draft) => {
            const bookmark = draft.bookmarks.find((item) => String(item.id) === String(id));
            if (!bookmark) throw new Error('找不到拖动的书签');
            const destination = draft.folders.includes(targetFolder) ? targetFolder : ROOT_FOLDER;
            const source = bookmark.folder;
            bookmark.folder = destination;
            const destinationList = draft.bookmarks
                .filter((item) => item.folder === destination && String(item.id) !== String(id))
                .sort(compareBookmarks);
            const foundIndex = targetId === undefined
                ? destinationList.length
                : destinationList.findIndex((item) => String(item.id) === String(targetId));
            const targetIndex = foundIndex < 0 ? destinationList.length : foundIndex;
            destinationList.splice(targetIndex, 0, bookmark);
            destinationList.forEach((item, index) => { item.order = index; });
            if (source !== destination) normalizeFolderOrder(draft.bookmarks, source);
        }, ['bookmarks']);
    }

    async removeRecentSearch(query: string): Promise<void> {
        await this.commit((draft) => {
            draft.recentSearches = draft.recentSearches.filter((item) => item !== query);
        }, ['recentSearches']);
    }

    async saveRecentSearch(query: string): Promise<void> {
        const value = cleanText(query, 200);
        if (!value) return;
        await this.commit((draft) => {
            draft.recentSearches = [value, ...draft.recentSearches.filter((item) => item !== value)].slice(0, 20);
        }, ['recentSearches']);
    }

    async setLastBackupPrompt(value = Date.now()): Promise<void> {
        await this.commit((draft) => { draft.lastBackupPrompt = value; }, ['lastBackupPrompt']);
    }

    /** Replaces everything with an already sanitized backup (see `sanitizeImportedData`). */
    replaceImportedData(next: AppState): Promise<void> {
        return this.serial(async () => {
            const encoded = encodeBookmarks(next.bookmarks);
            await storageSet({
                ...encoded.values,
                folders: next.folders,
                settings: next.settings,
                recentSearches: next.recentSearches,
                lastBackupPrompt: next.lastBackupPrompt
            });
            const staleKeys = [
                ...RETIRED_KEYS,
                ...staleBookmarkKeys(this.bookmarkChunks, encoded.count, this.hasLegacyBookmarks)
            ];
            await storageRemove(staleKeys);
            this.bookmarkChunks = encoded.count;
            this.hasLegacyBookmarks = false;
            this.stateValue = structuredClone(next);
            this.emit(ALL_CHANGES);
        });
    }

    reset(): Promise<void> {
        return this.serial(async () => {
            await storageClear();
            this.bookmarkChunks = 0;
            this.hasLegacyBookmarks = false;
            this.stateValue = initialState();
            this.emit(ALL_CHANGES);
        });
    }

    /** Runs tasks one after another, so a write always starts from the latest state. */
    private serial<T>(task: () => Promise<T>): Promise<T> {
        const run = this.queue.then(task, task);
        this.queue = run.catch(() => undefined);
        return run;
    }

    private async read(): Promise<AppState> {
        const stored = await storageGet<Record<string, unknown>>(null);
        this.bookmarkChunks = storedChunkCount(stored);
        this.hasLegacyBookmarks = LEGACY_BOOKMARKS_KEY in stored;
        const bookmarks = sanitizeBookmarks(decodeBookmarks(stored));
        return {
            bookmarks,
            folders: normalizeFolders(stored.folders, bookmarks),
            settings: sanitizeSettings(stored.settings),
            recentSearches: normalizeRecentSearches(stored.recentSearches),
            lastBackupPrompt: finiteNumber(stored.lastBackupPrompt, 0)
        };
    }

    /** Several change events (a save and its chunk cleanup) collapse into one reload. */
    private readonly queueReload = (): void => {
        if (this.reloadQueued) return;
        this.reloadQueued = true;
        void this.serial(async () => {
            this.reloadQueued = false;
            const next = await this.read();
            const changes = diff(this.stateValue, next);
            if (!changes.length) return; // Our own write coming back.
            this.stateValue = next;
            this.emit(changes);
        }).catch(() => undefined);
    };

    /** A mutator may return `false` to make no change at all. */
    private commit(
        mutator: (draft: AppState) => void | false,
        keys: Array<keyof AppState>,
        changes: StoreChangeKey[] = keys
    ): Promise<void> {
        return this.serial(async () => {
            const draft = structuredClone(this.stateValue);
            if (mutator(draft) === false) return;
            const values: Record<string, unknown> = {};
            let bookmarkChunks: number | null = null;
            keys.forEach((key) => {
                if (key !== 'bookmarks') {
                    values[key] = draft[key];
                    return;
                }
                const encoded = encodeBookmarks(draft.bookmarks);
                Object.assign(values, encoded.values);
                bookmarkChunks = encoded.count;
            });
            await storageSet(values);
            this.stateValue = draft;
            if (bookmarkChunks !== null) await this.dropStaleBookmarkKeys(bookmarkChunks);
            this.emit(changes);
        });
    }

    /** Stale chunks are harmless to readers, so a failed cleanup never rolls back a save. */
    private async dropStaleBookmarkKeys(nextCount: number): Promise<void> {
        const stale = staleBookmarkKeys(this.bookmarkChunks, nextCount, this.hasLegacyBookmarks);
        this.bookmarkChunks = nextCount;
        if (!stale.length) return;
        try {
            await storageRemove(stale);
            this.hasLegacyBookmarks = false;
        } catch {
            // Retried on the next bookmark save.
        }
    }

    private emit(changes: StoreChangeKey[]): void {
        this.dispatchEvent(new CustomEvent('change', { detail: { state: this.stateValue, changes } }));
    }
}

function diff(previous: AppState, next: AppState): StoreChangeKey[] {
    const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
    return ALL_CHANGES.filter((change) => {
        if (!change.startsWith('settings.')) return !same(previous[change as keyof AppState], next[change as keyof AppState]);
        const section = change.slice('settings.'.length) as SettingsSection;
        return !same(previous.settings[section], next.settings[section]);
    });
}

function normalizeBookmarkInput(
    input: Pick<Bookmark, 'name' | 'url' | 'icon' | 'folder'>,
    state: Pick<AppState, 'bookmarks' | 'folders'>,
    id: Bookmark['id'] = `${Date.now()}-${crypto.randomUUID()}`
): Bookmark {
    const url = normalizeUrl(input.url);
    if (!url) throw new Error('请输入有效的网址');
    if (url.length > 2048) throw new Error('网址过长，无法同步保存');
    const icon = sanitizeRemoteUrl(input.icon, true);
    if (icon.startsWith('data:') && icon.length > MAX_INLINE_ICON_LENGTH) {
        throw new Error('内嵌图标过大，请改用图标网址');
    }
    const folder = state.folders.includes(input.folder) ? input.folder : ROOT_FOLDER;
    return {
        id,
        url,
        folder,
        name: cleanText(input.name, 160) || new URL(url).hostname,
        icon,
        order: state.bookmarks.filter((bookmark) => bookmark.folder === folder && String(bookmark.id) !== String(id)).length
    };
}

function normalizeOrders(bookmarks: Bookmark[]): void {
    new Set(bookmarks.map((bookmark) => bookmark.folder)).forEach((folder) => normalizeFolderOrder(bookmarks, folder));
}

function normalizeFolderOrder(bookmarks: Bookmark[], folder: string): void {
    bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks)
        .forEach((bookmark, index) => { bookmark.order = index; });
}

export const appStore = new AppStore();
