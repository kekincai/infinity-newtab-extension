import type { Bookmark } from './types';

export const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NmYxIi8+PHBhdGggZD0iTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=';
const BOOKMARK_PROTOCOLS = new Set(['http:', 'https:', 'chrome-extension:']);
/** Hosts that usually serve plain HTTP: this machine, IP addresses and the local network. */
const LOCAL_HOST = /^(localhost|.+\.localhost|.+\.local|\d{1,3}(\.\d{1,3}){3}|\[[\da-f:.]+\])$/i;

/** Bookmarks outside any folder are stored under this name, as they were in every earlier version. */
export const ROOT_FOLDER = '全部';

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/** Adds a scheme when there is none: https for the web, http for local servers such as `localhost:3000`. */
export function normalizeUrl(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    const text = value.trim();
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(text);
    try {
        let url = new URL(hasScheme ? text : `https://${text}`);
        if (!hasScheme && LOCAL_HOST.test(url.hostname)) url = new URL(`http://${text}`);
        return BOOKMARK_PROTOCOLS.has(url.protocol) && url.hostname ? url.href : '';
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

const TWO_LEVEL_SUFFIXES = new Set([
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'com.hk', 'com.tw', 'co.jp', 'ne.jp', 'or.jp',
    'co.kr', 'co.uk', 'org.uk', 'ac.uk', 'com.au', 'co.nz', 'com.br', 'co.in', 'com.sg'
]);

/** Sites better known by another name than their host. */
const HOST_NAMES: Record<string, string> = {
    'mail.google.com': 'Gmail',
    'docs.google.com': 'Google 文档',
    'drive.google.com': 'Google 云端硬盘',
    'translate.google.com': 'Google 翻译',
    'maps.google.com': 'Google 地图',
    'music.youtube.com': 'YouTube Music',
    'news.ycombinator.com': 'Hacker News',
    'developer.mozilla.org': 'MDN',
    'chat.openai.com': 'ChatGPT'
};

/** The usual spelling of names that plain capitalisation gets wrong. */
const BRAND_NAMES: Record<string, string> = {
    '163': '网易',
    baidu: '百度',
    bgm: 'Bangumi',
    bilibili: 'Bilibili',
    chatgpt: 'ChatGPT',
    douban: '豆瓣',
    github: 'GitHub',
    icloud: 'iCloud',
    jd: '京东',
    linkedin: 'LinkedIn',
    moegirl: '萌娘百科',
    myanimelist: 'MyAnimeList',
    npmjs: 'npm',
    openai: 'OpenAI',
    pixiv: 'pixiv',
    qq: 'QQ',
    sspai: '少数派',
    stackoverflow: 'Stack Overflow',
    taobao: '淘宝',
    v2ex: 'V2EX',
    weibo: '微博',
    youtube: 'YouTube',
    zhihu: '知乎'
};

/** “www.github.com” → “GitHub”, “example.co.uk” → “Example”: a site's name without its domain suffix. */
export function siteLabel(hostname: string): string {
    const host = hostname.toLowerCase().replace(/^www\./, '');
    if (HOST_NAMES[host]) return HOST_NAMES[host];
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return host;
    const parts = host.split('.');
    const suffix = parts.length > 2 && TWO_LEVEL_SUFFIXES.has(parts.slice(-2).join('.')) ? 2 : 1;
    const label = parts[parts.length - suffix - 1] ?? host;
    return BRAND_NAMES[label] ?? label.charAt(0).toUpperCase() + label.slice(1);
}

/** True for names that are only an address, such as “www.google.com” or “https://v2ex.com/”. */
export function isAddressLike(value: string): boolean {
    return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i.test(value.trim());
}

export function truncate(value: unknown, maxLength: number): string {
    const text = String(value ?? '');
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Icon addresses that point at a favicon service (Google's, or Chrome's own)
 * are served from Chrome's local favicon cache instead, so showing a bookmark
 * never sends its address to a third party.
 */
export function isManagedFavicon(value: unknown): boolean {
    const icon = String(value ?? '');
    return /^https:\/\/www\.google\.com\/s2\/favicons/i.test(icon)
        || /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(icon);
}

export function faviconUrl(pageUrl: string, size = 128): string {
    try {
        const favicon = new URL(chrome.runtime.getURL('/_favicon/'));
        favicon.searchParams.set('pageUrl', new URL(pageUrl).href);
        favicon.searchParams.set('size', String(size));
        return favicon.toString();
    } catch {
        return DEFAULT_ICON;
    }
}

export function faviconSrcSet(pageUrl: string): string {
    return [64, 128, 256]
        .map((size) => `${faviconUrl(pageUrl, size)} ${size}w`)
        .join(', ');
}

export function bookmarkIcon(bookmark: Bookmark): string {
    return !bookmark.icon || isManagedFavicon(bookmark.icon)
        ? faviconUrl(bookmark.url)
        : bookmark.icon;
}

export function bookmarkIconSrcSet(bookmark: Bookmark): string {
    return !bookmark.icon || isManagedFavicon(bookmark.icon)
        ? faviconSrcSet(bookmark.url)
        : '';
}

export function bookmarkIconCanUpgrade(bookmark: Bookmark): boolean {
    return Boolean(bookmark.icon && !isManagedFavicon(bookmark.icon));
}

export function bookmarkIconFallback(bookmark: Bookmark): string {
    return bookmark.icon && !isManagedFavicon(bookmark.icon)
        ? faviconUrl(bookmark.url)
        : DEFAULT_ICON;
}

export function compareBookmarks(left: Bookmark, right: Bookmark): number {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
}
