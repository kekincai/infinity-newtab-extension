import {
    type OpticalMaps,
    type OpticalShape,
    createOpticalMaps,
    opticalShapeKey
} from './liquid-optics';
import { HdrGlassRenderer } from './hdr-glass';

type LensGeometry = OpticalShape & { x: number; y: number };
type Point = { x: number; y: number };

const ITEM_SELECTOR = '[data-liquid-item]';
const LENS_PADDING = 8;
const GROUP_MARGIN = 20;
const MAGNIFICATION_SCALE = 24;
const REFRACTION_LEVEL = 1;
const MAP_CACHE = new Map<string, OpticalMaps>();
const MAP_READY_CACHE = new Map<string, Promise<void>>();
let nextFilterId = 0;

/**
 * Owns one empty optical lens. The real controls stay untouched underneath it,
 * so SVG backdrop refraction bends their actual text, icons and borders.
 */
export class LiquidGlassSystem extends HTMLElement {
    private readonly lens = document.createElement('span');
    private readonly defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    private readonly filterContainer = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    private readonly hdrGlass = new HdrGlassRenderer();
    private activeItem: HTMLElement | null = null;
    private activeGroup: HTMLElement | null = null;
    private filter: SVGFilterElement | null = null;
    private filterImages: SVGFEImageElement[] = [];
    private filterVersion = 0;
    private mapShapeKey = '';
    private hideTimer = 0;

    connectedCallback(): void {
        this.lens.className = 'liquid-glass-lens';
        this.lens.setAttribute('aria-hidden', 'true');
        this.defs.classList.add('liquid-filter-defs');
        this.defs.setAttribute('aria-hidden', 'true');
        this.defs.append(this.filterContainer);
        this.append(this.defs, this.lens, this.hdrGlass.canvas);
        this.hdrGlass.connect();
        document.addEventListener('pointerover', this.onPointerOver, true);
        document.addEventListener('pointermove', this.onPointerMove, { passive: true, capture: true });
        document.addEventListener('pointerdown', this.onPointerDown, true);
        document.addEventListener('focusin', this.onFocusIn, true);
        document.addEventListener('focusout', this.onFocusOut, true);
        window.addEventListener('resize', this.onViewportChange);
        window.addEventListener('scroll', this.onViewportChange, true);
    }

    disconnectedCallback(): void {
        document.removeEventListener('pointerover', this.onPointerOver, true);
        document.removeEventListener('pointermove', this.onPointerMove, true);
        document.removeEventListener('pointerdown', this.onPointerDown, true);
        document.removeEventListener('focusin', this.onFocusIn, true);
        document.removeEventListener('focusout', this.onFocusOut, true);
        window.removeEventListener('resize', this.onViewportChange);
        window.removeEventListener('scroll', this.onViewportChange, true);
        window.clearTimeout(this.hideTimer);
        this.hdrGlass.disconnect();
    }

    private readonly onPointerOver = (event: PointerEvent): void => {
        const item = findItem(event.target);
        if (item) this.activate(item);
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
        const item = findItem(event.target);
        if (item) {
            if (item !== this.activeItem) this.activate(item);
            return;
        }
        if (!this.activeItem || !this.activeGroup) return;
        const point = { x: event.clientX, y: event.clientY };
        if (!containsPoint(groupBounds(this.groupItems()), point, GROUP_MARGIN)) {
            this.scheduleHide();
            return;
        }
        this.cancelHide();
        this.renderBetween(point);
    };

    private readonly onPointerDown = (event: PointerEvent): void => {
        const item = findItem(event.target);
        if (!item) return;
        this.activate(item);
        this.lens.classList.add('is-pressed');
        window.addEventListener('pointerup', this.releasePress, { once: true });
        window.addEventListener('pointercancel', this.releasePress, { once: true });
    };

    private readonly releasePress = (): void => this.lens.classList.remove('is-pressed');

    private readonly onFocusIn = (event: FocusEvent): void => {
        const item = findItem(event.target);
        if (item) this.activate(item);
    };

    private readonly onFocusOut = (event: FocusEvent): void => {
        if (!findItem(event.relatedTarget)) this.scheduleHide(80);
    };

    private readonly onViewportChange = (): void => {
        if (this.activeItem?.isConnected) this.render(geometryFor(this.activeItem));
        else this.hide();
    };

    private activate(item: HTMLElement): void {
        this.cancelHide();
        this.activeItem = item;
        this.activeGroup = item.parentElement;
        this.lens.dataset.liquidTarget = targetName(item);
        this.lens.classList.add('is-visible');
        this.hdrGlass.show();
        this.render(geometryFor(item));
    }

    private renderBetween(pointer: Point): void {
        const source = this.activeItem;
        if (!source) return;
        const candidates = this.groupItems().filter((item) => item !== source);
        const destination = directionalItem(source, candidates, pointer);
        if (!destination) {
            this.scheduleHide(120);
            return;
        }

        const from = geometryFor(source);
        const to = geometryFor(destination);
        const fromCenter = centerOf(from);
        const toCenter = centerOf(to);
        const deltaX = toCenter.x - fromCenter.x;
        const deltaY = toCenter.y - fromCenter.y;
        const distanceSquared = deltaX ** 2 + deltaY ** 2;
        if (!distanceSquared) return;
        const progress = clamp(
            ((pointer.x - fromCenter.x) * deltaX + (pointer.y - fromCenter.y) * deltaY) / distanceSquared,
            0,
            1
        );
        const bridge = Math.sin(Math.PI * progress);
        const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
        const travel = Math.sqrt(distanceSquared);
        let width = lerp(from.width, to.width, progress);
        let height = lerp(from.height, to.height, progress);
        const stretch = Math.min(72, travel * 0.27) * bridge;
        if (horizontal) {
            width += stretch;
            height *= 1 - bridge * 0.11;
        } else {
            height += stretch;
            width *= 1 - bridge * 0.11;
        }
        const centerX = lerp(fromCenter.x, toCenter.x, progress);
        const centerY = lerp(fromCenter.y, toCenter.y, progress);
        this.lens.dataset.liquidProgress = progress.toFixed(3);
        this.lens.classList.toggle('is-bridging', progress > 0.01 && progress < 0.99);
        this.render({
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            radius: lerp(from.radius, to.radius, progress) + bridge * 8
        }, false);
    }

    private render(geometry: LensGeometry, refreshMaps = true): void {
        this.lens.style.setProperty('--liquid-x', `${geometry.x}px`);
        this.lens.style.setProperty('--liquid-y', `${geometry.y}px`);
        this.lens.style.setProperty('--liquid-width', `${geometry.width}px`);
        this.lens.style.setProperty('--liquid-height', `${geometry.height}px`);
        this.lens.style.setProperty('--liquid-radius', `${geometry.radius}px`);
        const progress = Number(this.lens.dataset.liquidProgress ?? 0);
        this.hdrGlass.render(geometry, this.lens.classList.contains('is-bridging') ? Math.sin(Math.PI * progress) : 0);
        this.sizeFilter(geometry);
        if (refreshMaps) void this.ensureFilter(geometry);
    }

    private async ensureFilter(geometry: LensGeometry): Promise<void> {
        const shape = normalizeShape(geometry);
        const key = opticalShapeKey(shape);
        if (key === this.mapShapeKey && this.filter) return;
        this.mapShapeKey = key;
        const version = ++this.filterVersion;
        const maps = MAP_CACHE.get(key) ?? createOpticalMaps(shape);
        MAP_CACHE.set(key, maps);
        const ready = MAP_READY_CACHE.get(key) ?? decodeOpticalMaps(maps);
        MAP_READY_CACHE.set(key, ready);
        await ready;
        if (version !== this.filterVersion || !this.isConnected) return;
        this.installFilter(shape, maps);
    }

    private installFilter(shape: OpticalShape, maps: OpticalMaps): void {
        this.filter?.remove();
        const id = `infinity-liquid-lens-${++nextFilterId}`;
        const template = document.createElement('template');
        template.innerHTML = `
            <filter id="${id}" color-interpolation-filters="sRGB">
                <feImage href="${maps.magnifying}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="magnifying_displacement_map" data-optical-map="magnifying"></feImage>
                <feDisplacementMap in="SourceGraphic" in2="magnifying_displacement_map" scale="${MAGNIFICATION_SCALE}" xChannelSelector="R" yChannelSelector="G" result="magnified_source"></feDisplacementMap>
                <feGaussianBlur in="magnified_source" stdDeviation="0" result="blurred_source"></feGaussianBlur>
                <feImage href="${maps.displacement}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="displacement_map" data-optical-map="displacement"></feImage>
                <feDisplacementMap in="blurred_source" in2="displacement_map" scale="${maps.maximumDisplacement * REFRACTION_LEVEL}" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
                <feColorMatrix in="displaced" type="saturate" values="9" result="displaced_saturated"></feColorMatrix>
                <feImage href="${maps.specular}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="specular_layer" data-optical-map="specular"></feImage>
                <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated"></feComposite>
                <feComponentTransfer in="specular_layer" result="specular_faded"><feFuncA type="linear" slope="0.5"></feFuncA></feComponentTransfer>
                <feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation"></feBlend>
                <feBlend in="specular_faded" in2="withSaturation" mode="normal"></feBlend>
            </filter>`;
        const filter = template.content.firstElementChild as SVGFilterElement;
        filter.dataset.maximumDisplacement = String(maps.maximumDisplacement);
        filter.dataset.liquidShape = opticalShapeKey(shape);
        this.filterContainer.append(filter);
        this.filter = filter;
        this.filterImages = Array.from(filter.querySelectorAll<SVGFEImageElement>('feImage'));
        this.lens.style.setProperty('--liquid-filter', `url("#${id}")`);
        this.lens.dataset.liquidFilterId = id;
        this.sizeFilter(shape);
    }

    private sizeFilter(geometry: Pick<LensGeometry, 'width' | 'height'>): void {
        this.filterImages.forEach((image) => {
            image.setAttribute('width', String(Math.round(geometry.width)));
            image.setAttribute('height', String(Math.round(geometry.height)));
        });
    }

    private groupItems(): HTMLElement[] {
        if (!this.activeGroup) return [];
        return Array.from(this.activeGroup.children).filter(
            (child): child is HTMLElement => child instanceof HTMLElement && child.matches(ITEM_SELECTOR)
        );
    }

    private scheduleHide(delay = 150): void {
        if (this.hideTimer) return;
        this.hideTimer = window.setTimeout(() => {
            this.hideTimer = 0;
            this.hide();
        }, delay);
    }

    private cancelHide(): void {
        if (!this.hideTimer) return;
        window.clearTimeout(this.hideTimer);
        this.hideTimer = 0;
    }

    private hide(): void {
        this.activeItem = null;
        this.activeGroup = null;
        this.lens.classList.remove('is-visible', 'is-bridging', 'is-pressed');
        this.hdrGlass.hide();
        delete this.lens.dataset.liquidProgress;
        delete this.lens.dataset.liquidTarget;
    }
}

function findItem(target: EventTarget | null): HTMLElement | null {
    const item = target instanceof Element ? target.closest(ITEM_SELECTOR) : null;
    return item instanceof HTMLElement && item.getClientRects().length ? item : null;
}

function geometryFor(item: HTMLElement): LensGeometry {
    const rect = item.getBoundingClientRect();
    const padding = Math.min(14, Math.max(LENS_PADDING, Math.min(rect.width, rect.height) * 0.08));
    const radius = resolveRadius(getComputedStyle(item).borderTopLeftRadius, rect.width, rect.height);
    return normalizeGeometry({
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        radius: radius + padding
    });
}

function normalizeGeometry(geometry: LensGeometry): LensGeometry {
    const width = Math.max(24, geometry.width);
    const height = Math.max(24, geometry.height);
    return {
        x: geometry.x,
        y: geometry.y,
        width,
        height,
        radius: clamp(geometry.radius, 8, Math.min(width, height) / 2)
    };
}

function normalizeShape(geometry: Pick<LensGeometry, 'width' | 'height' | 'radius'>): OpticalShape {
    const normalized = normalizeGeometry({ ...geometry, x: 0, y: 0 });
    return {
        width: Math.max(24, Math.round(normalized.width)),
        height: Math.max(24, Math.round(normalized.height)),
        radius: Math.max(8, Math.round(normalized.radius))
    };
}

function centerOf(geometry: LensGeometry): Point {
    return { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height / 2 };
}

function directionalItem(source: HTMLElement, items: HTMLElement[], point: Point): HTMLElement | null {
    const sourceRect = source.getBoundingClientRect();
    const sourceCenter = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 };
    const pointerDelta = { x: point.x - sourceCenter.x, y: point.y - sourceCenter.y };
    const horizontal = Math.abs(pointerDelta.x) >= Math.abs(pointerDelta.y);
    let nearest: HTMLElement | null = null;
    let distance = Number.POSITIVE_INFINITY;
    items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const candidateDelta = { x: center.x - sourceCenter.x, y: center.y - sourceCenter.y };
        const sameLane = horizontal
            ? Math.abs(candidateDelta.y) <= (sourceRect.height + rect.height) * 0.35
            : Math.abs(candidateDelta.x) <= (sourceRect.width + rect.width) * 0.35;
        const forward = horizontal
            ? candidateDelta.x * pointerDelta.x > 0
            : candidateDelta.y * pointerDelta.y > 0;
        if (!sameLane || !forward) return;
        const candidateDistance = Math.hypot(point.x - center.x, point.y - center.y);
        if (candidateDistance < distance) {
            nearest = item;
            distance = candidateDistance;
        }
    });
    return nearest;
}

function groupBounds(items: HTMLElement[]): DOMRect {
    if (!items.length) return new DOMRect();
    const rects = items.map((item) => item.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return new DOMRect(left, top, right - left, bottom - top);
}

function containsPoint(rect: DOMRect, point: Point, margin: number): boolean {
    return point.x >= rect.left - margin && point.x <= rect.right + margin
        && point.y >= rect.top - margin && point.y <= rect.bottom + margin;
}

function targetName(item: HTMLElement): string {
    return item.className || item.tagName.toLowerCase();
}

function resolveRadius(value: string, width: number, height: number): number {
    if (value.endsWith('%')) return Math.min(width, height) * Number.parseFloat(value) / 100;
    return Number.parseFloat(value) || Math.min(width, height) / 2;
}

async function decodeOpticalMaps(maps: OpticalMaps): Promise<void> {
    await Promise.all([maps.magnifying, maps.displacement, maps.specular].map((source) => new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = source;
        if (image.complete) resolve();
    })));
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

function lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
}
