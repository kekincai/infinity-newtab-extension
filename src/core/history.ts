import type { RecentSite } from './types';
import { isAddressLike, siteLabel } from './utils';

type SiteStats = RecentSite & {
    hostname: string;
    /** Visits per scheme and host as typed (with or without www), to open the one actually used. */
    origins: Map<string, number>;
    /** Visits per page address without query or fragment, to find where the site is entered. */
    pages: Map<string, number>;
    rootTitle: string;
    /** Distinct page titles, to find the site name they share (“图库 · 美图”, “相簿 · 美图” → 美图). */
    titles: Set<string>;
};

/** A title's parts, split at the separators sites put between page and site name. */
const TITLE_SEPARATOR = /\s+[-|–—·]\s+/;

/**
 * The key a site is grouped under: host and port, without a leading www.
 * Different ports on one machine are different apps (minipc.local:8443 and :3000).
 */
export function siteKey(url: string): string {
    try {
        return new URL(url).host.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

/** Groups history by site, keeps the address people actually open and a readable site name. */
export function rankSites(items: Array<Record<string, unknown>>): RecentSite[] {
    const sites = new Map<string, SiteStats>();
    items.forEach((item) => {
        try {
            const url = new URL(String(item.url ?? ''));
            if (!['http:', 'https:'].includes(url.protocol)) return;
            const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
            if (!hostname || hostname === 'newtab' || /(^|\.)google\.[a-z.]+$/.test(hostname)) return;
            const host = siteKey(url.href);
            const visits = Math.max(1, Number(item.visitCount) || 1);
            const stats = sites.get(host) ?? {
                host,
                hostname,
                url: '',
                title: '',
                count: 0,
                lastVisit: 0,
                origins: new Map<string, number>(),
                pages: new Map<string, number>(),
                rootTitle: '',
                titles: new Set<string>()
            };
            stats.count += visits;
            stats.lastVisit = Math.max(stats.lastVisit, Number(item.lastVisitTime) || 0);
            add(stats.origins, url.origin, visits);
            // Only plain pages can be an entry point: /watch?v=1 is a video, not the way in.
            if (!url.search) add(stats.pages, url.pathname, visits);
            const title = typeof item.title === 'string' ? item.title.trim() : '';
            if (title) stats.titles.add(title);
            if (url.pathname === '/' && !url.search && title && !stats.rootTitle) stats.rootTitle = title;
            sites.set(host, stats);
        } catch {
            // Ignore invalid and browser-internal URLs.
        }
    });
    return [...sites.values()]
        .sort((left, right) => right.count - left.count || right.lastVisit - left.lastVisit)
        .slice(0, 20)
        .map(({ origins, pages, rootTitle, titles, hostname, ...site }) => ({
            ...site,
            url: `${top(origins)}${entryPath(pages)}`,
            title: siteName(hostname, rootTitle, titles)
        }));
}

function add(counts: Map<string, number>, key: string, visits: number): void {
    counts.set(key, (counts.get(key) ?? 0) + visits);
}

function top(counts: Map<string, number>): string {
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

/**
 * Where to open the site: its home page when that has been visited. An app
 * that lives under a path and is never opened at the root (a NAS gallery at
 * /gallery/) opens at the section visited most, as /gallery/ or /gallery,
 * whichever form was actually used.
 */
function entryPath(pages: Map<string, number>): string {
    if (pages.has('/') || !pages.size) return '/';
    const sections = new Map<string, number>();
    pages.forEach((visits, path) => {
        const section = path.split('/')[1];
        if (section) add(sections, section, visits);
    });
    if (!sections.size) return '/';
    const section = top(sections);
    const forms = [`/${section}/`, `/${section}`].filter((path) => pages.has(path));
    if (!forms.length) return '/';
    return forms.sort((left, right) => (pages.get(right) ?? 0) - (pages.get(left) ?? 0))[0];
}

/**
 * The site's own name: the part most page titles end with (“… · GitHub”),
 * else the home page title up to its tagline, else one from the host.
 */
function siteName(hostname: string, rootTitle: string, titles: Set<string>): string {
    const shared = sharedSuffix(titles);
    if (shared) return shared;
    const cleaned = rootTitle.replace(/^\(\d+\+?\)\s*/, '').split(TITLE_SEPARATOR)[0].trim();
    if (readable(cleaned)) return cleaned;
    return siteLabel(hostname);
}

function sharedSuffix(titles: Set<string>): string {
    const suffixes = new Map<string, number>();
    titles.forEach((title) => {
        const parts = title.split(TITLE_SEPARATOR);
        if (parts.length > 1) add(suffixes, parts[parts.length - 1].trim(), 1);
    });
    if (!suffixes.size) return '';
    const [suffix, pages] = [...suffixes.entries()].sort((left, right) => right[1] - left[1])[0];
    // Two different pages ending the same way, and most pages do: that ending is the site, not a page.
    return pages >= 2 && pages * 2 >= titles.size && readable(suffix) ? suffix : '';
}

function readable(name: string): boolean {
    return Boolean(name) && name.length <= 18 && !isAddressLike(name);
}

let recentSites: Promise<RecentSite[]> | null = null;

/** One history scan per page load, shared by the bookmark index and the search field. */
export function loadRecentSites(): Promise<RecentSite[]> {
    if (!recentSites) {
        recentSites = new Promise<RecentSite[]>((resolve, reject) => {
            if (!chrome.history?.search) {
                reject(new Error('浏览器未开放历史记录访问'));
                return;
            }
            chrome.history.search({ text: '', startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, maxResults: 3000 }, (items: Array<Record<string, unknown>>) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(rankSites(items ?? []));
            });
        });
        recentSites.catch(() => { recentSites = null; });
    }
    return recentSites;
}
