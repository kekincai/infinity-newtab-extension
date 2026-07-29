import type { RecentSite } from './types';

export function rankSites(items: Array<Record<string, unknown>>): RecentSite[] {
    const hosts = new Map<string, RecentSite>();
    items.forEach((item) => {
        try {
            const url = new URL(String(item.url ?? ''));
            if (!['http:', 'https:'].includes(url.protocol)) return;
            const host = url.hostname.replace(/^www\./, '').toLowerCase();
            if (!host || host === 'newtab' || /(^|\.)google\.[a-z.]+$/.test(host)) return;
            const previous = hosts.get(host);
            hosts.set(host, {
                host,
                url: `${url.protocol}//${host}/`,
                title: host.split('.')[0] || host,
                count: (previous?.count ?? 0) + Math.max(1, Number(item.visitCount) || 1),
                lastVisit: Math.max(previous?.lastVisit ?? 0, Number(item.lastVisitTime) || 0)
            });
        } catch {
            // Ignore invalid and browser-internal URLs.
        }
    });
    return [...hosts.values()]
        .sort((left, right) => right.count - left.count || right.lastVisit - left.lastVisit)
        .slice(0, 20);
}
