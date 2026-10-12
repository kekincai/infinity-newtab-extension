import type { Bookmark } from '../core/types';
import {
    bookmarkIcon,
    bookmarkIconCanUpgrade,
    bookmarkIconFallback,
    bookmarkIconIsRaster,
    bookmarkIconSrcSet,
    cleanDisplayName,
    escapeHtml,
    faviconSrcSet,
    faviconUrl
} from '../core/utils';

/** Letter tiles stand in for sites whose favicon cannot be loaded. */
const TILE_COLORS: Array<[string, string, string]> = [
    ['#3a414a', '#0d1117', '#ffffff'],
    ['#ff5f57', '#d42a22', '#ffffff'],
    ['#ffd76a', '#f4a320', '#5a3800'],
    ['#ff8db8', '#e0447c', '#ffffff'],
    ['#b9a2ff', '#7446f5', '#ffffff'],
    ['#4fb0ff', '#0a68ec', '#ffffff'],
    ['#53d891', '#169a55', '#ffffff'],
    ['#ffa35c', '#f06a12', '#ffffff'],
    ['#8b8ff8', '#5056d8', '#ffffff']
];

type IconSource = { url: string; name: string; bookmark?: Bookmark };

export function siteIcon({ url, name, bookmark }: IconSource, className = ''): string {
    const host = hostOf(url);
    const letter = Array.from(cleanDisplayName(name) || host || '?')[0]?.toUpperCase() ?? '?';
    const [from, to, ink] = TILE_COLORS[hash(host) % TILE_COLORS.length];
    const image = bookmark
        ? `<img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="96px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" data-icon-raster="${bookmarkIconIsRaster(bookmark)}" alt="" decoding="async" draggable="false">`
        : `<img src="${escapeHtml(faviconUrl(url))}" srcset="${escapeHtml(faviconSrcSet(url))}" sizes="96px" alt="" loading="lazy" decoding="async" draggable="false">`;
    return `<span class="app-icon ${className}" style="--tile-from:${from};--tile-to:${to};--tile-ink:${ink}">${image}<span class="app-letter" aria-hidden="true">${escapeHtml(letter)}</span></span>`;
}

/** Custom icon → Chrome favicon → letter tile. Tiny custom rasters upgrade to the favicon. */
export function bindSiteIcons(root: ParentNode): void {
    root.querySelectorAll<HTMLImageElement>('.app-icon > img').forEach((image) => {
        if (image.dataset.bound) return;
        image.dataset.bound = 'true';
        const tile = image.parentElement!;
        const fallback = image.dataset.iconFallback;
        const useFallback = () => {
            if (!fallback || image.dataset.fallbackUsed === 'true' || fallback.startsWith('data:')) {
                tile.classList.add('is-letter');
                return;
            }
            image.dataset.fallbackUsed = 'true';
            image.removeAttribute('srcset');
            image.src = fallback;
        };
        image.addEventListener('load', () => {
            if (image.dataset.iconCanUpgrade === 'true'
                && image.dataset.fallbackUsed !== 'true'
                && image.naturalWidth > 0
                && image.naturalWidth < 64) {
                useFallback();
            }
        });
        image.addEventListener('error', useFallback);
        if (image.complete && image.naturalWidth === 0 && image.getAttribute('src')) useFallback();
    });
}

export function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function hash(value: string): number {
    let result = 0;
    for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
    return result;
}
