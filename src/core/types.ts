export type SearchEngineKey = 'google' | 'bing' | 'baidu' | 'duckduckgo';
/** `gradient` is the built-in Twilight Bay scene; `local` is a cached picture, uploaded or downloaded. */
export type WallpaperType = 'gradient' | 'local' | 'video';
/** `light` renders dark text for bright wallpapers; `auto` follows the wallpaper brightness. */
export type Theme = 'auto' | 'light' | 'dark';
export type ResolvedTheme = Exclude<Theme, 'auto'>;

export type GlassMaterial = 'clear' | 'tinted';

export interface LayoutSettings {
    showClock: boolean;
    showSearch: boolean;
    /** Shows the bookmark index along the bottom of the home screen. */
    showBookmarks: boolean;
    showStatus: boolean;
    showRecent: boolean;
    openInNewTab: boolean;
    searchEngine: SearchEngineKey;
    saveSearches: boolean;
    backupReminder: boolean;
}

/**
 * How the wallpaper is framed, independent of the window size: `scale` is
 * relative to just filling the window (1), and `x`/`y` are the point of the
 * picture (0–1 across and down) shown at the centre of the window.
 */
export interface WallpaperFraming {
    scale: number;
    x: number;
    y: number;
}

export interface WallpaperSettings {
    type: WallpaperType;
    value: string;
    blur: number;
    overlay: number;
    framing: WallpaperFraming;
    idleHide: boolean;
    pauseOnBattery: boolean;
    pauseWhenHidden: boolean;
    sound: boolean;
}

export interface AppearanceSettings {
    clockFormat: '12h' | '24h';
    dateFormat: 'short' | 'long';
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
    localMedia?: LocalMediaBackup;
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
