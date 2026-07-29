type Geometry = { x: number; y: number; width: number; height: number };

const MAP_SIZE = 160;
const MIN_WIDTH = 58;
const MIN_HEIGHT = 50;

export class LiquidSurface extends HTMLElement {}

/** A single pointer-driven optical field shared by every interactive surface. */
export class LiquidGlassLayer extends HTMLElement {
    private lens!: HTMLDivElement;
    private displacement!: SVGFEDisplacementMapElement;
    private desired: Geometry = { x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT };
    private current: Geometry = { ...this.desired };
    private velocity: Geometry = { x: 0, y: 0, width: 0, height: 0 };
    private pointer = { x: 0, y: 0, previousX: 0, previousY: 0, time: 0, speed: 0 };
    private active = false;
    private activeSurface: LiquidSurface | null = null;
    private frame = 0;
    private previousFrame = 0;
    private hideTimer = 0;

    connectedCallback(): void {
        this.innerHTML = `
            <svg class="liquid-defs" width="0" height="0" aria-hidden="true">
                <defs>
                    <filter id="infinity-liquid-refraction" x="-28%" y="-28%" width="156%" height="156%" color-interpolation-filters="sRGB">
                        <feImage href="${createDisplacementMap()}" preserveAspectRatio="none" result="bezel-map"></feImage>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="0.18" result="soft-source"></feGaussianBlur>
                        <feDisplacementMap in="soft-source" in2="bezel-map" scale="52" xChannelSelector="R" yChannelSelector="G" result="refracted"></feDisplacementMap>
                        <feColorMatrix in="refracted" type="saturate" values="1.22"></feColorMatrix>
                    </filter>
                </defs>
            </svg>
            <div class="liquid-lens" aria-hidden="true"></div>
        `;
        this.lens = this.querySelector('.liquid-lens') as HTMLDivElement;
        this.displacement = this.querySelector('feDisplacementMap') as SVGFEDisplacementMapElement;
        window.addEventListener('pointermove', this.onPointerMove, { passive: true });
        window.addEventListener('pointerout', this.onPointerOut, { passive: true });
        window.addEventListener('blur', this.hide);
    }

    disconnectedCallback(): void {
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerout', this.onPointerOut);
        window.removeEventListener('blur', this.hide);
        cancelAnimationFrame(this.frame);
    }

    private readonly onPointerMove = (event: PointerEvent): void => {
        if (event.pointerType === 'touch') return;
        const now = performance.now();
        const elapsed = Math.max(8, now - (this.pointer.time || now));
        const dx = event.clientX - this.pointer.x;
        const dy = event.clientY - this.pointer.y;
        const instantaneous = Math.hypot(dx, dy) / elapsed;
        this.pointer = {
            x: event.clientX,
            y: event.clientY,
            previousX: this.pointer.x,
            previousY: this.pointer.y,
            time: now,
            speed: this.pointer.speed * 0.64 + instantaneous * 0.36
        };

        const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        const item = hit?.closest<HTMLElement>('[data-liquid-item]') ?? null;
        const surface = item?.closest<LiquidSurface>('liquid-surface')
            ?? findSurfaceAtPoint(event.clientX, event.clientY);
        if (!surface || surface.closest('[hidden]') || (!item && (!this.active || surface !== this.activeSurface))) {
            this.scheduleHide();
            return;
        }
        if (item) this.activeSurface = surface;

        window.clearTimeout(this.hideTimer);
        const itemRect = item?.getBoundingClientRect();
        const speedStretch = Math.min(30, this.pointer.speed * 18);
        const directWidth = itemRect ? Math.min(82, Math.max(MIN_WIDTH, itemRect.height * 1.06)) : MIN_WIDTH;
        const directHeight = itemRect ? Math.min(62, Math.max(MIN_HEIGHT, itemRect.height * 0.82)) : MIN_HEIGHT;
        const width = directWidth + speedStretch;
        const height = Math.max(44, directHeight - Math.min(8, speedStretch * 0.2));
        this.desired = {
            x: event.clientX - width / 2,
            y: event.clientY - height / 2,
            width,
            height
        };
        this.lens.classList.toggle('is-over-item', Boolean(item));
        this.show();
    };

    private readonly onPointerOut = (event: PointerEvent): void => {
        if (!event.relatedTarget) this.hide();
    };

    private show(): void {
        if (!this.active) {
            this.active = true;
            this.current = { ...this.desired };
            this.velocity = { x: 0, y: 0, width: 0, height: 0 };
            this.lens.classList.add('is-visible');
        }
        if (!this.frame) {
            this.previousFrame = performance.now();
            this.frame = requestAnimationFrame(this.tick);
        }
    }

    private scheduleHide(): void {
        window.clearTimeout(this.hideTimer);
        this.hideTimer = window.setTimeout(this.hide, 90);
    }

    private readonly hide = (): void => {
        window.clearTimeout(this.hideTimer);
        this.active = false;
        this.activeSurface = null;
        this.lens?.classList.remove('is-visible');
    };

    private readonly tick = (time: number): void => {
        this.frame = 0;
        const dt = Math.min(0.032, Math.max(0.001, (time - this.previousFrame) / 1000));
        this.previousFrame = time;
        const enhanced = document.body.classList.contains('enhanced-animations');
        const stiffness = enhanced ? 340 : 520;
        const damping = enhanced ? 31 : 42;
        for (const key of ['x', 'y', 'width', 'height'] as const) {
            const acceleration = (this.desired[key] - this.current[key]) * stiffness - this.velocity[key] * damping;
            this.velocity[key] += acceleration * dt;
            this.current[key] += this.velocity[key] * dt;
        }
        this.renderLens();
        if (this.active || !settled(this.current, this.desired, this.velocity)) {
            this.frame = requestAnimationFrame(this.tick);
        }
    };

    private renderLens(): void {
        const geometry = this.current;
        this.lens.style.width = `${geometry.width}px`;
        this.lens.style.height = `${geometry.height}px`;
        this.lens.style.transform = `translate3d(${geometry.x}px, ${geometry.y}px, 0)`;
        const opticalSpeed = Math.min(1, Math.hypot(this.velocity.x, this.velocity.y) / 850);
        this.lens.style.setProperty('--liquid-speed', opticalSpeed.toFixed(3));
        this.displacement.setAttribute('scale', String(48 + opticalSpeed * 26));
    }
}

function findSurfaceAtPoint(x: number, y: number): LiquidSurface | null {
    const surfaces = [...document.querySelectorAll<LiquidSurface>('liquid-surface')]
        .filter((surface) => {
            const style = getComputedStyle(surface);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = surface.getBoundingClientRect();
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
    return surfaces.sort((left, right) => area(left) - area(right))[0] ?? null;
}

function area(element: Element): number {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
}

function settled(current: Geometry, desired: Geometry, velocity: Geometry): boolean {
    return (Object.keys(current) as Array<keyof Geometry>).every((key) => (
        Math.abs(current[key] - desired[key]) < 0.08 && Math.abs(velocity[key]) < 0.08
    ));
}

function createDisplacementMap(): string {
    const canvas = document.createElement('canvas');
    canvas.width = MAP_SIZE;
    canvas.height = MAP_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return '';
    const image = context.createImageData(MAP_SIZE, MAP_SIZE);
    const center = (MAP_SIZE - 1) / 2;
    for (let y = 0; y < MAP_SIZE; y += 1) {
        for (let x = 0; x < MAP_SIZE; x += 1) {
            const nx = (x - center) / center;
            const ny = (y - center) / center;
            const radius = Math.sqrt(nx * nx + ny * ny);
            const edge = smoothStep(0.48, 1, radius);
            const bloom = Math.sin(Math.min(1, radius) * Math.PI) * 0.18;
            const strength = Math.min(0.46, edge * 0.38 + bloom);
            const index = (y * MAP_SIZE + x) * 4;
            image.data[index] = Math.round(128 + nx * strength * 127);
            image.data[index + 1] = Math.round(128 + ny * strength * 127);
            image.data[index + 2] = 128;
            image.data[index + 3] = Math.round(255 * smoothStep(0.1, 0.96, 1 - Math.max(0, radius - 0.94)));
        }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
}

function smoothStep(from: number, to: number, value: number): number {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
}
