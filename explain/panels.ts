import { Group, Rectangle, Text, Code, FadeIn, FadeOut, Transform } from '../src/index.ts';
import type { Scene, Vec, Box } from '../src/index.ts';
import type { Palette } from '../integrations/agentic-mermaid/snapshot.ts';
import { soft, raised, rule, boxCenter, emphasis, regionBox, REGIONS } from './look.ts';
import type { Region } from './look.ts';

export type CardRow = readonly [label: string, value: unknown];
export interface CardOptions {
  /**
   * Centre of the card, or a region/box to centre it in. The box's width caps
   * the card's, and a card never rises above the box's top.
   */
  at?: Vec | Box | Region;
  /** In a box: 'top' sets the card's top on the box's top, so cards side by side align. */
  align?: 'center' | 'top';
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
      // Centred in the box (or on its top edge), but never above its top edge.
      const b = at as Box;
      this.moveTo([center[0], options.align === 'top' ? b[3] - height / 2 : Math.min(b[3] - height / 2, center[1])]);
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
  align?: 'center' | 'top';
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
  /** Added/removed bars behind lines (from `diff`, or from `morph` with `markAdded`). */
  marks: Rectangle[] = [];
  private focused: readonly [number, number] | null = null;
  private fontSize: number;
  private scaled = 1;

  constructor(scene: Scene, colors: Palette, lines: readonly string[], options: CodeOptions = {}) {
    super();
    this.scene = scene;
    this.colors = colors;
    const fontSize = (this.fontSize = options.fontSize ?? 0.25);
    this.code = new Code(lines, { fontSize, color: colors.ink });
    const at = typeof options.at === 'string' ? regionBox(options.at) : (options.at ?? [0, 0]);
    const box = at.length === 4 ? (at as Box) : null;
    if (box) {
      const room = box[2] - box[0] - 0.7;
      if (this.code.width() > room) {
        this.scaled = room / this.code.width();
        this.code.scale(this.scaled);
      }
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
        this.marks.push(r);
        this.add(r);
      });
    this.add(this.bar, this.code);
    if (head) this.add(head);
    if (box) {
      const c = boxCenter(box);
      this.moveTo([c[0], options.align === 'top' ? box[3] - height / 2 : Math.min(box[3] - height / 2, c[1])]);
    } else this.moveTo(at as Vec);
  }

  /** Line pitch as laid out (the block may have been scaled to fit its box). */
  private get pitch(): number {
    return this.fontSize * 1.5 * this.scaled;
  }

  private lineBar(
    a: number,
    b: number,
    lines: readonly Text[] = this.code.lines,
    panel: Rectangle = this.panel,
  ): Rectangle {
    const pitch = this.pitch;
    const y0 = lines[a]!.anchorPoint()[1] + pitch / 2,
      y1 = lines[b]!.anchorPoint()[1] - pitch / 2;
    return new Rectangle({
      width: panel.width() - 0.14,
      height: Math.abs(y0 - y1),
      cornerRadius: 0.05,
      fill: emphasis(this.colors),
      fillOpacity: 0.22,
      stroke: 'none',
    }).moveTo([panel.center()[0], (y0 + y1) / 2]);
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

  /**
   * Turn the code into `next`, pairing lines by their text (longest common
   * subsequence): lines that survive glide to their new rows, removed lines
   * fade out, and added lines fade in, optionally with a bar that stays.
   */
  async morph(next: readonly string[], { runTime = 0.9, markAdded = false } = {}): Promise<void> {
    const old = this.code.lines;
    const keep = matchLines(
      old.map((l) => l.text),
      next,
    );
    const target = new Code(next, { fontSize: this.fontSize, color: this.colors.ink });
    if (this.scaled !== 1) target.scale(this.scaled);
    // The block keeps its centre and top: it grows downward and evenly sideways,
    // so a block placed in a region stays inside it.
    const [panelLeft, , panelRight, top] = this.panel.box()!;
    const width = Math.max(panelRight - panelLeft, target.width() + 0.7),
      left = (panelLeft + panelRight) / 2 - width / 2,
      right = left + width;
    const firstRow = old[0]!.anchorPoint()[1];
    target.shift([left + 0.35 - target.box()![0], firstRow - target.lines[0]!.anchorPoint()[1]]);
    let bottom = target.box()![1] - 0.3;
    // Growing downward must not leave the stage: lift the block by any overflow.
    const lift = Math.max(0, REGIONS.full[1] - bottom);
    target.shift([0, lift]);
    bottom += lift;
    const panel = new Rectangle({
      width: right - left,
      height: top + lift - bottom,
      cornerRadius: 0.1,
      fill: this.panel.style.fill,
      stroke: this.panel.style.stroke,
      strokeWidth: this.panel.style.strokeWidth,
    }).moveTo([(left + right) / 2, (top + lift + bottom) / 2]);
    const anims = [new Transform(this.panel, panel, { runTime })];
    const lines: Text[] = [];
    next.forEach((_, j) => {
      const i = keep.get(j);
      if (i == null) {
        const line = target.lines[j]!;
        this.code.add(line);
        anims.push(new FadeIn(line, { runTime, shift: [0, -0.06] }));
        lines.push(line);
        return;
      }
      const line = old[i]!,
        moved = line.copy();
      const [x0, y0] = line.anchorPoint(),
        [x1, y1] = target.lines[j]!.anchorPoint();
      moved.shift([x1 - x0, y1 - y0]);
      anims.push(new Transform(line, moved, { runTime }));
      lines.push(line);
    });
    const kept = new Set(keep.values());
    old.forEach((line, i) => {
      if (!kept.has(i)) anims.push(new FadeOut(line, { runTime: runTime * 0.6, shift: [-0.12, 0] }));
    });
    for (const mark of this.marks) anims.push(new FadeOut(mark, { runTime: runTime * 0.6 }));
    if (this.focused) anims.push(new FadeOut(this.bar, { runTime: runTime * 0.6 }));
    const added: Rectangle[] = [];
    if (markAdded)
      next.forEach((_, j) => {
        if (keep.has(j)) return;
        const bar = this.lineBar(j, j, target.lines, panel).setStyle({ fill: ADDED, fillOpacity: 0.2 });
        bar.style.opacity = 1;
        added.push(bar);
        anims.push(new FadeIn(bar, { runTime }));
      });
    // Bars draw behind the text: put them just after the panel.
    for (const bar of added) {
      bar.parent = this;
      this.children.splice(this.children.indexOf(this.panel) + 1, 0, bar);
    }
    await this.scene.play(...anims);
    for (const line of [...this.code.children]) this.code.remove(line);
    this.code.add(...lines);
    this.code.lines = lines;
    this.marks = added;
    this.focused = null;
    this.bar.setOpacity(0);
    this.invalidateBox();
  }

  /** Fade out the added/removed bars. */
  async clearMarks({ runTime = 0.4 } = {}): Promise<void> {
    const marks = this.marks;
    this.marks = [];
    if (marks.length) await this.scene.play(...marks.map((m) => new FadeOut(m, { runTime })));
  }
}

/** Pairs of (new index → old index) for the longest common subsequence of equal lines. */
export function matchLines(before: readonly string[], after: readonly string[]): Map<number, number> {
  const n = before.length,
    m = after.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i]![j] = before[i] === after[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const pairs = new Map<number, number>();
  for (let i = 0, j = 0; i < n && j < m; )
    if (before[i] === after[j]) pairs.set(j++, i++);
    else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  return pairs;
}
