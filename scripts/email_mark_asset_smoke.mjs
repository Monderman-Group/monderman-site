import assert from "node:assert/strict";
import fs from "node:fs";
import { inflateSync } from "node:zlib";

const assetPath = process.argv[2] || "assets/brand/monderman-email-mark-v1.png";
const png = fs.readFileSync(assetPath);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
assert(png.subarray(0, 8).equals(signature), `${assetPath}: invalid PNG signature`);

const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
const bitDepth = png[24];
const colorType = png[25];
const interlace = png[28];
assert.deepEqual([width, height, bitDepth, colorType, interlace], [96, 96, 8, 6, 0], `${assetPath}: expected a 96px non-interlaced RGBA PNG`);

const idat = [];
for (let offset = 8; offset < png.length;) {
  const length = png.readUInt32BE(offset);
  const type = png.toString("ascii", offset + 4, offset + 8);
  if (type === "IDAT") idat.push(png.subarray(offset + 8, offset + 8 + length));
  offset += length + 12;
}
assert(idat.length, `${assetPath}: PNG has no image data`);

const bytesPerPixel = 4;
const stride = width * bytesPerPixel;
const compressed = Buffer.concat(idat);
const filtered = inflateSync(compressed);
assert.equal(filtered.length, height * (stride + 1), `${assetPath}: unexpected decoded size`);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

const pixels = Buffer.alloc(width * height * bytesPerPixel);
for (let y = 0; y < height; y += 1) {
  const filter = filtered[y * (stride + 1)];
  assert(filter >= 0 && filter <= 4, `${assetPath}: unsupported PNG filter ${filter}`);
  for (let x = 0; x < stride; x += 1) {
    const raw = filtered[y * (stride + 1) + 1 + x];
    const target = y * stride + x;
    const left = x >= bytesPerPixel ? pixels[target - bytesPerPixel] : 0;
    const up = y > 0 ? pixels[target - stride] : 0;
    const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[target - stride - bytesPerPixel] : 0;
    pixels[target] = (raw + (
      filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : paeth(left, up, upperLeft)
    )) & 255;
  }
}

const alphaAt = (x, y) => pixels[(y * width + x) * bytesPerPixel + 3];
for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
  assert.equal(alphaAt(x, y), 0, `${assetPath}: corner ${x},${y} is not transparent`);
}

let transparent = 0;
let opaque = 0;
let visible = 0;
for (let index = 0; index < pixels.length; index += 4) {
  const alpha = pixels[index + 3];
  if (alpha === 0) transparent += 1;
  if (alpha === 255) opaque += 1;
  if (alpha > 0) {
    visible += 1;
    assert.equal(pixels[index], 255, `${assetPath}: visible red channel is not pure white`);
    assert.equal(pixels[index + 1], 255, `${assetPath}: visible green channel is not pure white`);
    assert.equal(pixels[index + 2], 255, `${assetPath}: visible blue channel is not pure white`);
  }
}
assert(transparent > 0 && opaque > 0 && visible > 300, `${assetPath}: transparency or visible mark is missing`);

console.log(`Email mark asset passed: ${assetPath} (${width}x${height}, transparent RGBA, pure-white linework).`);
