export type OpticalShape = {
    width: number;
    height: number;
    radius: number;
};

export type OpticalMaps = {
    magnifying: string;
    displacement: string;
    specular: string;
    maximumDisplacement: number;
};

export type OpticalProfile = 'convex' | 'lip';

const REFRACTIVE_INDEX = 1.5;
const RADIAL_SAMPLE_COUNT = 128;
const DISTANCE_TO_BACKDROP = 55;
const GLASS_THICKNESS = 63;
const SPECULAR_ANGLE = -Math.PI / 3;

export function opticalShapeKey(shape: OpticalShape): string {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    return `${shape.width}x${shape.height}r${shape.radius}@${ratio}`;
}

export function convexSquircle(value: number): number {
    return Math.pow(1 - Math.pow(1 - value, 4), 1 / 4);
}

export function lipSquircle(value: number): number {
    const convex = convexSquircle(value);
    const concave = 1 - convex;
    const blend = smootherstep(value);
    return convex * (1 - blend) + concave * blend;
}

/** Port of the article's Snell-law radius precomputation. */
export function precalculateDisplacements(
    distanceToBackdrop = DISTANCE_TO_BACKDROP,
    glassThickness = GLASS_THICKNESS,
    surface = convexSquircle,
    refractiveIndex = REFRACTIVE_INDEX,
    samples = RADIAL_SAMPLE_COUNT
): number[] {
    const ratio = 1 / refractiveIndex;
    const refract = (normalX: number, normalY: number): [number, number] | null => {
        const discriminant = 1 - ratio * ratio * (1 - normalY * normalY);
        if (discriminant < 0) return null;
        const root = Math.sqrt(discriminant);
        return [
            -(ratio * normalY + root) * normalX,
            ratio - (ratio * normalY + root) * normalY
        ];
    };

    return Array.from({ length: samples }, (_, index) => {
        const distanceFromSide = index / samples;
        const height = surface(distanceFromSide);
        const delta = distanceFromSide < 1 ? 0.0001 : -0.0001;
        const derivative = (surface(distanceFromSide + delta) - height) / delta;
        const normalLength = Math.hypot(derivative, 1);
        const refracted = refract(-derivative / normalLength, -1 / normalLength);
        if (!refracted) return 0;
        const depth = height * glassThickness + distanceToBackdrop;
        return refracted[0] * (depth / refracted[1]);
    });
}

export function createOpticalMaps(shape: OpticalShape, profile: OpticalProfile = 'convex'): OpticalMaps {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const radius = clamp(shape.radius, 2, Math.min(shape.width, shape.height) / 2);
    const bezelWidth = Math.max(2, radius * 0.75);
    const surface = profile === 'lip' ? lipSquircle : convexSquircle;
    const displacements = precalculateDisplacements(DISTANCE_TO_BACKDROP, GLASS_THICKNESS, surface);
    const maximumDisplacement = Math.max(...displacements.map(Math.abs));

    return {
        magnifying: imageDataUrl(createMagnifyingMap(
            shape.width,
            shape.height,
            pixelRatio
        )),
        displacement: imageDataUrl(createDisplacementMap(
            shape.width,
            shape.height,
            radius,
            bezelWidth,
            maximumDisplacement,
            displacements,
            pixelRatio
        )),
        specular: imageDataUrl(createSpecularMap(
            shape.width,
            shape.height,
            radius,
            bezelWidth,
            SPECULAR_ANGLE,
            pixelRatio
        )),
        maximumDisplacement
    };
}

/** The article's precision lens adds a central magnification field before the bezel bend. */
function createMagnifyingMap(width: number, height: number, pixelRatio: number): ImageData {
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
    const image = new ImageData(canvasWidth, canvasHeight);

    for (let y = 0; y < canvasHeight; y += 1) {
        for (let x = 0; x < canvasWidth; x += 1) {
            const normalizedX = ((x + 0.5) / canvasWidth) * 2 - 1;
            const normalizedY = ((y + 0.5) / canvasHeight) * 2 - 1;
            const distance = Math.hypot(normalizedX, normalizedY);
            const strength = distance < 1 ? 1 - smoothstep(0.08, 0.94, distance) : 0;
            const index = (y * canvasWidth + x) * 4;
            image.data[index] = 128 - normalizedX * strength * 112;
            image.data[index + 1] = 128 - normalizedY * strength * 112;
            image.data[index + 2] = 128;
            image.data[index + 3] = 255;
        }
    }
    return image;
}

/** Port of the article's RG displacement-map rasterizer. */
function createDisplacementMap(
    width: number,
    height: number,
    radius: number,
    bezelWidth: number,
    maximumDisplacement: number,
    displacements: number[],
    pixelRatio: number
): ImageData {
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
    const image = new ImageData(canvasWidth, canvasHeight);
    new Uint32Array(image.data.buffer).fill(0xff008080);

    const scaledRadius = radius * pixelRatio;
    const scaledBezel = bezelWidth * pixelRatio;
    const radiusSquared = scaledRadius ** 2;
    const outerSquared = (scaledRadius + 1) ** 2;
    const innerSquared = (scaledRadius - scaledBezel) ** 2;
    const middleWidth = canvasWidth - scaledRadius * 2;
    const middleHeight = canvasHeight - scaledRadius * 2;

    for (let y = 0; y < canvasHeight; y += 1) {
        for (let x = 0; x < canvasWidth; x += 1) {
            const left = x < scaledRadius;
            const right = x >= canvasWidth - scaledRadius;
            const top = y < scaledRadius;
            const bottom = y >= canvasHeight - scaledRadius;
            const offsetX = left ? x - scaledRadius : right ? x - scaledRadius - middleWidth : 0;
            const offsetY = top ? y - scaledRadius : bottom ? y - scaledRadius - middleHeight : 0;
            const distanceSquared = offsetX * offsetX + offsetY * offsetY;
            if (distanceSquared > outerSquared || distanceSquared < innerSquared) continue;

            const distance = Math.sqrt(distanceSquared);
            if (!distance) continue;
            const antiAlias = distanceSquared < radiusSquared
                ? 1
                : 1 - (distance - scaledRadius);
            const distanceFromBorder = scaledRadius - distance;
            const sample = Math.floor((distanceFromBorder / scaledBezel) * displacements.length);
            const magnitude = displacements[sample] ?? 0;
            const normalizedX = (-(offsetX / distance) * magnitude) / maximumDisplacement;
            const normalizedY = (-(offsetY / distance) * magnitude) / maximumDisplacement;
            const index = (y * canvasWidth + x) * 4;
            image.data[index] = 128 + normalizedX * 127 * antiAlias;
            image.data[index + 1] = 128 + normalizedY * 127 * antiAlias;
            image.data[index + 2] = 0;
            image.data[index + 3] = 255;
        }
    }
    return image;
}

/** Port of the article's independent rim-light map. */
function createSpecularMap(
    width: number,
    height: number,
    radius: number,
    bezelWidth: number,
    angle: number,
    pixelRatio: number
): ImageData {
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
    const image = new ImageData(canvasWidth, canvasHeight);
    const scaledRadius = radius * pixelRatio;
    const scaledBezel = bezelWidth * pixelRatio;
    const radiusSquared = scaledRadius ** 2;
    const outerSquared = (scaledRadius + pixelRatio) ** 2;
    const innerSquared = (scaledRadius - scaledBezel) ** 2;
    const middleWidth = canvasWidth - scaledRadius * 2;
    const middleHeight = canvasHeight - scaledRadius * 2;
    const light = [Math.cos(angle), Math.sin(angle)];

    for (let y = 0; y < canvasHeight; y += 1) {
        for (let x = 0; x < canvasWidth; x += 1) {
            const left = x < scaledRadius;
            const right = x >= canvasWidth - scaledRadius;
            const top = y < scaledRadius;
            const bottom = y >= canvasHeight - scaledRadius;
            const offsetX = left ? x - scaledRadius : right ? x - scaledRadius - middleWidth : 0;
            const offsetY = top ? y - scaledRadius : bottom ? y - scaledRadius - middleHeight : 0;
            const distanceSquared = offsetX * offsetX + offsetY * offsetY;
            if (distanceSquared > outerSquared || distanceSquared < innerSquared) continue;

            const distance = Math.sqrt(distanceSquared);
            if (!distance) continue;
            const distanceFromBorder = scaledRadius - distance;
            const antiAlias = distanceSquared < radiusSquared
                ? 1
                : 1 - (distance - scaledRadius) / pixelRatio;
            const normalX = offsetX / distance;
            const normalY = -offsetY / distance;
            const highlight = Math.abs(normalX * light[0] + normalY * light[1])
                * Math.sqrt(Math.max(0, 1 - (1 - distanceFromBorder / pixelRatio) ** 2));
            const brightness = 255 * highlight;
            const index = (y * canvasWidth + x) * 4;
            image.data[index] = brightness;
            image.data[index + 1] = brightness;
            image.data[index + 2] = brightness;
            image.data[index + 3] = brightness * highlight * antiAlias;
        }
    }
    return image;
}

function imageDataUrl(image: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(start: number, end: number, value: number): number {
    const progress = clamp((value - start) / (end - start), 0, 1);
    return progress * progress * (3 - 2 * progress);
}

function smootherstep(value: number): number {
    const progress = clamp(value, 0, 1);
    return progress ** 3 * (progress * (progress * 6 - 15) + 10);
}
