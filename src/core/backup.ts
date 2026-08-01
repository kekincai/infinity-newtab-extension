import type {
    AppSettings,
    Bookmark,
    LayoutSettings,
    WallpaperSettings
} from './types';
import { cleanText, normalizeUrl, sanitizeRemoteUrl } from './utils';

export const DEFAULT_SETTINGS: AppSettings = {
    layout: {
        showClock: true,
        showSearch: true,
        showBookmarks: true,
        showStatus: true,
        showRecent: true,
        searchEngine: 'google'
    },
    wallpaper: {
        type: 'gradient',
        value: '',
        blur: 0,
        overlay: 30
    },
    appearance: {
        clockFormat: '24h',
        dateFormat: 'long',
        enhancedAnimations: true,
        hdrHighlights: true,
        theme: 'light'
    }
};

export function mergeSettings(value: unknown): AppSettings {
    return sanitizeSettings(value);
}

export function sanitizeImportedData(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) throw new Error('Backup data must be an object');
    const sanitized: Record<string, unknown> = {};
    const bookmarks = sanitizeBookmarks(Array.isArray(value.bookmarks) ? value.bookmarks : []);
    sanitized.bookmarks = bookmarks;

    const folders = new Set<string>();
    if (Array.isArray(value.folders)) {
        value.folders.forEach((folder) => {
            const name = cleanText(folder, 80);
            if (name) folders.add(name);
        });
    }
    folders.add('全部');
    bookmarks.forEach((bookmark) => folders.add(bookmark.folder));
    sanitized.folders = Array.from(folders);

    if (value.settings !== undefined) sanitized.settings = sanitizeSettings(value.settings);
    if (Array.isArray(value.todos)) sanitized.todos = value.todos;
    if (Array.isArray(value.recentSearches)) {
        sanitized.recentSearches = value.recentSearches
            .map((entry) => cleanText(entry, 200))
            .filter(Boolean)
            .slice(0, 20);
    }
    const backupTime = Number(value.lastBackupPrompt);
    if (Number.isFinite(backupTime)) sanitized.lastBackupPrompt = backupTime;
    return sanitized;
}

export function sanitizeBookmarks(values: unknown[]): Bookmark[] {
    const merged = new Map<string, Bookmark>();
    values.forEach((raw, index) => {
        if (!isRecord(raw)) return;
        const url = normalizeUrl(raw.url);
        if (!url) return;
        const folder = cleanText(raw.folder, 80) || '全部';
        const key = `${folder}|${canonicalUrl(url)}`;
        if (merged.has(key)) return;
        const id = typeof raw.id === 'number' || typeof raw.id === 'string'
            ? raw.id
            : Date.now() + index;
        const icon = sanitizeRemoteUrl(raw.icon, true);
        const order = Number(raw.order);
        merged.set(key, {
            id,
            folder,
            url,
            name: cleanText(raw.name, 160) || new URL(url).hostname,
            icon,
            order: Number.isFinite(order) ? order : index
        });
    });

    const folders = new Map<string, Bookmark[]>();
    merged.forEach((bookmark) => {
        const list = folders.get(bookmark.folder) ?? [];
        list.push(bookmark);
        folders.set(bookmark.folder, list);
    });
    folders.forEach((list) => {
        list.sort((left, right) => left.order - right.order || String(left.id).localeCompare(String(right.id)));
        list.forEach((bookmark, index) => { bookmark.order = index; });
    });
    return Array.from(merged.values());
}

export function sanitizeSettings(value: unknown): AppSettings {
    const source = isRecord(value) ? value : {};
    const layout = isRecord(source.layout) ? source.layout : {};
    const wallpaper = isRecord(source.wallpaper) ? source.wallpaper : {};
    const appearance = isRecord(source.appearance) ? source.appearance : {};
    const searchEngines = ['google', 'bing', 'baidu', 'duckduckgo'];
    const wallpaperTypes = ['gradient', 'preset', 'local', 'video'];

    return {
        layout: {
            showClock: booleanOr(layout.showClock, true),
            showSearch: booleanOr(layout.showSearch, true),
            showBookmarks: booleanOr(layout.showBookmarks, true),
            showStatus: booleanOr(layout.showStatus, true),
            showRecent: booleanOr(layout.showRecent, true),
            searchEngine: searchEngines.includes(String(layout.searchEngine))
                ? layout.searchEngine as LayoutSettings['searchEngine']
                : 'google'
        },
        wallpaper: {
            type: wallpaperTypes.includes(String(wallpaper.type))
                ? wallpaper.type as WallpaperSettings['type']
                : 'gradient',
            value: sanitizeWallpaperValue(wallpaper.value),
            blur: clampNumber(wallpaper.blur, 0, 10, 0),
            overlay: clampNumber(wallpaper.overlay, 0, 80, 30)
        },
        appearance: {
            clockFormat: appearance.clockFormat === '12h' ? '12h' : '24h',
            dateFormat: appearance.dateFormat === 'short' ? 'short' : 'long',
            enhancedAnimations: booleanOr(appearance.enhancedAnimations, true),
            hdrHighlights: booleanOr(appearance.hdrHighlights, true),
            theme: appearance.theme === 'dark' ? 'dark' : 'light'
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

function canonicalUrl(value: string): string {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.toLowerCase();
}

function sanitizeWallpaperValue(value: unknown): string {
    if (value === 'local' || value === '') return value;
    return sanitizeRemoteUrl(value, true);
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
