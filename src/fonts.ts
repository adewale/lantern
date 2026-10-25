// Shapers for the embedded fonts, built on the vendored glyph shaper.
// The fonts (Inter, JetBrains Mono; OFL) are subset by tools/fonts.sh into
// src/font-data.ts: Latin-1, punctuation, arrows, math, shapes. The mono face
// carries no ligature lookups, so code reads as literal source, like a diff.
import { loadFont, run } from '../vendor/glyph.js';
import type { Run } from '../vendor/glyph.js';
import { SANS, MONO } from './font-data.ts';
import { perf } from './perf.ts';

const FONTS = { sans: SANS, mono: MONO };

/** The embedded faces. */
export type FontName = keyof typeof FONTS;
/** Shape `text` at `size` scene units: glyph outlines and advances. Memoized. */
export type Shaper = (text: string, size: number) => Run;

function bytesOf(b64: string): Uint8Array {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let loading: Promise<Record<FontName, Shaper>> | null = null;

/** Shaped runs kept per face: far more than one scene uses, so seeks never reshape. */
export const SHAPE_MEMO_MAX = 8192;
const memos: Array<Map<string, Run>> = [];
/** How many shaped runs are memoized now, over both faces (for tests). */
export function shapeMemoSize(): number { return memos.reduce((n, m) => n + m.size, 0); }
let shapers: Record<FontName, Shaper> | null = null;

/**
 * Decode the embedded fonts (once; concurrent callers share one decode).
 * Scene.run() calls this, so scenes never need to.
 */
export function loadFonts(): Promise<Record<FontName, Shaper>> {
  loading ??= buildShapers().then((s) => (shapers = s));
  return loading;
}

/** The shaper for 'sans' or 'mono'. Throws if fonts haven't been loaded. */
export function shaperFor(font: FontName): Shaper {
  if (!shapers) throw new Error('Fonts are not loaded: await loadFonts() first (Scene.run() does this for scenes)');
  const s = shapers[font] as Shaper | undefined;
  if (!s) throw new Error(`Unknown font "${font}": use 'sans' or 'mono'`);
  return s;
}

async function buildShapers(): Promise<Record<FontName, Shaper>> {
  const end = perf.begin('fonts.decode');
  const out: Partial<Record<FontName, Shaper>> = {};
  for (const [key, b64] of Object.entries(FONTS) as Array<[FontName, string]>) {
    const r = await loadFont(bytesOf(b64));
    if (r.tag !== 'Ok') throw new Error(key + ': ' + JSON.stringify(r.error));
    const font = r.value;
    // Shaping is a pure function of (font, text, size): memoize it. Re-running a
    // scene (every seek does) then costs no shaping at all, and identical
    // segment arrays let Text reuse its flattened outlines.
    // The memo is bounded, least recently used out first: a DecimalNumber shapes a new
    // string every frame, so a long count (or a Worker serving many scenes) would
    // otherwise keep every one of them.
    const memo = new Map<string, Run>();
    memos.push(memo);
    out[key] = (text, size) => {
      const k = size + '\u0000' + text;
      let r = memo.get(k);
      if (r) { memo.delete(k); memo.set(k, r); return r; }
      const ru = run(font, key, text, size);
      if (ru.tag !== 'Ok') throw new Error('shape: ' + JSON.stringify(ru.error));
      memo.set(k, (r = ru.value));
      if (memo.size > SHAPE_MEMO_MAX) memo.delete(memo.keys().next().value!);
      return r;
    };
  }
  end();
  // Both keys of FONTS were filled above
  return out as Record<FontName, Shaper>;
}
