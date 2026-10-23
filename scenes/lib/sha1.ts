// SHA-1 over bytes, synchronous and dependency-free, so a scene can hash git
// objects the same way in Node and in the browser. Not for security; git's
// object ids are what it is for. Checked against `git hash-object` in
// test/fidelity.test.ts.
const enc = new TextEncoder();

/** 40 hex chars. */
export function sha1(input: Uint8Array | string): string {
  const msg = typeof input === 'string' ? enc.encode(input) : input;
  const ml = msg.length;
  const withOne = ml + 1, total = Math.ceil((withOne + 8) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg); buf[ml] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 4, (ml * 8) >>> 0); dv.setUint32(total - 8, Math.floor(ml * 8 / 2 ** 32));
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1]
        : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]!) >>> 0;
      e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** Concatenate byte chunks (strings are UTF-8). */
export function bytes(...parts: Array<Uint8Array | string>): Uint8Array {
  const chunks = parts.map((p) => (typeof p === 'string' ? enc.encode(p) : p));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** 40 hex chars -> 20 bytes. */
export function unhex(hex: string): Uint8Array { return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16))); }

/**
 * Git's object id, as exgit computes it (Exgit.Object.compute_sha/2):
 * sha1("<type> <size>\0" + content).
 */
export function objectId(type: string, content: Uint8Array | string): string {
  const body = typeof content === 'string' ? enc.encode(content) : content;
  return sha1(bytes(`${type} ${body.length}\0`, body));
}
