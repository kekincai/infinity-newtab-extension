declare const chrome: any;

interface Navigator {
    /** User-Agent Client Hints (Chromium); `platform` is e.g. “macOS” or “Windows”. */
    userAgentData?: { platform: string; mobile: boolean };
    getBattery?: () => Promise<{
        level: number;
        charging: boolean;
    }>;
}

/** Screen reader announcements without a live region (Chrome 141). */
interface AriaNotificationOptions {
    priority?: 'normal' | 'high';
}

interface Document {
    ariaNotify(announcement: string, options?: AriaNotificationOptions): void;
}

interface Element {
    ariaNotify(announcement: string, options?: AriaNotificationOptions): void;
}
