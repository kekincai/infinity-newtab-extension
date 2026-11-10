import type { WallpaperFraming } from '../core/types';
import { hasOpenLayer } from './ui-layer';

const MAX_SCALE = 5;
/** Released this close to just filling the window, or to the whole picture, the framing settles there. */
const SNAP = 0.05;
/** Chrome turns a trackpad pinch into ctrl+wheel with deltaY ≈ −100 × ln(scale change). */
const PINCH_UNITS = 100;
/** A mouse wheel with ctrl jumps 100 units a notch; capped so one notch is a gentle step. */
const MAX_PINCH_STEP = 30;
/** No pinch or scroll for this long ends the gesture; the framing then settles and is saved. */
const GESTURE_END_MS = 140;
/** How far past the limits a pinch can stretch, as log-scale headroom: 35% over the top, 25% under the whole picture. */
const STRETCH_OVER = Math.log(1.35);
const STRETCH_UNDER = Math.log(1 / 0.75);
/** A slightly underdamped spring, so a settle ends with a hint of bounce. */
const STIFFNESS = 260;
const DAMPING = 30;

export const DEFAULT_FRAMING: WallpaperFraming = { scale: 1, x: 0.5, y: 0.5 };

type View = { scale: number; x: number; y: number };
type Box = { left: number; top: number; width: number; height: number };
type Range = { min: number; max: number };

export type FramingCallbacks = {
    /** A gesture or a double-click has settled on a new framing. */
    save: (framing: WallpaperFraming) => void;
    /** Share of the window the picture covers (1 when it fills it), after every settled change. */
    coverage: (share: number) => void;
};

/**
 * Lets the wallpaper be reframed in place, with the home screen untouched: a
 * trackpad pinch scales it around the fingers, from the whole picture (nothing
 * cropped, on a frosted backdrop) up to 5×, and two-finger scrolling over an
 * empty part of the screen moves it. Going past the edges or the limits meets
 * growing resistance, and on release a spring settles it back into range.
 * The settled framing is saved with the wallpaper settings in window-independent
 * terms; double-clicking an empty part of the screen returns to the default.
 */
export class WallpaperFramer {
    private view: View = { scale: 1, x: 0, y: 0 };
    /** The scale the fingers ask for; the view shows it stretched by `rubberBand` past the limits. */
    private requestedScale = 1;
    private velocity: View = { scale: 0, x: 0, y: 0 };
    private target: View | null = null;
    private focus = { x: innerWidth / 2, y: innerHeight / 2 };
    private gestureTimer = 0;
    private frame = 0;
    private lastTime = 0;
    private interacting = false;
    private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    constructor(private readonly surface: HTMLElement, private readonly callbacks: FramingCallbacks) {}

    connect(): void {
        window.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
        document.addEventListener('dblclick', this.onDoubleClick);
    }

    disconnect(): void {
        window.removeEventListener('wheel', this.onWheel, true);
        document.removeEventListener('dblclick', this.onDoubleClick);
        this.stop();
    }

    /** True from the first pinch or scroll until the spring has settled. */
    get busy(): boolean {
        return this.interacting || this.target !== null;
    }

    /** The current framing in window-independent terms. */
    get framing(): WallpaperFraming {
        const box = this.box();
        return {
            scale: round(this.view.scale),
            x: round(clamp((innerWidth / 2 - box.left - this.view.x) / (this.view.scale * box.width), 0, 1)),
            y: round(clamp((innerHeight / 2 - box.top - this.view.y) / (this.view.scale * box.height), 0, 1))
        };
    }

    /** Shows a saved framing at once, fitted to the current window and picture. */
    show(framing: WallpaperFraming): void {
        this.stop();
        const box = this.box();
        const scale = clamp(framing.scale, this.minScale(), MAX_SCALE);
        this.view = this.clamped({
            scale,
            x: innerWidth / 2 - box.left - framing.x * scale * box.width,
            y: innerHeight / 2 - box.top - framing.y * scale * box.height
        });
        this.apply();
        this.callbacks.coverage(this.coverage());
    }

    private get media(): HTMLElement | null {
        return this.surface.querySelector<HTMLElement>('.wallpaper-media');
    }

    private readonly onWheel = (event: WheelEvent): void => {
        if (hasOpenLayer()) return;
        const pinch = event.ctrlKey;
        // Scrolling over bookmarks, search results and other controls keeps its usual meaning.
        if (!pinch && (isControl(event.target) || !this.canPan())) return;
        event.preventDefault();
        event.stopPropagation();
        this.beginGesture();
        if (pinch) {
            const step = clamp(event.deltaY, -MAX_PINCH_STEP, MAX_PINCH_STEP);
            this.focus = { x: event.clientX, y: event.clientY };
            this.requestedScale *= Math.exp(-step / PINCH_UNITS);
            this.view = this.zoomedAbout(this.view, rubberBand(this.requestedScale, this.minScale()), this.focus);
        } else {
            this.panBy(-event.deltaX, -event.deltaY);
        }
        this.apply();
        this.gestureTimer = window.setTimeout(this.endGesture, GESTURE_END_MS);
    };

    /** Double-clicking an empty part of the screen returns to the default framing. */
    private readonly onDoubleClick = (event: MouseEvent): void => {
        if (hasOpenLayer() || isControl(event.target)) return;
        if (isDefault(this.framing)) return;
        this.settleTo({ scale: 1, x: 0, y: 0 });
    };

    /** Movement is possible on an axis where the picture is larger than the window, or while it is out of range. */
    private canPan(): boolean {
        const [rangeX, rangeY] = this.ranges(this.view.scale);
        const outside = (value: number, range: Range) => value < range.min - 0.5 || value > range.max + 0.5;
        return rangeX.max - rangeX.min > 1 || rangeY.max - rangeY.min > 1 || outside(this.view.x, rangeX) || outside(this.view.y, rangeY);
    }

    private beginGesture(): void {
        window.clearTimeout(this.gestureTimer);
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.target = null;
        this.velocity = { scale: 0, x: 0, y: 0 };
        this.requestedScale = unstretch(this.view.scale, this.minScale());
        this.interacting = true;
        this.surface.classList.add('is-framing');
    }

    private readonly endGesture = (): void => {
        this.interacting = false;
        const minimum = this.minScale();
        let scale = clamp(this.view.scale, minimum, MAX_SCALE);
        if (Math.abs(scale - 1) < SNAP) scale = 1;
        else if (scale / minimum - 1 < SNAP) scale = minimum;
        this.settleTo(this.clamped(this.zoomedAbout(this.view, scale, this.focus)));
    };

    private stop(): void {
        window.clearTimeout(this.gestureTimer);
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.target = null;
        this.interacting = false;
        this.velocity = { scale: 0, x: 0, y: 0 };
        this.surface.classList.remove('is-framing');
    }

    /** The view scaled to `scale` with the point under `at` staying put. */
    private zoomedAbout(view: View, scale: number, at: { x: number; y: number }): View {
        const box = this.box();
        const ratio = scale / view.scale;
        return {
            scale,
            x: at.x - box.left - (at.x - box.left - view.x) * ratio,
            y: at.y - box.top - (at.y - box.top - view.y) * ratio
        };
    }

    /** Panning past an edge moves less and less, so the picture resists being dragged out of view. */
    private panBy(dx: number, dy: number): void {
        const [rangeX, rangeY] = this.ranges(this.view.scale);
        this.view = {
            scale: this.view.scale,
            x: this.view.x + resist(this.view.x, dx, rangeX, innerWidth),
            y: this.view.y + resist(this.view.y, dy, rangeY, innerHeight)
        };
    }

    /** The media layer's untransformed box in window coordinates. */
    private box(): Box {
        const media = this.media;
        return media
            ? { left: media.offsetLeft, top: media.offsetTop, width: media.offsetWidth, height: media.offsetHeight }
            : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    }

    /** The scale at which the whole picture fits in the window. */
    private minScale(): number {
        const box = this.box();
        return Math.min(1, innerWidth / box.width, innerHeight / box.height);
    }

    /**
     * Allowed offsets on each axis at `scale`. A picture larger than the window
     * (plus the blur margin, which must stay out of view) can move until an edge
     * meets the window; a smaller one stays centred.
     */
    private ranges(scale: number): [Range, Range] {
        const box = this.box();
        const bleed = Number(this.surface.dataset.bleed) || 0;
        const axis = (start: number, length: number, window: number): Range => {
            const size = length * scale;
            if (size < window + bleed * 2) {
                const centred = (window - size) / 2 - start;
                return { min: centred, max: centred };
            }
            return { min: window + bleed - size - start, max: -bleed - start };
        };
        return [axis(box.left, box.width, innerWidth), axis(box.top, box.height, innerHeight)];
    }

    private clamped(view: View): View {
        const scale = clamp(view.scale, this.minScale(), MAX_SCALE);
        const [rangeX, rangeY] = this.ranges(scale);
        return { scale, x: clamp(view.x, rangeX.min, rangeX.max), y: clamp(view.y, rangeY.min, rangeY.max) };
    }

    /** Share of the window the picture covers. */
    private coverage(): number {
        const box = this.box();
        const left = Math.max(0, box.left + this.view.x);
        const top = Math.max(0, box.top + this.view.y);
        const right = Math.min(innerWidth, box.left + this.view.x + box.width * this.view.scale);
        const bottom = Math.min(innerHeight, box.top + this.view.y + box.height * this.view.scale);
        return Math.max(0, right - left) * Math.max(0, bottom - top) / (innerWidth * innerHeight);
    }

    private settleTo(target: View): void {
        window.clearTimeout(this.gestureTimer);
        this.target = target;
        this.surface.classList.add('is-framing');
        if (this.reducedMotion.matches) {
            this.view = target;
            this.finish();
            return;
        }
        this.lastTime = performance.now();
        if (!this.frame) this.frame = requestAnimationFrame(this.step);
    }

    private readonly step = (time: number): void => {
        this.frame = 0;
        const target = this.target;
        if (!target) return;
        // Fixed small steps keep the spring stable however late a frame arrives.
        let remaining = Math.min(0.064, (time - this.lastTime) / 1000);
        this.lastTime = time;
        while (remaining > 0) {
            const dt = Math.min(remaining, 1 / 240);
            remaining -= dt;
            for (const key of ['scale', 'x', 'y'] as const) {
                const force = -STIFFNESS * (this.view[key] - target[key]) - DAMPING * this.velocity[key];
                this.velocity[key] += force * dt;
                this.view[key] += this.velocity[key] * dt;
            }
        }
        const settled = Math.abs(this.view.scale - target.scale) < 0.0005
            && Math.abs(this.view.x - target.x) < 0.25
            && Math.abs(this.view.y - target.y) < 0.25
            && Math.abs(this.velocity.scale) < 0.005
            && Math.abs(this.velocity.x) + Math.abs(this.velocity.y) < 2;
        if (settled) {
            this.view = { ...target };
            this.finish();
            return;
        }
        this.apply();
        this.frame = requestAnimationFrame(this.step);
    };

    private finish(): void {
        this.target = null;
        this.velocity = { scale: 0, x: 0, y: 0 };
        this.apply();
        // Dropping the compositing hint lets Chrome redraw the picture sharply at its new size.
        this.surface.classList.remove('is-framing');
        this.callbacks.coverage(this.coverage());
        this.callbacks.save(this.framing);
    }

    private apply(): void {
        const media = this.media;
        const { scale, x, y } = this.view;
        const resting = Math.abs(scale - 1) < 1e-4 && Math.abs(x) < 0.01 && Math.abs(y) < 0.01;
        if (media) media.style.transform = resting ? '' : `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        this.surface.dataset.zoom = scale.toFixed(3);
    }
}

export function isDefault(framing: WallpaperFraming): boolean {
    return Math.abs(framing.scale - 1) < 0.001 && Math.abs(framing.x - 0.5) < 0.001 && Math.abs(framing.y - 0.5) < 0.001;
}

export function sameFraming(left: WallpaperFraming, right: WallpaperFraming): boolean {
    return Math.abs(left.scale - right.scale) < 0.001 && Math.abs(left.x - right.x) < 0.001 && Math.abs(left.y - right.y) < 0.001;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

/** Four decimals are plenty for a framing and keep the saved settings small. */
function round(value: number): number {
    return Math.round(value * 10000) / 10000;
}

/** Movement away from the allowed range is damped more the further out it already is. */
function resist(value: number, delta: number, range: Range, size: number): number {
    const outward = (value >= range.max && delta > 0) || (value <= range.min && delta < 0);
    if (!outward) return delta;
    const overshoot = value > range.max ? value - range.max : value < range.min ? range.min - value : 0;
    return delta * 0.5 * Math.max(0, 1 - overshoot / (size * 0.3));
}

/**
 * Past the limits the shown scale approaches a ceiling (or floor) however far
 * the fingers keep going: the further the stretch, the less it gives.
 */
function rubberBand(requested: number, minimum: number): number {
    if (requested > MAX_SCALE) return MAX_SCALE * Math.exp(stretch(Math.log(requested / MAX_SCALE), STRETCH_OVER));
    if (requested < minimum) return minimum * Math.exp(-stretch(Math.log(minimum / requested), STRETCH_UNDER));
    return requested;
}

/** The requested scale that `rubberBand` would show as `scale`, to pick a gesture up mid-bounce. */
function unstretch(scale: number, minimum: number): number {
    if (scale > MAX_SCALE) return MAX_SCALE * Math.exp(release(Math.log(scale / MAX_SCALE), STRETCH_OVER));
    if (scale < minimum) return minimum * Math.exp(-release(Math.log(minimum / scale), STRETCH_UNDER));
    return scale;
}

/** iOS-style rubber band: `overshoot` maps to at most `limit`. */
function stretch(overshoot: number, limit: number): number {
    return limit * (1 - 1 / (overshoot / limit + 1));
}

function release(shown: number, limit: number): number {
    const ratio = Math.min(shown / limit, 0.999);
    return limit * (1 / (1 - ratio) - 1);
}

/** Pointer events on controls, text and bookmarks keep their own meaning. */
function isControl(target: EventTarget | null): boolean {
    return target instanceof Element
        && Boolean(target.closest('a, button, input, label, select, textarea, [data-glass], bookmark-index, search-box, status-strip, dashboard-header, backup-toast, settings-panel, bookmark-dialog, .context-menu, .modal-backdrop'));
}
