import { type GlassRim, HdrRimLayer, MAX_RIMS } from './hdr-glass';
import { type OpticalShape, createRefractionMap, opticalShapeKey } from './liquid-optics';

const GLASS_SELECTOR = '[data-glass]';
/** Share of the physical rim bend that is applied; the full value smears small controls. */
const REFRACTION = 0.5;
/** Frost under the bend, in px of Gaussian deviation. */
const FROST = 1.2;
const SATURATION = 1.6;
/** How long rims keep being re-measured after the page changes, so fades and slides are followed. */
const SETTLE_MS = 700;

type Tracked = { shapeKey: string; glint: number };

/**
 * Every `[data-glass]` control is its own piece of glass: an SVG filter sized
 * to it bends the backdrop at the rim, a light follows the pointer across it,
 * and on HDR screens a WebGPU layer draws the rim above SDR white.
 */
export class GlassSystem extends HTMLElement {
    private readonly defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    private readonly filters = new Map<string, string>();
    private readonly tracked = new Map<HTMLElement, Tracked>();
    private readonly hdr = new HdrRimLayer();
    private readonly resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => this.refract(entry.target as HTMLElement));
        this.wake();
    });
    private readonly mutationObserver = new MutationObserver(() => {
        this.scan();
        this.wake();
    });
    private hovered: HTMLElement | null = null;
    private pointer = { x: -1e4, y: -1e4 };
    private smoothPointer = { x: -1e4, y: -1e4 };
    private settleUntil = 0;
    private frame = 0;

    connectedCallback(): void {
        this.defs.classList.add('glass-filters');
        this.defs.setAttribute('aria-hidden', 'true');
        this.defs.innerHTML = '<defs></defs>';
        this.append(this.defs, this.hdr.canvas);
        this.hdr.connect();
        this.scan();
        this.mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
        document.addEventListener('pointermove', this.onPointerMove, { passive: true, capture: true });
        document.addEventListener('pointerleave', this.onPointerLeave);
        window.addEventListener('scroll', this.wake, { passive: true, capture: true });
        window.addEventListener('resize', this.wake);
        this.wake();
    }

    disconnectedCallback(): void {
        this.resizeObserver.disconnect();
        this.mutationObserver.disconnect();
        document.removeEventListener('pointermove', this.onPointerMove, true);
        document.removeEventListener('pointerleave', this.onPointerLeave);
        window.removeEventListener('scroll', this.wake, true);
        window.removeEventListener('resize', this.wake);
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.hdr.disconnect();
    }

    /** Picks up glass controls added since the last look and forgets removed ones. */
    private scan(): void {
        document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((element) => {
            if (this.tracked.has(element)) return;
            this.tracked.set(element, { shapeKey: '', glint: 0 });
            this.resizeObserver.observe(element);
        });
        this.tracked.forEach((_state, element) => {
            if (element.isConnected) return;
            this.tracked.delete(element);
            this.resizeObserver.unobserve(element);
        });
    }

    /** Points the control's backdrop at a filter built for its exact size and corner radius. */
    private refract(element: HTMLElement): void {
        const state = this.tracked.get(element);
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        if (!state || !width || !height) return;
        const radius = cornerRadius(getComputedStyle(element).borderTopLeftRadius, width, height);
        const shape = { width, height, radius };
        const key = opticalShapeKey(shape);
        if (state.shapeKey === key) return;
        state.shapeKey = key;
        const id = this.filters.get(key) ?? this.createFilter(shape, key);
        element.style.setProperty('--glass-backdrop', `url("#${id}") saturate(${SATURATION}) brightness(1.04)`);
        element.dataset.glassFilter = id;
    }

    private createFilter(shape: OpticalShape, key: string): string {
        const map = createRefractionMap(shape);
        const id = `glass-refraction-${this.filters.size + 1}`;
        const bend = Math.min(map.maximumDisplacement, shape.radius * 3) * REFRACTION;
        this.defs.firstElementChild!.insertAdjacentHTML('beforeend', `
            <filter id="${id}" color-interpolation-filters="sRGB" data-shape="${key}">
                <feGaussianBlur in="SourceGraphic" stdDeviation="${FROST}" result="frost"></feGaussianBlur>
                <feImage href="${map.displacement}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="bend"></feImage>
                <feDisplacementMap in="frost" in2="bend" scale="${bend.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
            </filter>`);
        this.filters.set(key, id);
        return id;
    }

    private readonly onPointerMove = (event: PointerEvent): void => {
        this.pointer = { x: event.clientX, y: event.clientY };
        const element = event.target instanceof Element ? event.target.closest<HTMLElement>(GLASS_SELECTOR) : null;
        if (element !== this.hovered) {
            this.hovered = element;
            if (this.smoothPointer.x < -1e3) this.smoothPointer = { ...this.pointer };
        }
        if (element) {
            // The CSS light under the pointer; :hover fades it in and out.
            const rect = element.getBoundingClientRect();
            element.style.setProperty('--glint-x', `${event.clientX - rect.left}px`);
            element.style.setProperty('--glint-y', `${event.clientY - rect.top}px`);
        }
        this.wake();
    };

    private readonly onPointerLeave = (): void => {
        this.hovered = null;
        this.wake();
    };

    /** Re-measures for a moment; the loop stops by itself once nothing moves. */
    private readonly wake = (): void => {
        this.settleUntil = performance.now() + SETTLE_MS;
        if (!this.frame) this.frame = requestAnimationFrame(this.tick);
    };

    private readonly tick = (time: number): void => {
        this.frame = 0;
        if (!this.hdr.active) return;
        this.smoothPointer.x += (this.pointer.x - this.smoothPointer.x) * 0.35;
        this.smoothPointer.y += (this.pointer.y - this.smoothPointer.y) * 0.35;
        let moving = Math.abs(this.pointer.x - this.smoothPointer.x) + Math.abs(this.pointer.y - this.smoothPointer.y) > 0.5;
        const rims: GlassRim[] = [];
        this.tracked.forEach((state, element) => {
            const target = element === this.hovered ? 1 : 0;
            state.glint += (target - state.glint) * 0.2;
            if (Math.abs(target - state.glint) > 0.01) moving = true;
            if (rims.length >= MAX_RIMS) return;
            const rim = measure(element, state.glint);
            if (rim) rims.push(rim);
        });
        this.hdr.update(rims, this.smoothPointer);
        if (moving || time < this.settleUntil) this.frame = requestAnimationFrame(this.tick);
    };
}

/** Where the control is on screen and how visible it is; null when hidden, faded out or covered. */
function measure(element: HTMLElement, glint: number): GlassRim | null {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > innerHeight) return null;
    let opacity = 1;
    for (let node: Element | null = element; node && opacity > 0.02; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.visibility === 'hidden' || style.display === 'none') return null;
        opacity *= Number(style.opacity);
    }
    if (opacity <= 0.02) return null;
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!top || !(element.contains(top) || top.contains(element))) return null;
    // Scaled while pressed: the corner shrinks with the box.
    const scale = rect.width / Math.max(1, element.offsetWidth);
    const radius = cornerRadius(getComputedStyle(element).borderTopLeftRadius, element.offsetWidth, element.offsetHeight) * scale;
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height, radius, opacity, glint };
}

function cornerRadius(value: string, width: number, height: number): number {
    const radius = value.endsWith('%') ? Math.min(width, height) * Number.parseFloat(value) / 100 : Number.parseFloat(value) || 0;
    return Math.min(radius, width / 2, height / 2);
}
