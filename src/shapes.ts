// Shapes: VMobjects built from cubic Béziers (Rectangle, Circle, Arc, Line, ...),
// and small groups with named parts (Arrow, CurvedArrow, Labeled).
import { VMobject } from './vmobject.ts';
import { Group } from './mobject.ts';
import type { Mobject, Style } from './mobject.ts';
import * as V from './vec.ts';
import type { Vec } from './vec.ts';

export class Polygon extends VMobject {
  constructor(points: ReadonlyArray<Readonly<Vec>>, style: Style = {}) {
    super(style);
    this.setPolygon(points);
  }
}

export interface RectangleOpts extends Style { width?: number; height?: number; cornerRadius?: number }

export class Rectangle extends VMobject {
  constructor({ width = 4, height = 2, cornerRadius = 0, ...style }: RectangleOpts = {}) {
    super(style);
    const w = width / 2, h = height / 2, r = Math.min(cornerRadius, w, h);
    // Drawn from the top-left corner, clockwise on screen, so Create sweeps
    // along the top edge first
    if (r <= 0) {
      this.setPolygon([[-w, h], [w, h], [w, -h], [-w, -h]]);
      return;
    }
    // Rounded: 4 straight edges + 4 quarter-arcs, each arc one cubic
    const k = 0.5523 * r;
    this.startNewPath([-w + r, h]);
    this.addLineTo([w - r, h]);
    this.addCubic([w - r + k, h], [w, h - r + k], [w, h - r]);
    this.addLineTo([w, -h + r]);
    this.addCubic([w, -h + r - k], [w - r + k, -h], [w - r, -h]);
    this.addLineTo([-w + r, -h]);
    this.addCubic([-w + r - k, -h], [-w, -h + r - k], [-w, -h + r]);
    this.addLineTo([-w, h - r]);
    this.addCubic([-w, h - r + k], [-w + r - k, h], [-w + r, h]);
    this.closed[0] = true;
  }
}

export interface SquareOpts extends Style { side?: number; cornerRadius?: number }

export class Square extends Rectangle {
  constructor({ side = 2, ...rest }: SquareOpts = {}) { super({ width: side, height: side, ...rest }); }
}

export interface CircleOpts extends Style { radius?: number }

export class Circle extends VMobject {
  constructor({ radius = 1, ...style }: CircleOpts = {}) {
    super(style);
    const r = radius, k = 0.5523 * r;
    // From 3 o'clock, clockwise on screen (Create sweeps down first)
    this.startNewPath([r, 0]);
    this.addCubic([r, -k], [k, -r], [0, -r]);
    this.addCubic([-k, -r], [-r, -k], [-r, 0]);
    this.addCubic([-r, k], [-k, r], [0, r]);
    this.addCubic([k, r], [r, k], [r, 0]);
    this.closed[0] = true;
  }
}

export interface DotOpts extends Style { radius?: number; color?: string }

export class Dot extends Circle {
  constructor({ radius = 0.08, color = '#ffffff', ...rest }: DotOpts = {}) {
    super({ radius, fill: color, stroke: 'none', ...rest });
  }
}

export class Line extends VMobject {
  constructor(start: Readonly<Vec> = [-1, 0], end: Readonly<Vec> = [1, 0], style: Style = {}) {
    super(style);
    this.startNewPath(start);
    this.addLineTo(end);
  }
  start(): Vec { const a = this.subpaths[0]!; return [a[0]!, a[1]!]; }
  end(): Vec { const a = this.subpaths[0]!; return [a[a.length - 2]!, a[a.length - 1]!]; }
  putStartAndEndOn(start: Readonly<Vec>, end: Readonly<Vec>): this {
    this.subpaths = []; this.closed = [];
    this.startNewPath(start); this.addLineTo(end);
    return this;
  }
}

/**
 * A shape with a label: a box and its name, a state and its circle, an edge
 * and its caption. `shape` and `label` read through child indices, so they
 * stay correct on copies (copy() clones children; a plain property pointing
 * at a child would still point at the original's).
 *
 * The type parameters say what the parts are (`Labeled<Rectangle, Text>`).
 */
export class Labeled<S extends Mobject = Mobject, L extends Mobject = Mobject> extends Group {
  shapeIdx: number;
  labelIdx: number;

  /** center: put the label on the shape's center */
  constructor(shape: S | null, label: L | null, { center = true }: { center?: boolean } = {}) {
    super(...[shape, label].filter((m): m is S | L => Boolean(m)));
    this.shapeIdx = shape ? 0 : -1;
    this.labelIdx = label ? this.children.length - 1 : -1;
    if (shape && label && center) label.moveTo(shape);
  }
  /** The shape, or the label when there is no shape: what arrows attach to. */
  get shape(): S | L { return (this.children[this.shapeIdx] ?? this.label) as S | L; }
  get label(): L | null { return (this.children[this.labelIdx] ?? null) as L | null; }
}

export interface ArrowOpts { tipLength?: number; tipWidth?: number; stroke?: string; strokeWidth?: number; buff?: number }

/**
 * A line with a filled triangular tip. Children: [line, tip], read through
 * indices so a copy's `line` is the copy's own: copy() clones children, and a
 * stored reference would still point at the original's.
 */
export class Arrow extends Group {
  opts: { tipLength: number; tipWidth: number };

  constructor(start: Readonly<Vec>, end: Readonly<Vec>, { tipLength = 0.3, tipWidth = 0.22, stroke = '#ffffff', strokeWidth = 0.04, buff = 0 }: ArrowOpts = {}) {
    super();
    this.opts = { tipLength, tipWidth };
    this.add(new Line(start, end, { stroke, strokeWidth }), new Polygon([[0, 0], [0, 0], [0, 0]], { fill: stroke, stroke: 'none' }));
    this.putStartAndEndOn(start, end, buff);
  }
  get line(): Line { return this.children[0] as Line; }
  get tip(): Polygon { return this.children[1] as Polygon; }
  putStartAndEndOn(start: Readonly<Vec>, end: Readonly<Vec>, buff = 0): this {
    const dir = V.normalize(V.sub(end, start));
    const s = V.add(start, V.mul(dir, buff));
    const e = V.sub(end, V.mul(dir, buff));
    const { tipLength, tipWidth } = this.opts;
    const base = V.sub(e, V.mul(dir, tipLength));
    const perp: Vec = [dir[1], -dir[0]]; // right of the direction: the tip is drawn clockwise on screen
    this.line.putStartAndEndOn(s, base);
    this.tip.setPolygon([e, V.add(base, V.mul(perp, tipWidth / 2)), V.sub(base, V.mul(perp, tipWidth / 2))]);
    this.invalidateBox();
    return this;
  }
}



export interface ArcOpts extends Style { center?: Vec; radius?: number; startAngle?: number; angle?: number }

/** Circular arc as cubics, ≤ 90° per segment. Angles in radians, counterclockwise (y up). */
export class Arc extends VMobject {
  constructor({ center = [0, 0], radius = 1, startAngle = 0, angle = Math.PI / 2, ...style }: ArcOpts = {}) {
    super(style);
    const n = Math.max(1, Math.ceil(Math.abs(angle) / (Math.PI / 2)));
    const step = angle / n;
    const k = (4 / 3) * Math.tan(step / 4);
    const pt = (a: number): Vec => [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
    this.startNewPath(pt(startAngle));
    for (let i = 0; i < n; i++) {
      const a0 = startAngle + i * step, a1 = a0 + step;
      const p0 = pt(a0), p3 = pt(a1);
      const t0 = [-Math.sin(a0), Math.cos(a0)] as const, t1 = [-Math.sin(a1), Math.cos(a1)] as const;
      this.addCubic(
        [p0[0] + k * radius * t0[0], p0[1] + k * radius * t0[1]],
        [p3[0] - k * radius * t1[0], p3[1] - k * radius * t1[1]],
        p3,
      );
    }
  }
}

/**
 * Arc from `start` to `end` turning through `angle` radians about its center:
 * positive is counterclockwise (as in manim), which bulges to the right of start → end.
 */
export class ArcBetweenPoints extends Arc {
  constructor(start: Readonly<Vec>, end: Readonly<Vec>, { angle = Math.PI / 4, ...style }: Style & { angle?: number } = {}) {
    const chord = V.sub(end, start), d = V.norm(chord);
    const radius = d / (2 * Math.sin(Math.abs(angle) / 2));
    const mid = V.lerp(start, end, 0.5);
    const perp = V.normalize([-chord[1], chord[0]]);
    const h = radius * Math.cos(Math.abs(angle) / 2) * Math.sign(angle);
    const center = V.add(mid, V.mul(perp, h));
    const startAngle = V.angleOf(V.sub(start, center));
    super({ center, radius, startAngle, angle, ...style });
  }
}

export interface CurvedArrowOpts { angle?: number; tipLength?: number; tipWidth?: number; stroke?: string; strokeWidth?: number }

/** Curved arrow: arc body + tip tangent to the arc's end. Children: [arc, tip], by index (see Arrow). */
export class CurvedArrow extends Group {
  constructor(start: Readonly<Vec>, end: Readonly<Vec>, { angle = Math.PI / 4, tipLength = 0.28, tipWidth = 0.2, stroke = '#ffffff', strokeWidth = 0.04 }: CurvedArrowOpts = {}) {
    super();
    const arc = new ArcBetweenPoints(start, end, { angle, stroke, strokeWidth });
    // Trim the arc so it ends at the tip's base, then place the tip along the end tangent
    const n = arc.numCurves(0);
    const pEnd = arc.pointOnCurve(0, n - 1, 1), pNear = arc.pointOnCurve(0, n - 1, 0.97);
    const dir = V.normalize(V.sub(pEnd, pNear));
    const base = V.sub(pEnd, V.mul(dir, tipLength));
    const perp: Vec = [dir[1], -dir[0]]; // right of the direction: the tip is drawn clockwise on screen
    const a = arc.subpaths[0]!;
    a[a.length - 2] = base[0]; a[a.length - 1] = base[1];
    arc.touchPoints();
    this.add(arc, new Polygon([pEnd, V.add(base, V.mul(perp, tipWidth / 2)), V.sub(base, V.mul(perp, tipWidth / 2))], { fill: stroke, stroke: 'none' }));
  }
  get arc(): ArcBetweenPoints { return this.children[0] as ArcBetweenPoints; }
  get tip(): Polygon { return this.children[1] as Polygon; }
}
