import { appStore } from '../core/store';
import { StoreElement } from './base';

/** Centered clock and date; re-renders only when its layout or format settings change. */
export class DashboardHeader extends StoreElement {
    protected readonly observedChanges = ['settings.layout', 'settings.appearance'] as const;
    private clockTimer = 0;

    connectedCallback(): void {
        super.connectedCallback();
        this.scheduleTick();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.clearTimeout(this.clockTimer);
    }

    protected render(): void {
        this.hidden = !appStore.state.settings.layout.showClock;
        if (!this.querySelector('.hero-time')) {
            this.innerHTML = '<time class="hero-time" id="time">--:--</time><span class="hero-date" id="date"></span>';
        }
        this.updateClock();
    }

    /** Wakes up on the minute boundary instead of polling every second. */
    private scheduleTick(): void {
        window.clearTimeout(this.clockTimer);
        const now = new Date();
        const delay = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20;
        this.clockTimer = window.setTimeout(() => {
            this.updateClock();
            this.scheduleTick();
        }, delay);
    }

    private updateClock(): void {
        const time = this.querySelector<HTMLTimeElement>('#time');
        const date = this.querySelector('#date');
        if (!time || !date) return;
        const now = new Date();
        const { clockFormat, dateFormat } = appStore.state.settings.appearance;
        time.dateTime = now.toISOString();
        time.textContent = now.toLocaleTimeString('zh-CN', {
            hour: '2-digit', minute: '2-digit', hour12: clockFormat === '12h'
        });
        date.textContent = now.toLocaleDateString('zh-CN', dateFormat === 'long'
            ? { month: 'long', day: 'numeric', weekday: 'long' }
            : { month: 'numeric', day: 'numeric', weekday: 'short' });
    }
}
