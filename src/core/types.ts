export type SearchEngineKey = 'google' | 'bing' | 'baidu' | 'duckduckgo';
export type WallpaperType = 'gradient' | 'preset' | 'local' | 'video';
/** `light` renders dark text for bright wallpapers; `auto` follows the wallpaper brightness. */
export type Theme = 'auto' | 'light' | 'dark';
export type ResolvedTheme = Exclude<Theme, 'auto'>;

export type DockSource = 'bookmarks' | 'recent';
export type GlassMaterial = 'clear' | 'tinted';

export interface LayoutSettings {
    showClock: boolean;
    showSearch: boolean;
    /** Shows the Dock; the key predates the Dock and is kept for old backups. */
    showBookmarks: boolean;
    showStatus: boolean;
    showRecent: boolean;
    openInNewTab: boolean;
    searchEngine: SearchEngineKey;
    dockSource: DockSource;
    dockSize: number;
    dockMagnify: boolean;
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
