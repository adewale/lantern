// Animations are pure functions of alpha over two fixed endpoints.
// begin() settles the endpoints (and aligns their structure); every frame
// is then `mobject = blend(start, end, rateFunc(t / runTime))`.

import { smooth, thereAndBack, linear, clip } from './rate.ts';
import type { RateFunc } from './rate.ts';
import type { Mobject, PathFunc, AnimateBuilderBase } from './mobject.ts';
import type { VMobject } from './vmobject.ts';
import type { Scene } from './scene.ts';
import * as V from './vec.ts';
import type { Vec } from './vec.ts';

export interface AnimOpts {
  runTime?: number;
  rateFunc?: RateFunc;
  /** 0: children move together; 1: one after another. */
  lagRatio?: number;
  /** Remove the mobject from the scene when the animation ends. */
  remover?: boolean;
}

/** What play() accepts besides animations: a trailing options object. */
export type PlayOpts = Pick<AnimOpts, 'runTime' | 'rateFunc' | 'lagRatio'>;

/**
 * One family member and its counterparts, zipped by index: [mobject's, starting
 * copy's] for most animations, plus the target's for a Transform.
 */
export type FamilyRow = Mobject[];

export class Animation {
  mobject: Mobject;
  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  remover: boolean;
  // Set by begin()
  starting!: Mobject;
  families!: FamilyRow[];

  constructor(mobject: Mobject, { runTime = 1, rateFunc = smooth, lagRatio = 0, remover = false }: AnimOpts = {}) {
    this.mobject = mobject;
    this.runTime = runTime;
    this.rateFunc = rateFunc;
    this.lagRatio = lagRatio;
    this.remover = remover;
  }

  setOptions({ runTime, rateFunc, lagRatio }: PlayOpts = {}): this {
    if (runTime != null) this.runTime = runTime;
    if (rateFunc != null) this.rateFunc = rateFunc;
    if (lagRatio != null) this.lagRatio = lagRatio;
    return this;
  }

  /** Called when play starts. Copies live here, never in the constructor. */
  begin(): void {
    this.starting = this.createStartingMobject();
    this.families = this.zipFamilies();
    this.interpolate(0);
  }

  createStartingMobject(): Mobject { return this.mobject.copy(); }

  /** The mobjects whose families are zipped as arguments to interpolateSubmobject. */
  allMobjects(): Mobject[] { return [this.mobject, this.starting]; }

  zipFamilies(): FamilyRow[] {
    const fams = this.allMobjects().map((m) => m.family());
    // Aligned families: every one is as long as the first
    return fams[0]!.map((_, i) => fams.map((f) => f[i]!));
  }

  /** Lands on rateFunc(1): for a there-and-back rate function that is the start. */
  finish(): void { this.interpolate(this.rateFunc(1)); }

  cleanUpFromScene(scene: Scene): void { if (this.remover) scene.remove(this.mobject); }

  /** alpha already passed through rateFunc by the scene. */
  interpolate(alpha: number): void {
    const n = this.families.length;
    for (let i = 0; i < n; i++) {
      this.interpolateSubmobject(...this.families[i]!, this.subAlpha(alpha, i, n));
    }
    this.mobject.invalidateBox();
  }

  /** Stagger alpha across submobjects by lagRatio (manim's get_sub_alpha). */
  subAlpha(alpha: number, index: number, count: number): number {
    const lag = this.lagRatio;
    if (lag === 0) return alpha;
    const fullLength = (count - 1) * lag + 1;
    const value = alpha * fullLength;
    const lower = index * lag;
    return clip(value - lower, 0, 1);
  }

  /**
   * One family row at `alpha`: called as (sub, start, alpha), or
   * (sub, start, target, alpha) for a Transform; see allMobjects().
   */
  interpolateSubmobject(..._row: [...FamilyRow, number]): void {}
}

export interface TransformOpts extends AnimOpts {
  pathFunc?: PathFunc | null;
  replace?: boolean;
}

/** Blend `mobject` into `target`. With replace=true, the scene keeps `target` afterwards. */
export class Transform extends Animation {
  target: Mobject;
  pathFunc: PathFunc | null;
  replace: boolean;
  /** The target was built for this animation alone, so begin() may use it without copying. */
  ownsTarget: boolean;
  /** The target is a copy of the mobject: same structure, no alignment needed. */
  sameStructure: boolean;
  /** Set by begin(). */
  targetCopy!: Mobject;

  constructor(mobject: Mobject, target: Mobject, { pathFunc = null, replace = false, ...opts }: TransformOpts = {}) {
    super(mobject, opts);
    this.target = target;
    this.pathFunc = pathFunc;
    this.replace = replace;
    this.ownsTarget = false;
    this.sameStructure = false;
  }

  override begin(): void {
    // An animation that built its own target (FadeIn, Indicate, .animate) hands it
    // over as is: nothing else holds it, so copying it again is pure cost. And a
    // target that is a copy of the mobject needs no alignment: same structure.
    this.targetCopy = this.ownsTarget ? this.target : this.target.copy();
    if (!this.sameStructure) this.mobject.alignWith(this.targetCopy);
    super.begin();
  }

  override allMobjects(): Mobject[] { return [this.mobject, this.starting, this.targetCopy]; }

  override interpolateSubmobject(sub: Mobject, start: Mobject, target: Mobject, alpha: number): void {
    sub.interpolate(start, target, alpha, this.pathFunc);
  }

  override cleanUpFromScene(scene: Scene): void {
    super.cleanUpFromScene(scene);
    if (this.replace) scene.replace(this.mobject, this.target);
  }
}

/** A Transform whose target is the result of recorded .animate calls. */
export function fromAnimateBuilder(builder: AnimateBuilderBase, opts: TransformOpts = {}): Transform {
  const t = new Transform(builder.mobject, builder.buildTarget(), opts);
  t.ownsTarget = true; // the built target is this animation's alone; its structure may differ (setText), so it still aligns
  return t;
}

export interface FadeOpts extends TransformOpts { shift?: Vec | null; scale?: number }

export class FadeIn extends Transform {
  shiftVec: Vec | null;
  scaleFrom: number;
  mobjectStart!: Mobject;

  constructor(mobject: Mobject, { shift = null, scale = 1, ...opts }: FadeOpts = {}) {
    super(mobject, mobject, opts);
    this.shiftVec = shift; this.scaleFrom = scale;
  }
  override begin(): void {
    // Start state: invisible, displaced; end state: the mobject as it is.
    this.target = this.mobject.copy(); this.ownsTarget = true; this.sameStructure = true;
    const start = this.mobject.copy();
    for (const m of start.family()) m.style.opacity = 0;
    if (this.shiftVec) start.shift(V.mul(this.shiftVec, -1));
    if (this.scaleFrom !== 1) start.scale(this.scaleFrom);
    this.mobjectStart = start;
    super.begin();
  }
  override createStartingMobject(): Mobject { return this.mobjectStart; }
}

export class FadeOut extends Transform {
  shiftVec: Vec | null;
  scaleTo: number;

  constructor(mobject: Mobject, { shift = null, scale = 1, ...opts }: FadeOpts = {}) {
    super(mobject, mobject, { remover: true, ...opts });
    this.shiftVec = shift; this.scaleTo = scale;
  }
  override begin(): void {
    const end = this.mobject.copy();
    for (const m of end.family()) m.style.opacity = 0;
    if (this.shiftVec) end.shift(this.shiftVec);
    if (this.scaleTo !== 1) end.scale(this.scaleTo);
    this.target = end; this.ownsTarget = true; this.sameStructure = true;
    super.begin();
  }
  override finish(): void {
    super.finish();
    // Restore so the mobject can be shown again later
    for (const [m, start] of this.families) m!.style.opacity = start!.style.opacity;
  }
}

/**
 * Draw a path in: the stroke traces along the path, then the fill fades in.
 * Fill-only shapes (glyphs, filled dots) have no stroke to trace, so they get
 * a temporary outline in the fill color, kept until the fill is complete and
 * removed at finish (manim's DrawBorderThenFill). Without it they stay invisible until the fill
 * pops in over a few frames.
 */
export class Create extends Animation {
  borderWidth: number;

  constructor(mobject: Mobject, { borderWidth = 0.012, ...opts }: AnimOpts & { borderWidth?: number } = {}) {
    super(mobject, { lagRatio: 0.2, ...opts });
    this.borderWidth = borderWidth;
  }
  override interpolateSubmobject(sub: Mobject, start: Mobject, alpha: number): void {
    const s0 = start.style, s = sub.style;
    const fill = clip((alpha - 0.66) / 0.34, 0, 1);
    s.drawFraction = alpha;
    s.fillOpacity = s0.fillOpacity * fill;
    s.opacity = s0.opacity * (alpha > 0 ? 1 : 0);
    if (s0.stroke === 'none' && s0.fill !== 'none') {
      s.stroke = s0.fill;
      s.strokeWidth = this.borderWidth;
      // Full strength until the end: fading it while the fill fades in leaves both near 50%
      // mid-crossover, a visible dip the motion verifier flags as a pop
      s.strokeOpacity = s0.fillOpacity;
    }
  }
  override finish(): void {
    super.finish();
    for (const [sub, start] of this.families as Array<[Mobject, Mobject]>) {
      delete sub.style.drawFraction;
      // Restore the temporary border to what the shape had
      sub.style.stroke = start.style.stroke;
      sub.style.strokeWidth = start.style.strokeWidth;
      sub.style.strokeOpacity = start.style.strokeOpacity;
    }
  }
}

/** Write text: Create for paths, letter-by-letter fade for Text. */
export class Write extends Create {
  constructor(mobject: Mobject, opts: AnimOpts = {}) { super(mobject, { lagRatio: 0.3, ...opts }); }
}

export interface IndicateOpts extends TransformOpts { scaleFactor?: number; color?: string }

/** Scale up and recolor, there and back. */
export class Indicate extends Transform {
  scaleFactor: number;
  color: string;

  constructor(mobject: Mobject, { scaleFactor = 1.2, color = '#ffff00', ...opts }: IndicateOpts = {}) {
    super(mobject, mobject, { rateFunc: thereAndBack, ...opts });
    this.scaleFactor = scaleFactor; this.color = color;
  }
  override begin(): void {
    const t = this.mobject.copy().scale(this.scaleFactor);
    for (const m of t.family()) {
      if (m.style.stroke !== 'none') m.style.stroke = this.color;
      if (m.style.fill !== 'none') m.style.fill = this.color;
    }
    this.target = t; this.ownsTarget = true; this.sameStructure = true;
    super.begin();
  }
}

/** Run several animations together; lagRatio staggers their start times. */
export class AnimationGroup extends Animation {
  animations: Animation[];
  timings: Array<[start: number, end: number]>;
  maxEnd: number;

  constructor(animations: Animation[], { lagRatio = 0, ...opts }: AnimOpts = {}) {
    // A group drives no mobject of its own, its members do: `mobject` stays null at
    // runtime, and every base method that would read it is overridden below.
    super(null as unknown as Mobject, { lagRatio, ...opts });
    this.animations = animations;
    // Timings: each starts lagRatio * (previous run time) after the previous
    let start = 0, end = 0;
    this.timings = animations.map((a, i) => {
      if (i > 0) start += lagRatio * animations[i - 1]!.runTime;
      end = Math.max(end, start + a.runTime);
      return [start, start + a.runTime];
    });
    if (opts.runTime == null) this.runTime = end;
    this.maxEnd = end;
  }
  override begin(): void { for (const a of this.animations) a.begin(); }
  override finish(): void { for (const a of this.animations) a.finish(); }
  override cleanUpFromScene(scene: Scene): void { for (const a of this.animations) a.cleanUpFromScene(scene); }
  /** Receives raw time fraction (scene applies this.rateFunc first). */
  override interpolate(alpha: number): void {
    const t = alpha * this.maxEnd;
    this.animations.forEach((a, i) => {
      const [s, e] = this.timings[i]!;
      const sub = clip((t - s) / (e - s || 1), 0, 1);
      a.interpolate(a.rateFunc(sub));
    });
  }
  /** A group has no mobject; nested groups contribute their leaf members. */
  get mobjects(): Mobject[] {
    return this.animations.flatMap((a) => a instanceof AnimationGroup ? a.mobjects : [a.mobject]).filter(Boolean);
  }
}

export class LaggedStart extends AnimationGroup {
  constructor(animations: Animation[], opts: AnimOpts = {}) { super(animations, { lagRatio: 0.2, ...opts }); }
}

/** What play() accepts: an animation, or a `mobject.animate` builder. */
export type Playable = Animation | AnimateBuilderBase;

function isAnimateBuilder(x: unknown): x is AnimateBuilderBase {
  return !!x && !!(x as Partial<AnimateBuilderBase>)._isAnimateBuilder;
}

/** Normalize play() arguments: builders become Transforms. */
export function prepareAnimation(x: unknown): Animation {
  if (isAnimateBuilder(x)) return fromAnimateBuilder(x);
  if (x instanceof Animation) return x;
  throw new Error('play() expects Animations or mobject.animate builders');
}

export interface MoveAlongPathOpts extends AnimOpts { fromCurrent?: boolean }

/**
 * Move a mobject's center along a path. If the mobject isn't at the path's
 * start (a token at a box's center riding an edge that starts at the box's
 * border), the offset is blended out over the move instead of snapping on the
 * first frame: position(α) = path(α) + (1 − α)·(start − path(0)).
 * Pass { fromCurrent: false } for manim's snap-to-path behavior.
 */
export class MoveAlongPath extends Animation {
  path: VMobject;
  fromCurrent: boolean;
  /** Set by begin(). */
  offset!: Vec;

  constructor(mobject: Mobject, path: VMobject, { fromCurrent = true, ...opts }: MoveAlongPathOpts = {}) {
    super(mobject, opts); this.path = path; this.fromCurrent = fromCurrent;
  }
  override begin(): void {
    const c = this.mobject.center(), p0 = this.path.pointFromProportion(0);
    this.offset = this.fromCurrent ? [c[0] - p0[0], c[1] - p0[1]] : [0, 0];
    super.begin();
  }
  override interpolate(alpha: number): void {
    const p = this.path.pointFromProportion(alpha);
    const k = 1 - alpha;
    // Pure in alpha: every frame is the starting copy translated, never the previous
    // frame moved again. Accumulated Float32 rounding would otherwise make a seeked
    // frame differ from the full run by an ulp, which a later alignment can amplify.
    const c = this.starting.center();
    const dx = p[0] + k * this.offset[0] - c[0], dy = p[1] + k * this.offset[1] - c[1];
    const fams = this.families;
    for (let i = 0; i < fams.length; i++) {
      const [sub, start] = fams[i] as [Mobject, Mobject];
      const mine = sub.pointArrays(), from = start.pointArrays();
      for (let j = 0; j < mine.length; j++) {
        const m = mine[j]!, x = from[j]!;
        for (let q = 0; q < m.length; q += 2) { m[q] = x[q]! + dx; m[q + 1] = x[q + 1]! + dy; }
      }
      sub.touchPoints(); sub._bbox = null;
    }
    this.mobject.invalidateBox();
  }
}

/** Fade in, hold, fade out around a mobject: a one-shot "look here". */
export class Flash extends Animation {
  constructor(mobject: Mobject, opts: AnimOpts = {}) { super(mobject, { rateFunc: linear, ...opts }); }
  override interpolateSubmobject(sub: Mobject, start: Mobject, alpha: number): void {
    sub.style.opacity = start.style.opacity * Math.sin(Math.PI * alpha);
  }
}
