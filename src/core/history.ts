import type { RecentSite } from './types';

type HostStats = RecentSite & { hostnames: Map<string, number>; rootTitle: string };

/** Groups history by site, keeps the hostname people actually visit and a readable site name. */
export function rankSites(items: Array<Record<string, unknown>>): RecentSite[] {
    const hosts = new Map<string, HostStats>();
    items.forEach((item) => {
        try {
            const url = new URL(String(item.url ?? ''));
            if (!['http:', 'https:'].includes(url.protocol)) return;
            const hostname = url.hostname.toLowerCase();
            const host = hostname.replace(/^www\./, '');
            if (!host || host === 'newtab' || /(^|\.)google\.[a-z.]+$/.test(host)) return;
            const visits = Math.max(1, Number(item.visitCount) || 1);
            const stats = hosts.get(host) ?? {
                host,
                url: '',
                title: '',
                count: 0,
                lastVisit: 0,
                hostnames: new Map<string, number>(),
                rootTitle: ''
            };
            stats.count += visits;
            stats.lastVisit = Math.max(stats.lastVisit, Number(item.lastVisitTime) || 0);
            stats.hostnames.set(`${url.protocol}//${hostname}`, (stats.hostnames.get(`${url.protocol}//${hostname}`) ?? 0) + visits);
            const title = typeof item.title === 'string' ? item.title.trim() : '';
            if (url.pathname === '/' && !url.search && title && !stats.rootTitle) stats.rootTitle = title;
            hosts.set(host, stats);
        } catch {
            // Ignore invalid and browser-internal URLs.
        }
    });
    return [...hosts.values()]
        .sort((left, right) => right.count - left.count || right.lastVisit - left.lastVisit)
        .slice(0, 20)
        .map(({ hostnames, rootTitle, ...site }) => {
            const origin = [...hostnames.entries()].sort((left, right) => right[1] - left[1])[0][0];
            return { ...site, url: `${origin}/`, title: siteName(site.host, rootTitle) };
        });
}

function siteName(host: string, rootTitle: string): string {
    const cleaned = rootTitle.replace(/^\(\d+\+?\)\s*/, '').split(/\s+[-|–—·]\s+/)[0].trim();
    if (cleaned && cleaned.length <= 18) return cleaned;
    return host;
}
