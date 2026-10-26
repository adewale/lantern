/**
 * Close-ups for a narrow stage. A 16 × 9 stage on a 390 px phone draws a scene
 * unit at about 22 px, so a 0.25-unit label is under 6 px. Instead of asking every
 * scene to lay itself out for a phone, the player frames each step: it zooms onto
 * the part of the resting picture that changed in that step, far enough that the
 * labels there read at 12 px, as a map fits its view to the feature a search found.
 * The reader can still pan, zoom, or go back to the whole picture.
 *
 * `stepLayouts` runs a scene once and records, for each step, where its picture
 * changed and every visible label's size; `closeUps` turns one step's layout into the
 * zooms for a stage of a given size. `explain check` uses both, so its phone number
 * is the size the player draws.
 *
 * A close-up is the reader's zoom, and it sits on top of the author's camera
 * (`scene.frame`, which `d.focus()` moves). So a layout is recorded as the camera
 * shows it: in the 16 × 9 units of the camera's view, centred on the origin, with
 * label sizes multiplied by the camera's zoom. At home those are stage units. A
 * close-up's zoom then multiplies the camera's, and Fit is the author's frame.
 */
import type { Box, Mobject, Scene, SceneClass, Sink } from '../src/index.ts';
import { labelOf } from '../explain/diagrams.ts';
import { IDENTITY, ZOOM_MAX, clampZoom } from './embed-zoom.ts';
import type { Zoom } from './embed-zoom.ts';

/** The smallest label size a close-up aims for, in CSS px: Android's floor for body text, a little over Apple's 11 pt. */
export const READ_PX = 12;
/** Stages narrower than this get close-ups; wider ones (a tablet, a laptop) keep the whole picture. */
export const NARROW_PX = 600;
/** Room left around the changed region, in stage units, so a mark's outline is not cut. */
const PAD = 0.2;
const FRAME: Box = [-8, -4.5, 8, 4.5];

/** A label on the stage: where it is and its font size, in stage units. */
export interface LayoutLabel {
  box: Box;
  size: number;
}
/** What a step's resting picture holds, for framing it; boxes and sizes in the camera's view units. */
export interface StepLayout {
  /**
   * Where the picture changed during the step, in the units of the camera's view, as
   * separate parts in reading order (rows top to bottom, each left to right); empty
   * when nothing is drawn.
   */
  parts: Box[];
  /** The part the step opens on: the one whose lettering changed most (new words, new values), else the first. */
  lead: number;
  labels: LayoutLabel[];
}
/** Changed boxes closer than this, in stage units, read as one part. */
const GAP = 0.5;

const intersect = (a: Box, b: Box): Box | null => {
  const box: Box = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  // A line has no height (or no width) and is still drawn; only boxes that miss each other give null.
  return box[2] >= box[0] && box[3] >= box[1] ? box : null;
};
const union = (a: Box | null, b: Box): Box =>
  a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : [...b];
const overlaps = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** A drawn leaf of the resting picture: what it looks like (`key`), how opaque it is, and where. */
interface Leaf {
  key: string;
  opacity: number;
  box: Box;
  top: Mobject;
  /** Part of a label's lettering. */
  text: boolean;
}
/** FNV-1a over the points rounded to a thousandth of a unit: equal shapes in the same place hash equal. */
function hashPoints(m: Mobject): string {
  let h = 0x811c9dc5;
  for (const a of m.pointArrays())
    for (let i = 0; i < a.length; i++) {
      h ^= Math.round(a[i]! * 1000) | 0;
      h = Math.imul(h, 0x01000193);
    }
  return (h >>> 0).toString(36);
}
const painted = (m: Mobject) =>
  (m.style.fill !== 'none' && (m.style.fillOpacity ?? 1) > 0) ||
  (m.style.stroke !== 'none' && (m.style.strokeOpacity ?? 1) > 0 && (m.style.strokeWidth ?? 0) > 0);

/** The paper and the heading frame every step; the heading changes each step but says nothing about where to look. */
const fixed = (m: Mobject) => m.key === '__paper' || m.key === '__heading';

/**
 * A world box in the units of the camera's view `view`: 16 wide, centred on the origin.
 * The identity at home. `explain check` maps its labels the same way (inView there).
 */
export function toView(box: Box, view: Box): Box {
  const z = viewZoom(view),
    cx = (view[0] + view[2]) / 2,
    cy = (view[1] + view[3]) / 2;
  return [(box[0] - cx) * z, (box[1] - cy) * z, (box[2] - cx) * z, (box[3] - cy) * z];
}
/**
 * The camera's zoom: stage units per world unit. The stage shows the view whole and
 * centred (an SVG viewBox meets its viewport), so a view out of 16:9 is letterboxed
 * and the tighter side sets the scale. 1 at home.
 */
export const viewZoom = (view: Box): number => Math.min(16 / (view[2] - view[0]), 9 / (view[3] - view[1]));
/** The camera's box: what the author's frame shows, the most a leaf can be seen in. */
const viewOf = (scene: Scene): Box => [...(scene.frame?.box() ?? FRAME)] as Box;

function leavesOf(scene: Scene): Leaf[] {
  const out: Leaf[] = [];
  const walk = (m: Mobject, top: Mobject, opacity: number, clip: Box, inLabel: boolean) => {
    const o = opacity * (m.style.opacity ?? 1);
    if (o < 0.05) return;
    const c = m.clipBox ? intersect(clip, m.clipBox) : clip;
    if (!c) return;
    const text = inLabel || !!labelOf(m);
    if (!m.children.length) {
      const b = m.box();
      const seen = b && painted(m) && (m.style.drawFraction ?? 1) > 0.05 ? intersect(b, c) : null;
      if (seen) {
        const s = m.style;
        const key = [s.fill, s.fillOpacity, s.stroke, s.strokeOpacity, s.strokeWidth, s.drawFraction ?? 1, hashPoints(m)].join('|');
        out.push({ key, opacity: o, box: seen, top, text });
      }
    }
    for (const child of m.children) walk(child, top, o, c, text);
  };
  const view = viewOf(scene);
  for (const top of scene.mobjects) if (!fixed(top)) walk(top, top, 1, view, false);
  return out;
}

/** Every readable label in the camera's view, in its units: a label's size grows with the camera's zoom. */
function labelsOf(scene: Scene): LayoutLabel[] {
  const out: LayoutLabel[] = [];
  const view = viewOf(scene),
    zoom = viewZoom(view);
  const walk = (m: Mobject, opacity: number, clip: Box) => {
    const o = opacity * (m.style.opacity ?? 1);
    if (o < 0.25) return;
    const c = m.clipBox ? intersect(clip, m.clipBox) : clip;
    if (!c) return;
    const label = labelOf(m);
    if (label?.text.trim() && (m.style.drawFraction ?? 1) >= 0.95) {
      const b = m.box(),
        seen = b && intersect(b, c);
      if (seen) out.push({ box: toView(seen, view), size: m.height() * label.emRatio * zoom });
      return; // a label's own parts are not labels
    }
    for (const child of m.children) walk(child, o, c);
  };
  for (const top of scene.mobjects) walk(top, 1, view);
  return out;
}

/**
 * What changed since `before` (the previous step's resting picture): every leaf that
 * is new, moved, reshaped, recoloured or brighter. A leaf that only grew fainter was
 * dimmed, which points away from it; when a step only dims, what it left bright in
 * the drawings it dimmed is what changed. With no change at all, everything drawn.
 */
export function changed(leaves: readonly Leaf[], before: readonly Leaf[]): Change[] {
  const was = new Map<string, number>();
  for (const l of before) was.set(l.key, Math.max(was.get(l.key) ?? 0, l.opacity));
  const out: Change[] = [],
    dimmed = new Set<Mobject>();
  for (const l of leaves) {
    const prior = was.get(l.key);
    if (prior == null || l.opacity > prior + 0.1) out.push({ box: l.box, text: l.text });
    else if (l.opacity < prior - 0.1) dimmed.add(l.top);
  }
  if (out.length) return out;
  const kept = leaves.filter((l) => dimmed.has(l.top) && (was.get(l.key) ?? 0) - l.opacity <= 0.1);
  // Kept or not, nothing here is new lettering: the step opens on the first part.
  return (kept.length ? kept : leaves).map((l) => ({ box: l.box, text: false }));
}
/** A changed leaf: where, and whether it is lettering. */
export interface Change {
  box: Box;
  text: boolean;
}
/**
 * Changes merged into parts (any two within GAP join), in reading order: by rows of a
 * unit, top first, then left to right. The lead is the part with the most changed
 * lettering: a caption usually reads out the new words or numbers, so the step opens
 * there; with no changed lettering, it opens on the first part.
 */
export function partsOf(changes: readonly Change[]): { parts: Box[]; lead: number } {
  let parts = changes.map((c) => ({ box: [...c.box] as Box, text: +c.text }));
  for (let merged = true; merged; ) {
    merged = false;
    const next: typeof parts = [];
    for (const p of parts) {
      const b = p.box;
      const near = next.findIndex(({ box: n }) => overlaps([n[0] - GAP, n[1] - GAP, n[2] + GAP, n[3] + GAP], b));
      if (near < 0) next.push(p);
      else {
        next[near] = { box: union(next[near]!.box, b), text: next[near]!.text + p.text };
        merged = true;
      }
    }
    parts = next;
  }
  parts.sort((a, b) => Math.floor(-a.box[3]) - Math.floor(-b.box[3]) || a.box[0] - b.box[0]);
  const lead = parts.reduce((best, p, i) => (p.text > parts[best]!.text ? i : best), 0);
  return { parts: parts.map((p) => p.box), lead: parts.length ? lead : 0 };
}
/** All the parts as one box, or null when there are none. */
export const focusOf = (layout: StepLayout): Box | null => layout.parts.reduce<Box | null>(union, null);

/**
 * Each step's layout, by step name, from one run of the scene with every frame
 * skipped. A step ends on its resting picture (nothing may change once its caption
 * hold begins), so the scene at each step's end is the picture the player rests on,
 * seen through the camera where the step leaves it.
 */
export async function stepLayouts(Scene: SceneClass): Promise<Map<string, StepLayout>> {
  const layouts = new Map<string, StepLayout>();
  let before: Leaf[] = [];
  const sink: Sink = {
    async frame() {},
    async stepEnd(scene, step) {
      const leaves = leavesOf(scene),
        view = viewOf(scene);
      // Changes are found in the world (a camera move alone changes no leaf), then framed as the camera shows them.
      const changes = changed(leaves, before).map((c) => ({ ...c, box: toView(c.box, view) }));
      layouts.set(step.name, { ...partsOf(changes), labels: labelsOf(scene) });
      before = leaves;
    },
  };
  await new Scene(sink, { skipUntil: Infinity }).run();
  return layouts;
}

/** How the stage draws the author's 16 × 9 view at 1×: px per view unit and the offset of its top-left corner (the SVG letterboxes). */
export function stageScale(w: number, h: number) {
  const s = Math.min(w / 16, h / 9);
  return { s, ox: (w - 16 * s) / 2, oy: (h - 9 * s) / 2 };
}
/** The part of the author's view a zoom shows on a `w`×`h` stage, in its units (stage units when the camera is home). */
export function viewBox(z: Zoom, w: number, h: number): Box {
  const { s, ox, oy } = stageScale(w, h);
  const x = (px: number) => (px / z.k - z.x / z.k - ox) / s - 8,
    y = (py: number) => 4.5 - (py / z.k - z.y / z.k - oy) / s;
  return [x(0), y(h), x(w), y(0)];
}
const padded = (b: Box, by = PAD): Box => [b[0] - by, b[1] - by, b[2] + by, b[3] + by];
/** The labels a close-up reads at: those in or touching a changed part, else every label. */
export function labelsToRead(layout: StepLayout): LayoutLabel[] {
  const near = layout.parts.map((p) => padded(p));
  const inside = layout.labels.filter((l) => near.some((n) => overlaps(l.box, n)));
  return inside.length ? inside : layout.labels;
}
/**
 * The regions a tour of the step's changes visits with a `vw`×`vh` view, in reading
 * order: changed parts taken together while they fit in one view, each group centred;
 * a group too big for one view is covered by views in rows, top to bottom, each row left
 * to right, overlapping evenly, the way a comic reader's guided view crosses a big panel.
 */
export function tourRegions(parts: readonly Box[], vw: number, vh: number): Box[] {
  const groups: Box[] = [];
  let group: Box | null = null;
  // Room around each part, but never so much that a part which fits a view no longer does.
  const room = (b: Box): Box => {
    const x = b[2] - b[0] <= vw ? Math.min(PAD, (vw - (b[2] - b[0])) / 2) : PAD,
      y = b[3] - b[1] <= vh ? Math.min(PAD, (vh - (b[3] - b[1])) / 2) : PAD;
    return intersect([b[0] - x, b[1] - y, b[2] + x, b[3] + y], FRAME) ?? FRAME;
  };
  for (const p of parts.map(room)) {
    const next = union(group, p);
    if (group && (next[2] - next[0] > vw || next[3] - next[1] > vh)) {
      groups.push(group);
      group = p;
    } else group = next;
  }
  if (group) groups.push(group);
  const views: Box[] = [];
  // Starts of views across a span: one centred view if it fits, else evenly overlapping ones from edge to edge.
  const starts = (lo: number, hi: number, size: number) => {
    // A span over by a rounding (a part padded to exactly a view's width) is one view, not n = 1 over 0.
    const n = Math.ceil((hi - lo) / size - 1e-9);
    if (n < 2) return [(lo + hi) / 2 - size / 2];
    return Array.from({ length: n }, (_, i) => lo + (i * (hi - lo - size)) / (n - 1));
  };
  for (const g of groups)
    for (const bottom of starts(g[1], g[3], vh).reverse())
      for (const left of starts(g[0], g[2], vw)) views.push([left, bottom, left + vw, bottom + vh]);
  return views;
}

/**
 * The close-ups of a step on a `w`×`h` stage: the first is where the step opens (on its
 * lead part), and the rest continue the tour of its changes in reading order, wrapping
 * round, for the reader to step through with the overview. On a stage at least
 * NARROW_PX wide, or with nothing to read, there is one: the whole picture. Otherwise
 * every close-up has one scale, the least that draws every label near the step's
 * changes at READ_PX (up to `max`), so a label read in one close-up, or found by
 * panning, reads the same in any other. When every such label already reads at
 * READ_PX, there is one: the whole picture. Any label under it is enlarged, however
 * little it needs: a label at 11 px is still under the floor `explain check` measures.
 */
export function closeUps(layout: StepLayout | undefined, w: number, h: number, max = ZOOM_MAX): Zoom[] {
  const whole = [clampZoom(IDENTITY, w, h, max)];
  if (!layout?.parts.length || !(w > 0) || !(h > 0) || w >= NARROW_PX) return whole;
  const read = labelsToRead(layout);
  if (!read.length) return whole;
  const { s, ox, oy } = stageScale(w, h);
  const smallest = Math.min(...read.map((l) => l.size));
  const k = Math.min(max, Math.max(1, READ_PX / (smallest * s)));
  if (k < 1 + 1e-9) return whole;
  const vw = w / (k * s),
    vh = h / (k * s);
  const regions = tourRegions(layout.parts, vw, vh);
  // Open on the lead part: the first region that holds all of it when it fits a view, else the
  // first that holds its top-left corner, where reading it starts.
  const lead = layout.parts[layout.lead] ?? layout.parts[0]!,
    inside = (x: number, y: number, r: Box) => x >= r[0] - 1e-9 && x <= r[2] + 1e-9 && y >= r[1] - 1e-9 && y <= r[3] + 1e-9,
    holds = (r: Box) => inside(lead[0], lead[3], r),
    holdsAll = (r: Box) => holds(r) && inside(lead[2], lead[1], r);
  const fits = lead[2] - lead[0] <= vw && lead[3] - lead[1] <= vh;
  let open = fits ? regions.findIndex(holdsAll) : -1;
  if (open < 0) open = Math.max(0, regions.findIndex(holds));
  const zooms: Zoom[] = [];
  for (const [left, , , top] of [...regions.slice(open), ...regions.slice(0, open)]) {
    // The stage point that shows (left, top) at 1× goes to the stage's top-left corner.
    const z = clampZoom({ k, x: -k * (ox + (left + 8) * s), y: -k * (oy + (4.5 - top) * s) }, w, h, max);
    // Clamping at the frame's edge can land two views in one place; the tour visits it once.
    if (!zooms.some((o) => Math.abs(o.x - z.x) < 1e-6 && Math.abs(o.y - z.y) < 1e-6)) zooms.push(z);
  }
  return zooms;
}
/** Where a step opens on a `w`×`h` stage: the first of its close-ups. */
export const closeUp = (layout: StepLayout | undefined, w: number, h: number, max = ZOOM_MAX): Zoom =>
  closeUps(layout, w, h, max)[0]!;
