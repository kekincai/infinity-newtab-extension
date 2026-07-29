export type SearchEngineKey = 'google' | 'bing' | 'baidu' | 'duckduckgo';
export type WallpaperType = 'gradient' | 'preset' | 'local' | 'video';
export type Theme = 'light' | 'dark';

export interface LayoutSettings {
    showClock: boolean;
    showSearch: boolean;
    showBookmarks: boolean;
    showStatus: boolean;
    showRecent: boolean;
    searchEngine: SearchEngineKey;
}

export interface WallpaperSettings {
    type: WallpaperType;
    value: string;
    blur: number;
    overlay: number;
}

export interface AppearanceSettings {
    clockFormat: '12h' | '24h';
    dateFormat: 'short' | 'long';
    enhancedAnimations: boolean;
    theme: Theme;
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
