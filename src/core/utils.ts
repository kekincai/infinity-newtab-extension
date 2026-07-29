import type { Bookmark } from './types';

export const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NmYxIi8+PHBhdGggZD0iTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=';

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function normalizeUrl(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value.trim())
        ? value.trim()
        : `https://${value.trim()}`;
    try {
        const url = new URL(candidate);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

export function sanitizeRemoteUrl(value: unknown, allowImageData = false): string {
    if (typeof value !== 'string') return '';
    if (allowImageData && value.startsWith('data:image/')) return value;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : '';
    } catch {
        return '';
    }
}

export function cleanText(value: unknown, maxLength: number): string {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function cleanDisplayName(value: unknown): string {
    return cleanText(value, 160)
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/\/.*$/, '');
}

export function truncate(value: unknown, maxLength: number): string {
    const text = String(value ?? '');
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function isManagedFavicon(value: unknown): boolean {
    const icon = String(value ?? '');
    return /^https:\/\/www\.google\.com\/s2\/favicons/i.test(icon)
        || /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(icon);
}

export function faviconUrl(pageUrl: string): string {
    try {
        const favicon = new URL(chrome.runtime.getURL('/_favicon/'));
        favicon.searchParams.set('pageUrl', new URL(pageUrl).href);
        favicon.searchParams.set('size', '64');
        return favicon.toString();
    } catch {
        return DEFAULT_ICON;
    }
}

export function bookmarkIcon(bookmark: Bookmark): string {
    return !bookmark.icon || isManagedFavicon(bookmark.icon)
        ? faviconUrl(bookmark.url)
        : bookmark.icon;
}

export function debounce<T extends (...args: any[]) => void>(callback: T, wait: number): T {
    let timer = 0;
    return ((...args: Parameters<T>) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback(...args), wait);
    }) as T;
}

export function dispatch(name: string, detail?: unknown): CustomEvent {
    return new CustomEvent(name, { detail, bubbles: true, composed: true });
}
