// Palette PNGs for the link-preview pictures (cardPng in tools/lib/explain-shots.ts). A step's
// picture is flat colour with anti-aliased edges, so a palette of at most 256 colours drawn from
// the picture itself keeps it within a few levels of the render at about a third of the bytes.
// No dependency: zlib from Node, and a palette chosen by farthest-point (k-centre) selection, which
// bounds the worst pixel's error rather than the average, so a rare colour (a small coloured
// label) keeps its own entry instead of being averaged into the paper's anti-aliasing.
import { crc32, deflateSync } from 'node:zlib';

/** At most 256 RGB colours for an opaque picture, and each pixel's index into them. */
export function paletteOf(rgba: Uint8Array, max = 256): { palette: number[]; indices: Uint8Array } {
  const n = rgba.length / 4,
    counts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] !== 255) throw new Error('paletteOf takes opaque pictures');
    const key = (rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Colours in a fixed order, so the result depends only on the pixels.
  const keys = [...counts.keys()].sort((a, b) => a - b),
    u = keys.length,
    rgb = new Int32Array(u * 3);
  keys.forEach((k, i) => rgb.set([k >> 16, (k >> 8) & 255, k & 255], i * 3));
  // Each colour's nearest palette entry and its squared distance to it.
  const near = new Int32Array(u),
    dist = new Float64Array(u).fill(Infinity),
    palette: number[] = [];
  const add = (c: number) => {
    const p = palette.length;
    palette.push(keys[c]!);
    for (let i = 0; i < u; i++) {
      const dr = rgb[i * 3]! - rgb[c * 3]!,
        dg = rgb[i * 3 + 1]! - rgb[c * 3 + 1]!,
        db = rgb[i * 3 + 2]! - rgb[c * 3 + 2]!,
        d = dr * dr + dg * dg + db * db;
      if (d < dist[i]!) {
        dist[i] = d;
        near[i] = p;
      }
    }
  };
  if (u <= max) for (let c = 0; c < u; c++) add(c);
  else {
    // Start from the most common colour (the paper), then add the colour farthest from the palette
    // until it is full; ties go to the lowest colour value.
    let common = 0;
    for (let c = 1; c < u; c++) if (counts.get(keys[c]!)! > counts.get(keys[common]!)!) common = c;
    add(common);
    while (palette.length < max) {
      let far = 0;
      for (let c = 1; c < u; c++) if (dist[c]! > dist[far]!) far = c;
      add(far);
    }
  }
  const index = new Map<number, number>();
  keys.forEach((k, i) => index.set(k, near[i]!));
  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) indices[i] = index.get((rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!)!;
  return { palette, indices };
}

function chunk(type: string, data: Uint8Array): Buffer {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0);
  b.write(type, 4, 'latin1');
  b.set(data, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
}

/** An opaque RGBA picture as an 8-bit palette PNG (colour type 3, no filter, zlib level 9). */
export function palettePng(rgba: Uint8Array, width: number, height: number): Buffer {
  if (rgba.length !== width * height * 4) throw new Error(`palettePng: ${rgba.length} bytes is not ${width} × ${height} RGBA`);
  const { palette, indices } = paletteOf(rgba),
    header = Buffer.alloc(13),
    plte = Buffer.alloc(palette.length * 3),
    rows = Buffer.alloc((width + 1) * height);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per index
  header[9] = 3; // palette colour
  palette.forEach((k, i) => plte.set([k >> 16, (k >> 8) & 255, k & 255], i * 3));
  // Each row is filter byte 0 (none) then its indices: neighbouring indices of a palette are not
  // numerically close, so the predicting filters only cost bytes.
  for (let y = 0; y < height; y++) rows.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('PLTE', plte),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}
