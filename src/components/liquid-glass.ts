import {
    type OpticalMaps,
    type OpticalShape,
    createOpticalMaps,
    opticalShapeKey
} from './liquid-optics';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const REFRACTION_LEVEL = 0.7;
const SOURCE_BLUR = 1;
const SPECULAR_OPACITY = 0.2;
const SPECULAR_SATURATION = 4;
const SPRING_STIFFNESS = 250;
const SPRING_DAMPING = 24;
const MAP_CACHE = new Map<string, OpticalMaps>();
let nextFilterId = 0;

/**
 * Finds real controls and equips each one with the article's co-located SVG
 * filter. There is no cursor lens or shared geometry moving between controls.
 */
export class LiquidGlassSystem extends HTMLElement {
    private readonly bindings = new Map<HTMLElement, LiquidGlassBinding>();
    private readonly resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => this.bindings.get(entry.target as HTMLElement)?.configure());
    });
    private readonly mutationObserver = new MutationObserver(() => this.scheduleScan());
    private scanScheduled = false;

    connectedCallback(): void {
        this.hidden = true;
        const root = this.parentElement ?? document.body;
        this.mutationObserver.observe(root, { childList: true, subtree: true });
        window.addEventListener('resize', this.onWindowResize);
        this.scheduleScan();
    }

    disconnectedCallback(): void {
        this.mutationObserver.disconnect();
        this.resizeObserver.disconnect();
        window.removeEventListener('resize', this.onWindowResize);
        this.bindings.forEach((binding) => binding.destroy());
        this.bindings.clear();
    }

    private scheduleScan(): void {
        if (this.scanScheduled) return;
        this.scanScheduled = true;
        queueMicrotask(() => {
            this.scanScheduled = false;
            this.scan();
        });
    }

    private scan(): void {
        const root = this.parentElement ?? document.body;
        const items = new Set(root.querySelectorAll<HTMLElement>('[data-liquid-item]'));

        this.bindings.forEach((binding, item) => {
            if (items.has(item) && item.isConnected) return;
            this.resizeObserver.unobserve(item);
            binding.destroy();
            this.bindings.delete(item);
        });

        items.forEach((item) => {
            if (this.bindings.has(item)) return;
            const binding = new LiquidGlassBinding(item);
            this.bindings.set(item, binding);
            this.resizeObserver.observe(item);
            binding.configure();
        });
    }

    private readonly onWindowResize = (): void => {
        this.bindings.forEach((binding) => binding.configure());
    };
}

class LiquidGlassBinding {
    private readonly layer = document.createElement('span');
    private svg: SVGSVGElement | null = null;
    private displacement: SVGFEDisplacementMapElement | null = null;
    private blur: SVGFEGaussianBlurElement | null = null;
    private saturation: SVGFEColorMatrixElement | null = null;
    private specularAlpha: SVGFEFuncAElement | null = null;
    private maximumDisplacement = 0;
    private shapeKey = '';
    private target = 0;
    private presence = 0;
    private velocity = 0;
    private frame = 0;
    private pointerInside = false;
    private pointerDown = false;
    private focusInside = false;

    constructor(private readonly item: HTMLElement) {
        this.item.classList.add('liquid-glass-host');
        this.layer.className = 'liquid-glass-layer';
        this.layer.setAttribute('aria-hidden', 'true');
        this.item.prepend(this.layer);
        this.item.addEventListener('pointerenter', this.onPointerEnter);
        this.item.addEventListener('pointerleave', this.onPointerLeave);
        this.item.addEventListener('pointerdown', this.onPointerDown);
        this.item.addEventListener('focusin', this.onFocusIn);
        this.item.addEventListener('focusout', this.onFocusOut);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp);
    }

    configure(): void {
        const width = this.item.offsetWidth;
        const height = this.item.offsetHeight;
        if (!width || !height) return;
        const shape = normalizeShape({
            width,
            height,
            radius: resolveRadius(getComputedStyle(this.item).borderTopLeftRadius, width, height)
        });
        const key = opticalShapeKey(shape);
        if (key === this.shapeKey && this.svg?.isConnected) return;
        this.shapeKey = key;

        const maps = MAP_CACHE.get(key) ?? createOpticalMaps(shape);
        MAP_CACHE.set(key, maps);
        this.maximumDisplacement = maps.maximumDisplacement;
        this.svg?.remove();
        this.svg = this.createFilter(shape, maps);
        this.item.prepend(this.svg);
        this.updateFilter();
    }

    destroy(): void {
        cancelAnimationFrame(this.frame);
        this.item.removeEventListener('pointerenter', this.onPointerEnter);
        this.item.removeEventListener('pointerleave', this.onPointerLeave);
        this.item.removeEventListener('pointerdown', this.onPointerDown);
        this.item.removeEventListener('focusin', this.onFocusIn);
        this.item.removeEventListener('focusout', this.onFocusOut);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('pointercancel', this.onPointerUp);
        this.item.classList.remove('liquid-glass-host');
        this.item.style.removeProperty('--liquid-filter');
        this.item.style.removeProperty('--liquid-presence');
        delete this.item.dataset.liquidFilterId;
        delete this.item.dataset.liquidShape;
        delete this.item.dataset.liquidState;
        this.svg?.remove();
        this.layer.remove();
    }

    private createFilter(shape: OpticalShape, maps: OpticalMaps): SVGSVGElement {
        const id = `infinity-liquid-${++nextFilterId}`;
        const svg = svgElement('svg');
        svg.classList.add('liquid-filter-defs');
        svg.setAttribute('color-interpolation-filters', 'sRGB');
        svg.setAttribute('aria-hidden', 'true');
        const definitions = svgElement('defs');
        const filter = svgElement('filter');
        filter.id = id;
        filter.dataset.maximumDisplacement = String(maps.maximumDisplacement);
        filter.dataset.liquidShape = opticalShapeKey(shape);

        this.blur = svgElement('feGaussianBlur');
        attributes(this.blur, { in: 'SourceGraphic', stdDeviation: '0', result: 'blurred_source' });

        const displacementImage = svgElement('feImage');
        attributes(displacementImage, {
            href: maps.displacement,
            x: '0',
            y: '0',
            width: String(shape.width),
            height: String(shape.height),
            result: 'displacement_map',
            'data-optical-map': 'displacement'
        });

        this.displacement = svgElement('feDisplacementMap');
        attributes(this.displacement, {
            in: 'blurred_source',
            in2: 'displacement_map',
            scale: '0',
            xChannelSelector: 'R',
            yChannelSelector: 'G',
            result: 'displaced'
        });

        this.saturation = svgElement('feColorMatrix');
        attributes(this.saturation, {
            in: 'displaced',
            type: 'saturate',
            values: '1',
            result: 'displaced_saturated'
        });

        const specularImage = svgElement('feImage');
        attributes(specularImage, {
            href: maps.specular,
            x: '0',
            y: '0',
            width: String(shape.width),
            height: String(shape.height),
            result: 'specular_layer',
            'data-optical-map': 'specular'
        });

        const composite = svgElement('feComposite');
        attributes(composite, {
            in: 'displaced_saturated',
            in2: 'specular_layer',
            operator: 'in',
            result: 'specular_saturated'
        });

        const transfer = svgElement('feComponentTransfer');
        attributes(transfer, { in: 'specular_layer', result: 'specular_faded' });
        this.specularAlpha = svgElement('feFuncA');
        attributes(this.specularAlpha, { type: 'linear', slope: '0' });
        transfer.append(this.specularAlpha);

        const saturationBlend = svgElement('feBlend');
        attributes(saturationBlend, {
            in: 'specular_saturated',
            in2: 'displaced',
            mode: 'normal',
            result: 'withSaturation'
        });
        const finalBlend = svgElement('feBlend');
        attributes(finalBlend, { in: 'specular_faded', in2: 'withSaturation', mode: 'normal' });

        filter.append(
            this.blur,
            displacementImage,
            this.displacement,
            this.saturation,
            specularImage,
            composite,
            transfer,
            saturationBlend,
            finalBlend
        );
        definitions.append(filter);
        svg.append(definitions);
        this.item.dataset.liquidFilterId = id;
        this.item.dataset.liquidShape = opticalShapeKey(shape);
        this.item.style.setProperty('--liquid-filter', `url("#${id}")`);
        return svg;
    }

    private setTarget(value: number): void {
        this.target = value;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.presence = value;
            this.velocity = 0;
            this.updateFilter();
            return;
        }
        if (!this.frame) this.frame = requestAnimationFrame(this.tick);
    }

    private readonly tick = (): void => {
        const acceleration = (this.target - this.presence) * SPRING_STIFFNESS;
        this.velocity = (this.velocity + acceleration / 60) * Math.exp(-SPRING_DAMPING / 60);
        this.presence += this.velocity / 60;
        if (Math.abs(this.target - this.presence) < 0.001 && Math.abs(this.velocity) < 0.01) {
            this.presence = this.target;
            this.velocity = 0;
            this.frame = 0;
            this.updateFilter();
            return;
        }
        this.updateFilter();
        this.frame = requestAnimationFrame(this.tick);
    };

    private updateFilter(): void {
        const presence = Math.min(1, Math.max(0, this.presence));
        this.displacement?.setAttribute('scale', String(this.maximumDisplacement * REFRACTION_LEVEL * presence));
        this.blur?.setAttribute('stdDeviation', String(SOURCE_BLUR * presence));
        this.saturation?.setAttribute('values', String(1 + (SPECULAR_SATURATION - 1) * presence));
        this.specularAlpha?.setAttribute('slope', String(SPECULAR_OPACITY * presence));
        this.item.style.setProperty('--liquid-presence', presence.toFixed(4));
        this.item.dataset.liquidState = presence > 0.01 ? 'active' : 'idle';
    }

    private refreshTarget(): void {
        this.setTarget(this.pointerInside || this.pointerDown || this.focusInside ? 1 : 0);
    }

    private readonly onPointerEnter = (): void => {
        this.pointerInside = true;
        this.refreshTarget();
    };

    private readonly onPointerLeave = (): void => {
        this.pointerInside = false;
        this.refreshTarget();
    };

    private readonly onPointerDown = (): void => {
        this.pointerDown = true;
        this.refreshTarget();
    };

    private readonly onPointerUp = (): void => {
        if (!this.pointerDown) return;
        this.pointerDown = false;
        this.refreshTarget();
    };

    private readonly onFocusIn = (): void => {
        this.focusInside = true;
        this.refreshTarget();
    };

    private readonly onFocusOut = (event: FocusEvent): void => {
        this.focusInside = event.relatedTarget instanceof Node && this.item.contains(event.relatedTarget);
        this.refreshTarget();
    };
}

function normalizeShape(shape: OpticalShape): OpticalShape {
    const width = Math.max(1, Math.round(shape.width));
    const height = Math.max(1, Math.round(shape.height));
    return {
        width,
        height,
        radius: Math.min(Math.max(2, Math.round(shape.radius)), Math.min(width, height) / 2)
    };
}

function resolveRadius(value: string, width: number, height: number): number {
    const firstValue = value.trim().split(/\s+/)[0] ?? '0';
    if (firstValue.endsWith('%')) {
        return Math.min(width, height) * (Number.parseFloat(firstValue) || 0) / 100;
    }
    return Number.parseFloat(firstValue) || Math.min(width, height) / 2;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
    return document.createElementNS(SVG_NAMESPACE, name);
}

function attributes(element: Element, values: Record<string, string>): void {
    Object.entries(values).forEach(([name, value]) => element.setAttribute(name, value));
}
