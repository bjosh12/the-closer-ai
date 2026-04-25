const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const width = 256;
const height = 256;
const pngPath = path.join(__dirname, '..', 'public', 'icon.png');

const pixels = Buffer.alloc(width * height * 4, 0);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = (y * width + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function fillEllipse(cx, cy, rx, ry, color) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        setPixel(x, y, color[0], color[1], color[2], color[3]);
      }
    }
  }
}

function fillCircle(cx, cy, r, color) {
  fillEllipse(cx, cy, r, r, color);
}

function fillTriangle(p1, p2, p3, color) {
  const minX = Math.max(0, Math.floor(Math.min(p1[0], p2[0], p3[0])));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(p1[0], p2[0], p3[0])));
  const minY = Math.max(0, Math.floor(Math.min(p1[1], p2[1], p3[1])));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(p1[1], p2[1], p3[1])));
  const area = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1]);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((p2[0] - p1[0]) * (y - p1[1]) - (p2[1] - p1[1]) * (x - p1[0])) / area;
      const w1 = ((p3[0] - p2[0]) * (y - p2[1]) - (p3[1] - p2[1]) * (x - p2[0])) / area;
      const w2 = ((p1[0] - p3[0]) * (y - p3[1]) - (p1[1] - p3[1]) * (x - p3[0])) / area;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
        setPixel(x, y, color[0], color[1], color[2], color[3]);
      }
    }
  }
}

function fillPolygon(points, color) {
  for (let i = 1; i < points.length - 1; i++) {
    fillTriangle(points[0], points[i], points[i + 1], color);
  }
}

const black = [0, 0, 0, 255];
const white = [255, 255, 255, 255];
const gray = [30, 30, 30, 255];

// Body and head
fillEllipse(148, 156, 70, 88, black);
fillCircle(96, 86, 44, black);

// Wing
fillEllipse(156, 152, 56, 64, gray);
fillEllipse(160, 162, 50, 58, black);

// Tail feathers
fillPolygon([
  [178, 194],
  [232, 164],
  [220, 186],
  [248, 174],
  [240, 200],
], black);

// Beak
fillTriangle([58, 88], [34, 76], [46, 94], black);
fillTriangle([58, 88], [44, 84], [48, 98], gray);

// Eye
fillCircle(84, 74, 8, white);
fillCircle(84, 74, 3, black);

// Detail lines
fillEllipse(118, 130, 22, 16, black);
fillEllipse(128, 172, 18, 12, black);

function crc32(buf) {
  const table = Array(256).fill(0).map((_, idx) => {
    let c = idx;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  let c = -1;
  for (const b of buf) {
    c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  const crcValue = crc32(Buffer.concat([typeBuf, data]));
  crc.writeUInt32BE(crcValue, 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr.writeUInt8(8, 8); // bit depth
ihdr.writeUInt8(6, 9); // color type RGBA
ihdr.writeUInt8(0, 10); // compression
ihdr.writeUInt8(0, 11); // filter
ihdr.writeUInt8(0, 12); // interlace

const rawData = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) {
  const rowStart = y * (width * 4 + 1);
  rawData[rowStart] = 0;
  const srcStart = y * width * 4;
  pixels.copy(rawData, rowStart + 1, srcStart, srcStart + width * 4);
}

const idat = zlib.deflateSync(rawData);
const pngBuffer = Buffer.concat([header, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(pngPath, pngBuffer);
console.log(`Generated ${pngPath} (${pngBuffer.length} bytes)`);
