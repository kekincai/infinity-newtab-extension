type GlassGeometry = {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
};

const HDR_CANVAS_SIZE = 512;

const HDR_SHADER = `
struct GlassUniforms {
    size: vec2f,
    radius: f32,
    bridge: f32,
}

@group(0) @binding(0) var<uniform> glass: GlassUniforms;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    var positions = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f(3.0, -1.0),
        vec2f(-1.0, 3.0)
    );
    return vec4f(positions[index], 0.0, 1.0);
}

fn roundedRectDistance(point: vec2f, halfSize: vec2f, radius: f32) -> f32 {
    let corner = abs(point) - (halfSize - vec2f(radius));
    return length(max(corner, vec2f(0.0))) + min(max(corner.x, corner.y), 0.0) - radius;
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
    let uv = position.xy / vec2f(${HDR_CANVAS_SIZE}.0);
    let point = (uv - vec2f(0.5)) * glass.size;
    let halfSize = max(glass.size * 0.5 - vec2f(2.0), vec2f(1.0));
    let radius = min(glass.radius, min(halfSize.x, halfSize.y));
    let sdf = roundedRectDistance(point, halfSize, radius);
    let inside = 1.0 - smoothstep(0.0, 2.0, sdf);
    let rim = exp(-abs(sdf) * 0.58) * inside;

    let gradient = vec2f(dpdx(sdf), dpdy(sdf));
    let normal = gradient / max(length(gradient), 0.0001);
    let light = normalize(vec2f(0.5, -0.8660254));
    let tangent = vec2f(-light.y, light.x);
    let facing = abs(dot(normal, light));
    let specular = pow(facing, 3.2);
    let dispersion = dot(normal, tangent);
    let cyanEdge = pow(max(dispersion, 0.0), 2.4);
    let pinkEdge = pow(max(-dispersion, 0.0), 2.4);
    let innerCaustic = exp(-abs(sdf + 4.2) * 0.42) * inside;
    let motionGain = 1.0 + glass.bridge * 0.42;

    let whiteSpecular = vec3f(3.25) * rim * (0.16 + specular * 1.12);
    let skyDispersion = vec3f(0.16, 1.05, 2.8) * rim * cyanEdge * 0.52;
    let pinkDispersion = vec3f(2.35, 0.22, 0.82) * rim * pinkEdge * 0.4;
    let caustic = vec3f(0.52, 0.82, 1.35) * innerCaustic * (0.08 + glass.bridge * 0.12);
    let radiance = (whiteSpecular + skyDispersion + pinkDispersion + caustic) * motionGain;
    let alpha = clamp(rim * (0.2 + specular * 0.7 + (cyanEdge + pinkEdge) * 0.12) + innerCaustic * 0.08, 0.0, 0.96);

    return vec4f(radiance * alpha, alpha);
}`;

export class HdrGlassRenderer {
    readonly canvas = document.createElement('canvas');
    private device: any = null;
    private context: any = null;
    private pipeline: any = null;
    private uniformBuffer: any = null;
    private bindGroup: any = null;
    private geometry: GlassGeometry | null = null;
    private bridge = 0;
    private wantsVisible = false;
    private initializing = false;
    private readonly hdrMedia = window.matchMedia('(dynamic-range: high)');
    private readonly classObserver = new MutationObserver(() => this.syncVisibility());

    constructor() {
        this.canvas.className = 'hdr-glass-layer';
        this.canvas.width = HDR_CANVAS_SIZE;
        this.canvas.height = HDR_CANVAS_SIZE;
        this.canvas.setAttribute('aria-hidden', 'true');
    }

    connect(): void {
        this.classObserver.observe(document.body, { attributeFilter: ['class'] });
        this.hdrMedia.addEventListener('change', this.onDisplayChange);
        void this.initialize();
    }

    disconnect(): void {
        this.classObserver.disconnect();
        this.hdrMedia.removeEventListener('change', this.onDisplayChange);
        this.device?.destroy?.();
        this.device = null;
        this.canvas.classList.remove('is-visible');
    }

    show(): void {
        this.wantsVisible = true;
        this.syncVisibility();
    }

    hide(): void {
        this.wantsVisible = false;
        this.canvas.classList.remove('is-visible');
    }

    render(geometry: GlassGeometry, bridge: number): void {
        this.geometry = geometry;
        this.bridge = bridge;
        this.canvas.style.setProperty('--hdr-glass-x', `${geometry.x}px`);
        this.canvas.style.setProperty('--hdr-glass-y', `${geometry.y}px`);
        this.canvas.style.setProperty('--hdr-glass-width', `${geometry.width}px`);
        this.canvas.style.setProperty('--hdr-glass-height', `${geometry.height}px`);
        this.canvas.style.setProperty('--hdr-glass-radius', `${geometry.radius}px`);
        this.draw();
    }

    private readonly onDisplayChange = (): void => {
        if (this.hdrMedia.matches) void this.initialize();
        this.syncVisibility();
    };

    private async initialize(): Promise<void> {
        if (this.device || this.initializing || !this.hdrMedia.matches || !('gpu' in navigator)) return;
        this.initializing = true;
        try {
            const gpu = (navigator as Navigator & { gpu?: any }).gpu;
            const adapter = await gpu?.requestAdapter();
            if (!adapter) return;
            const device = await adapter.requestDevice();
            const context = this.canvas.getContext('webgpu') as any;
            if (!context) return;
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
                    targets: [{
                        format: 'rgba16float',
                        blend: {
                            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
                        }
                    }]
                },
                primitive: { topology: 'triangle-list' }
            });
            const uniformBuffer = device.createBuffer({
                size: 16,
                usage: 0x40 | 0x08
            });
            const bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
            });
            this.device = device;
            this.context = context;
            this.pipeline = pipeline;
            this.uniformBuffer = uniformBuffer;
            this.bindGroup = bindGroup;
            this.canvas.dataset.hdrRenderer = 'webgpu';
            void device.lost.then(() => {
                this.device = null;
                this.canvas.classList.remove('is-visible');
                this.canvas.dataset.hdrRenderer = 'lost';
            });
            this.draw();
            this.syncVisibility();
        } catch {
            this.canvas.dataset.hdrRenderer = 'unavailable';
        } finally {
            this.initializing = false;
        }
    }

    private syncVisibility(): void {
        const enabled = this.wantsVisible
            && Boolean(this.device)
            && this.hdrMedia.matches
            && document.body.classList.contains('hdr-highlights');
        this.canvas.classList.toggle('is-visible', enabled);
    }

    private draw(): void {
        if (!this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.bindGroup || !this.geometry) return;
        const values = new Float32Array([
            this.geometry.width,
            this.geometry.height,
            this.geometry.radius,
            this.bridge
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, values);
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
