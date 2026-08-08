import { appStore } from '../core/store';
import { rankSites } from '../core/history';
import type { RecentSite } from '../core/types';
import { escapeHtml, faviconSrcSet, faviconUrl, truncate } from '../core/utils';
import { StoreElement } from './base';

export class RecentSites extends StoreElement {
    protected readonly observedChanges = ['settings.layout'] as const;
    private sites: RecentSite[] = [];
    private loading = true;
    private error = '';
    private loaded = false;

    connectedCallback(): void {
        super.connectedCallback();
        if (!this.loaded) void this.load();
    }

    protected render(): void {
        this.hidden = !appStore.state.settings.layout.showRecent;
        this.innerHTML = `
            <section class="glass-panel recent-panel" data-liquid-item>
                <header class="recent-header">
                    <div><span class="section-kicker">常访问</span><h2>最近常访问的网站</h2></div>
                    <div class="recent-actions"><button class="glass-button refresh-recent" type="button" data-liquid-item>刷新</button></div>
                </header>
                <div class="recent-viewport">
                    <div class="recent-track">
                        ${this.contentTemplate()}
                    </div>
                </div>
            </section>
        `;
        this.querySelector('.refresh-recent')?.addEventListener('click', () => void this.load());
        this.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
            image.addEventListener('error', () => { image.style.opacity = '0.3'; });
        });
    }

    private contentTemplate(): string {
        if (this.loading) return '<div class="recent-message">正在整理浏览记录…</div>';
        if (this.error) return `<div class="recent-message">${escapeHtml(this.error)}</div>`;
        if (!this.sites.length) return '<div class="recent-message">暂无可展示的历史记录</div>';
        return this.sites.map((site) => `
            <a class="recent-card" href="${escapeHtml(site.url)}" data-liquid-item rel="noreferrer">
                <span class="recent-icon"><img src="${escapeHtml(faviconUrl(site.url))}" srcset="${escapeHtml(faviconSrcSet(site.url))}" sizes="34px" alt="" loading="lazy" decoding="async"></span>
                <span class="recent-copy"><strong>${escapeHtml(truncate(site.title, 20))}</strong><small>${escapeHtml(site.host)}</small></span>
            </a>
        `).join('');
    }

    private async load(): Promise<void> {
        this.loaded = true;
        this.loading = true;
        this.error = '';
        this.render();
        if (!chrome.history?.search) {
            this.loading = false;
            this.error = '浏览器未开放历史记录访问';
            this.render();
            return;
        }
        try {
            const items = await new Promise<any[]>((resolve, reject) => {
                chrome.history.search({
                    text: '', startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, maxResults: 5000
                }, (result: any[]) => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(result ?? []);
                });
            });
            this.sites = rankSites(items);
        } catch {
            this.error = '读取历史记录失败';
        } finally {
            this.loading = false;
            this.render();
        }
    }
}
