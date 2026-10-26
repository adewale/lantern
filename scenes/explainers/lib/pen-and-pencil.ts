// A small model of drawing a laid-out diagram by hand: a pen that wobbles within a bound of each
// laid-out line, a coloured pencil that hatches inside a box, and single-stroke Hershey letters.
// It models the technique the pele-art-diagrams page describes, not that page's code.
import { SIMPLEX } from './hershey-simplex.ts';

export type Pt = [number, number];

/** A made-up world of this explainer's own; the page draws four others. */
export const WORLD = [
  'graph TB',
  '  Spring[Glass Spring] --> Mill[Windmill]',
  '  Mill --> Ferry[Salt Ferry]',
  '  Mill --> Orchard[Pear Orchard]',
  '  Ferry --> Harbour[Harbour]',
  '  Orchard --> Harbour',
].join('\n');
/** The pen's bound on the plate, in stage units: 0.035 is under 3 px on a 1280 px stage. */
export const BOUND = 0.035;
export type Box = [number, number, number, number];

/** mulberry32: a seeded generator, so a drawing repeats exactly for the same seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PenOptions {
  /** The largest distance the pen may stray from the line it follows. */
  amplitude: number;
  /** Distance between pen samples along the line. */
  step: number;
  /** Wavelengths of the two waves that make the wobble, in the same units. */
  waves?: readonly [number, number];
}

/** Points every `step` along a polyline, keeping its corners. */
export function resample(line: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [line[0]!];
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1]!,
      [bx, by] = line[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/**
 * The pen's path along `line`: each sample moves sideways by two summed sine waves whose weights
 * add to 1, so no sample strays more than `amplitude` from the line. `rand` picks the phases.
 */
export function penStroke(line: readonly Pt[], o: PenOptions, rand: () => number): Pt[] {
  const pts = resample(line, o.step);
  const [l1, l2] = o.waves ?? [o.amplitude * 30, o.amplitude * 7];
  const p1 = rand() * 2 * Math.PI,
    p2 = rand() * 2 * Math.PI;
  let along = 0;
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)]!,
      next = pts[Math.min(pts.length - 1, i + 1)]!;
    if (i > 0) along += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    const dx = next[0] - prev[0],
      dy = next[1] - prev[1],
      len = Math.hypot(dx, dy) || 1;
    const off = o.amplitude * (0.65 * Math.sin((2 * Math.PI * along) / l1 + p1) + 0.35 * Math.sin((2 * Math.PI * along) / l2 + p2));
    return [p[0] - (dy / len) * off, p[1] + (dx / len) * off];
  });
}

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** The farthest any point of `stroke` lies from the polyline `line`. */
export function deviation(stroke: readonly Pt[], line: readonly Pt[]): number {
  let worst = 0;
  for (const p of stroke) {
    let near = Infinity;
    for (let i = 1; i < line.length; i++) near = Math.min(near, segmentDistance(p, line[i - 1]!, line[i]!));
    if (line.length === 1) near = Math.hypot(p[0] - line[0]![0], p[1] - line[0]![1]);
    worst = Math.max(worst, near);
  }
  return worst;
}

export interface HatchOptions {
  /** Angle of the strokes from horizontal, in degrees. */
  angle: number;
  /** Distance between neighbouring strokes. */
  spacing: number;
  /** Each end stops short of the edge by up to this much, as a hand does. */
  shortfall: number;
}

/** Clip the infinite line through `p` along `d` to `box`; null when it misses. */
function clip(p: Pt, d: Pt, box: Box): [Pt, Pt] | null {
  let t0 = -Infinity,
    t1 = Infinity;
  for (const axis of [0, 1] as const) {
    const lo = box[axis]!,
      hi = box[axis + 2]!;
    if (Math.abs(d[axis]) < 1e-12) {
      if (p[axis] < lo || p[axis] > hi) return null;
      continue;
    }
    let a = (lo - p[axis]) / d[axis],
      b = (hi - p[axis]) / d[axis];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  if (t1 <= t0) return null;
  return [
    [p[0] + d[0] * t0, p[1] + d[1] * t0],
    [p[0] + d[0] * t1, p[1] + d[1] * t1],
  ];
}

/** Parallel pencil strokes across `box`, each clipped to it and shortened at both ends by chance. */
export function hatch(box: Box, o: HatchOptions, rand: () => number): [Pt, Pt][] {
  const a = (o.angle * Math.PI) / 180,
    d: Pt = [Math.cos(a), Math.sin(a)],
    n: Pt = [-d[1], d[0]];
  const c: Pt = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  const reach = Math.hypot(box[2] - box[0], box[3] - box[1]) / 2;
  const out: [Pt, Pt][] = [];
  for (let k = Math.ceil(-reach / o.spacing); k * o.spacing <= reach; k++) {
    const p: Pt = [c[0] + n[0] * k * o.spacing, c[1] + n[1] * k * o.spacing];
    const seg = clip(p, d, box);
    if (!seg) continue;
    const [s, e] = seg,
      len = Math.hypot(e[0] - s[0], e[1] - s[1]);
    const cut0 = rand() * o.shortfall,
      cut1 = rand() * o.shortfall;
    if (len - cut0 - cut1 < o.spacing) continue;
    out.push([
      [s[0] + d[0] * cut0, s[1] + d[1] * cut0],
      [e[0] - d[0] * cut1, e[1] - d[1] * cut1],
    ]);
  }
  return out;
}

export const inside = (p: Pt, b: Box, eps = 1e-9) =>
  p[0] >= b[0] - eps && p[0] <= b[2] + eps && p[1] >= b[1] - eps && p[1] <= b[3] + eps;

/** A text as Hershey strokes on the 21-unit capital grid, from x = 0; `width` is the summed advance. */
export function hershey(text: string): { strokes: Pt[][]; width: number } {
  const strokes: Pt[][] = [];
  let x = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const glyph = SIMPLEX[code - 32];
    if (glyph == null) throw new Error(`Hershey Simplex has no glyph for U+${code.toString(16).toUpperCase()}`);
    const [advance, body] = glyph.split(';') as [string, string];
    for (const stroke of body ? body.split('|') : [])
      strokes.push(stroke.split(' ').map((xy) => {
        const [gx, gy] = xy.split(',').map(Number) as [number, number];
        return [x + gx, gy];
      }));
    x += Number(advance);
  }
  return { strokes, width: x };
}

/** The bounding box of a set of strokes. */
export function boundsOf(strokes: readonly (readonly Pt[])[]): Box {
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of strokes)
    for (const [x, y] of s) {
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    }
  return b;
}

/** Strokes scaled and moved so their ink has `height` and is centred on `at`. */
export function fit(strokes: readonly (readonly Pt[])[], at: Pt, height: number): Pt[][] {
  const b = boundsOf(strokes),
    k = height / (b[3] - b[1]);
  const cx = (b[0] + b[2]) / 2,
    cy = (b[1] + b[3]) / 2;
  return strokes.map((s) => s.map(([x, y]) => [at[0] + (x - cx) * k, at[1] + (y - cy) * k] as Pt));
}

/** Nodes and links named by a `graph` source: the only facts the text gives the layout. */
export function graphFacts(source: string): { nodes: Map<string, string>; links: [string, string][] } {
  const nodes = new Map<string, string>();
  const links: [string, string][] = [];
  const ref = /([A-Za-z][\w]*)(?:\[([^\]]*)\])?/y;
  for (const raw of source.split('\n').slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    const ends = line.split('-->').map((part) => {
      ref.lastIndex = 0;
      const m = ref.exec(part.trim());
      if (!m) throw new Error(`not a node: ${part}`);
      if (m[2] != null) nodes.set(m[1]!, m[2]);
      else if (!nodes.has(m[1]!)) nodes.set(m[1]!, m[1]!);
      return m[1]!;
    });
    for (let i = 1; i < ends.length; i++) links.push([ends[i - 1]!, ends[i]!]);
  }
  return { nodes, links };
}
