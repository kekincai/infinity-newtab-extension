import { createOpticalMaps, type OpticalProfile, type OpticalShape } from './liquid-optics';

type FilterTuning = {
    profile: OpticalProfile;
    blur: number;
    maximumDisplacement: number;
    restingRefraction: number;
    activeRefraction: number;
    saturation: number;
    specularOpacity: number;
};

let nextControlFilterId = 0;

abstract class LiquidControlElement extends HTMLElement {
    protected input: HTMLInputElement | null = null;
    private filterDefs: SVGSVGElement | null = null;
    private displacement: SVGFEDisplacementMapElement | null = null;
    private tuning: FilterTuning | null = null;

    disconnectedCallback(): void {
        this.input?.removeEventListener('input', this.onValueChange);
        this.input?.removeEventListener('change', this.onValueChange);
        this.input?.removeEventListener('focus', this.onFocus);
        this.input?.removeEventListener('blur', this.onBlur);
        this.input?.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('pointercancel', this.onPointerUp);
    }

    protected connectInput(selector: string): void {
        this.input = this.querySelector<HTMLInputElement>(selector);
        this.input?.addEventListener('input', this.onValueChange);
        this.input?.addEventListener('change', this.onValueChange);
        this.input?.addEventListener('focus', this.onFocus);
        this.input?.addEventListener('blur', this.onBlur);
        this.input?.addEventListener('pointerdown', this.onPointerDown);
        this.update();
    }

    protected installFilter(target: HTMLElement, shape: OpticalShape, tuning: FilterTuning): void {
        this.filterDefs?.remove();
        const maps = createOpticalMaps(shape, tuning.profile);
        const id = `infinity-liquid-control-${++nextControlFilterId}`;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('liquid-control-defs');
        svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = `
            <defs>
                <filter id="${id}" color-interpolation-filters="sRGB">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="${tuning.blur}" result="blurred_source"></feGaussianBlur>
                    <feImage href="${maps.displacement}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="displacement_map"></feImage>
                    <feDisplacementMap in="blurred_source" in2="displacement_map" scale="${tuning.maximumDisplacement * tuning.restingRefraction}" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
                    <feColorMatrix in="displaced" type="saturate" values="${tuning.saturation}" result="displaced_saturated"></feColorMatrix>
                    <feImage href="${maps.specular}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="specular_layer"></feImage>
                    <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated"></feComposite>
                    <feComponentTransfer in="specular_layer" result="specular_faded"><feFuncA type="linear" slope="${tuning.specularOpacity}"></feFuncA></feComponentTransfer>
                    <feBlend in="specular_saturated" in2="displaced" mode="normal" result="with_saturation"></feBlend>
                    <feBlend in="specular_faded" in2="with_saturation" mode="normal"></feBlend>
                </filter>
            </defs>`;
        this.prepend(svg);
        this.filterDefs = svg;
        this.displacement = svg.querySelector('feDisplacementMap');
        this.tuning = tuning;
        target.style.setProperty('--liquid-control-filter', `url("#${id}")`);
        target.dataset.liquidProfile = tuning.profile;
    }

    protected abstract update(): void;

    private readonly onValueChange = (): void => this.update();
    private readonly onFocus = (): void => this.classList.add('is-focused');
    private readonly onBlur = (): void => {
        this.classList.remove('is-focused');
        this.setActive(false);
    };
    private readonly onPointerDown = (): void => {
        this.setActive(true);
        window.addEventListener('pointerup', this.onPointerUp, { once: true });
        window.addEventListener('pointercancel', this.onPointerUp, { once: true });
    };
    private readonly onPointerUp = (): void => this.setActive(false);

    private setActive(active: boolean): void {
        this.classList.toggle('is-active', active);
        if (!this.displacement || !this.tuning) return;
        const ratio = active ? this.tuning.activeRefraction : this.tuning.restingRefraction;
        this.displacement.setAttribute('scale', String(this.tuning.maximumDisplacement * ratio));
    }
}

export class LiquidRange extends LiquidControlElement {
    connectedCallback(): void {
        this.connectInput('input[type="range"]');
        const thumb = this.querySelector<HTMLElement>('.liquid-range-thumb');
        if (thumb) this.installFilter(thumb, { width: 90, height: 60, radius: 30 }, {
            profile: 'convex',
            blur: 0,
            maximumDisplacement: 83.88118841653394,
            restingRefraction: 0.4,
            activeRefraction: 0.9,
            saturation: 7,
            specularOpacity: 0.4
        });
    }

    protected update(): void {
        if (!this.input) return;
        const minimum = Number(this.input.min) || 0;
        const maximum = Number(this.input.max) || 100;
        const progress = maximum === minimum ? 0 : (Number(this.input.value) - minimum) / (maximum - minimum);
        const clamped = Math.max(0, Math.min(1, progress));
        this.style.setProperty('--liquid-progress', `${clamped * 100}%`);
        // The article keeps a 90 px optical map and scales its visible thumb to 54 px.
        this.style.setProperty('--liquid-thumb-left', `calc(${clamped * 100}% - ${clamped * 54}px - 18px)`);
    }
}

export class LiquidToggle extends LiquidControlElement {
    connectedCallback(): void {
        this.connectInput('input[type="checkbox"]');
        const thumb = this.querySelector<HTMLElement>('.liquid-toggle-thumb');
        if (thumb) this.installFilter(thumb, { width: 146, height: 92, radius: 46 }, {
            profile: 'lip',
            blur: 0.2,
            maximumDisplacement: 55.65161904498752,
            restingRefraction: 0.4,
            activeRefraction: 0.9,
            saturation: 6,
            specularOpacity: 0.5
        });
    }

    protected update(): void {
        this.classList.toggle('is-checked', Boolean(this.input?.checked));
    }
}
