// Text: real glyph outlines from the embedded fonts, one VMobject per glyph.
//
// Exact advances for layout, letter-by-letter Write, and Transform between
// strings morphs glyph to glyph. The DOM renderer draws a same-styled line as
// one <path> (mergedRecord in svg.ts), so a line costs one element.
//
//   new Text('hello', { fontSize: 0.4, font: 'sans' | 'mono', color, weight: 'normal' | 'bold',
//                       anchor: 'start' | 'middle' | 'end' })
//
// `anchor` is the point setText() keeps fixed: a left-anchored counter going
// 10.0 -> 9.0 stays put at its left edge. Fonts are loaded by Scene.run();
// outside a scene, await loadFonts() first.

import { Mobject, Group } from './mobject.ts';
import type { Style, PathFunc } from './mobject.ts';
import { VMobject } from './vmobject.ts';
import { Rectangle } from './shapes.ts';
import { shaperFor } from './fonts.ts';
import type { FontName } from './fonts.ts';
import { WHITE } from './color.ts';
import type { Vec } from './vec.ts';
import type { Segment } from '../vendor/glyph.js';

export interface TextOpts {
  fontSize?: number;
  font?: FontName;
  color?: string;
  weight?: 'normal' | 'bold';
  /** The point setText() keeps fixed. */
  anchor?: 'start' | 'middle' | 'end';
  fillOpacity?: number;
  /** Lay tabs out to the next multiple of this many columns (Code sets it); unset, a tab is one blank advance. */
  tabWidth?: number;
}

/** A glyph outline as cubic subpaths in font units, before placement. */
interface UnitOutline { subpaths: number[][]; closed: boolean[] }

/**
 * A glyph outline flattened once to cubic Bézier subpaths in font units (y-up),
 * keyed by the shaper's segment array. Shaping is memoized, so the same glyph
 * reuses this; each Glyph is then one affine map into a Float32Array.
 */
const unitOutlines = new WeakMap<Segment[], UnitOutline>();
function unitOutline(segments: Segment[]): UnitOutline {
  let o = unitOutlines.get(segments);
  if (o) return o;
  const subpaths: number[][] = [], closed: boolean[] = [];
  // The shaper always opens a contour with MoveTo before drawing into it
  let cur: number[] = [], cx = 0, cy = 0;
  for (const s of segments) {
    switch (s.tag) {
      case 'MoveTo': cur = [s.x, s.y]; subpaths.push(cur); closed.push(false); cx = s.x; cy = s.y; break;
      case 'LineTo':
        cur.push(cx + (s.x - cx) / 3, cy + (s.y - cy) / 3, cx + 2 * (s.x - cx) / 3, cy + 2 * (s.y - cy) / 3, s.x, s.y);
        cx = s.x; cy = s.y; break;
      case 'QuadTo':
        // Degree elevation: cubic handles 2/3 of the way toward the quad control
        cur.push(cx + 2 * (s.x1 - cx) / 3, cy + 2 * (s.y1 - cy) / 3, s.x + 2 * (s.x1 - s.x) / 3, s.y + 2 * (s.y1 - s.y) / 3, s.x, s.y);
        cx = s.x; cy = s.y; break;
      case 'CubicTo': cur.push(s.x1, s.y1, s.x2, s.y2, s.x, s.y); cx = s.x; cy = s.y; break;
      case 'Close': if (closed.length) closed[closed.length - 1] = true; break;
    }
  }
  o = { subpaths, closed };
  unitOutlines.set(segments, o);
  return o;
}

class Glyph extends VMobject {
  /** Source string index this glyph came from. */
  cluster: number | undefined;
  constructor(segments: Segment[], scale: number, ox: number, oy: number, style: Style) {
    super(style);
    const { subpaths, closed } = unitOutline(segments);
    this.subpaths = subpaths.map((u) => {
      const a = new Float32Array(u.length);
      // Font units are y-up, like the scene: one scale and offset, no flip
      for (let i = 0; i < u.length; i += 2) { a[i] = ox + u[i]! * scale; a[i + 1] = oy + u[i + 1]! * scale; }
      return a;
    });
    this.closed = closed.slice();
  }
}

// Faux bold: an outline in the fill color, this fraction of the font size wide
// (only Regular faces are embedded).
const BOLD_STROKE = 0.045;

/** A shaped run's metrics, in scene units at `fontSize`. */
export interface RunMetrics { width: number; ascent: number; descent: number; fontSize: number }

export class Text extends Group {
  text: string;
  font: FontName;
  fontSize: number;
  weight: 'normal' | 'bold';
  anchor: 'start' | 'middle' | 'end';
  /** Tab stops every this many columns, or undefined: see TextOpts. `text` keeps the tabs; glyph clusters index the expanded string. */
  tabWidth: number | undefined;
  // Set by build(), which the constructor calls
  run!: RunMetrics;
  /**
   * The advance box as a point array of its corners, bottom-left, top-right,
   * top-left, bottom-right: [x0, y0, x1, y1, ...]. All four travel with the glyphs,
   * so a rotated text still knows its size and angle: see build().
   */
  frameBox!: Float32Array;

  constructor(text: string, { fontSize = 0.4, font = 'sans', color = WHITE, weight = 'normal', anchor = 'middle', fillOpacity = 1, tabWidth }: TextOpts = {}) {
    super();
    if (tabWidth != null) expandTabs('', tabWidth); // validates it
    this.tabWidth = tabWidth;
    this.text = text;
    this.font = font;
    this.fontSize = fontSize;
    this.weight = weight;
    this.anchor = anchor;
    this.mergeLeaves = true;
    const bold = weight === 'bold';
    this.build(text, fontSize, {
      fill: color, fillOpacity, stroke: bold ? color : 'none', strokeWidth: bold ? BOLD_STROKE * fontSize : 0,
    });
    // Centered on the origin, like every other mobject
    this.shift([-this.run.width / 2, this.run.ascent - (this.run.ascent - this.run.descent) / 2]);
  }

  /** Lay out glyphs with the pen at the origin and the baseline at y = 0. */
  build(text: string, fontSize: number, style: Style): void {
    const run = shaperFor(this.font)(this.tabWidth ? expandTabs(text, this.tabWidth) : text, fontSize);
    this.run = { width: run.width, ascent: run.ascent, descent: run.descent, fontSize };
    const scale = run.s ?? fontSize / 1000;
    for (const c of this.children) c.parent = null;
    this.children = [];
    for (const g of run.glyphs) {
      if (!g.path?.length) continue;
      const gl = new Glyph(g.path, g.s ?? scale, g.x + g.dx, g.dy, { ...style });
      gl.cluster = g.cluster;
      gl.parent = this;
      this.children.push(gl);
    }
    // The advance box travels with the glyphs as a point array of its own, so
    // box()/left() are typographic extents (leading spaces count), not ink.
    this.frameBox = new Float32Array([0, -run.descent, run.width, run.ascent, 0, run.ascent, run.width, -run.descent]);
    this.invalidateBox();
  }

  override pointArrays(): Float32Array[] { return [this.frameBox]; }
  override pointKind(): string { return 'box'; }
  override copyData(src: Mobject): void { this.frameBox = new Float32Array((src as Text).frameBox); }

  /** Exact advance width, in scene units. */
  advance(): number { return this.frameBox[2]! - this.frameBox[0]!; }

  /**
   * What the advance box has been through since build(), as its linear part per unit:
   * ex along the baseline, ey up the side. A fresh build has ex = (1, 0), ey = (0, 1).
   */
  private frame(): { ex: Vec; ey: Vec } {
    const f = this.frameBox, h = this.run.ascent + this.run.descent, w = this.run.width;
    const ey: Vec = [(f[4]! - f[0]!) / h, (f[5]! - f[1]!) / h];
    // An empty run has no width to measure: assume the baseline is ey turned a quarter clockwise
    const ex: Vec = w > 0 ? [(f[6]! - f[0]!) / w, (f[7]! - f[1]!) / w] : [ey[1], -ey[0]];
    return { ex, ey };
  }

  /** Only moved and scaled uniformly (no turn, mirror, stretch or shear): the common case, read the simple way. */
  private plain(): boolean {
    const f = this.frameBox;
    if (!(f[0] === f[4] && f[1] === f[7])) return false;
    const { ex, ey } = this.frame();
    return ex[0] > 0 && ey[1] > 0 && Math.abs(ex[0] / ey[1] - 1) < 1e-6;
  }

  /** The angle the text has been turned through, in radians (0 while plain), read from its upright edge. */
  angle(): number {
    if (this.plain()) return 0;
    const { ey } = this.frame();
    return Math.atan2(ey[1], ey[0]) - Math.PI / 2;
  }

  /** The font size the text is drawn at now, after any scaling (the geometric mean when stretched); never negative. */
  textSize(): number {
    const f = this.frameBox;
    if (this.plain()) return this.run.fontSize * (f[3]! - f[1]!) / (this.run.ascent + this.run.descent);
    const { ex, ey } = this.frame();
    return this.run.fontSize * Math.sqrt(Math.abs(ex[0] * ey[1] - ex[1] * ey[0]));
  }

  /** The point setText keeps fixed: left, center or right of the advance box, at its vertical middle. */
  anchorPoint(): Vec {
    const f = this.frameBox;
    if (this.plain()) {
      const cy = (f[1]! + f[3]!) / 2;
      return [this.anchor === 'start' ? f[0]! : this.anchor === 'end' ? f[2]! : (f[0]! + f[2]!) / 2, cy];
    }
    // Along the bottom edge by fx, then halfway up the side edge: right for any affine map
    const fx = this.anchor === 'start' ? 0 : this.anchor === 'end' ? 1 : 0.5;
    return [f[0]! + fx * (f[6]! - f[0]!) + (f[4]! - f[0]!) / 2, f[1]! + fx * (f[7]! - f[1]!) + (f[5]! - f[1]!) / 2];
  }

  /**
   * Replace the text, keeping the anchor point and current style, and whatever the text
   * has been through since it was built: its size, and any turn, mirror, stretch or shear.
   */
  setText(text: string): this {
    const at = this.anchorPoint();
    const style: Style = this.children[0] ? { ...this.children[0].style } : { fill: WHITE, stroke: 'none' };
    this.text = text;
    if (this.plain()) {
      this.build(text, this.textSize(), style);
    } else {
      const { ex, ey } = this.frame();
      this.build(text, this.run.fontSize, style);
      this.applyAffine(ex[0], ex[1], ey[0], ey[1], 0, 0, { aboutPoint: [0, 0] });
    }
    const now = this.anchorPoint();
    this.shift([at[0] - now[0], at[1] - now[1]]);
    return this;
  }

  override setFill(fill: string, fillOpacity?: number): this {
    super.setFill(fill, fillOpacity);
    if (this.weight === 'bold') this.setStyle({ stroke: fill });
    return this;
  }

  /** Glyphs morph pairwise (Transform aligns them); the string itself switches when the morph lands. */
  override interpolate(a: Mobject, b: Mobject, alpha: number, pathFunc?: PathFunc | null): this {
    super.interpolate(a, b, alpha, pathFunc);
    if (alpha >= 1 && b instanceof Text) { this.text = b.text; this.run = b.run; }
    return this;
  }
}

export interface DecimalNumberOpts extends TextOpts { decimals?: number; prefix?: string; suffix?: string }

/** A number that animates: Transform blends `value`; the glyphs are re-shaped each frame. */
export class DecimalNumber extends Text {
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;

  constructor(value: number, { decimals = 0, prefix = '', suffix = '', ...opts }: DecimalNumberOpts = {}) {
    super(DecimalNumber.format(value, decimals, prefix, suffix), opts);
    this.value = value; this.decimals = decimals; this.prefix = prefix; this.suffix = suffix;
  }
  /** The shown string. A value that rounds to zero shows no sign: never "-0" or "-0.00". */
  static format(v: number, d: number, pre: string, suf: string): string {
    const s = v.toFixed(d);
    return pre + (/^-0(?:\.0*)?$/.test(s) ? s.slice(1) : s) + suf;
  }
  setValue(v: number): this {
    this.value = v;
    return this.setText(DecimalNumber.format(v, this.decimals, this.prefix, this.suffix));
  }
  override interpolate(a: Mobject, b: Mobject, alpha: number, pathFunc?: PathFunc | null): this {
    // Alignment pairs family members by index, so either side may be another
    // class; its `value` is then undefined and the plain blend runs
    const va = (a as Partial<DecimalNumber>).value, vb = (b as Partial<DecimalNumber>).value;
    if (va === vb) return super.interpolate(a, b, alpha, pathFunc);
    Mobject.prototype.interpolate.call(this, a, b, alpha, pathFunc);
    return this.setValue(va! + (vb! - va!) * alpha);
  }
}

export interface CodeOpts { fontSize?: number; color?: string; lineHeight?: number; tabWidth?: number }

const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;

/**
 * `line` with each tab replaced by the spaces up to the next multiple of `width` columns.
 * A column is a grapheme (an accent combined with its letter takes one). `width` must be a
 * positive integer.
 */
export function expandTabs(line: string, width = 4): string {
  if (!Number.isInteger(width) || width < 1) throw new RangeError(`tabWidth must be a positive integer, not ${width}`);
  if (!line.includes('\t')) return line;
  let out = '', col = 0;
  const units = graphemes ? Array.from(graphemes.segment(line), (g) => g.segment) : Array.from(line);
  for (const ch of units) {
    if (ch === '\t') { const n = width - (col % width); out += ' '.repeat(n); col += n; }
    else { out += ch; col++; }
  }
  return out;
}

/** Monospace lines, left-aligned on exact advances. Tabs advance to the next tab stop (every `tabWidth` columns). */
export class Code extends Group {
  lines: Text[];

  constructor(lines: readonly string[], { fontSize = 0.26, color = '#dddddd', lineHeight = 1.5, tabWidth = 4 }: CodeOpts = {}) {
    super();
    this.lines = lines.map((l, i) => {
      // `text` stays the source line, tabs and all; the glyphs are laid out with the tabs expanded
      const t = new Text(l, { fontSize, font: 'mono', color, anchor: 'start', tabWidth });
      t.shift([-t.frameBox[0]!, -i * fontSize * lineHeight - t.anchorPoint()[1]]);
      return t;
    });
    this.add(...this.lines);
    this.moveTo([0, 0]);
  }
  /** A translucent bar behind line `i`, as wide as the block. */
  highlight(i: number, color = '#ffff00'): Rectangle {
    const r = new Rectangle({ width: this.width() + 0.3, height: this.lines[i]!.height() * 1.45, cornerRadius: 0.06, fill: color, fillOpacity: 0.18, stroke: 'none' });
    return r.moveTo(this.lineCenter(i));
  }
  /** Where a highlight bar for line `i` sits. */
  lineCenter(i: number): Vec { return [this.center()[0], this.lines[i]!.center()[1]]; }
}
