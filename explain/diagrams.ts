import {
  Group,
  VMobject,
  FadeIn,
  FadeOut,
  Create,
  Transform,
  Dot,
  MoveAlongPath,
  AnimationGroup,
  linear,
  Rectangle,
  Text,
} from '../src/index.ts';
import type { Scene, Mobject, Box, Vec, Style } from '../src/index.ts';
import { regionBox, boxCenter, raised, emphasis, dimOpacity } from './look.ts';
import type { Region } from './look.ts';
import { diagramsOf, findingsOf, SVG_PX_PER_UNIT } from '../integrations/agentic-mermaid/snapshot.ts';
import { outlineText } from '../integrations/agentic-mermaid/text.ts';
import { recordWalk } from './trace.ts';
import type { Seen, SeenPart } from './trace.ts';
import { lerpColor } from '../src/color.ts';
import type {
  DiagramSpec,
  DiagramSnapshot,
  SnapshotPart,
  MutationOp,
} from '../integrations/agentic-mermaid/snapshot.ts';

export interface ShowOptions {
  /** Where the diagram fits: a stage region name or [minX, minY, maxX, maxY]. */
  box?: Box | Region;
  build?: 'all' | 'frame';
  runTime?: number;
}
interface Part {
  info: SnapshotPart;
  mob: Group;
  route?: VMobject;
}
export type NoteSide = 'above' | 'below' | 'left' | 'right';
interface Note {
  id: string;
  side: NoteSide;
  text: string;
  mob: Group;
}
/** Route tokens: the dot that travels a link, and how fast it appears and goes. */
const TOKEN = { radius: 0.08, fade: 0.18 };
/** Parts that frame a family (axes, lifelines, lanes, branches) rather than say something. */
const isScaffold = (info: SnapshotPart) =>
  info.id === '__frame' ||
  /axis|lifeline|lane|grid|participant|actor|section|rail|plate|chrome/.test(info.role) ||
  info.id.startsWith('branch:');
/** A reader's name for each family, and for its things and its links. */
const FAMILIES: Record<string, [string, string?, string?]> = {
  flowchart: ['Flowchart', 'node', 'link'],
  sequence: ['Sequence diagram', 'participant', 'message'],
  state: ['State diagram', 'state', 'transition'],
  class: ['Class diagram', 'class', 'relationship'],
  mindmap: ['Mind map', 'topic', 'branch'],
  gitgraph: ['Git graph', 'commit', 'link'],
  er: ['ER diagram', 'entity', 'relationship'],
  xychart: ['XY chart'],
  timeline: ['Timeline', 'period'],
  gantt: ['Gantt chart', 'task'],
  quadrant: ['Quadrant chart', 'point'],
};
const counted = (n: number, noun: string) =>
  `${n} ${n === 1 ? noun : noun.replace(/(s|ch)$/, '$1e').replace(/y$/, 'ie') + 's'}`;

/** The words and size of a label: a native Text, or a diagram label imported as outlines. */
export interface LabelInfo {
  text: string;
  fontSize: number;
  /** Font size per unit of drawn height, so a scaled label's size can be read from its height. */
  emRatio: number;
}
/** A label's words and size, or undefined for a mobject that is not a label. */
export function labelOf(m: Mobject): LabelInfo | undefined {
  if (m instanceof Text) return { text: m.text, fontSize: m.run.fontSize, emRatio: m.run.fontSize / (m.run.ascent + m.run.descent) };
  const info = m as Partial<LabelInfo>;
  return typeof info.text === 'string' && info.emRatio ? (info as LabelInfo) : undefined;
}
const OPPOSITE: Record<NoteSide, NoteSide> = { above: 'below', below: 'above', left: 'right', right: 'left' };
/**
 * Where a note sits beside a box. If the frame would push it back onto the
 * part it describes, try the opposite side, then above and below.
 */
function notePosition(note: Mobject, box: Box, side: NoteSide, frame: Box): Vec {
  const w = note.width() / 2,
    h = note.height() / 2;
  const clear = ([x, y]: Vec) => x + w <= box[0] || x - w >= box[2] || y + h <= box[1] || y - h >= box[3];
  const tries = [...new Set<NoteSide>([side, OPPOSITE[side], 'above', 'below'])].map((s) =>
    clampedPosition(note, box, s, frame),
  );
  return tries.find(clear) ?? tries[0]!;
}
function clampedPosition(note: Mobject, box: Box, side: NoteSide, frame: Box): Vec {
  const w = note.width(),
    h = note.height(),
    gap = 0.14;
  let [x, y] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  if (side === 'above') y = box[3] + gap + h / 2;
  else if (side === 'below') y = box[1] - gap - h / 2;
  else if (side === 'left') x = box[0] - gap - w / 2;
  else x = box[2] + gap + w / 2;
  x = Math.min(Math.max(x, frame[0] + w / 2 + 0.05), frame[2] - w / 2 - 0.05);
  y = Math.min(Math.max(y, frame[1] + h / 2 + 0.05), frame[3] - h / 2 - 0.05);
  return [x, y];
}
class GrowFromEdge extends FadeIn {
  axis: 0 | 1;
  edge: Vec;
  constructor(mob: Mobject, axis: 0 | 1, edge: Vec, runTime: number) {
    super(mob, { runTime });
    this.axis = axis;
    this.edge = edge;
  }
  override createStartingMobject(): Mobject {
    return super.createStartingMobject().stretch(0.001, this.axis, { aboutEdge: this.edge });
  }
}
class MessageToken extends MoveAlongPath {
  override interpolate(alpha: number): void {
    super.interpolate(alpha);
    this.mobject.setOpacity(Math.sin(Math.PI * alpha));
  }
}
/** Scale a style's lengths (stroke width, dashes) by k, as artwork scaled by k needs. */
function scaleStyle(style: Style, k: number): void {
  if (style.strokeWidth != null) style.strokeWidth *= k;
  // Dash patterns are SVG lists: numbers split by spaces and/or commas.
  if (style.dashArray)
    style.dashArray = style.dashArray
      .split(/[ ,]+/)
      .filter((v) => v !== '')
      .map((v) => Number(v) * k)
      .join(' ');
  if (style.dashOffset) style.dashOffset *= k;
}
function scaleArtwork(mob: Mobject, k: number, at: Vec = [0, 0]): void {
  mob.scale(k, { aboutPoint: at });
  for (const m of mob.family()) scaleStyle(m.style, k);
}
/** A copy of `m` scaled by k about `from`, then moved so `from` lands on `to`: one camera move. */
function moved(m: Group, k: number, from: Vec, to: Vec): Group {
  const target = m.copy();
  scaleArtwork(target, k, from);
  target.shift([to[0] - from[0], to[1] - from[1]]);
  return target;
}

export class Diagram {
  readonly scene: Scene;
  spec: DiagramSpec;
  snapshot: DiagramSnapshot;
  root = new Group();
  parts = new Map<string, Part>();
  visible = new Set<string>();
  order: string[];
  frameBox: Box;
  accent: string;
  private home = new Group();
  /** Unemphasised styles of each top-level part's family, at the home frame (captured when built). */
  private base = new Map<string, Style[]>();
  /** How far the camera has scaled the artwork from home; stroke widths and dashes follow it. */
  private zoom = 1;
  /** Marked parts: their colour, and the word a description gives the mark. */
  private marks = new Map<string, { color: string; as: string }>();
  private kept: Set<string> | null = null;
  /** How opaque dimmed parts stay on this diagram's paper. */
  private dimmed: number;
  /** The last walk, by step name, for the description. */
  private walked: { step: string | undefined; hops: string[]; trail: boolean } | null = null;
  notes: Note[] = [];

  constructor(
    scene: Scene,
    spec: DiagramSpec,
    snapshot: DiagramSnapshot,
    { box: where = 'full' }: ShowOptions = {},
  ) {
    const box = regionBox(where);
    this.scene = scene;
    this.spec = spec;
    this.snapshot = snapshot;
    this.frameBox = box;
    this.root.clipBox = [...box];
    this.accent = emphasis(snapshot.palette);
    this.dimmed = dimOpacity(snapshot.palette);
    for (const info of snapshot.parts) {
      const mob = new Group();
      mob.key = info.id;
      for (const shape of info.shapes) {
        const paths = shape.textRun ? outlineText(shape.textRun, shape.style) : [new VMobject(shape.style)];
        if (!shape.textRun) {
          paths[0]!.subpaths = shape.subpaths.map((a) => new Float32Array(a));
          paths[0]!.closed = [...shape.closed];
        }
        // A text run is one label of many outlines: it moves and checks as a unit.
        const drawn = shape.textRun ? Object.assign(new Group(...paths), { mergeLeaves: true }) : paths[0]!;
        if (shape.text != null) {
          const label: LabelInfo = { text: shape.text, fontSize: shape.fontSize!, emRatio: shape.fontSize! / Math.max(0.001, drawn.height()) };
          Object.assign(drawn, label);
        }
        mob.add(drawn);
      }
      let route: VMobject | undefined;
      if (info.route?.length) {
        route = new VMobject({ fill: 'none', stroke: 'none', opacity: 0 });
        route.startNewPath(info.route[0]!);
        for (const p of info.route.slice(1)) route.addLineTo(p);
        mob.add(route);
      }
      this.parts.set(info.id, { info, mob, ...(route ? { route } : {}) });
      this.root.add(mob);
    }
    // Some renderer labels overhang the declared SVG canvas (notably XY ticks).
    // Fit all artwork as well as that canvas, rather than clipping those labels.
    const [w, h] = [snapshot.width / SVG_PX_PER_UNIT, snapshot.height / SVG_PX_PER_UNIT];
    const artwork = this.root.box() ?? [0, -h, w, 0];
    const bounds: Box = [
      Math.min(0, artwork[0]),
      Math.min(-h, artwork[1]),
      Math.max(w, artwork[2]),
      Math.max(0, artwork[3]),
    ];
    const inset = Math.min(0.12, (box[2] - box[0]) / 20, (box[3] - box[1]) / 20);
    const k = Math.min(
      (box[2] - box[0] - 2 * inset) / (bounds[2] - bounds[0]),
      (box[3] - box[1] - 2 * inset) / (bounds[3] - bounds[1]),
    );
    scaleArtwork(this.root, k);
    this.root.shift([
      (box[0] + box[2]) / 2 - ((bounds[0] + bounds[2]) * k) / 2,
      (box[1] + box[3]) / 2 - ((bounds[1] + bounds[3]) * k) / 2,
    ]);
    this.home = this.root.copy();
    for (const p of this.parts.values()) if (p.info.owner) this.parts.get(p.info.owner)!.mob.add(p.mob);
    // Hidden marks stay in the addressable map, not in the rendered tree.
    for (const p of [...this.root.children]) this.root.remove(p);
    // Family reading: preserve message/task/commit order; graph nodes precede outgoing links.
    const all = [...this.parts.values()].filter((p) => !p.info.owner);
    const graph = ['flowchart', 'state', 'mindmap', 'class'].includes(snapshot.family);
    const nodes = all.filter((p) => p.info.from == null && p.info.id !== '__frame');
    if (graph) {
      const rank = new Map<string, number>();
      const edges = all.filter((p) => p.info.from && p.info.to);
      for (let i = 0; i < nodes.length; i++)
        for (const e of edges) {
          const a = e.info.from!,
            b = e.info.to!;
          if (a !== b && !rank.has(b)) rank.set(b, (rank.get(a) ?? 0) + 1);
        }
      nodes.sort(
        (a, b) =>
          (rank.get(a.info.id) ?? 0) - (rank.get(b.info.id) ?? 0) ||
          b.mob.center()[1] - a.mob.center()[1] ||
          a.mob.center()[0] - b.mob.center()[0],
      );
      this.order = nodes.flatMap((n) => [
        n.info.id,
        ...edges.filter((e) => e.info.from === n.info.id).map((e) => e.info.id),
      ]);
      this.order.push(...all.map((p) => p.info.id).filter((id) => !this.order.includes(id)));
    } else this.order = all.map((p) => p.info.id);
    if (snapshot.family === 'gitgraph')
      this.order.sort((a, b) => this.get(a).center()[0] - this.get(b).center()[0]);
    for (const p of all) this.base.set(p.info.id, p.mob.family().map((m) => ({ ...m.style })));
  }

  /** The verifier's warnings for this diagram, each with the `part` id it names (see `findingsOf`). */
  findings() {
    return findingsOf(this.snapshot);
  }

  /**
   * The one way an id names a part: its own id, or a participant's or class's
   * bare name ('A' for 'actor:A'), the name links use for their endpoints.
   */
  private find(id: string): Part | undefined {
    return this.parts.get(id) ?? this.parts.get('actor:' + id) ?? this.parts.get('class:' + id);
  }
  get(id: string): Group {
    const part = this.find(id);
    if (!part) throw new Error(`No diagram mark ${id}. Available: ${[...this.parts.keys()].join(', ')}`);
    return part.mob;
  }
  /** The top-level part an id belongs to (an owned label resolves to its owner); throws for an unknown id. */
  private top(id: string): string {
    this.get(id);
    let part = this.find(id)!;
    while (part.info.owner) part = this.parts.get(part.info.owner)!;
    return part.info.id;
  }
  /** As `top`, but an endpoint that names no part stands for itself. */
  private end(id: string): string {
    return this.find(id) ? this.top(id) : id;
  }
  /** Put the root on stage. Hidden marks are never added: opacity on a Group does not mask its descendants in Lantern. */
  private attach(): void {
    if (!this.scene.mobjects.includes(this.root)) this.scene.add(this.root);
  }
  /** A route token at the start of a link. */
  private token(route: VMobject, color: string): Dot {
    const dot = new Dot({ radius: TOKEN.radius, color }).moveTo(route.pointFromProportion(0));
    this.root.add(dot);
    return dot;
  }
  async build(mode: 'all' | 'frame' = 'all', runTime = 0.65): Promise<this> {
    this.attach();
    await this.reveal(this.order.filter((id) => isScaffold(this.parts.get(id)!.info)), { runTime });
    if (mode === 'all') await this.reveal('rest', { runTime });
    return this;
  }
  async reveal(which: number | readonly string[] | 'rest', { runTime = 0.65 } = {}): Promise<void> {
    const pending = this.order.filter((id) => !this.visible.has(id));
    if (typeof which === 'number' && (!Number.isInteger(which) || which < 0))
      throw new Error('reveal count must be a non-negative integer');
    const requested =
      which === 'rest' ? pending : typeof which === 'number' ? pending.slice(0, which) : [...which];
    const arriving = [...new Set(requested.map((id) => this.top(id)))].filter((id) => !this.visible.has(id));
    const messages: Part[] = [];
    // Arrive in the current look (dimmed if dimming is on, marked if marked, at the camera's zoom).
    this.looks(arriving, 0, false);
    const anims = arriving.map((id) => {
        const p = this.parts.get(id)!;
        this.visible.add(id);
        this.attach();
        for (const child of this.parts.values()) if (child.info.owner === id) this.visible.add(child.info.id);
        this.root.add(p.mob);
        if (p.info.role === 'message' && p.info.from && p.info.to && p.route) {
          const token = this.token(p.route, this.accent);
          messages.push(p);
          return new AnimationGroup(
            [
              new Create(p.mob, { runTime, lagRatio: 0 }),
              new MessageToken(token, p.route, { runTime, rateFunc: linear, remover: true }),
            ],
            { rateFunc: linear },
          );
        }
        if (p.info.role === 'bar') return new GrowFromEdge(p.mob, 1, [0, -1], runTime);
        if (p.info.role === 'task') return new GrowFromEdge(p.mob, 0, [-1, 0], runTime);
        return p.info.from
          ? new Create(p.mob, { runTime, lagRatio: 0 })
          : new FadeIn(p.mob, { runTime, shift: [0, 0.08] });
      });
    if (anims.length) {
      // Draw in snapshot order, sorted once (by rank, not a search per comparison). Transient
      // route tokens (and notes) stay above artwork; the sort is stable among them.
      const rank = new Map(this.snapshot.parts.map((p, i) => [p.id, i]));
      const at = (m: Mobject) => rank.get(m.key!) ?? this.snapshot.parts.length;
      this.root.children.sort((a, b) => at(a) - at(b));
      await this.scene.play(new AnimationGroup(anims, { lagRatio: 0.12, rateFunc: linear }));
    }
    // Land exactly on that look: drawing animations can end a rounding away from it.
    this.looks(arriving, 0, false);
    for (const p of messages)
      recordWalk(this.scene, {
        step: this.scene.currentStep?.name,
        from: p.info.from!,
        to: p.info.to!,
        edge: p.info.id,
      });
  }
  /** A part's words: its own text and its labels' (an edge's label is a part it owns; a quadrant point's is `<id>:label`). */
  private words(id: string): string {
    return [...this.parts.values()]
      .filter((p) => p.info.id === id || p.info.owner === id || p.info.id === `${id}:label`)
      .flatMap((p) => p.info.shapes.map((s) => s.text?.trim()).filter((t): t is string => !!t))
      .join(' ');
  }
  /** What a reader calls a part: its words, a link as "from → to: label", a bar or line by its data. */
  private nameOf(id: string): string {
    const p = this.find(id);
    if (!p) return id;
    const words = this.words(p.info.id);
    if (p.info.from && p.info.to)
      return `${this.nameOf(p.info.from)} → ${this.nameOf(p.info.to)}${words ? ': ' + words : ''}`;
    return words || this.datum(p.info.id);
  }
  /** A bar's category and value, or a line's range, from the chart's data as written. */
  private datum(id: string): string {
    const bar = /^bar:(\d+):(.*)$/s.exec(id),
      line = /^series:line-(\d+)$/.exec(id);
    // A quadrant point too close to another to be labelled is named by its id, the name in the source.
    if (id.startsWith('point:')) return id.slice(6);
    if (!bar && !line) return '';
    const categories = this.snapshot.chart?.categories ?? [];
    // Bars and lines are numbered within their kind: bar:1:… is the second bar series.
    const series = (this.snapshot.chart?.series ?? []).filter((s) => s.kind === (bar ? 'bar' : 'line'));
    const k = +(bar ?? line)![1]!;
    const values = series[k]?.values ?? [];
    if (bar) {
      const value = values[categories.indexOf(bar[2]!)];
      return `${bar[2]}${series.length > 1 ? ` (bars ${k + 1})` : ''}${value != null ? ': ' + value : ''}`;
    }
    const name = series.length > 1 ? `Line ${k + 1}` : 'Line';
    if (!values.length) return name;
    const [lo, hi] = [Math.min(...values), Math.max(...values)];
    if (lo === hi) return `${name}: ${lo} throughout`;
    const at = (v: number) => {
      const where = values.flatMap((x, i) => (x === v ? [categories[i] ?? String(i + 1)] : []));
      return where.length > 3 ? `${where.slice(0, 3).join(', ')} and ${where.length - 3} more` : where.join(', ');
    };
    return `${name}: lowest ${lo} (${at(lo)}), highest ${hi} (${at(hi)})`;
  }
  /** The chart's axes, as a reader would read them: titles, the value range and the categories. */
  private axes(): string {
    const ticks = [...this.parts.keys()]
      .filter((id) => id.startsWith('axis:y:label:'))
      .map((id) => Number(this.words(id)))
      .filter(Number.isFinite);
    const y = this.words('axis:y:title') || 'values';
    const range = ticks.length ? ` from ${Math.min(...ticks)} to ${Math.max(...ticks)}` : '';
    const categories = this.snapshot.chart?.categories ?? [];
    const x = this.words('axis:x:title');
    const over = categories.length
      ? `, ${counted(categories.length, 'category')} from ${categories[0]} to ${categories.at(-1)}`
      : '';
    return `${y}${range}${x ? ` by ${x}` : ''}${over}`;
  }
  /**
   * What a reader sees of this diagram: what it is and how big, then each shown part
   * by its words in reading order (participants and lanes first), with its emphasis,
   * and the notes on it. Parts drawn with no words are reported as blank.
   */
  describe(): Seen {
    const [family, thing = 'part', link = 'link'] = FAMILIES[this.snapshot.family] ?? [`${this.snapshot.family} diagram`];
    const parts: SeenPart[] = [];
    const blank: string[] = [];
    let things = 0,
      links = 0;
    const step = this.scene.steps.at(-1)?.name;
    // A trail already marks the path; a walk without one names it.
    const walked = this.walked;
    if (walked && walked.step === step && !walked.trail) parts.push({ name: walked.hops.join(', '), mark: 'path' });
    for (const n of this.notes) parts.push({ name: `“${n.text}” beside ${this.nameOf(n.id)}`, mark: 'note' });
    const order = [...this.order].sort((a, b) => +!isScaffold(this.parts.get(a)!.info) - +!isScaffold(this.parts.get(b)!.info));
    for (const id of order) {
      const info = this.parts.get(id)!.info;
      // Axes, titles and legends are summed up in what the chart is.
      if (!this.visible.has(id) || /axis|title|legend/.test(info.role)) continue;
      // A point's label is said with its point.
      if (id.endsWith(':label') && this.visible.has(id.slice(0, -6))) continue;
      const name = this.nameOf(id);
      if (!name) {
        if (!isScaffold(info)) blank.push(`${family} part ${id}`);
        continue;
      }
      if (info.from && info.to) links++;
      else if (!isScaffold(info) || info.role === 'actor') things++;
      const mark = this.marks.get(id)?.as;
      const dimmed = !!this.kept && !this.kept.has(id) && !isScaffold(info);
      parts.push({ name, ...(mark ? { mark } : {}), ...(dimmed ? { dimmed } : {}) });
    }
    const title = this.words('title');
    const size =
      this.snapshot.family === 'xychart'
        ? this.axes()
        : [things && counted(things, thing), links && counted(links, link)].filter(Boolean).join(', ');
    return { what: `${family}${title ? ` “${title}”` : ''}${size ? ': ' + size : ''}`, parts, ...(blank.length ? { blank } : {}) };
  }
  /**
   * Animations that bring each part to its current look: base style, then the
   * mark colour, then dimming. Parts not on screen change in place.
   */
  private looks(ids: Iterable<string>, runTime: number, animate = true): Transform[] {
    const anims: Transform[] = [];
    for (const id of new Set(ids)) {
      const p = this.parts.get(id)!;
      const fam = p.mob.family();
      const base = this.base.get(id)!;
      const color = this.marks.get(id)?.color;
      const dim = this.kept != null && !this.kept.has(id) && !isScaffold(p.info);
      const connector = !!(p.info.from && p.info.to);
      const within = (m: Mobject, test: (a: Mobject) => boolean) => {
        for (let a: Mobject | null = m; a && a !== p.mob; a = a.parent) if (test(a)) return true;
        return false;
      };
      const styles = fam.map((m, i) => {
        const b = base[i]!,
          st: Style = { ...b };
        if (this.zoom !== 1) scaleStyle(st, this.zoom);
        const text = within(m, (a) => !!labelOf(a));
        const owned = within(m, (a) => a.key != null && a.key !== id);
        if (color && !owned && !text) {
          if (st.stroke && st.stroke !== 'none' && (st.strokeWidth ?? 0) > 0) {
            st.stroke = color;
            st.strokeWidth = (st.strokeWidth ?? 0) * 1.8;
          }
          if (st.fill && st.fill !== 'none' && (st.fillOpacity ?? 1) > 0) {
            st.fill = connector ? color : lerpColor(st.fill, color, 0.2);
            // A shape drawn by fill alone (a bar, a task) gains an outline: the mark shows by shape, not only hue.
            if (!connector && !(st.stroke && st.stroke !== 'none' && (st.strokeWidth ?? 0) > 0)) {
              Object.assign(st, { stroke: color, strokeOpacity: 1, strokeWidth: 0.04 * this.zoom });
            }
          }
        }
        if (dim) st.opacity = (b.opacity ?? 1) * this.dimmed;
        return st;
      });
      if (fam.every((m, i) => JSON.stringify(m.style) === JSON.stringify(styles[i]))) continue;
      if (animate && this.root.children.includes(p.mob) && this.scene.familyMembers().includes(p.mob)) {
        const target = p.mob.copy();
        target.family().forEach((m, i) => (m.style = { ...styles[i]! } as typeof m.style));
        anims.push(new Transform(p.mob, target, { runTime }));
      } else fam.forEach((m, i) => (m.style = { ...styles[i]! } as typeof m.style));
    }
    return anims;
  }
  /**
   * Colour parts (and links' arrowheads) and thicken their outlines until unmarked. Labels keep
   * their ink. `as` is the word the description gives the mark ("rejected"), when marks are kinds.
   */
  async mark(
    ids: readonly string[],
    { color = this.accent, as = 'marked', runTime = 0.45 }: { color?: string; as?: string; runTime?: number } = {},
  ): Promise<void> {
    const tops = ids.map((id) => this.top(id));
    for (const id of tops) this.marks.set(id, { color, as });
    const anims = this.looks(tops, runTime);
    if (anims.length) await this.scene.play(...anims);
  }
  async unmark(ids?: readonly string[], { runTime = 0.45 } = {}): Promise<void> {
    const tops = ids ? ids.map((id) => this.top(id)) : [...this.marks.keys()];
    for (const id of tops) this.marks.delete(id);
    const anims = this.looks(tops, runTime);
    if (anims.length) await this.scene.play(...anims);
  }
  /**
   * Fade everything except these parts (and links between them, and the
   * family's scaffolding such as lifelines and axes). `null` restores.
   */
  async dim(keep: readonly string[] | null, { runTime = 0.5 } = {}): Promise<void> {
    if (keep == null) this.kept = null;
    else {
      const kept = new Set(keep.map((id) => this.top(id)));
      for (const p of this.parts.values())
        if (!p.info.owner && p.info.from && p.info.to && !kept.has(p.info.id)) {
          if ([p.info.from, p.info.to].every((n) => kept.has(this.end(n)))) kept.add(p.info.id);
        }
      this.kept = kept;
    }
    const anims = this.looks(
      [...this.parts.values()].filter((p) => !p.info.owner).map((p) => p.info.id),
      runTime,
    );
    if (anims.length) await this.scene.play(...anims);
  }
  /**
   * A short label beside a part, at a readable size whatever the diagram's
   * scale. It follows the part through `focus`, and leaves with `hide`/`morph`.
   */
  async note(
    id: string,
    text: string,
    { side = 'above', color = this.accent, size = 0.22 }: { side?: NoteSide; color?: string; size?: number } = {},
  ): Promise<Group> {
    const anchor = this.get(id);
    const label = new Text(text, { fontSize: size, color });
    const bg = new Rectangle({
      width: label.width() + size * 1.4,
      height: size * 1.85,
      fill: raised(this.snapshot.palette),
      stroke: color,
      strokeWidth: 0.014,
      cornerRadius: 0.08,
    });
    label.moveTo(bg.center());
    const g = new Group(bg, label);
    g.moveTo(notePosition(g, anchor.box()!, side, this.frameBox));
    this.root.add(g);
    this.attach();
    this.notes.push({ id, side, text, mob: g });
    await this.scene.play(new FadeIn(g, { runTime: 0.35, shift: [0, -0.06] }));
    return g;
  }
  async clearNotes({ runTime = 0.3 } = {}): Promise<void> {
    const notes = this.notes;
    this.notes = [];
    if (notes.length) await this.scene.play(...notes.map((n) => new FadeOut(n.mob, { runTime })));
  }
  /**
   * Tokens travel the diagram's own links. Consecutive hops that join up are
   * one journey with one token. `trail` leaves the travelled links marked, so
   * the step's resting frame still shows the path.
   */
  async walk(
    hops: readonly (readonly [string, string])[],
    {
      runTime = 0.8,
      color = this.accent,
      parallel = false,
      trail = false,
    }: { runTime?: number; color?: string; parallel?: boolean; trail?: boolean | string } = {},
  ): Promise<void> {
    // Endpoints resolve as `get` resolves ids (so 'actor:A' and 'A' name the same participant).
    const path = hops.map(([from, to]) => {
      const [a, b] = [this.end(from), this.end(to)];
      const edge = [...this.parts.values()].find(
        (p) => p.info.from != null && p.info.to != null && this.end(p.info.from) === a && this.end(p.info.to) === b,
      );
      if (!edge?.route || !edge.route.numCurves())
        throw new Error(`walk(): ${from} -> ${to} is not a real link`);
      if (!this.visible.has(edge.info.id)) throw new Error(`walk(): reveal ${edge.info.id} first`);
      return { edge, from, to, a, b };
    });
    const trailColor = trail === true ? color : trail || null;
    const lay = (ids: string[]) => {
      if (!trailColor) return [];
      for (const id of ids) this.marks.set(id, { color: trailColor, as: 'travelled' });
      return this.looks(ids, runTime);
    };
    const record = ({ edge, from, to }: (typeof path)[number]) =>
      recordWalk(this.scene, { step: this.scene.currentStep?.name, from, to, edge: edge.info.id });
    this.walked = {
      step: this.scene.currentStep?.name,
      hops: path.map(({ edge }) => `${this.nameOf(edge.info.from!)} → ${this.nameOf(edge.info.to!)}`),
      trail: !!trailColor,
    };
    if (parallel && path.length) {
      const tokens = path.map(({ edge }) => this.token(edge.route!, color));
      await this.scene.play(...tokens.map((token) => new FadeIn(token, { runTime: TOKEN.fade })));
      await this.scene.play(
        ...tokens.map(
          (token, i) => new MoveAlongPath(token, path[i]!.edge.route!, { runTime, rateFunc: linear }),
        ),
        ...lay(path.map((p) => p.edge.info.id)),
      );
      path.forEach(record);
      await this.scene.play(...tokens.map((token) => new FadeOut(token, { runTime: TOKEN.fade })));
      return;
    }
    let token: Dot | null = null;
    for (let i = 0; i < path.length; i++) {
      const hop = path[i]!;
      if (!token) {
        token = this.token(hop.edge.route!, color);
        await this.scene.play(new FadeIn(token, { runTime: TOKEN.fade }));
      }
      await this.scene.play(
        new MoveAlongPath(token, hop.edge.route!, { runTime, rateFunc: linear }),
        ...lay([hop.edge.info.id]),
      );
      record(hop);
      if (path[i + 1]?.a !== hop.b) {
        await this.scene.play(new FadeOut(token, { runTime: TOKEN.fade }));
        token = null;
      }
    }
  }
  private async moveParts(mobs: Group[], targetFor: (m: Group) => Group, runTime: number): Promise<void> {
    const shown: Transform[] = [];
    const targets = new Map<Mobject, Group>();
    for (const m of mobs) {
      const target = targetFor(m);
      targets.set(m, target);
      const animation = new Transform(m, target, { runTime });
      if (this.visible.has(m.key!)) shown.push(animation);
      else {
        animation.begin();
        animation.finish();
      }
    }
    for (const n of this.notes) {
      let top: Mobject = this.get(n.id);
      while (top.parent && top.parent !== this.root) top = top.parent;
      const moved = targets.get(top);
      if (!moved) continue;
      const box = moved.family()[top.family().indexOf(this.get(n.id))]!.box()!;
      const target = n.mob.copy();
      target.moveTo(notePosition(target, box, n.side, this.frameBox));
      shown.push(new Transform(n.mob, target, { runTime }));
    }
    if (shown.length) await this.scene.play(...shown);
  }
  /** Move the camera onto these parts (or back to the whole diagram). Notes follow. */
  async focus(ids: readonly string[] | 'all', { zoom = 1, runTime = 0.9 } = {}): Promise<void> {
    if (!(zoom > 0 && Number.isFinite(zoom))) throw new Error(`focus() zoom must be a positive number, not ${zoom}`);
    const mobs = [...this.parts.values()].filter((p) => !p.info.owner).map((p) => p.mob);
    const whole = new Group(...mobs.map((m) => m.copy()));
    if (ids === 'all') {
      // Apply one global affine map from current full diagram bounds to its authored frame.
      const home = this.home.box(),
        now = whole.box();
      if (!home || !now) return; // Nothing drawn: the camera has nothing to frame.
      // The map is uniform, so either extent gives k; the longer one is measured more precisely
      // (a thin diagram's short side is mostly float32 rounding once zoomed).
      const wide = home[2] - home[0] >= home[3] - home[1];
      const k = wide ? (home[2] - home[0]) / (now[2] - now[0]) : (home[3] - home[1]) / (now[3] - now[1]);
      // A diagram fitted down to a point (an absurd canvas size) has no extent to restore.
      if (!(Number.isFinite(k) && k > 0)) return;
      const a: Vec = [(now[0] + now[2]) / 2, (now[1] + now[3]) / 2],
        b: Vec = [(home[0] + home[2]) / 2, (home[1] + home[3]) / 2];
      await this.moveParts(mobs, (m) => moved(m, k, a, b), runTime);
      this.rezoom(1);
      return;
    }
    if (!ids.length) throw new Error("focus() needs at least one part, or 'all'");
    const chosen = new Group(...ids.map((id) => this.get(id).copy()));
    const center = chosen.center(),
      box = this.frameBox;
    const k =
      Math.min(
        (box[2] - box[0]) / Math.max(0.1, chosen.width()),
        (box[3] - box[1]) / Math.max(0.1, chosen.height()),
      ) *
      0.78 *
      zoom;
    await this.moveParts(mobs, (m) => moved(m, k, center, boxCenter(box)), runTime);
    this.rezoom(this.zoom * k);
  }
  /**
   * The camera has moved: re-derive every look from the home styles at the new zoom (the move
   * already animated it), so a look depends only on zoom, marks and dimming, never on the order
   * of calls, and returning to 'all' restores the home styles exactly.
   */
  private rezoom(zoom: number): void {
    this.zoom = zoom;
    this.looks(this.base.keys(), 0, false);
  }
  /**
   * Same-id marks glide to their next place; arrivals fade in, departures fade
   * out. Marks, dimming and notes are reset: the next diagram starts plain.
   * The next diagram keeps this one's style unless it names its own.
   */
  async morph(
    next: DiagramSpec,
    { ops, runTime = 1.1 }: { ops?: readonly MutationOp[]; runTime?: number } = {},
  ): Promise<void> {
    if (next.style == null && this.spec.style != null) next = { ...next, style: this.spec.style };
    const resolver = diagramsOf(this.scene);
    if (ops && resolver.morph) await resolver.morph(this.spec, next, ops);
    const snapshot = await resolver.diagram(next);
    const target = new Diagram(this.scene, next, snapshot, { box: this.frameBox });
    const animations = [];
    for (const [id, p] of this.parts)
      if (!p.info.owner && this.visible.has(id)) {
        const q = target.parts.get(id);
        animations.push(q ? new Transform(p.mob, q.mob, { runTime }) : new FadeOut(p.mob, { runTime }));
      }
    for (const [id, q] of target.parts)
      if (!q.info.owner && !this.visible.has(id)) animations.push(new FadeIn(q.mob, { runTime }));
    for (const n of this.notes) animations.push(new FadeOut(n.mob, { runTime: Math.min(runTime, 0.4) }));
    this.notes = [];
    if (animations.length) await this.scene.play(...animations);
    // Exact handoff to the freshly read tree, retaining semantic route references.
    this.scene.remove(this.root);
    for (const p of target.parts.values())
      if (!p.info.owner) {
        this.scene.remove(p.mob);
        target.root.add(p.mob);
      }
    this.scene.add(target.root);
    this.parts = target.parts;
    this.order = target.order;
    this.root = target.root;
    this.home = target.home;
    this.visible = new Set(this.parts.keys());
    this.spec = next;
    this.snapshot = snapshot;
    // A new style brings its own emphasis colour and dimming.
    this.accent = target.accent;
    this.dimmed = target.dimmed;
    this.base = target.base;
    this.zoom = 1;
    this.plain();
  }
  /** No marks, dimming or walk: the state a fresh or morphed diagram starts in. */
  private plain(): void {
    this.marks.clear();
    this.kept = null;
    this.walked = null;
  }
  /** Fade the whole diagram (and its notes) out. `reveal` can bring parts back. */
  async hide(): Promise<void> {
    const shown = [...this.visible]
      .filter((id) => !this.parts.get(id)!.info.owner)
      .map((id) => this.parts.get(id)!.mob);
    const notes = this.notes.map((n) => n.mob);
    if (shown.length || notes.length)
      await this.scene.play(...[...shown, ...notes].map((m) => new FadeOut(m, { runTime: 0.4 })));
    this.forget();
  }
  /** Reset to unrevealed and unemphasised, without animating (the stage has faded it). */
  forget(): void {
    this.plain();
    this.looks(this.base.keys(), 0, false);
    this.notes = [];
    this.visible.clear();
    for (const child of [...this.root.children]) this.root.remove(child);
  }
}
