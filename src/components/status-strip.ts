import { appStore } from '../core/store';
import { escapeHtml, faviconUrl, truncate } from '../core/utils';
import { StoreElement } from './base';
import { ICONS } from './icons';
import { hostOf } from './site-icon';

type Media = { id: number; title: string; host: string; icon: string; muted: boolean };
type Status = { media: Media | null; downloads: number[]; battery: { level: number; charging: boolean } | null };

/** Top-left capsules that only appear while media plays, files download or the laptop runs on battery. */
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
        const muteLabel = media?.muted ? '取消静音' : '静音';
        this.innerHTML = [
            media ? `
                <div class="glass glass-dark capsule media-capsule">
                    <button class="media-open" type="button" title="切换到正在播放的标签页">
                        <img class="media-art" src="${escapeHtml(media.icon)}" alt="" draggable="false">
                        <span class="capsule-text">
                            <strong>${escapeHtml(truncate(media.title, 28))}</strong>
                            <small>${escapeHtml(media.host)} 标签页${media.muted ? '已静音' : '正在播放'}</small>
                        </span>
                        ${media.muted ? '' : '<span class="equalizer" aria-hidden="true"><span></span><span></span><span></span><span></span></span>'}
                    </button>
                    <button class="media-mute" type="button" data-liquid-item aria-label="${muteLabel}" title="${muteLabel}">${media.muted ? ICONS.muted : ICONS.speaker}</button>
                </div>` : '',
            downloads.length ? `<button class="glass glass-dark capsule download-capsule" type="button" data-liquid-item title="在文件夹中显示">${ICONS.download}<span>${downloads.length} 项下载中</span></button>` : '',
            battery ? `<span class="glass glass-dark capsule battery-capsule ${battery.level <= 0.2 && !battery.charging ? 'is-low' : ''}" title="${battery.charging ? '正在充电' : '正在使用电池'}">${battery.charging ? ICONS.bolt : ICONS.battery}<span>${Math.round(battery.level * 100)}%</span></span>` : ''
        ].join('');
        this.querySelector('.media-open')?.addEventListener('click', () => {
            if (media) chrome.tabs.update(media.id, { active: true });
        });
        this.querySelector('.media-mute')?.addEventListener('click', () => {
            if (!media) return;
            void Promise.resolve(chrome.tabs.update(media.id, { muted: !media.muted })).finally(() => void this.refresh());
        });
        this.querySelector('.download-capsule')?.addEventListener('click', () => {
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
        const tab = tabs[0];
        const next: Status = {
            media: tab ? {
                id: tab.id,
                title: tab.title || '正在播放',
                host: hostOf(tab.url ?? '') || '其他',
                icon: tab.url ? faviconUrl(tab.url, 64) : '',
                muted: Boolean(tab.mutedInfo?.muted)
            } : null,
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
