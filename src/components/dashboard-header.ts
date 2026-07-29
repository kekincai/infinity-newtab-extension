import { appStore } from '../core/store';
import { truncate } from '../core/utils';
import { StoreElement } from './base';

export class DashboardHeader extends StoreElement {
    private clockTimer = 0;
    private statusTimer = 0;

    connectedCallback(): void {
        super.connectedCallback();
        this.updateClock();
        this.clockTimer = window.setInterval(() => this.updateClock(), 1000);
        void this.updateStatus();
        this.statusTimer = window.setInterval(() => void this.updateStatus(), 8000);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.clearInterval(this.clockTimer);
        window.clearInterval(this.statusTimer);
    }

    protected render(): void {
        const { layout } = appStore.state.settings;
        this.innerHTML = `
            <div class="time-row" ${layout.showClock ? '' : 'hidden'}>
                <time class="hero-time" id="time">--:--</time>
                <span class="hero-date" id="date">----</span>
            </div>
            <div class="status-grid" ${layout.showStatus ? '' : 'hidden'}>
                <article class="glass-panel status-panel status-panel-wide" data-liquid-item>
                    <span class="section-kicker">活动</span>
                    <div class="status-pills">
                        <button class="status-chip is-media" type="button" data-liquid-item>无媒体播放</button>
                        <button class="status-chip is-download" type="button" data-liquid-item>无下载</button>
                    </div>
                </article>
                <article class="glass-panel status-panel" data-liquid-item>
                    <span class="section-kicker">系统</span>
                    <div class="status-pills system-pills">
                        <span class="status-chip cpu-chip">CPU: --</span>
                        <span class="status-chip memory-chip">内存: --</span>
                        <span class="status-chip battery-chip">电池: --</span>
                    </div>
                </article>
            </div>
        `;
        this.updateClock();
        void this.updateStatus();
    }

    private updateClock(): void {
        const time = this.querySelector('#time');
        const date = this.querySelector('#date');
        if (!time || !date) return;
        const now = new Date();
        const { clockFormat, dateFormat } = appStore.state.settings.appearance;
        time.textContent = now.toLocaleTimeString('zh-CN', {
            hour: '2-digit', minute: '2-digit', hour12: clockFormat === '12h'
        });
        date.textContent = now.toLocaleDateString('zh-CN', dateFormat === 'long'
            ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }
            : { month: 'numeric', day: 'numeric', weekday: 'short' });
    }

    private async updateStatus(): Promise<void> {
        const cpu = this.querySelector('.cpu-chip');
        const memory = this.querySelector('.memory-chip');
        if (cpu) cpu.textContent = `CPU: ${navigator.hardwareConcurrency || '--'} 线程`;
        if (memory) memory.textContent = `内存: ${navigator.deviceMemory ? `≈ ${navigator.deviceMemory} GB` : '不可用'}`;
        await Promise.all([this.updateMedia(), this.updateDownloads(), this.updateBattery()]);
    }

    private async updateMedia(): Promise<void> {
        const button = this.querySelector<HTMLButtonElement>('.is-media');
        if (!button || !chrome.tabs?.query) return;
        const tabs = await callbackResult<any[]>((done) => chrome.tabs.query({ audible: true }, done), []);
        const tab = tabs[0];
        button.textContent = tab ? `播放中：${truncate(tab.title || '媒体', 28)}` : '无媒体播放';
        button.disabled = !tab;
        button.onclick = tab ? () => chrome.tabs.update(tab.id, { active: true }) : null;
    }

    private async updateDownloads(): Promise<void> {
        const button = this.querySelector<HTMLButtonElement>('.is-download');
        if (!button || !chrome.downloads?.search) return;
        const downloads = await callbackResult<any[]>((done) => chrome.downloads.search({ state: 'in_progress' }, done), []);
        button.textContent = downloads.length ? `下载中：${downloads.length} 项` : '无下载';
        button.disabled = !downloads.length;
        button.onclick = downloads.length ? () => chrome.downloads.show(downloads[0].id) : null;
    }

    private async updateBattery(): Promise<void> {
        const chip = this.querySelector('.battery-chip');
        if (!chip) return;
        if (!navigator.getBattery) {
            chip.textContent = '电池: 不可用';
            return;
        }
        try {
            const battery = await navigator.getBattery();
            chip.textContent = `电池: ${Math.round(battery.level * 100)}%${battery.charging ? ' ⚡' : ''}`;
        } catch {
            chip.textContent = '电池: 不可用';
        }
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
