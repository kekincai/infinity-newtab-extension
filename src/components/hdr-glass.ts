/** One glass control as the HDR layer sees it, in CSS pixels. `glint` is the pointer light on it, 0–1. */
export type GlassRim = {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    opacity: number;
    glint: number;
};

export const MAX_RIMS = 16;
/** Brightest rim light as a multiple of SDR white; the display clips anything past its own headroom. */
const PEAK = 2.2;
/** Caps the layer's backing store; larger windows render at a slightly lower density. */
const MAX_PIXELS = 3840 * 2400;
const FRAME_FLOATS = 8;
const RIM_FLOATS = 8;

const HDR_SHADER = `
struct Frame {
    pointer: vec2f,
    count: f32,
    scale: f32,
    peak: f32,
    unused0: f32,
    unused1: f32,
    unused2: f32,
}

struct Rim {
    rect: vec4f,
    shape: vec4f,
}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> rims: array<Rim, ${MAX_RIMS}>;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    return vec4f(positions[index], 0.0, 1.0);
}

fn roundedRect(point: vec2f, half: vec2f, radius: f32) -> f32 {
    let corner = abs(point) - half + vec2f(radius);
    return length(max(corner, vec2f(0.0))) + min(max(corner.x, corner.y), 0.0) - radius;
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
    let point = position.xy / frame.scale;
    let pixel = 1.0 / frame.scale;
    let light = normalize(vec2f(-0.55, -0.85));
    var radiance = 0.0;
    var coverage = 0.0;
    for (var index = 0u; index < u32(frame.count); index = index + 1u) {
        let rim = rims[index];
        let half = rim.rect.zw * 0.5;
        let local = point - rim.rect.xy - half;
        let radius = min(rim.shape.x, min(half.x, half.y));
        let distance = roundedRect(local, half, radius);
        if (distance > pixel || distance < -4.0) {
            continue;
        }
        // A 1.25 px band just inside the edge, anti-aliased to the device pixel on both sides.
        let band = smoothstep(-1.25 - pixel, -1.25, distance) * (1.0 - smoothstep(-pixel, pixel * 0.5, distance));
        let step = 0.5;
        let normal = normalize(vec2f(
            roundedRect(local + vec2f(step, 0.0), half, radius) - roundedRect(local - vec2f(step, 0.0), half, radius),
            roundedRect(local + vec2f(0.0, step), half, radius) - roundedRect(local - vec2f(0.0, step), half, radius)
        ));
        let facing = max(dot(normal, light), 0.0);
        let away = max(-dot(normal, light), 0.0);
        let toPointer = point - frame.pointer;
        let glint = rim.shape.z * exp(-dot(toPointer, toPointer) / 1800.0);
        let brightness = 0.12 + pow(facing, 2.0) * 0.6 + pow(away, 3.0) * 0.18 + glint * 1.3;
        radiance = radiance + band * brightness * rim.shape.y;
        coverage = max(coverage, band * rim.shape.y);
    }
    // Premultiplied light that may exceed its alpha: it adds to what is below, past SDR white on HDR screens.
    return vec4f(vec3f(radiance * frame.peak), coverage * 0.3);
}`;

const hdrMedia = window.matchMedia('(dynamic-range: high)');

/** The one test for an HDR screen; the layer, the settings and its description all use it. */
export function isHdrDisplay(): boolean {
    return hdrMedia.matches;
}

export function onHdrDisplayChange(listener: () => void): () => void {
    hdrMedia.addEventListener('change', listener);
    return () => hdrMedia.removeEventListener('change', listener);
}

/**
 * A transparent full-window WebGPU layer that draws the rim light of every
 * glass control in extended range, so the highlights rise above SDR white on
 * HDR screens. It only exists on HDR displays with the setting on.
 */
export class HdrRimLayer {
    readonly canvas = document.createElement('canvas');
    private device: any = null;
    private context: any = null;
    private pipeline: any = null;
    private frameBuffer: any = null;
    private rimBuffer: any = null;
    private bindGroup: any = null;
    private rims: GlassRim[] = [];
    private pointer = { x: -1e4, y: -1e4 };
    private initializing = false;
    private drawFrame = 0;
    private stopWatchingDisplay: (() => void) | null = null;
    private readonly classObserver = new MutationObserver(() => this.syncVisibility());

    /** `onActivate` runs whenever the layer starts drawing, so its owner can measure the rims for it. */
    constructor(private readonly onActivate: () => void = () => undefined) {
        this.canvas.className = 'hdr-glass-layer';
        this.canvas.setAttribute('aria-hidden', 'true');
    }

    /** Ready to draw: HDR screen, the setting on and a WebGPU device. */
    get active(): boolean {
        return Boolean(this.device) && isHdrDisplay() && document.body.classList.contains('hdr-highlights');
    }

    connect(): void {
        this.classObserver.observe(document.body, { attributeFilter: ['class'] });
        this.stopWatchingDisplay = onHdrDisplayChange(this.onDisplayChange);
        window.addEventListener('resize', this.onResize);
        this.onResize();
        void this.initialize();
    }

    disconnect(): void {
        this.classObserver.disconnect();
        this.stopWatchingDisplay?.();
        this.stopWatchingDisplay = null;
        window.removeEventListener('resize', this.onResize);
        cancelAnimationFrame(this.drawFrame);
        this.drawFrame = 0;
        this.device?.destroy?.();
        this.device = null;
        this.canvas.classList.remove('is-visible');
    }

    update(rims: GlassRim[], pointer: { x: number; y: number }): void {
        this.rims = rims.slice(0, MAX_RIMS);
        this.pointer = pointer;
        this.canvas.dataset.hdrCount = String(this.rims.length);
        this.scheduleDraw();
    }

    private readonly onDisplayChange = (): void => {
        if (isHdrDisplay()) void this.initialize();
        this.syncVisibility();
    };

    private readonly onResize = (): void => {
        const ratio = Math.max(1, window.devicePixelRatio || 1);
        const scale = Math.min(ratio, Math.sqrt(MAX_PIXELS / Math.max(1, innerWidth * innerHeight)));
        this.canvas.width = Math.max(1, Math.round(innerWidth * scale));
        this.canvas.height = Math.max(1, Math.round(innerHeight * scale));
        this.scheduleDraw();
    };

    private async initialize(): Promise<void> {
        if (this.device || this.initializing || !isHdrDisplay()) return;
        if (!('gpu' in navigator)) {
            this.canvas.dataset.hdrRenderer = 'unavailable';
            return;
        }
        this.initializing = true;
        try {
            const gpu = (navigator as Navigator & { gpu?: any }).gpu;
            const adapter = await gpu?.requestAdapter();
            if (!adapter) {
                this.canvas.dataset.hdrRenderer = 'unavailable';
                return;
            }
            const device = await adapter.requestDevice();
            const context = this.canvas.getContext('webgpu') as any;
            if (!context) {
                this.canvas.dataset.hdrRenderer = 'unavailable';
                return;
            }
            context.configure({
                device,
                format: 'rgba16float',
                alphaMode: 'premultiplied',
                toneMapping: { mode: 'extended' }
            });
            const shader = device.createShaderModule({ code: HDR_SHADER });
            const pipeline = device.createRenderPipeline({
                layout: 'auto',
                vertex: { module: shader, entryPoint: 'vertexMain' },
                fragment: {
                    module: shader,
                    entryPoint: 'fragmentMain',
                    targets: [{ format: 'rgba16float' }]
                },
                primitive: { topology: 'triangle-list' }
            });
            // GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            const frameBuffer = device.createBuffer({ size: FRAME_FLOATS * 4, usage: 0x40 | 0x08 });
            const rimBuffer = device.createBuffer({ size: MAX_RIMS * RIM_FLOATS * 4, usage: 0x40 | 0x08 });
            this.bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: frameBuffer } },
                    { binding: 1, resource: { buffer: rimBuffer } }
                ]
            });
            this.device = device;
            this.context = context;
            this.pipeline = pipeline;
            this.frameBuffer = frameBuffer;
            this.rimBuffer = rimBuffer;
            this.canvas.dataset.hdrRenderer = 'webgpu';
            void device.lost.then(() => {
                this.device = null;
                this.canvas.dataset.hdrRenderer = 'lost';
                this.syncVisibility();
            });
            this.syncVisibility();
        } catch {
            this.canvas.dataset.hdrRenderer = 'unavailable';
        } finally {
            this.initializing = false;
        }
    }

    private syncVisibility(): void {
        const active = this.active;
        const activated = active && !this.canvas.classList.contains('is-visible');
        this.canvas.classList.toggle('is-visible', active);
        if (!active) return;
        this.scheduleDraw();
        // Nothing may move on the page after the device arrives; ask for the rims now.
        if (activated) this.onActivate();
    }

    private scheduleDraw(): void {
        if (this.drawFrame || !this.active) return;
        this.drawFrame = requestAnimationFrame(() => {
            this.drawFrame = 0;
            this.draw();
        });
    }

    private draw(): void {
        if (!this.active) return;
        const scale = this.canvas.width / Math.max(1, innerWidth);
        this.device.queue.writeBuffer(this.frameBuffer, 0, new Float32Array([
            this.pointer.x, this.pointer.y, this.rims.length, scale, PEAK, 0, 0, 0
        ]));
        const rims = new Float32Array(MAX_RIMS * RIM_FLOATS);
        this.rims.forEach((rim, index) => rims.set(
            [rim.x, rim.y, rim.width, rim.height, rim.radius, rim.opacity, rim.glint, 0],
            index * RIM_FLOATS
        ));
        this.device.queue.writeBuffer(this.rimBuffer, 0, rims);
        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3);
        pass.end();
        this.device.queue.submit([encoder.finish()]);
    }
}
