import type { Bookmark } from './types';

/**
 * chrome.storage.sync caps every item at 8 KB, so one `bookmarks` array stops
 * saving after roughly fifty entries. Bookmarks are split into numbered chunks
 * that each stay under the per-item limit; the legacy key is still read.
 */
export const LEGACY_BOOKMARKS_KEY = 'bookmarks';
export const BOOKMARK_CHUNKS_KEY = 'bookmarkChunks';
const CHUNK_PREFIX = 'bookmarks.';
const ITEM_BUDGET = 7600;

export function bookmarkChunkKey(index: number): string {
    return `${CHUNK_PREFIX}${index}`;
}

export function encodeBookmarks(bookmarks: Bookmark[]): { values: Record<string, unknown>; count: number } {
    const encoder = new TextEncoder();
    const chunks: Bookmark[][] = [];
    let current: Bookmark[] = [];
    let size = 2;
    bookmarks.forEach((bookmark) => {
        const bytes = encoder.encode(JSON.stringify(bookmark)).length + 1;
        if (bytes + 2 > ITEM_BUDGET) throw new Error(`书签“${bookmark.name}”数据过大，无法同步`);
        if (current.length && size + bytes > ITEM_BUDGET) {
            chunks.push(current);
            current = [];
            size = 2;
        }
        current.push(bookmark);
        size += bytes;
    });
    if (current.length) chunks.push(current);
    const values: Record<string, unknown> = { [BOOKMARK_CHUNKS_KEY]: chunks.length };
    chunks.forEach((chunk, index) => { values[bookmarkChunkKey(index)] = chunk; });
    return { values, count: chunks.length };
}

export function decodeBookmarks(stored: Record<string, unknown>): unknown[] {
    const count = stored[BOOKMARK_CHUNKS_KEY];
    if (typeof count === 'number' && Number.isInteger(count) && count >= 0) {
        return Array.from({ length: count }, (_, index) => stored[bookmarkChunkKey(index)])
            .flatMap((chunk) => Array.isArray(chunk) ? chunk : []);
    }
    const legacy = stored[LEGACY_BOOKMARKS_KEY];
    return Array.isArray(legacy) ? legacy : [];
}

export function storedChunkCount(stored: Record<string, unknown>): number {
    const count = stored[BOOKMARK_CHUNKS_KEY];
    return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : 0;
}

/** Keys left over after a save that produced `nextCount` chunks. */
export function staleBookmarkKeys(previousCount: number, nextCount: number, hasLegacy: boolean): string[] {
    const keys = hasLegacy ? [LEGACY_BOOKMARKS_KEY] : [];
    for (let index = nextCount; index < previousCount; index += 1) keys.push(bookmarkChunkKey(index));
    return keys;
}
