import { Group, Rectangle, Text, Code, FadeIn, FadeOut, Transform } from '../src/index.ts';
import type { Scene, Vec, Box } from '../src/index.ts';
import type { Palette } from '../integrations/agentic-mermaid/snapshot.ts';
import { soft, raised, rule, boxCenter, emphasis, regionBox } from './look.ts';
import type { Region } from './look.ts';

export type CardRow = readonly [label: string, value: unknown];
export interface CardOptions {
  /**
   * Centre of the card, or a region/box to centre it in. The box's width caps
   * the card's, and a card never rises above the box's top.
   */
  at?: Vec | Box | Region;
  /** Fixed width; by default the card fits its widest row. */
  width?: number;
  title?: string;
  fontSize?: number;
}
const ROW = 1.9; // row pitch, in font sizes
/** A copy of `group` at `opacity`, leaving its emphasis bar's own visibility alone. */
function faded(group: Group, bar: Rectangle, opacity: number): Group {
  const target = group.copy();
  const skip = group.family().indexOf(bar);
  target.family().forEach((m, i) => {
    if (i !== skip) m.style.opacity = opacity;
  });
  return target;
}
const PAD = 0.28;

/**
 * Labelled values on a panel. A native Group: move, fade or transform it like
 * any Lantern object. `set` crossfades changed values and `mark` keeps a row
 * lit, so the resting frame of a step shows what changed.
 */
export class Card extends Group {
  readonly scene: Scene;
  readonly colors: Palette;
  readonly values = new Map<string, Text>();
  readonly labels = new Map<string, Text>();
  readonly fontSize: number;
  panel: Rectangle;
  bar: Rectangle;
  private valueEdge: number;
  private maxValue: number;

  constructor(scene: Scene, colors: Palette, rows: readonly CardRow[], options: CardOptions = {}) {
    super();
    this.scene = scene;
    this.colors = colors;
    const size = (this.fontSize = options.fontSize ?? 0.24);
    const labels = rows.map(([l]) => new Text(l, { fontSize: size, color: soft(colors), anchor: 'start' }));
    const values = rows.map(
      ([, v]) => new Text(String(v), { fontSize: size * 1.04, font: 'mono', color: colors.ink, anchor: 'end' }),
    );
    const titleText = options.title
      ? new Text(options.title, { fontSize: size * 1.05, color: colors.accent, weight: 'bold', anchor: 'start' })
      : null;
    const at = typeof options.at === 'string' ? regionBox(options.at) : (options.at ?? [0, 0]);
    const cap = at.length === 4 ? at[2] - at[0] : Infinity;
    const natural =
      Math.max(
        titleText ? titleText.width() : 0,
        ...rows.map((_, i) => labels[i]!.width() + values[i]!.width() + size * 2.5),
      ) +
      2 * PAD;
    const width = Math.min(options.width ?? Math.max(3.2, natural), cap);
    const pitch = size * ROW;
    const height = (rows.length + (titleText ? 1.15 : 0)) * pitch + 2 * PAD - size * 0.55;
    this.panel = new Rectangle({
      width,
      height,
      cornerRadius: 0.1,
      fill: raised(colors),
      stroke: rule(colors),
      strokeWidth: 0.016,
    });
    this.bar = new Rectangle({
      width: width - 0.12,
      height: pitch * 0.92,
      cornerRadius: 0.06,
      fill: emphasis(colors),
      fillOpacity: 0.2,
      stroke: 'none',
      opacity: 0,
    });
    this.add(this.panel, this.bar);
    const left = -width / 2 + PAD;
    this.valueEdge = width / 2 - PAD;
    let y = height / 2 - PAD - size * 0.5;
    if (titleText) {
      titleText.moveTo([left, y], [-1, 0]);
      this.add(titleText);
      y -= pitch * 1.15;
    }
    this.maxValue = width - 2 * PAD - size * 1.5;
    rows.forEach(([label], i) => {
      const l = labels[i]!.moveTo([left, y], [-1, 0]);
      const v = values[i]!.moveTo([this.valueEdge, y], [1, 0]);
      const room = this.maxValue - l.width();
      if (v.width() > room) v.scale(room / v.width(), { aboutEdge: [1, 0] });
      this.labels.set(label, l);
      this.values.set(label, v);
      this.add(l, v);
      y -= pitch;
    });
    const center = at.length === 4 ? boxCenter(at as Box) : (at as Vec);
    if (at.length === 4) {
      // Centred in the box, but never above its top edge.
      const b = at as Box;
      this.moveTo([center[0], Math.min(b[3] - height / 2, center[1])]);
    } else this.moveTo(center);
  }

  /** Fade the card to an opacity (1 restores) without waking a hidden mark bar. */
  async fade(opacity: number, { runTime = 0.4 } = {}): Promise<void> {
    await this.scene.play(new Transform(this, faded(this, this.bar, opacity), { runTime }));
  }

  private row(label: string): Text {
    const v = this.values.get(label);
    if (!v) throw new Error(`No card row ${label}. Rows: ${[...this.values.keys()].join(', ')}`);
    return v;
  }

  /** Crossfade changed values in one play; unchanged rows do not move. */
  async set(changes: Readonly<Record<string, unknown>>, { runTime = 0.45 } = {}): Promise<void> {
    const anims = [];
    for (const [label, value] of Object.entries(changes)) {
      const old = this.row(label);
      if (old.text === String(value)) continue;
      const y = old.anchorPoint()[1];
      const next = new Text(String(value), {
        fontSize: this.fontSize * 1.04,
        font: 'mono',
        color: this.colors.ink,
        anchor: 'end',
      }).moveTo([old.anchorPoint()[0], y], [1, 0]);
      const room = this.maxValue - this.labels.get(label)!.width();
      if (next.width() > room) next.scale(room / next.width(), { aboutEdge: [1, 0] });
      this.add(next);
      this.values.set(label, next);
      anims.push(
        new FadeOut(old, { shift: [0, 0.12], runTime }),
        new FadeIn(next, { shift: [0, 0.12], runTime }),
      );
    }
    if (anims.length) await this.scene.play(...anims);
  }

  /** Light one row (null clears). The bar stays until moved, so it shows in the step's resting frame. */
  async mark(label: string | null, { runTime = 0.4 } = {}): Promise<void> {
    if (label == null) {
      if (this.bar.style.opacity) await this.scene.play(this.bar.animate.setOpacity(0), { runTime });
      return;
    }
    const y = this.row(label).anchorPoint()[1];
    const target = this.bar.copy().setOpacity(1);
    target.moveTo([this.panel.center()[0], y]);
    if (!this.bar.style.opacity) {
      this.bar.moveTo([this.panel.center()[0], y]);
      await this.scene.play(new FadeIn(this.bar.setOpacity(1), { runTime }));
    } else await this.scene.play(new Transform(this.bar, target, { runTime }));
  }
}

export interface CodeOptions {
  /** As for cards: a centre point, or a region/box to centre in. */
  at?: Vec | Box | Region;
  fontSize?: number;
  title?: string;
  /** Lines beginning `+ ` or `- ` get added/removed bars (the marker is kept). */
  diff?: boolean;
}
const ADDED = '#2ea043',
  REMOVED = '#e5534b';

/**
 * Code on a panel in the stage's colours, with a focus bar that stays where
 * it was put. A native Group around Lantern's `Code`.
 */
export class CodeBlock extends Group {
  readonly scene: Scene;
  readonly code: Code;
  readonly panel: Rectangle;
  readonly bar: Rectangle;
  readonly colors: Palette;
  private focused: readonly [number, number] | null = null;

  constructor(scene: Scene, colors: Palette, lines: readonly string[], options: CodeOptions = {}) {
    super();
    this.scene = scene;
    this.colors = colors;
    const fontSize = options.fontSize ?? 0.25;
    this.code = new Code(lines, { fontSize, color: colors.ink });
    const at = typeof options.at === 'string' ? regionBox(options.at) : (options.at ?? [0, 0]);
    const box = at.length === 4 ? (at as Box) : null;
    if (box) {
      const room = box[2] - box[0] - 0.7;
      if (this.code.width() > room) this.code.scale(room / this.code.width());
    }
    const pad = 0.3;
    const head = options.title
      ? new Text(options.title, { fontSize: 0.2, color: soft(colors), anchor: 'start' })
      : null;
    const width = this.code.width() + 2 * pad + 0.1,
      height = this.code.height() + 2 * pad + (head ? 0.42 : 0);
    this.panel = new Rectangle({
      width,
      height,
      cornerRadius: 0.1,
      fill: raised(colors),
      stroke: rule(colors),
      strokeWidth: 0.016,
    });
    this.code.moveTo([0, head ? -0.21 : 0]);
    if (head) head.moveTo([-width / 2 + pad, height / 2 - 0.3], [-1, 0]);
    this.bar = new Rectangle({
      width: width - 0.14,
      height: 0.1,
      cornerRadius: 0.05,
      fill: emphasis(colors),
      fillOpacity: 0.22,
      stroke: 'none',
      opacity: 0,
    });
    this.add(this.panel);
    if (options.diff)
      lines.forEach((line, i) => {
        if (!/^[+-] /.test(line)) return;
        const r = this.lineBar(i, i).setStyle({ fill: line[0] === '+' ? ADDED : REMOVED, fillOpacity: 0.2 });
        this.add(r);
      });
    this.add(this.bar, this.code);
    if (head) this.add(head);
    if (box) {
      const c = boxCenter(box);
      this.moveTo([c[0], Math.min(box[3] - height / 2, c[1])]);
    } else this.moveTo(at as Vec);
  }

  private lineBar(a: number, b: number): Rectangle {
    const lines = this.code.lines;
    // Line pitch as laid out (the block may have been scaled to fit its box).
    const pitch =
      lines.length > 1
        ? Math.abs(lines[1]!.anchorPoint()[1] - lines[0]!.anchorPoint()[1])
        : lines[0]!.height() * 1.45;
    const y0 = lines[a]!.anchorPoint()[1] + pitch / 2,
      y1 = lines[b]!.anchorPoint()[1] - pitch / 2;
    return new Rectangle({
      width: this.panel.width() - 0.14,
      height: Math.abs(y0 - y1),
      cornerRadius: 0.05,
      fill: emphasis(this.colors),
      fillOpacity: 0.22,
      stroke: 'none',
    }).moveTo([this.panel.center()[0], (y0 + y1) / 2]);
  }

  /** Fade the block to an opacity (1 restores) without waking a hidden focus bar. */
  async fade(opacity: number, { runTime = 0.4 } = {}): Promise<void> {
    await this.scene.play(new Transform(this, faded(this, this.bar, opacity), { runTime }));
  }

  /** Put the focus bar on line i, or lines [a, b] inclusive; null hides it. */
  async focus(lines: number | readonly [number, number] | null, { runTime = 0.4 } = {}): Promise<void> {
    if (lines == null) {
      if (this.focused) await this.scene.play(this.bar.animate.setOpacity(0), { runTime });
      this.focused = null;
      return;
    }
    const [a, b] = typeof lines === 'number' ? [lines, lines] : lines;
    if (a < 0 || b >= this.code.lines.length || a > b) throw new Error(`No code lines ${a}..${b}`);
    const target = this.lineBar(a, b);
    target.style.fill = emphasis(this.colors);
    target.style.fillOpacity = 0.22;
    if (!this.focused) {
      this.bar.subpaths = target.subpaths.map((a) => a.slice());
      this.bar.closed = [...target.closed];
      this.bar.invalidateBox();
      this.bar.setOpacity(1);
      this.focused = [a, b];
      await this.scene.play(new FadeIn(this.bar, { runTime }));
    } else {
      this.focused = [a, b];
      await this.scene.play(new Transform(this.bar, target, { runTime }));
    }
  }
}
