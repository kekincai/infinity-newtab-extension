/**
 * Keeps the page previewable outside an installed extension without changing
 * extension behavior. Like the real APIs, every method returns a promise.
 */
export function installChromeFallback(): void {
    if ((globalThis as any).chrome?.storage?.sync) return;
    const syncKey = 'infinity-preview-sync';
    const read = (): Record<string, unknown> => JSON.parse(localStorage.getItem(syncKey) || '{}');
    const write = (values: Record<string, unknown>) => localStorage.setItem(syncKey, JSON.stringify(values));
    const sync = {
        async get(keys: unknown): Promise<Record<string, unknown>> {
            const values = read();
            if (keys === null || keys === undefined) return values;
            if (typeof keys === 'string') return { [keys]: values[keys] };
            if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, values[key]]));
            return {};
        },
        async set(next: Record<string, unknown>): Promise<void> {
            write({ ...read(), ...next });
        },
        async remove(keys: string | string[]): Promise<void> {
            const values = read();
            (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete values[key]);
            write(values);
        },
        async clear(): Promise<void> {
            localStorage.removeItem(syncKey);
        },
        async getBytesInUse(): Promise<number> {
            return new TextEncoder().encode(localStorage.getItem(syncKey) ?? '').length;
        }
    };
    (globalThis as any).chrome = {
        runtime: { id: 'preview', getURL: (path: string) => new URL(path, location.href).href },
        storage: {
            sync,
            // Other preview tabs writing to localStorage stand in for other tabs and devices.
            onChanged: {
                addListener(listener: (changes: Record<string, unknown>, areaName: string) => void) {
                    window.addEventListener('storage', (event) => {
                        if (event.key === syncKey) listener({}, 'sync');
                    });
                }
            }
        },
        tabs: {
            query: async () => [],
            update: async () => undefined,
            create: async ({ url }: { url?: string }) => { if (url) window.open(url, '_blank', 'noopener'); }
        },
        windows: { update: async () => undefined },
        downloads: { search: async () => [], show: () => undefined },
        history: { search: async () => [] }
    };
}
