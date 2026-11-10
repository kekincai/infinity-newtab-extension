import type {
    AppSettings,
    AppState,
    Bookmark,
    LayoutSettings,
    WallpaperSettings
} from './types';
import { ROOT_FOLDER, cleanText, compareBookmarks, normalizeUrl, sanitizeRemoteUrl } from './utils';

export const DEFAULT_SETTINGS: AppSettings = {
    layout: {
        showClock: true,
        showSearch: true,
        showBookmarks: true,
        showStatus: true,
        showRecent: true,
        openInNewTab: false,
        searchEngine: 'google',
        saveSearches: true,
        backupReminder: true
    },
    wallpaper: {
        type: 'gradient',
        value: '',
        blur: 0,
        overlay: 12,
        idleHide: true,
        pauseOnBattery: true,
        pauseWhenHidden: true,
        sound: false
    },
    appearance: {
        clockFormat: '24h',
        dateFormat: 'long',
        hdrHighlights: true,
        theme: 'auto',
        glass: 'clear',
        reduceTransparency: false
    }
};

/** Turns a backup's `data` into a complete state; repeated addresses in one folder are merged. */
export function sanitizeImportedData(value: unknown): AppState {
    if (!isRecord(value)) throw new Error('Backup data must be an object');
    const bookmarks = sanitizeBookmarks(Array.isArray(value.bookmarks) ? value.bookmarks : [], true);
    return {
        bookmarks,
        folders: normalizeFolders(value.folders, bookmarks),
        settings: sanitizeSettings(value.settings),
        recentSearches: normalizeRecentSearches(value.recentSearches),
        lastBackupPrompt: finiteNumber(value.lastBackupPrompt, 0)
    };
}

/**
 * Cleans stored or imported bookmarks. Only imports merge duplicates, and only
 * exact ones: `watch?v=1` and `watch?v=2` are different pages.
 */
export function sanitizeBookmarks(values: unknown[], mergeDuplicates = false): Bookmark[] {
    const bookmarks: Bookmark[] = [];
    const seen = new Set<string>();
    values.forEach((raw, index) => {
        if (!isRecord(raw)) return;
        const url = normalizeUrl(raw.url);
        if (!url) return;
        const folder = cleanText(raw.folder, 80) || ROOT_FOLDER;
        const key = `${folder}|${url}`;
        if (mergeDuplicates && seen.has(key)) return;
        seen.add(key);
        const id = typeof raw.id === 'number' || typeof raw.id === 'string'
            ? raw.id
            : Date.now() + index;
        const order = Number(raw.order);
        bookmarks.push({
            id,
            folder,
            url,
            name: cleanText(raw.name, 160) || new URL(url).hostname,
            icon: sanitizeBookmarkIcon(raw.icon),
            order: Number.isFinite(order) ? order : index
        });
    });

    const folders = new Map<string, Bookmark[]>();
    bookmarks.forEach((bookmark) => {
        const list = folders.get(bookmark.folder) ?? [];
        list.push(bookmark);
        folders.set(bookmark.folder, list);
    });
    folders.forEach((list) => {
        list.sort(compareBookmarks);
        list.forEach((bookmark, index) => { bookmark.order = index; });
    });
    return bookmarks;
}

/** The root folder first, then every named folder and any folder a bookmark still points at. */
export function normalizeFolders(value: unknown, bookmarks: Bookmark[]): string[] {
    const folders = new Set<string>([ROOT_FOLDER]);
    if (Array.isArray(value)) value.forEach((item) => {
        const name = cleanText(item, 80);
        if (name) folders.add(name);
    });
    bookmarks.forEach((bookmark) => folders.add(bookmark.folder));
    return [...folders];
}

export function normalizeRecentSearches(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => cleanText(item, 200)).filter(Boolean).slice(0, 20);
}

export function sanitizeSettings(value: unknown): AppSettings {
    const source = isRecord(value) ? value : {};
    const layout = isRecord(source.layout) ? source.layout : {};
    const wallpaper = isRecord(source.wallpaper) ? source.wallpaper : {};
    const appearance = isRecord(source.appearance) ? source.appearance : {};
    const defaults = DEFAULT_SETTINGS;
    const searchEngines = ['google', 'bing', 'baidu', 'duckduckgo'];
    const wallpaperTypes = ['gradient', 'local', 'video'];
    const wallpaperType = wallpaperTypes.includes(String(wallpaper.type))
        ? wallpaper.type as WallpaperSettings['type']
        : defaults.wallpaper.type;

    return {
        layout: {
            showClock: booleanOr(layout.showClock, defaults.layout.showClock),
            showSearch: booleanOr(layout.showSearch, defaults.layout.showSearch),
            showBookmarks: booleanOr(layout.showBookmarks, defaults.layout.showBookmarks),
            showStatus: booleanOr(layout.showStatus, defaults.layout.showStatus),
            showRecent: booleanOr(layout.showRecent, defaults.layout.showRecent),
            openInNewTab: booleanOr(layout.openInNewTab, defaults.layout.openInNewTab),
            searchEngine: searchEngines.includes(String(layout.searchEngine))
                ? layout.searchEngine as LayoutSettings['searchEngine']
                : defaults.layout.searchEngine,
            saveSearches: booleanOr(layout.saveSearches, defaults.layout.saveSearches),
            backupReminder: booleanOr(layout.backupReminder, defaults.layout.backupReminder)
        },
        wallpaper: {
            type: wallpaperType,
            value: wallpaperType === 'gradient' ? '' : sanitizeWallpaperValue(wallpaper.value),
            blur: clampNumber(wallpaper.blur, 0, 40, defaults.wallpaper.blur),
            overlay: clampNumber(wallpaper.overlay, 0, 60, defaults.wallpaper.overlay),
            idleHide: booleanOr(wallpaper.idleHide, defaults.wallpaper.idleHide),
            pauseOnBattery: booleanOr(wallpaper.pauseOnBattery, defaults.wallpaper.pauseOnBattery),
            pauseWhenHidden: booleanOr(wallpaper.pauseWhenHidden, defaults.wallpaper.pauseWhenHidden),
            sound: booleanOr(wallpaper.sound, defaults.wallpaper.sound)
        },
        appearance: {
            clockFormat: appearance.clockFormat === '12h' ? '12h' : '24h',
            dateFormat: appearance.dateFormat === 'short' ? 'short' : 'long',
            hdrHighlights: booleanOr(appearance.hdrHighlights, defaults.appearance.hdrHighlights),
            theme: appearance.theme === 'light' || appearance.theme === 'dark' ? appearance.theme : 'auto',
            glass: appearance.glass === 'tinted' ? 'tinted' : 'clear',
            reduceTransparency: booleanOr(appearance.reduceTransparency, defaults.appearance.reduceTransparency)
        }
    };
}

export function dataUrlToBlob(dataUrl: unknown): Blob | null {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    const [header, payload] = dataUrl.split(',', 2);
    if (!payload) return null;
    const mime = header.match(/^data:([^;,]+)/)?.[1] ?? 'application/octet-stream';
    try {
        const decoded = header.includes(';base64') ? atob(payload) : decodeURIComponent(payload);
        const bytes = new Uint8Array(decoded.length);
        for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
        return new Blob([bytes], { type: mime });
    } catch {
        return null;
    }
}

/** Inline icons live in sync storage, so oversized data URLs are dropped instead of breaking the quota. */
export const MAX_INLINE_ICON_LENGTH = 4096;

export function sanitizeBookmarkIcon(value: unknown): string {
    const icon = sanitizeRemoteUrl(value, true);
    return icon.startsWith('data:') && icon.length > MAX_INLINE_ICON_LENGTH ? '' : icon;
}

/** `local-<time>` / `online-<time>` name the cached media, so a new picture always reloads. */
function sanitizeWallpaperValue(value: unknown): string {
    return typeof value === 'string' && /^(local|online)-\d+$/.test(value) ? value : '';
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function finiteNumber(value: unknown, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
