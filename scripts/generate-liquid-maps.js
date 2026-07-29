const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SCALE = 2;
const WIDTH = 170 * SCALE;
const HEIGHT = 104 * SCALE;
const OUTPUT_DIR = path.join(__dirname, '..', 'assets');

const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    return value >>> 0;
});

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const length = Buffer.alloc(4);
    const checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
    return Buffer.concat([length, typeBuffer, data, checksum]);
}

function writePng(filename, width, height, pixelAt) {
    const scanlines = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y += 1) {
        const rowOffset = y * (width * 4 + 1);
        scanlines[rowOffset] = 0;
        for (let x = 0; x < width; x += 1) {
            const pixel = pixelAt(x, y);
            const offset = rowOffset + 1 + x * 4;
            scanlines[offset] = pixel[0];
            scanlines[offset + 1] = pixel[1];
            scanlines[offset + 2] = pixel[2];
            scanlines[offset + 3] = pixel[3];
        }
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    const png = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), png);
}

function capsulePoint(x, y) {
    const radius = HEIGHT / 2 - 2;
    const centerY = HEIGHT / 2;
    const closestX = Math.max(radius, Math.min(WIDTH - radius, x));
    const dx = x - closestX;
    const dy = y - centerY;
    const radialDistance = Math.hypot(dx, dy);
    return {
        inside: radialDistance <= radius,
        distanceToEdge: radius - radialDistance,
        normalX: radialDistance ? dx / radialDistance : 0,
        normalY: radialDistance ? dy / radialDistance : -1
    };
}

function refractionMagnitude(distanceToEdge) {
    const bezel = 19 * SCALE;
    if (distanceToEdge < 0 || distanceToEdge >= bezel) return 0;

    // Convex squircle profile from the article, converted through Snell's law.
    const t = Math.max(0.0001, Math.min(0.9999, distanceToEdge / bezel));
    const u = 1 - t;
    const derivative = (u ** 3) / ((1 - u ** 4) ** 0.75);
    const incidentAngle = Math.atan(derivative);
    const refractedAngle = Math.asin(Math.sin(incidentAngle) / 1.5);
    const displacement = Math.tan(incidentAngle - refractedAngle);
    return Math.min(1, displacement / 1.12);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

writePng('liquid-magnifying-map.png', WIDTH, HEIGHT, (x, y) => [
    Math.round(255 * (1 - x / (WIDTH - 1))),
    Math.round(255 * (1 - y / (HEIGHT - 1))),
    0,
    255
]);

writePng('liquid-refraction-map.png', WIDTH, HEIGHT, (x, y) => {
    const point = capsulePoint(x + 0.5, y + 0.5);
    if (!point.inside) return [128, 128, 128, 255];
    const magnitude = refractionMagnitude(point.distanceToEdge);
    const inwardX = -point.normalX * magnitude;
    const inwardY = -point.normalY * magnitude;
    return [
        Math.round(128 + inwardX * 127),
        Math.round(128 + inwardY * 127),
        128,
        255
    ];
});

writePng('liquid-specular-map.png', WIDTH, HEIGHT, (x, y) => {
    const point = capsulePoint(x + 0.5, y + 0.5);
    const rim = point.inside
        ? Math.max(0, 1 - point.distanceToEdge / (3.5 * SCALE))
        : 0;
    const lightAngle = -Math.PI / 3;
    const lightX = Math.cos(lightAngle);
    const lightY = Math.sin(lightAngle);
    const facing = Math.abs(point.normalX * lightX + point.normalY * lightY) ** 5;
    const alpha = Math.round(255 * rim * (0.18 + 0.82 * facing));
    return [255, 255, 255, alpha];
});

console.log(`Generated Liquid Glass maps at ${WIDTH}x${HEIGHT}.`);
