/** Keeps the page previewable outside an installed extension without changing extension behavior. */
export function installChromeFallback(): void {
    if ((globalThis as any).chrome?.storage?.sync) return;
    const makeArea = (name: string) => ({
        get(keys: unknown, callback: (value: Record<string, unknown>) => void) {
            const values = JSON.parse(localStorage.getItem(name) || '{}') as Record<string, unknown>;
            if (keys === null || keys === undefined) callback({ ...values });
            else if (typeof keys === 'string') callback({ [keys]: values[keys] });
            else if (Array.isArray(keys)) callback(Object.fromEntries(keys.map((key) => [key, values[key]])));
            else callback({});
        },
        set(next: Record<string, unknown>, callback: () => void = () => undefined) {
            const values = JSON.parse(localStorage.getItem(name) || '{}') as Record<string, unknown>;
            localStorage.setItem(name, JSON.stringify({ ...values, ...next }));
            callback();
        },
        remove(keys: string | string[], callback: () => void = () => undefined) {
            const values = JSON.parse(localStorage.getItem(name) || '{}') as Record<string, unknown>;
            (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete values[key]);
            localStorage.setItem(name, JSON.stringify(values));
            callback();
        },
        clear(callback: () => void = () => undefined) {
            localStorage.removeItem(name);
            callback();
        }
    });
    (globalThis as any).chrome = {
        runtime: { id: 'preview', lastError: null, getURL: (path: string) => new URL(path, location.href).href },
        storage: { sync: makeArea('infinity-preview-sync'), local: makeArea('infinity-preview-local') },
        tabs: { query: (_query: unknown, done: (value: unknown[]) => void) => done([]), update: () => undefined },
        downloads: { search: (_query: unknown, done: (value: unknown[]) => void) => done([]), show: () => undefined },
        history: { search: (_query: unknown, done: (value: unknown[]) => void) => done([]) }
    };
}
