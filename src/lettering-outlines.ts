// Optional outline snapshots. This module has no installation side effects: a
// page without lettering never imports a provider or carries a lettering store.
import type { SceneClass } from './scene.ts';
import { Scene } from './scene.ts';
import { loadFonts, shapeChain, shaperFor } from './fonts.ts';
import type { FontName, Shaper } from './fonts.ts';
import { loadFont } from '../vendor/glyph.js';
import type { Font, Run } from '../vendor/glyph.js';
import { SANS, MONO, FALLBACK } from './font-data.ts';
import { Text, CodeSpan } from './text.ts';
import type { Style, Box } from './mobject.ts';

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
  payloadHash?: string;
}
export interface LetteringProvider {
  prepare?(): Promise<void>;
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

// DecimalNumber produces intermediate values at the chosen playback/video FPS.
// Keep that narrow alphabet available without authorizing new prose at runtime.
export const numericAlphabet = '0123456789+-.eE,%‰‱$€£¥()−\u0020\u00a0\u202f';
export const isNumericText = (text: string): boolean =>
  /^[ (+\-−$€£¥\u00a0\u202f]*\d[\d .,\u00a0\u202f]*(?:[eE][+\-−]?\d+)?[ )%‰‱$€£¥\u00a0\u202f]*$/u.test(text);
const simpleWrapper = (text: string) => /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]*$/u.test(text);
function numericTemplates(snapshot: LetteringSnapshot, font: FontName): [string, string][] {
  const out: [string, string][] = [];
  for (const key of Object.keys(snapshot.runs)) {
    const [family, text] = JSON.parse(key) as [string, string];
    if (family !== font) continue;
    for (const match of text.matchAll(/[+\-−]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+\-−]?\d+)?/gu)) {
      const prefix = text.slice(0, match.index), suffix = text.slice(match.index + match[0].length);
      if (simpleWrapper(prefix) && simpleWrapper(suffix)) out.push([prefix, suffix]);
    }
  }
  return out;
}
function isNumericReplay(text: string, templates: readonly [string, string][]): boolean {
  return isNumericText(text) || templates.some(([prefix, suffix]) => text.startsWith(prefix) && text.endsWith(suffix)
    && text.length > prefix.length + suffix.length && isNumericText(text.slice(prefix.length, text.length - suffix.length)));
}
async function decode(data: string): Promise<Font> {
  const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
  const result = await loadFont(bytes);
  if (result.tag !== 'Ok') throw new Error('Cannot decode numeric lettering subset: ' + JSON.stringify(result.error));
  return result.value;
}
let baseFaces: Promise<Record<FontName, Font[]>> | undefined;
function numericFallbackFaces(): Promise<Record<FontName, Font[]>> {
  return baseFaces ??= (async () => {
    const [sans, mono, ...fallback] = await Promise.all([SANS, MONO, ...FALLBACK.map(([, data]) => data)].map(decode));
    return { sans: [sans!, ...fallback], mono: [mono!, sans!, ...fallback] };
  })();
}
interface ReplayState {
  ready?: Promise<void>;
  chains: Partial<Record<FontName, Font[]>>;
  templates: Partial<Record<FontName, [string, string][]>>;
  memo: Map<string, Run>;
}
const replays = new WeakMap<LetteringSnapshot, ReplayState>();
const scriptFaceNames: Record<string, string> = {
  Arab: 'noto-naskh-arabic', Deva: 'noto-sans-devanagari', Hebr: 'noto-sans-hebrew',
  Hani: 'noto-sans-sc', Latn: 'inter', Grek: 'inter', Cyrl: 'inter',
};
export function snapshotProvider(snapshot: LetteringSnapshot): LetteringProvider {
  let replay = replays.get(snapshot);
  if (!replay) replays.set(snapshot, replay = { chains: {}, templates: {}, memo: new Map() });
  const state = replay;
  const lookup = (font: string, text: string, size: number, display = false) => {
    const run = snapshot.runs[runKey(font, text, display)];
    if (run) return scaledRun(run, size);
    if ((font === 'sans' || font === 'mono') && state.chains[font]
      && isNumericReplay(text, state.templates[font] ?? [])) {
      const key = runKey(font, text);
      let numeric = state.memo.get(key);
      if (!numeric) {
        numeric = shapeChain(state.chains[font]!, font, text, 1);
        if (numeric.glyphs.some((g) => g.gid === 0)) throw new Error(`Numeric lettering cannot draw ${JSON.stringify(text)}`);
        state.memo.set(key, numeric);
        if (state.memo.size > 4096) state.memo.delete(state.memo.keys().next().value!);
      }
      return scaledRun(numeric, size);
    }
    throw new Error(`Lettering snapshot has no run for ${JSON.stringify(text)} (${font}); run explain snapshots`);
  };
  return {
    prepare() {
      return state.ready ??= (async () => {
        const families = (['sans', 'mono'] as const).filter((font) => {
          state.templates[font] = numericTemplates(snapshot, font);
          return snapshot.request.faces?.[font] || state.templates[font]!.length;
        });
        if (!families.length) return;
        const fallback = await numericFallbackFaces();
        const scriptNames = [...new Set((snapshot.request.scripts ?? []).flatMap((script) => scriptFaceNames[script] ?? []))];
        const scriptFaces = await Promise.all(scriptNames.flatMap((name) => snapshot.faces[name] ? [decode(snapshot.faces[name]!.data)] : []));
        for (const font of families) {
          const name = snapshot.request.faces?.[font];
          if (name) {
            const subset = snapshot.faces[name];
            if (!subset) throw new Error(`Lettering snapshot has no subset for requested face ${name}`);
            state.chains[font] = [await decode(subset.data), ...scriptFaces, ...fallback[font]];
          } else {
            state.chains[font] = [fallback[font][0]!, ...scriptFaces, ...fallback[font].slice(1)];
          }
        }
      })();
    },
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
let loadedFonts: Awaited<ReturnType<typeof loadFonts>> | undefined;
let normalShapers: Awaited<ReturnType<typeof loadFonts>> | undefined;
let leasing = false;
const activeTasks = new Set<Promise<unknown>>();
const textProviders = new WeakMap<Text, LetteringProvider>();
function withinLease<T>(work: () => Promise<T>): Promise<T> {
  const result = Promise.resolve().then(work);
  activeTasks.add(result);
  void result.then(() => activeTasks.delete(result), () => activeTasks.delete(result));
  return result;
}
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

/** The source mapping used by Text: grapheme-based tab stops, code-point clusters. */
function spanForm(text: Text): { shaped: string; source: number[] } {
  const source: number[] = [];
  let shaped = '', at = 0, column = 0;
  const units = typeof Intl !== 'undefined' && Intl.Segmenter
    ? [...new Intl.Segmenter().segment(text.text)].map((g) => g.segment) : [...text.text];
  for (const unit of units) {
    if (unit === '\t' && text.tabWidth != null) {
      const count = text.tabWidth - column % text.tabWidth;
      shaped += ' '.repeat(count);
      for (let i = 0; i < count; i++) source.push(at);
      column += count; at++;
    } else {
      shaped += unit; column++;
      for (const ch of unit) { source.push(at); at += ch.length; }
    }
  }
  return { shaped, source };
}

// Preserve the core module's source and all legacy geometry. Only a Text built
// with an optional provider needs the adapter; remember that provider for spans
// queried after the run has released its fonts, or on a copied Code line.
function installSpanAdapter(): void {
  const build = Text.prototype.build, copy = Text.prototype.copy, box = CodeSpan.prototype.box;
  Text.prototype.build = function (text: string, size: number, style: Style) {
    if (active) textProviders.set(this, active); else textProviders.delete(this);
    return build.call(this, text, size, style);
  };
  Text.prototype.copy = function (this: Text) {
    const result = copy.call(this), provider = textProviders.get(this);
    if (provider) textProviders.set(result, provider);
    return result;
  } as typeof Text.prototype.copy;
  CodeSpan.prototype.box = function (): Box {
    const provider = textProviders.get(this.owner);
    if (!provider || this.stale) return box.call(this);
    const text = this.owner, form = spanForm(text);
    const run = provider.shape(text.font, form.shaped, text.run.fontSize, normalShapers?.[text.font] ?? shaperFor(text.font));
    const clusters = run.glyphs.map((g) => form.source[g.cluster] ?? text.text.length);
    const rtl = clusters.some((cluster, i) => i > 0 && cluster < clusters[i - 1]!);
    if (!rtl) {
      if (!loadedFonts) return box.call(this);
      const saved = loadedFonts[text.font];
      loadedFonts[text.font] = () => run;
      try { return box.call(this); } finally { loadedFonts[text.font] = saved; }
    }
    const starts = [...new Set(clusters)].sort((a, b) => a - b);
    const endOf = (cluster: number) => starts.find((start) => start > cluster) ?? text.text.length;
    const selected = this.from === this.to ? []
      : run.glyphs.filter((_, i) => clusters[i]! < this.to && endOf(clusters[i]!) > this.from);
    const frame = text.frameBox, scale = run.width ? (frame[2]! - frame[0]!) / run.width : 0;
    let left = Infinity, right = -Infinity;
    for (const glyph of selected) {
      const a = frame[0]! + glyph.x * scale, b = frame[0]! + (glyph.x + glyph.ax) * scale;
      left = Math.min(left, a, b); right = Math.max(right, a, b);
    }
    if (!selected.length) {
      // A zero-width range is a caret at the logical boundary, including RTL ends.
      const logical = starts.find((start) => endOf(start) > this.from) ?? starts.at(-1);
      const cell = run.glyphs.filter((_, i) => clusters[i] === logical);
      const next = starts.find((start) => start > (logical ?? 0));
      const previous = [...starts].reverse().find((start) => start < (logical ?? 0));
      const position = (cluster: number | undefined) => run.glyphs.find((_, i) => clusters[i] === cluster)?.x;
      const here = position(logical) ?? 0;
      const clusterText = logical === undefined ? '' : text.text.slice(logical, endOf(logical));
      const previousDelta = previous === undefined ? undefined : here - position(previous)!;
      const nextDelta = next === undefined ? undefined : position(next)! - here;
      const delta = previousDelta === undefined ? nextDelta : nextDelta === undefined ? previousDelta
        : Math.abs(previousDelta) < Math.abs(nextDelta) ? previousDelta : nextDelta;
      const backwards = (/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(clusterText) && /\p{L}/u.test(clusterText)) || (delta ?? 0) < 0;
      const x0 = cell.length ? Math.min(...cell.map((g) => g.x)) : 0;
      const x1 = cell.length ? Math.max(...cell.map((g) => g.x + g.ax)) : run.width;
      const atEnd = this.from >= (logical === undefined ? 0 : endOf(logical));
      left = right = frame[0]! + (backwards !== atEnd ? x1 : x0) * scale;
    }
    const result: Box = [left, frame[1]!, right, frame[3]!];
    const selectedClusters = new Set(selected.map((glyph) => form.source[glyph.cluster] ?? text.text.length));
    const inkGlyphs = text.children.filter((glyph) => selectedClusters.has((glyph as { cluster?: number }).cluster ?? -1));
    for (const glyph of inkGlyphs) {
      const ink = glyph.box();
      if (!ink) continue;
      result[0] = Math.min(result[0], ink[0]); result[1] = Math.min(result[1], ink[1]);
      result[2] = Math.max(result[2], ink[2]); result[3] = Math.max(result[3], ink[3]);
    }
    return result;
  };
}
async function lease<T>(p: LetteringProvider | undefined, work: () => Promise<T>): Promise<T> {
  const fonts = await loadFonts();
  await p?.prepare?.();
  const saved = { ...fonts };
  normalShapers ??= saved;
  active = p;
  leasing = true;
  loadedFonts = fonts;
  currentFonts = fonts;
  if (p) for (const font of ['sans', 'mono'] as const)
    fonts[font] = (text, size) => p.shape(font, text, size, saved[font]);
  try { return await work(); }
  finally {
    // Same-provider work can nest (or start while a run is awaiting). Keep its
    // font lease until every such task finishes, including on errors.
    while (activeTasks.size) await Promise.allSettled([...activeTasks]);
    Object.assign(fonts, saved); active = undefined; currentFonts = undefined; leasing = false;
  }
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
  if (!installed) return work();
  if (leasing && active === p) return withinLease(work);
  return enqueue(p, work);
}
export function bindLettering(Source: SceneClass, provider: LetteringProvider | LetteringSnapshot): SceneClass {
  if (!installed) {
    installed = true;
    const original = Scene.prototype.run;
    Scene.prototype.run = function () {
      const p = providerOf(this.constructor);
      return leasing && active === p ? withinLease(() => original.call(this))
        : enqueue(p, () => original.call(this));
    };
    installSpanAdapter();
  }
  const Bound = class extends Source {};
  providers.set(Bound, 'version' in provider ? snapshotProvider(provider) : provider);
  return Bound;
}

/** Keep the existing Latin/Greek/Cyrillic subset workflow unless more is requested. */
export function usesOutlineLettering(Source: object): boolean {
  const r = letteringOf(Source);
  return !!r && (Object.hasOwn(r, 'faces') || Object.hasOwn(r, 'math') ||
    (Array.isArray(r.scripts) && r.scripts.some((s) => !['Latn', 'Grek', 'Cyrl'].includes(s))));
}
