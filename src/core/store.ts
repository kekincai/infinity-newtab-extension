import { DEFAULT_SETTINGS, sanitizeBookmarks, sanitizeSettings } from './backup';
import { storageClear, storageGet, storageRemove, storageSet } from './storage';
import type { AppSettings, AppState, Bookmark, SettingsSection } from './types';
import { cleanText, normalizeUrl, sanitizeRemoteUrl } from './utils';

const MANAGED_KEYS = ['bookmarks', 'folders', 'settings', 'recentSearches', 'lastBackupPrompt'] as const;

function initialState(): AppState {
    return {
        bookmarks: [],
        folders: ['全部'],
        settings: structuredClone(DEFAULT_SETTINGS),
        recentSearches: [],
        lastBackupPrompt: 0
    };
}

export class AppStore extends EventTarget {
    private stateValue = initialState();
    private initialized = false;

    get state(): Readonly<AppState> {
        return this.stateValue;
    }

    async init(force = false): Promise<void> {
        if (this.initialized && !force) return;
        const stored = await storageGet<Record<string, unknown>>([...MANAGED_KEYS]);
        const bookmarks = sanitizeBookmarks(Array.isArray(stored.bookmarks) ? stored.bookmarks : []);
        const folders = normalizeFolders(stored.folders, bookmarks);
        this.stateValue = {
            bookmarks,
            folders,
            settings: sanitizeSettings(stored.settings),
            recentSearches: normalizeRecentSearches(stored.recentSearches),
            lastBackupPrompt: finiteNumber(stored.lastBackupPrompt, 0)
        };
        this.initialized = true;
        this.emit();
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
        }, ['settings']);
    }

    async addFolder(value: string): Promise<boolean> {
        const name = cleanText(value, 80);
        if (!name || this.stateValue.folders.includes(name)) return false;
        await this.commit((draft) => { draft.folders.push(name); }, ['folders']);
        return true;
    }

    async renameFolder(from: string, to: string): Promise<boolean> {
        const name = cleanText(to, 80);
        if (!name || from === '全部' || (name !== from && this.stateValue.folders.includes(name))) return false;
        await this.commit((draft) => {
            draft.folders = draft.folders.map((folder) => folder === from ? name : folder);
            draft.bookmarks.forEach((bookmark) => {
                if (bookmark.folder === from) bookmark.folder = name;
            });
            normalizeOrders(draft.bookmarks);
        }, ['folders', 'bookmarks']);
        return true;
    }

    async deleteFolder(folder: string): Promise<void> {
        if (folder === '全部') return;
        await this.commit((draft) => {
            draft.folders = draft.folders.filter((item) => item !== folder);
            draft.bookmarks.forEach((bookmark) => {
                if (bookmark.folder === folder) bookmark.folder = '全部';
            });
            normalizeOrders(draft.bookmarks);
        }, ['folders', 'bookmarks']);
    }

    async addBookmark(input: Pick<Bookmark, 'name' | 'url' | 'icon' | 'folder'>): Promise<Bookmark> {
        const bookmark = normalizeBookmarkInput(input, this.stateValue);
        await this.commit((draft) => { draft.bookmarks.push(bookmark); }, ['bookmarks']);
        return bookmark;
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
            const destination = draft.folders.includes(targetFolder) ? targetFolder : '全部';
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

    async replaceImportedData(data: Record<string, unknown>): Promise<void> {
        const next = initialState();
        next.bookmarks = sanitizeBookmarks(Array.isArray(data.bookmarks) ? data.bookmarks : []);
        next.folders = normalizeFolders(data.folders, next.bookmarks);
        next.settings = sanitizeSettings(data.settings);
        next.recentSearches = normalizeRecentSearches(data.recentSearches);
        next.lastBackupPrompt = finiteNumber(data.lastBackupPrompt, 0);
        const values: Record<string, unknown> = {
            bookmarks: next.bookmarks,
            folders: next.folders,
            settings: next.settings,
            recentSearches: next.recentSearches,
            lastBackupPrompt: next.lastBackupPrompt,
            ...(Array.isArray(data.todos) ? { todos: data.todos } : {})
        };
        await storageSet(values);
        const staleKeys = ['bookmarks', 'folders', 'settings', 'todos', 'recentSearches', 'lastBackupPrompt']
            .filter((key) => !(key in values));
        if (staleKeys.length) await storageRemove(staleKeys);
        this.stateValue = next;
        this.initialized = true;
        this.emit();
    }

    async reset(): Promise<void> {
        await storageClear('sync');
        this.stateValue = initialState();
        this.emit();
    }

    private async commit(mutator: (draft: AppState) => void, keys: Array<keyof AppState>): Promise<void> {
        const draft = structuredClone(this.stateValue);
        mutator(draft);
        const values: Record<string, unknown> = {};
        keys.forEach((key) => { values[key] = draft[key]; });
        await storageSet(values);
        this.stateValue = draft;
        this.emit();
    }

    private emit(): void {
        this.dispatchEvent(new CustomEvent('change', { detail: this.stateValue }));
    }
}

function normalizeBookmarkInput(
    input: Pick<Bookmark, 'name' | 'url' | 'icon' | 'folder'>,
    state: Pick<AppState, 'bookmarks' | 'folders'>,
    id: Bookmark['id'] = `${Date.now()}-${crypto.randomUUID()}`
): Bookmark {
    const url = normalizeUrl(input.url);
    if (!url) throw new Error('请输入有效的网址');
    const folder = state.folders.includes(input.folder) ? input.folder : '全部';
    return {
        id,
        url,
        folder,
        name: cleanText(input.name, 160) || new URL(url).hostname,
        icon: sanitizeRemoteUrl(input.icon, true),
        order: state.bookmarks.filter((bookmark) => bookmark.folder === folder && String(bookmark.id) !== String(id)).length
    };
}

function normalizeFolders(value: unknown, bookmarks: Bookmark[]): string[] {
    const folders = new Set<string>(['全部']);
    if (Array.isArray(value)) value.forEach((item) => {
        const name = cleanText(item, 80);
        if (name) folders.add(name);
    });
    bookmarks.forEach((bookmark) => folders.add(bookmark.folder));
    return [...folders];
}

function normalizeRecentSearches(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => cleanText(item, 200)).filter(Boolean).slice(0, 20);
}

function normalizeOrders(bookmarks: Bookmark[]): void {
    new Set(bookmarks.map((bookmark) => bookmark.folder)).forEach((folder) => normalizeFolderOrder(bookmarks, folder));
}

function normalizeFolderOrder(bookmarks: Bookmark[], folder: string): void {
    bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks)
        .forEach((bookmark, index) => { bookmark.order = index; });
}

function compareBookmarks(left: Bookmark, right: Bookmark): number {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
}

function finiteNumber(value: unknown, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export const appStore = new AppStore();
