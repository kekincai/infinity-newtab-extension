import { hasOpenLayer } from './ui-layer';

const MAX_SCALE = 5;
/** Below this on release the picture springs back to fit instead of staying barely zoomed. */
const SNAP_TO_FIT = 1.05;
const DOUBLE_CLICK_SCALE = 2.5;
/** Chrome turns a trackpad pinch into ctrl+wheel with deltaY ≈ −100 × ln(scale change). */
const PINCH_UNITS = 100;
/** A mouse wheel with ctrl jumps 100 units a notch; capped so one notch is a gentle step. */
const MAX_PINCH_STEP = 30;
/** No pinch or scroll for this long ends the gesture and the picture settles. */
const GESTURE_END_MS = 120;
/** How far past the limits a pinch can stretch, as log-scale headroom (35% over the top, down to 60% of fit). */
const STRETCH_OVER = Math.log(1.35);
const STRETCH_UNDER = Math.log(1 / 0.6);
/** A slightly underdamped spring, so a settle ends with a hint of bounce. */
const STIFFNESS = 260;
const DAMPING = 30;

type View = { scale: number; x: number; y: number };

/**
 * Zooms the wallpaper the way Photos does: a trackpad pinch scales the picture
 * around the fingers, two-finger scrolling pans it, pushing past the edges or
 * the zoom limits meets growing resistance, and on release everything springs
 * back into range. The home screen fades out while the picture is zoomed;
 * double-click toggles zoom, and Esc, typing or a resize restores it.
 */
export class WallpaperZoom {
    private view: View = { scale: 1, x: 0, y: 0 };
    /** The scale the fingers ask for; the view shows it stretched by `rubberBand` past the limits. */
    private requestedScale = 1;
    private velocity: View = { scale: 0, x: 0, y: 0 };
    private target: View | null = null;
    private focus = { x: innerWidth / 2, y: innerHeight / 2 };
    private gestureTimer = 0;
    private frame = 0;
    private lastTime = 0;
    private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    constructor(private readonly surface: HTMLElement) {}

    connect(): void {
        window.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
        document.addEventListener('dblclick', this.onDoubleClick);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('focusin', this.onFocusIn);
        window.addEventListener('resize', this.reset);
    }

    disconnect(): void {
        window.removeEventListener('wheel', this.onWheel, true);
        document.removeEventListener('dblclick', this.onDoubleClick);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('focusin', this.onFocusIn);
        window.removeEventListener('resize', this.reset);
        window.clearTimeout(this.gestureTimer);
        cancelAnimationFrame(this.frame);
    }

    get zoomed(): boolean {
        return this.view.scale > 1.001;
    }

    /** Back to fit at once, e.g. when the wallpaper itself changes. */
    readonly reset = (): void => {
        window.clearTimeout(this.gestureTimer);
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.target = null;
        this.velocity = { scale: 0, x: 0, y: 0 };
        this.view = { scale: 1, x: 0, y: 0 };
        this.apply();
        this.surface.classList.remove('is-zooming');
    };

    /** Animated back to fit. */
    restore(): void {
        if (!this.zoomed && !this.frame) return;
        this.settleTo({ scale: 1, x: 0, y: 0 });
    }

    private get media(): HTMLElement | null {
        return this.surface.querySelector<HTMLElement>('.wallpaper-media');
    }

    private readonly onWheel = (event: WheelEvent): void => {
        if (hasOpenLayer()) return;
        const pinch = event.ctrlKey;
        if (!pinch && !this.zoomed) return; // Ordinary scrolling of the home screen.
        event.preventDefault();
        event.stopPropagation();
        if (pinch && isTypingTarget(document.activeElement)) (document.activeElement as HTMLElement).blur();
        this.beginGesture();
        if (pinch) {
            const step = Math.max(-MAX_PINCH_STEP, Math.min(MAX_PINCH_STEP, event.deltaY));
            this.focus = { x: event.clientX, y: event.clientY };
            this.requestedScale *= Math.exp(-step / PINCH_UNITS);
            this.view = this.zoomedAbout(this.view, rubberBand(this.requestedScale), this.focus);
        } else {
            this.panBy(-event.deltaX, -event.deltaY);
        }
        this.apply();
        this.gestureTimer = window.setTimeout(this.endGesture, GESTURE_END_MS);
    };

    private readonly onDoubleClick = (event: MouseEvent): void => {
        if (hasOpenLayer() || isControl(event.target)) return;
        if (this.zoomed) {
            this.restore();
            return;
        }
        this.focus = { x: event.clientX, y: event.clientY };
        this.settleTo(this.clamped(this.zoomedAbout(this.view, DOUBLE_CLICK_SCALE, this.focus)));
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || !this.zoomed || hasOpenLayer()) return;
        event.preventDefault();
        this.restore();
    };

    /** Anything taking focus (⌘K, /, Tab) needs the home screen back. */
    private readonly onFocusIn = (): void => {
        if (this.zoomed) this.restore();
    };

    private beginGesture(): void {
        window.clearTimeout(this.gestureTimer);
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.target = null;
        this.velocity = { scale: 0, x: 0, y: 0 };
        this.requestedScale = unstretch(this.view.scale);
        this.surface.classList.add('is-zooming');
    }

    private readonly endGesture = (): void => {
        const scale = this.view.scale < SNAP_TO_FIT ? 1 : Math.min(MAX_SCALE, this.view.scale);
        this.settleTo(this.clamped(this.zoomedAbout(this.view, scale, this.focus)));
    };

    /** The view scaled to `scale` with the point under `at` staying put. */
    private zoomedAbout(view: View, scale: number, at: { x: number; y: number }): View {
        const origin = this.origin();
        const ratio = scale / view.scale;
        return {
            scale,
            x: at.x - origin - (at.x - origin - view.x) * ratio,
            y: at.y - origin - (at.y - origin - view.y) * ratio
        };
    }

    /** Panning past an edge moves less and less, so the picture resists being dragged out of view. */
    private panBy(dx: number, dy: number): void {
        const bounds = this.bounds(this.view.scale);
        const resist = (value: number, delta: number, min: number, max: number, size: number) => {
            const overshoot = value > max ? value - max : value < min ? min - value : 0;
            const outward = (value >= max && delta > 0) || (value <= min && delta < 0);
            return outward ? delta * 0.5 * Math.max(0, 1 - overshoot / (size * 0.3)) : delta;
        };
        this.view = {
            scale: this.view.scale,
            x: this.view.x + resist(this.view.x, dx, bounds.minX, 0, innerWidth),
            y: this.view.y + resist(this.view.y, dy, bounds.minY, 0, innerHeight)
        };
    }

    /**
     * The media layer reaches past the window by `bleed` on every side so a
     * blurred edge never shows; panning keeps that margin out of view too.
     */
    private bounds(scale: number): { minX: number; minY: number } {
        const media = this.media;
        const width = media?.offsetWidth || innerWidth;
        const height = media?.offsetHeight || innerHeight;
        return { minX: (1 - scale) * width, minY: (1 - scale) * height };
    }

    /** Where the untransformed media layer starts, in window coordinates (equal on both axes). */
    private origin(): number {
        const media = this.media;
        return media ? -(media.offsetWidth - innerWidth) / 2 : 0;
    }

    private clamped(view: View): View {
        const scale = Math.max(1, Math.min(MAX_SCALE, view.scale));
        const bounds = this.bounds(scale);
        return {
            scale,
            x: Math.min(0, Math.max(bounds.minX, view.x)),
            y: Math.min(0, Math.max(bounds.minY, view.y))
        };
    }

    private settleTo(target: View): void {
        window.clearTimeout(this.gestureTimer);
        this.target = target;
        this.surface.classList.add('is-zooming');
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
        this.surface.classList.remove('is-zooming');
    }

    private apply(): void {
        const media = this.media;
        const { scale, x, y } = this.view;
        if (media) media.style.transform = scale === 1 && x === 0 && y === 0 ? '' : `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        this.surface.dataset.zoom = scale.toFixed(3);
        document.body.classList.toggle('is-zoomed', this.zoomed || this.target !== null && this.target.scale > 1);
    }
}

/**
 * Past the limits the shown scale approaches a ceiling (or floor) however far
 * the fingers keep going: the further the stretch, the less it gives.
 */
function rubberBand(requested: number): number {
    if (requested > MAX_SCALE) return MAX_SCALE * Math.exp(stretch(Math.log(requested / MAX_SCALE), STRETCH_OVER));
    if (requested < 1) return Math.exp(-stretch(Math.log(1 / requested), STRETCH_UNDER));
    return requested;
}

/** The requested scale that `rubberBand` would show as `scale`, to pick a gesture up mid-bounce. */
function unstretch(scale: number): number {
    if (scale > MAX_SCALE) return MAX_SCALE * Math.exp(release(Math.log(scale / MAX_SCALE), STRETCH_OVER));
    if (scale < 1) return Math.exp(-release(Math.log(1 / scale), STRETCH_UNDER));
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

function isTypingTarget(target: Element | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
}

/** Double-clicks on controls, text and bookmarks keep their own meaning. */
function isControl(target: EventTarget | null): boolean {
    return target instanceof Element
        && Boolean(target.closest('a, button, input, label, select, textarea, [data-glass], bookmark-index, search-box, status-strip, dashboard-header, backup-toast, settings-panel, bookmark-dialog, .context-menu, .modal-backdrop'));
}
