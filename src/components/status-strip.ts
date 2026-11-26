import { appStore } from '../core/store';
import { escapeHtml, faviconUrl, truncate } from '../core/utils';
import { StoreElement } from './base';
import { ICONS } from './icons';
import { hostOf } from './site-icon';
import { notifyError } from './ui-layer';

type Media = { id: number; windowId: number; title: string; host: string; icon: string; muted: boolean };
type Status = { media: Media | null; downloads: number[]; battery: { level: number; charging: boolean } | null };
type BatteryEvents = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/**
 * Top-right capsules that only appear while media plays, files download or the
 * laptop runs on battery. Chrome and battery events drive it; nothing polls.
 */
export class StatusStrip extends StoreElement {
    protected readonly observedChanges = ['settings.layout'] as const;
    private status: Status = { media: null, downloads: [], battery: null };
    private refreshTimer = 0;
    private refreshToken = 0;
    private battery: BatteryEvents | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        void this.refresh();
        document.addEventListener('visibilitychange', this.onVisibility);
        chrome.tabs?.onUpdated?.addListener(this.onTabUpdated);
        chrome.tabs?.onRemoved?.addListener(this.scheduleRefresh);
        chrome.downloads?.onCreated?.addListener(this.scheduleRefresh);
        chrome.downloads?.onChanged?.addListener(this.scheduleRefresh);
        void navigator.getBattery?.().then((battery) => {
            if (!this.isConnected) return;
            this.battery = battery as unknown as BatteryEvents;
            this.battery.addEventListener?.('levelchange', this.scheduleRefresh);
            this.battery.addEventListener?.('chargingchange', this.scheduleRefresh);
        }).catch(() => undefined);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.clearTimeout(this.refreshTimer);
        document.removeEventListener('visibilitychange', this.onVisibility);
        chrome.tabs?.onUpdated?.removeListener(this.onTabUpdated);
        chrome.tabs?.onRemoved?.removeListener(this.scheduleRefresh);
        chrome.downloads?.onCreated?.removeListener(this.scheduleRefresh);
        chrome.downloads?.onChanged?.removeListener(this.scheduleRefresh);
        this.battery?.removeEventListener?.('levelchange', this.scheduleRefresh);
        this.battery?.removeEventListener?.('chargingchange', this.scheduleRefresh);
        this.battery = null;
    }

    private readonly onVisibility = (): void => {
        if (document.visibilityState === 'visible') void this.refresh();
    };

    /** Only sound starting or stopping, muting, or the playing tab's title matter; page loads elsewhere do not. */
    private readonly onTabUpdated = (tabId: number, change: { audible?: boolean; mutedInfo?: unknown; title?: string }): void => {
        if ('audible' in change || 'mutedInfo' in change || ('title' in change && tabId === this.status.media?.id)) this.scheduleRefresh();
    };

    /** Bursts of events (a download starting fires several) collapse into one read. */
    private readonly scheduleRefresh = (): void => {
        window.clearTimeout(this.refreshTimer);
        this.refreshTimer = window.setTimeout(() => void this.refresh(), 150);
    };

    protected handleStoreChange(): void {
        this.render();
        void this.refresh();
    }

    protected render(): void {
        // A redraw replaces the buttons; whichever one had focus gets it back.
        const focused = this.contains(document.activeElement)
            ? ['media-open', 'media-mute', 'download-capsule'].find((name) => document.activeElement?.classList.contains(name))
            : undefined;
        this.hidden = !appStore.state.settings.layout.showStatus;
        const { media, downloads, battery } = this.status;
        const muteLabel = media?.muted ? '取消静音' : '静音';
        this.innerHTML = [
            media ? `
                <div class="glass glass-dark capsule media-capsule" data-glass>
                    <button class="media-open" type="button" title="切换到正在播放的标签页">
                        <img class="media-art" src="${escapeHtml(media.icon)}" alt="" draggable="false">
                        <span class="capsule-text">
                            <strong>${escapeHtml(truncate(media.title, 28))}</strong>
                            <small>${escapeHtml(media.host)} 标签页${media.muted ? '已静音' : '正在播放'}</small>
                        </span>
                        ${media.muted ? '' : '<span class="equalizer" aria-hidden="true"><span></span><span></span><span></span><span></span></span>'}
                    </button>
                    <button class="media-mute" type="button" aria-label="${muteLabel}" title="${muteLabel}">${media.muted ? ICONS.muted : ICONS.speaker}</button>
                </div>` : '',
            downloads.length ? `<button class="glass glass-dark capsule download-capsule" type="button" data-glass title="在文件夹中显示">${ICONS.download}<span>${downloads.length} 项下载中</span></button>` : '',
            battery ? `<span data-glass class="glass glass-dark capsule battery-capsule ${battery.level <= 0.2 && !battery.charging ? 'is-low' : ''}" title="${battery.charging ? '正在充电' : '正在使用电池'}">${battery.charging ? ICONS.bolt : ICONS.battery}<span class="visually-hidden">${battery.charging ? '正在充电，电量' : '正在使用电池，电量'}</span><span>${Math.round(battery.level * 100)}%</span></span>` : ''
        ].join('');
        if (focused) this.querySelector<HTMLElement>(`.${focused}`)?.focus();
        this.querySelector('.media-open')?.addEventListener('click', () => {
            if (media) void showTab(media).catch(notifyError);
        });
        this.querySelector('.media-mute')?.addEventListener('click', () => {
            if (media) void this.toggleMute(media);
        });
        this.querySelector('.download-capsule')?.addEventListener('click', () => {
            if (downloads[0] === undefined) return;
            try {
                chrome.downloads.show(downloads[0]);
            } catch (error) {
                notifyError(error);
            }
        });
    }

    private async toggleMute(media: Media): Promise<void> {
        try {
            await chrome.tabs.update(media.id, { muted: !media.muted });
        } catch (error) {
            notifyError(error);
        }
        await this.refresh();
    }

    private async refresh(): Promise<void> {
        if (document.visibilityState === 'hidden' || this.hidden) return;
        // Reads can overlap; only the latest one may paint.
        const token = ++this.refreshToken;
        const [tabs, downloads, battery] = await Promise.all([
            settle<any[]>(() => chrome.tabs.query({ audible: true }), []),
            settle<any[]>(() => chrome.downloads.search({ state: 'in_progress' }), []),
            readBattery()
        ]);
        const tab = tabs[0];
        const next: Status = {
            media: tab ? {
                id: tab.id,
                windowId: tab.windowId,
                title: tab.title || '正在播放',
                host: hostOf(tab.url ?? '') || '其他',
                icon: tab.url ? faviconUrl(tab.url, 64) : '',
                muted: Boolean(tab.mutedInfo?.muted)
            } : null,
            downloads: downloads.map((item) => item.id),
            battery
        };
        if (token !== this.refreshToken || JSON.stringify(next) === JSON.stringify(this.status)) return;
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

/** The playing tab may sit in another window; that window comes to the front with it. */
async function showTab(media: Media): Promise<void> {
    await chrome.tabs.update(media.id, { active: true });
    await chrome.windows?.update?.(media.windowId, { focused: true });
}

/** A capsule that cannot be read (an API missing, a call refused) simply stays away. */
async function settle<T>(read: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await read() ?? fallback;
    } catch {
        return fallback;
    }
}
