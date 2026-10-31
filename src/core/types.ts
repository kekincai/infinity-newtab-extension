export type SearchEngineKey = 'google' | 'bing' | 'baidu' | 'duckduckgo';
export type WallpaperType = 'gradient' | 'preset' | 'local' | 'video';
/** `light` renders dark text for bright wallpapers; `auto` follows the wallpaper brightness. */
export type Theme = 'auto' | 'light' | 'dark';
export type ResolvedTheme = Exclude<Theme, 'auto'>;

/** What the home screen's bookmark grid shows: a folder of bookmarks or the most visited sites. */
export type BookmarkView = 'bookmarks' | 'recent';
export type GlassMaterial = 'clear' | 'tinted';

export interface LayoutSettings {
    showClock: boolean;
    showSearch: boolean;
    /** Shows the bookmark grid on the home screen. */
    showBookmarks: boolean;
    showStatus: boolean;
    showRecent: boolean;
    openInNewTab: boolean;
    searchEngine: SearchEngineKey;
    /** The view the bookmark grid opens on; named after the old Dock and kept for existing backups. */
    dockSource: BookmarkView;
    /** Bookmark icon size in px; same history as `dockSource`. */
    dockSize: number;
    saveSearches: boolean;
    backupReminder: boolean;
}

export interface WallpaperSettings {
    type: WallpaperType;
    value: string;
    blur: number;
    overlay: number;
    idleHide: boolean;
    pauseOnBattery: boolean;
    pauseWhenHidden: boolean;
    sound: boolean;
}

export interface AppearanceSettings {
    clockFormat: '12h' | '24h';
    dateFormat: 'short' | 'long';
    enhancedAnimations: boolean;
    hdrHighlights: boolean;
    theme: Theme;
    glass: GlassMaterial;
    reduceTransparency: boolean;
}

export interface AppSettings {
    layout: LayoutSettings;
    wallpaper: WallpaperSettings;
    appearance: AppearanceSettings;
}

export interface Bookmark {
    id: number | string;
    name: string;
    url: string;
    icon: string;
    folder: string;
    order: number;
}

export interface AppState {
    bookmarks: Bookmark[];
    folders: string[];
    settings: AppSettings;
    recentSearches: string[];
    lastBackupPrompt: number;
}

export interface BackupData {
    version: string;
    exportDate?: string;
    data: Record<string, unknown>;
    localMedia?: {
        image?: string | null;
        video?: string | null;
    };
}

export interface RecentSite {
    host: string;
    url: string;
    title: string;
    count: number;
    lastVisit: number;
}

export type SettingsSection = keyof AppSettings;

export interface LocalMediaBackup {
    image?: string | null;
    video?: string | null;
}
