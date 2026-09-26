import { appStore } from '../core/store';
import { escapeHtml, truncate } from '../core/utils';
import { StoreElement } from './base';
import { ICONS } from './icons';

type Status = { media: { id: number; title: string } | null; downloads: number[]; battery: { level: number; charging: boolean } | null };

/** Quiet top-left strip: it only shows media, downloads and battery when there is something to say. */
export class StatusStrip extends StoreElement {
    protected readonly observedChanges = ['settings.layout'] as const;
    private timer = 0;
    private status: Status = { media: null, downloads: [], battery: null };

    connectedCallback(): void {
        super.connectedCallback();
        void this.refresh();
        this.timer = window.setInterval(() => void this.refresh(), 5000);
        document.addEventListener('visibilitychange', this.onVisibility);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.clearInterval(this.timer);
        document.removeEventListener('visibilitychange', this.onVisibility);
    }

    private readonly onVisibility = (): void => {
        if (document.visibilityState === 'visible') void this.refresh();
    };

    protected handleStoreChange(): void {
        this.render();
        void this.refresh();
    }

    protected render(): void {
        this.hidden = !appStore.state.settings.layout.showStatus;
        const { media, downloads, battery } = this.status;
        const chips = [
            media ? `<button class="status-chip is-media" type="button" data-liquid-item title="切换到正在播放的标签页">${ICONS.play}<span>${escapeHtml(truncate(media.title, 26))}</span></button>` : '',
            downloads.length ? `<button class="status-chip is-download" type="button" data-liquid-item title="在文件夹中显示">${ICONS.download}<span>${downloads.length} 项下载中</span></button>` : '',
            battery ? `<span class="status-chip battery-chip ${battery.level <= 0.2 && !battery.charging ? 'is-low' : ''}">${battery.charging ? ICONS.bolt : ICONS.battery}<span>${Math.round(battery.level * 100)}%</span></span>` : ''
        ].join('');
        this.innerHTML = chips;
        this.querySelector('.is-media')?.addEventListener('click', () => {
            if (media) chrome.tabs.update(media.id, { active: true });
        });
        this.querySelector('.is-download')?.addEventListener('click', () => {
            if (downloads[0] !== undefined) chrome.downloads.show(downloads[0]);
        });
    }

    private async refresh(): Promise<void> {
        if (document.visibilityState === 'hidden' || this.hidden) return;
        const [tabs, downloads, battery] = await Promise.all([
            chrome.tabs?.query ? callbackResult<any[]>((done) => chrome.tabs.query({ audible: true }, done), []) : [],
            chrome.downloads?.search ? callbackResult<any[]>((done) => chrome.downloads.search({ state: 'in_progress' }, done), []) : [],
            readBattery()
        ]);
        const next: Status = {
            media: tabs[0] ? { id: tabs[0].id, title: tabs[0].title || '正在播放' } : null,
            downloads: downloads.map((item) => item.id),
            battery
        };
        if (JSON.stringify(next) === JSON.stringify(this.status)) return;
        this.status = next;
        this.render();
    }
}

/** Desktops report a permanently full, charging battery; hide it there. */
async function readBattery(): Promise<Status['battery']> {
    try {
        const battery = await navigator.getBattery?.();
        if (!battery || !Number.isFinite(battery.level)) return null;
        if (battery.charging && battery.level >= 1) return null;
        return { level: battery.level, charging: battery.charging };
    } catch {
        return null;
    }
}

function callbackResult<T>(start: (done: (result: T) => void) => void, fallback: T): Promise<T> {
    return new Promise((resolve) => {
        try {
            start((result) => resolve(chrome.runtime.lastError ? fallback : result));
        } catch {
            resolve(fallback);
        }
    });
}
