import { Group, Rectangle, Text, Code, FadeIn, FadeOut, Transform } from '../src/index.ts';
import type { Scene, Vec, Box } from '../src/index.ts';
import type { Palette } from '../integrations/agentic-mermaid/snapshot.ts';
import { soft, raised, rule, boxCenter, emphasis, good, bad, regionBox, REGIONS } from './look.ts';
import type { Region } from './look.ts';
import type { Seen } from './trace.ts';

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
/** Shrink a right-anchored value to `room`, never mirroring it. */
function fitValue(value: Text, room: number): void {
  const w = value.width();
  if (w > room && w > 0) value.scale(Math.max(room, 0) / w, { aboutEdge: [1, 0] });
}
/**
 * Fit a row's label and value into `room`. The label never takes more than
 * 90% of it, so every value (now or after `set`) keeps a positive room.
 */
function fitRow(label: Text, value: Text, room: number): void {
  const labelRoom = Math.min(room * 0.9, Math.max(room - value.width(), room * 0.6));
  if (label.width() > labelRoom) label.scale(labelRoom / label.width(), { aboutEdge: [-1, 0] });
  fitValue(value, room - label.width());
}
const PAD = 0.28;
/** The raised, ruled panel cards and code sit on. */
const panelRect = (colors: Palette, width: number, height: number) =>
  new Rectangle({ width, height, cornerRadius: 0.1, fill: raised(colors), stroke: rule(colors), strokeWidth: 0.016 });
/** A tinted bar behind a row or lines: the one shape for card marks, code focus and diff lines. */
const tint = (color: string, width: number, height: number) =>
  new Rectangle({ width, height, cornerRadius: 0.05, fill: color, fillOpacity: 0.2, stroke: 'none' });
/**
 * Move a panel's highlight bar onto `to`'s place, fading it in if it is hidden;
 * `null` fades it out. The bar stays, so a step's resting frame shows it.
 */
async function moveBar(scene: Scene, bar: Rectangle, to: Rectangle | null, runTime: number): Promise<void> {
  const shown = (bar.style.opacity ?? 1) > 0;
  if (!to) {
    if (shown) await scene.play(bar.animate.setOpacity(0), { runTime });
  } else if (shown) await scene.play(new Transform(bar, to.setStyle({ ...bar.style }), { runTime }));
  else {
    bar.subpaths = to.subpaths.map((a) => a.slice());
    bar.closed = [...to.closed];
    bar.invalidateBox();
    await scene.play(new FadeIn(bar.setOpacity(1), { runTime }));
  }
}
/**
 * Put a panel `height` tall at a point, or centred in a box (`align: 'top'` sets
 * it on the box's top, so panels side by side align), never above the box's top.
 */
function place(panel: Group, at: Vec | Box, height: number, align: 'center' | 'top' = 'center'): void {
  if (at.length !== 4) {
    panel.moveTo(at as Vec);
    return;
  }
  const b = at as Box,
    [x, y] = boxCenter(b);
  panel.moveTo([x, align === 'top' ? b[3] - height / 2 : Math.min(b[3] - height / 2, y)]);
}

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
  /** The row `mark` lit and its word, for the description. */
  private lit: { label: string; as: string } | null = null;
  private repeated: Set<string>;
  private readonly title: string | undefined;
  /** Rows in order (labels may repeat), for the description. */
  private rows: { label: string; value: Text }[] = [];

  constructor(scene: Scene, colors: Palette, rows: readonly CardRow[], options: CardOptions = {}) {
    super();
    this.scene = scene;
    this.colors = colors;
    this.title = options.title;
    const size = (this.fontSize = options.fontSize ?? 0.24);
    // A label may repeat (a card can list parts by kind), but then it names no single row.
    const names = rows.map(([l]) => l);
    this.repeated = new Set(names.filter((l, i) => names.indexOf(l) !== i));
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
    this.panel = panelRect(colors, width, height);
    this.bar = tint(emphasis(colors), width - 0.12, pitch * 0.92).setOpacity(0);
    this.add(this.panel, this.bar);
    const left = -width / 2 + PAD;
    this.valueEdge = width / 2 - PAD;
    let y = height / 2 - PAD - size * 0.5;
    if (titleText) {
      // A title wider than a capped card shrinks to fit, as values do.
      const room = width - 2 * PAD;
      if (titleText.width() > room && room > 0) titleText.scale(room / titleText.width());
      titleText.moveTo([left, y], [-1, 0]);
      this.add(titleText);
      y -= pitch * 1.15;
    }
    this.maxValue = width - 2 * PAD - size * 1.5;
    // Room for at least a glyph's width beside its label; less than that cannot hold a row.
    if (!(this.maxValue >= size)) throw new Error(`A card ${width.toFixed(2)} wide has no room for its rows`);
    rows.forEach(([label], i) => {
      const l = labels[i]!.moveTo([left, y], [-1, 0]);
      const v = values[i]!.moveTo([this.valueEdge, y], [1, 0]);
      fitRow(l, v, this.maxValue);
      this.labels.set(label, l);
      this.values.set(label, v);
      this.rows.push({ label, value: v });
      this.add(l, v);
      y -= pitch;
    });
    place(this, at, height, options.align);
  }

  /** The rows as a reader sees them, the lit one with its word. */
  describe(): Seen {
    const n = `${this.rows.length} labelled value${this.rows.length === 1 ? '' : 's'}`;
    return {
      what: this.title ? `“${this.title}”, ${n}` : n,
      parts: this.rows.map((r) => ({
        name: `${r.label}: ${r.value.text}`,
        ...(r.label === this.lit?.label ? { mark: this.lit.as } : {}),
      })),
    };
  }

  private row(label: string): Text {
    if (this.repeated.has(label)) throw new Error(`Card row ${label} is not unique: set and mark need a label that names one row`);
    const v = this.values.get(label);
    if (!v) throw new Error(`No card row ${label}. Rows: ${[...this.values.keys()].join(', ')}`);
    return v;
  }

  /** Crossfade changed values in one play; unchanged rows do not move. */
  async set(changes: Readonly<Record<string, unknown>>, { runTime = 0.45 } = {}): Promise<void> {
    const anims = [];
    // Check every label before drawing anything, so a bad call changes nothing.
    for (const label of Object.keys(changes)) this.row(label);
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
      fitValue(next, this.maxValue - this.labels.get(label)!.width());
      // A faded card stays faded: the new value arrives at the old one's opacity.
      next.setOpacity(old.style.opacity);
      this.add(next);
      this.values.set(label, next);
      this.rows.find((r) => r.label === label)!.value = next;
      anims.push(
        new FadeOut(old, { shift: [0, 0.12], runTime }),
        new FadeIn(next, { shift: [0, 0.12], runTime }),
      );
    }
    if (anims.length) await this.scene.play(...anims);
  }

  /**
   * Light one row (null clears). The bar stays until moved, so it shows in the step's
   * resting frame. `as` is the word the description gives it (default "marked").
   */
  async mark(label: string | null, { as = 'marked', runTime = 0.4 } = {}): Promise<void> {
    const y = label == null ? 0 : this.row(label).anchorPoint()[1];
    this.lit = label == null ? null : { label, as };
    await moveBar(this.scene, this.bar, label == null ? null : this.bar.copy().moveTo([this.panel.center()[0], y]), runTime);
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
/** A bar behind an added or removed line. */
interface LineMark {
  line: number;
  kind: 'added' | 'removed';
  mob: Group;
}

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
  marks: LineMark[] = [];
  private focused: { lines: readonly [number, number]; as: string } | null = null;
  private fontSize: number;
  private scaled = 1;
  /** The box the block was placed in; `morph` grows only within it (the stage, if placed at a point). */
  private region: Box;
  private readonly title: string | undefined;

  constructor(scene: Scene, colors: Palette, lines: readonly string[], options: CodeOptions = {}) {
    super();
    this.scene = scene;
    this.colors = colors;
    const fontSize = (this.fontSize = options.fontSize ?? 0.25);
    if (!lines.length) throw new Error('A code block needs at least one line');
    this.code = new Code(lines, { fontSize, color: colors.ink });
    const at = typeof options.at === 'string' ? regionBox(options.at) : (options.at ?? [0, 0]);
    const box = at.length === 4 ? (at as Box) : null;
    this.region = box ? [...box] : regionBox('full');
    this.title = options.title;
    if (box) {
      const room = box[2] - box[0] - 0.7;
      // Room for at least a glyph's width of code beside the padding.
      if (!(room >= fontSize)) throw new Error(`A box ${(box[2] - box[0]).toFixed(2)} wide has no room for code`);
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
    this.panel = panelRect(colors, width, height);
    this.code.moveTo([0, head ? -0.21 : 0]);
    // A title wider than the panel shrinks to fit it, as a card's does.
    if (head && head.width() > width - 2 * pad) head.scale((width - 2 * pad) / head.width());
    if (head) head.moveTo([-width / 2 + pad, height / 2 - 0.3], [-1, 0]);
    this.bar = tint(emphasis(colors), width - 0.14, 0.1).setOpacity(0);
    this.add(this.panel);
    if (options.diff)
      lines.forEach((line, i) => {
        if (!/^[+-] /.test(line)) return;
        const mark = this.lineMark(i, line[0] === '+' ? 'added' : 'removed');
        this.marks.push(mark);
        this.add(mark.mob);
      });
    this.add(this.bar, this.code);
    if (head) this.add(head);
    place(this, at, height, options.align);
  }

  /** The lines as a reader sees them, with the focused, added and removed ones named. */
  describe(): Seen {
    const kinds = new Map(this.marks.map((m) => [m.line, m.kind]));
    const f = this.focused;
    const n = this.code.lines.length;
    return {
      what: `Code${this.title ? ` “${this.title}”` : ''}, ${n} line${n === 1 ? '' : 's'}`,
      parts: this.code.lines.map((l, i) => {
        const words = [...(f && i >= f.lines[0] && i <= f.lines[1] ? [f.as] : []), ...(kinds.has(i) ? [kinds.get(i)!] : [])];
        return { name: `${i + 1}: ${l.text}`, ...(words.length ? { mark: words.join(', ') } : {}) };
      }),
    };
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
    return tint(emphasis(this.colors), panel.width() - 0.14, Math.abs(y0 - y1)).moveTo([panel.center()[0], (y0 + y1) / 2]);
  }

  /**
   * A tinted bar behind line i, with a solid edge in the gutter: the edge marks
   * the line by shape as well as by colour.
   */
  private lineMark(i: number, kind: LineMark['kind'], lines?: readonly Text[], panel?: Rectangle): LineMark {
    const color = kind === 'added' ? good(this.colors) : bad(this.colors);
    const back = this.lineBar(i, i, lines, panel).setStyle({ fill: color });
    const [x0, y0, , y1] = back.box()!;
    const edge = new Rectangle({ width: 0.06, height: y1 - y0, fill: color, stroke: 'none' }).moveTo([x0 + 0.03, (y0 + y1) / 2]);
    return { line: i, kind, mob: new Group(back, edge) };
  }

  /**
   * Put the focus bar on line i, or lines [a, b] inclusive; null hides it. `as` is the
   * word the description gives the lines (default "focused").
   */
  async focus(lines: number | readonly [number, number] | null, { as = 'focused', runTime = 0.4 } = {}): Promise<void> {
    if (lines == null) {
      this.focused = null;
      return moveBar(this.scene, this.bar, null, runTime);
    }
    const [a, b] = typeof lines === 'number' ? [lines, lines] : lines;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b >= this.code.lines.length || a > b)
      throw new Error(`No code lines ${a}..${b}`);
    this.focused = { lines: [a, b], as };
    await moveBar(this.scene, this.bar, this.lineBar(a, b), runTime);
  }

  /**
   * Turn the code into `next`, pairing lines by their text (longest common
   * subsequence): lines that survive glide to their new rows, removed lines
   * fade out, and added lines fade in, optionally with a bar that stays.
   */
  async morph(next: readonly string[], { runTime = 0.9, markAdded = false } = {}): Promise<void> {
    if (!next.length) throw new Error('A code block needs at least one line');
    const old = this.code.lines;
    const target = new Code(next, { fontSize: this.fontSize, color: this.colors.ink });
    // Pair lines as Code shows them (tabs expanded), the form the old lines carry.
    const keep = matchLines(
      old.map((l) => l.text),
      target.lines.map((l) => l.text),
    );
    // The block keeps its centre and top: it grows downward and evenly sideways,
    // and only as far as its region allows (it shrinks the code to fit).
    const [panelLeft, , panelRight, top] = this.panel.box()!;
    const region = this.region;
    const regionWidth = region[2] - region[0],
      regionHeight = region[3] - region[1];
    this.scaled = Math.min(this.scaled, (regionWidth - 0.7) / Math.max(1e-9, target.width()));
    target.scale(this.scaled);
    const firstRow = old[0]!.anchorPoint()[1];
    const place = () => {
      const width = Math.max(Math.min(panelRight - panelLeft, regionWidth), target.width() + 0.7);
      let left = (panelLeft + panelRight) / 2 - width / 2;
      left = Math.min(Math.max(left, region[0]), region[2] - width);
      target.shift([left + 0.35 - target.box()![0], firstRow - target.lines[0]!.anchorPoint()[1]]);
      return [left, left + width] as const;
    };
    let [left, right] = place();
    // Taller than the region allows: shrink so the panel fits (placing by the first row moves
    // the text a little as it shrinks, so settle in a few passes).
    // A region too short for even a shrunken line bounds only the width; the stage bounds the height.
    const tallRegion = regionHeight >= 1;
    // (A 1e-4 margin: text geometry is float32, so an exact fit can land a rounding outside.)
    const fitHeight = regionHeight - 1e-4;
    for (let pass = 0; tallRegion && pass < 4 && top - (target.box()![1] - 0.3) > fitHeight; pass++) {
      const k = (fitHeight - (top - target.box()![3]) - 0.3) / target.height();
      target.scale(k * (1 - 1e-6), { aboutEdge: [-1, 1] });
      this.scaled *= k * (1 - 1e-6);
      [left, right] = place();
    }
    let bottom = target.box()![1] - 0.3;
    // Growing downward must not leave the region: lift the block by any overflow.
    const lift = Math.max(0, (tallRegion ? region : REGIONS.full)[1] - bottom);
    target.shift([0, lift]);
    bottom += lift;
    const panel = panelRect(this.colors, right - left, top + lift - bottom).moveTo([
      (left + right) / 2,
      (top + lift + bottom) / 2,
    ]);
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
      // Same text, so the same glyphs: the old line becomes its target row (at the new scale).
      const line = old[i]!;
      anims.push(new Transform(line, target.lines[j]!.copy(), { runTime }));
      lines.push(line);
    });
    const kept = new Set(keep.values());
    old.forEach((line, i) => {
      if (!kept.has(i)) anims.push(new FadeOut(line, { runTime: runTime * 0.6, shift: [-0.12, 0] }));
    });
    for (const mark of this.marks) anims.push(new FadeOut(mark.mob, { runTime: runTime * 0.6 }));
    // Hide the focus bar in place: a FadeOut would take it out of the block.
    if (this.focused) anims.push(new Transform(this.bar, this.bar.copy().setOpacity(0), { runTime: runTime * 0.6 }));
    const added: LineMark[] = [];
    if (markAdded)
      next.forEach((_, j) => {
        if (keep.has(j)) return;
        const mark = this.lineMark(j, 'added', target.lines, panel);
        added.push(mark);
        anims.push(new FadeIn(mark.mob, { runTime }));
      });
    // Bars draw behind the text: put them just after the panel.
    for (const { mob } of added) {
      mob.parent = this;
      this.children.splice(this.children.indexOf(this.panel) + 1, 0, mob);
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
    if (marks.length) await this.scene.play(...marks.map((m) => new FadeOut(m.mob, { runTime })));
  }
}

/** Pairs of (new index → old index) for the longest common subsequence of equal lines. */
function matchLines(before: readonly string[], after: readonly string[]): Map<number, number> {
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
