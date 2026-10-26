// Optional outline snapshots. This module has no installation side effects: a
// page without lettering never imports a provider or carries a lettering store.
import type { SceneClass } from './scene.ts';
import { Scene } from './scene.ts';
import { loadFonts } from './fonts.ts';
import type { FontName, Shaper } from './fonts.ts';
import type { Run } from '../vendor/glyph.js';

export interface LetteringRequest {
  faces?: Partial<Record<FontName, string>>;
  /** ISO 15924 script codes, e.g. Arab, Deva, Hebr, Hani. */
  scripts?: readonly string[];
  math?: boolean;
}
export interface LetteringSnapshot {
  version: 1;
  sourceHash: string;
  builderHash: string;
  request: LetteringRequest;
  /** Unit-em runs; clusters count source code points, including for RTL runs. */
  runs: Record<string, Run>;
  faces: Record<string, { hash: string; data: string; license: string }>;
  shaper: string;
}
export interface LetteringProvider {
  shape(font: FontName, text: string, size: number, fallback: Shaper): Run;
  math(latex: string, size: number, display: boolean): Run;
}
export const letteringOf = (Source: object): LetteringRequest | undefined =>
  (Source as { meta?: { lettering?: LetteringRequest } }).meta?.lettering;
export const usesLettering = (request: LetteringRequest, font: FontName, text: string): boolean =>
  !!request.faces?.[font] || (request.scripts ?? []).some((s) => new RegExp(`\\p{Script_Extensions=${s}}`, 'u').test(text));
export const runKey = (font: string, text: string, display = false): string => JSON.stringify([font, text, display]);
export function scaledRun(run: Run, size: number): Run {
  return { ...run, width: run.width * size, ascent: run.ascent * size, descent: run.descent * size,
    s: (run.s ?? 1) * size,
    glyphs: run.glyphs.map((g) => ({ ...g, x: g.x * size, dx: g.dx * size, dy: g.dy * size, ax: g.ax * size, s: (g.s ?? run.s ?? 1) * size })) };
}
export function snapshotProvider(snapshot: LetteringSnapshot): LetteringProvider {
  const lookup = (font: string, text: string, size: number, display = false) => {
    const run = snapshot.runs[runKey(font, text, display)];
    if (!run) throw new Error(`Lettering snapshot has no run for ${JSON.stringify(text)} (${font}); run explain snapshots`);
    return scaledRun(run, size);
  };
  return {
    shape: (font, text, size, fallback) => usesLettering(snapshot.request, font, text)
      ? lookup(font, text, size) : fallback(text, size),
    math: (text, size, display) => lookup('math', text, size, display),
  };
}

// Text and diagram lowering use the same public font table. Lease it for a
// complete run, and restore it even on StopScene or errors. Once an optional
// provider is installed ALL runs participate, so overlapping seeks, videos and
// ordinary scenes cannot borrow one another's fonts. No patch is installed on
// pages which do not request lettering.
const providers: WeakMap<object, LetteringProvider> = /* @__PURE__ */ new WeakMap();
let installed = false;
let pending: Promise<unknown> | undefined;
let active: LetteringProvider | undefined;
let currentFonts: Awaited<ReturnType<typeof loadFonts>> | undefined;
export function withFontRun<T>(font: FontName, run: Run, draw: () => T): T {
  if (!currentFonts) throw new Error('Lettering requires a running scene');
  const saved = currentFonts[font];
  currentFonts[font] = () => run;
  try { return draw(); } finally { currentFonts[font] = saved; }
}
export function mathRun(text: string, size: number, display: boolean): Run {
  if (!active) throw new Error('Math requires meta.lettering.math and a fresh lettering snapshot');
  return active.math(text, size, display);
}
function providerOf(Source: object): LetteringProvider | undefined {
  for (let c: object | null = Source; c; c = Object.getPrototypeOf(c)) {
    const p = providers.get(c);
    if (p) return p;
  }
  return undefined;
}
async function lease<T>(p: LetteringProvider | undefined, work: () => Promise<T>): Promise<T> {
  const fonts = await loadFonts(), saved = { ...fonts };
  active = p;
  currentFonts = fonts;
  if (p) for (const font of ['sans', 'mono'] as const)
    fonts[font] = (text, size) => p.shape(font, text, size, saved[font]);
  try { return await work(); }
  finally { Object.assign(fonts, saved); active = undefined; currentFonts = undefined; }
}
function enqueue<T>(p: LetteringProvider | undefined, work: () => Promise<T>): Promise<T> {
  const execute = () => lease(p, work);
  const result = (pending ?? Promise.resolve()).then(execute, execute);
  pending = result.then(() => undefined, () => undefined);
  return result;
}
/** Build-time text outside a run (caption wrapping, video footers). */
export function withSceneLettering<T>(Source: object, work: () => Promise<T>): Promise<T> {
  const p = providerOf(Source);
  if (!p || active === p) return work();
  return enqueue(p, work);
}
export function bindLettering(Source: SceneClass, provider: LetteringProvider | LetteringSnapshot): SceneClass {
  if (!installed) {
    installed = true;
    const original = Scene.prototype.run;
    Scene.prototype.run = function () {
      return enqueue(providerOf(this.constructor), () => original.call(this));
    };
  }
  const Bound = class extends Source {};
  providers.set(Bound, 'version' in provider ? snapshotProvider(provider) : provider);
  return Bound;
}
