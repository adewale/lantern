import {
  Group,
  VMobject,
  FadeIn,
  FadeOut,
  Create,
  Transform,
  Indicate,
  Dot,
  MoveAlongPath,
  AnimationGroup,
  linear,
} from '../src/index.ts';
import type { Scene, Mobject, Box, Vec, Style } from '../src/index.ts';
import { Rectangle, Text } from '../src/index.ts';
import { regionBox, raised, emphasis } from './look.ts';
import type { Region } from './look.ts';
import { diagramsOf, findingsOf } from '../integrations/agentic-mermaid/snapshot.ts';
import { outlineText } from '../integrations/agentic-mermaid/text.ts';
import { recordWalk } from './trace.ts';
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
  mob: Group;
}
const DIM = 0.2;
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
export function scaleArtwork(mob: Mobject, k: number, at: Vec = [0, 0]): void {
  mob.scale(k, { aboutPoint: at });
  for (const m of mob.family()) {
    m.style.strokeWidth *= k;
    if (m.style.dashArray)
      m.style.dashArray = m.style.dashArray
        .split(' ')
        .map((v) => Number(v) * k)
        .join(' ');
    if (m.style.dashOffset) m.style.dashOffset *= k;
  }
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
  /** Unemphasised styles of each top-level part's family, captured on first restyle. */
  private base = new Map<string, Style[]>();
  private marks = new Map<string, string>();
  private kept: Set<string> | null = null;
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
    for (const info of snapshot.parts) {
      const mob = new Group();
      mob.key = info.id;
      for (const shape of info.shapes) {
        const paths = shape.textRun ? outlineText(shape.textRun, shape.style) : [new VMobject(shape.style)];
        if (!shape.textRun) {
          paths[0]!.subpaths = shape.subpaths.map((a) => new Float32Array(a));
          paths[0]!.closed = [...shape.closed];
        }
        const label = shape.textRun ? new Group(...paths) : undefined;
        if (label) {
          Object.assign(label, {
            text: shape.text,
            fontSize: shape.fontSize,
            emRatio: shape.fontSize! / Math.max(0.001, label.height()),
            mergeLeaves: true,
          });
          mob.add(label);
        } else {
          const path = paths[0]!;
          if (shape.text != null)
            Object.assign(path, {
              text: shape.text,
              fontSize: shape.fontSize,
              emRatio: shape.fontSize! / Math.max(0.001, path.height()),
            });
          mob.add(path);
        }
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
    const artwork = this.root.box() ?? [0, -snapshot.height / 100, snapshot.width / 100, 0];
    const bounds: Box = [
      Math.min(0, artwork[0]),
      Math.min(-snapshot.height / 100, artwork[1]),
      Math.max(snapshot.width / 100, artwork[2]),
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
  }

  /** The verifier's warnings for this diagram, each with the `part` id it names (see `findingsOf`). */
  findings() {
    return findingsOf(this.snapshot);
  }

  get(id: string): Group {
    const part =
      this.parts.get(id) ??
      this.parts.get(id.replace(/^node:/, '')) ??
      this.parts.get('class:' + id) ??
      this.parts.get('state:' + id);
    if (!part) throw new Error(`No diagram mark ${id}. Available: ${[...this.parts.keys()].join(', ')}`);
    return part.mob;
  }
  async build(mode: 'all' | 'frame' = 'all', runTime = 0.65): Promise<this> {
    // Do not add hidden marks: opacity on a Group does not mask its descendants in Lantern.
    if (!this.scene.mobjects.includes(this.root)) this.scene.add(this.root);
    const frame = this.order.filter(
      (id) =>
        id === '__frame' ||
        /axis|lifeline|lane|grid|participant|actor|section/.test(this.parts.get(id)!.info.role) ||
        id.startsWith('branch:'),
    );
    await this.reveal(frame, { runTime });
    if (mode === 'all') await this.reveal('rest', { runTime });
    return this;
  }
  async reveal(which: number | readonly string[] | 'rest', { runTime = 0.65 } = {}): Promise<void> {
    const pending = this.order.filter((id) => !this.visible.has(id));
    if (typeof which === 'number' && (!Number.isInteger(which) || which < 0))
      throw new Error('reveal count must be a non-negative integer');
    const requested =
      which === 'rest' ? pending : typeof which === 'number' ? pending.slice(0, which) : [...which];
    const ids = [
      ...new Set(
        requested.map((id) => {
          const mob = this.get(id);
          const part = this.parts.get(mob.key!)!;
          return part.info.owner ?? part.info.id;
        }),
      ),
    ];
    const messages: Part[] = [];
    const anims = ids
      .filter((id) => !this.visible.has(id))
      .map((id) => {
        const p = this.parts.get(id)!;
        this.visible.add(id);
        if (!this.scene.mobjects.includes(this.root)) this.scene.add(this.root);
        for (const child of this.parts.values()) if (child.info.owner === id) this.visible.add(child.info.id);
        this.root.add(p.mob);
        this.root.children.sort((a, b) => {
          const ai = this.snapshot.parts.findIndex((p) => p.id === a.key),
            bi = this.snapshot.parts.findIndex((p) => p.id === b.key);
          // Transient route tokens stay above artwork when later messages appear.
          return (ai < 0 ? this.snapshot.parts.length : ai) - (bi < 0 ? this.snapshot.parts.length : bi);
        });
        if (p.info.role === 'message' && p.info.from && p.info.to && p.route) {
          const token = new Dot({ radius: 0.075, color: this.accent }).moveTo(p.route.pointFromProportion(0));
          this.root.add(token);
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
    if (anims.length) await this.scene.play(new AnimationGroup(anims, { lagRatio: 0.12, rateFunc: linear }));
    for (const p of messages)
      recordWalk(this.scene, {
        step: this.scene.currentStep?.name,
        from: p.info.from!,
        to: p.info.to!,
        edge: p.info.id,
      });
  }
  /** The top-level part an id belongs to (an owned label resolves to its owner). */
  private top(id: string): string {
    let part = this.parts.get(this.get(id).key!)!;
    while (part.info.owner) part = this.parts.get(part.info.owner)!;
    return part.info.id;
  }
  private isScaffold(p: Part): boolean {
    return (
      p.info.id === '__frame' ||
      /axis|lifeline|lane|grid|participant|actor|section/.test(p.info.role) ||
      p.info.id.startsWith('branch:')
    );
  }
  /**
   * Animations that bring each part to its current look: base style, then the
   * mark colour, then dimming. Parts not on screen change in place.
   */
  private looks(ids: Iterable<string>, runTime: number): Transform[] {
    const anims: Transform[] = [];
    for (const id of new Set(ids)) {
      const p = this.parts.get(id)!;
      const fam = p.mob.family();
      if (!this.base.has(id)) this.base.set(id, fam.map((m) => ({ ...m.style })));
      const base = this.base.get(id)!;
      const color = this.marks.get(id);
      const dim = this.kept != null && !this.kept.has(id) && !this.isScaffold(p);
      const connector = !!(p.info.from && p.info.to);
      const within = (m: Mobject, test: (a: Mobject) => boolean) => {
        for (let a: Mobject | null = m; a && a !== p.mob; a = a.parent) if (test(a)) return true;
        return false;
      };
      const styles = fam.map((m, i) => {
        const b = base[i]!,
          st: Style = { ...b };
        const text = within(m, (a) => typeof (a as { text?: unknown }).text === 'string');
        const owned = within(m, (a) => a.key != null && a.key !== id);
        if (color && !owned && !text) {
          if (st.stroke && st.stroke !== 'none' && (st.strokeWidth ?? 0) > 0) {
            st.stroke = color;
            st.strokeWidth = (st.strokeWidth ?? 0) * 1.8;
          }
          if (st.fill && st.fill !== 'none' && (st.fillOpacity ?? 1) > 0)
            st.fill = connector ? color : lerpColor(st.fill, color, 0.2);
        }
        if (dim) st.opacity = (b.opacity ?? 1) * DIM;
        return st;
      });
      if (fam.every((m, i) => JSON.stringify(m.style) === JSON.stringify(styles[i]))) continue;
      if (this.root.children.includes(p.mob) && this.scene.familyMembers().includes(p.mob)) {
        const target = p.mob.copy();
        target.family().forEach((m, i) => (m.style = { ...styles[i]! } as typeof m.style));
        anims.push(new Transform(p.mob, target, { runTime }));
      } else fam.forEach((m, i) => (m.style = { ...styles[i]! } as typeof m.style));
    }
    return anims;
  }
  /** Colour parts (and links' arrowheads) until unmarked. Labels keep their ink. */
  async mark(ids: readonly string[], { color = this.accent, runTime = 0.45 } = {}): Promise<void> {
    const tops = ids.map((id) => this.top(id));
    for (const id of tops) this.marks.set(id, color);
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
          const ends = [p.info.from, p.info.to].map((n) => {
            try {
              return this.top(n);
            } catch {
              return n;
            }
          });
          if (ends.every((n) => kept.has(n))) kept.add(p.info.id);
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
    if (!this.scene.mobjects.includes(this.root)) this.scene.add(this.root);
    this.notes.push({ id, side, mob: g });
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
    const path = hops.map(([from, to]) => {
      const edge = [...this.parts.values()].find((p) => p.info.from === from && p.info.to === to);
      if (!edge?.route || !edge.route.numCurves())
        throw new Error(`walk(): ${from} -> ${to} is not a real link`);
      if (!this.visible.has(edge.info.id)) throw new Error(`walk(): reveal ${edge.info.id} first`);
      return { edge, from, to };
    });
    const trailColor = trail === true ? color : trail || null;
    const lay = (ids: string[]) => {
      if (!trailColor) return [];
      for (const id of ids) this.marks.set(id, trailColor);
      return this.looks(ids, runTime);
    };
    const record = ({ edge, from, to }: (typeof path)[number]) =>
      recordWalk(this.scene, { step: this.scene.currentStep?.name, from, to, edge: edge.info.id });
    if (parallel && path.length) {
      const tokens = path.map(({ edge }) =>
        new Dot({ radius: 0.08, color }).moveTo(edge.route!.pointFromProportion(0)),
      );
      this.root.add(...tokens);
      await this.scene.play(...tokens.map((token) => new FadeIn(token, { runTime: 0.18 })));
      await this.scene.play(
        ...tokens.map(
          (token, i) => new MoveAlongPath(token, path[i]!.edge.route!, { runTime, rateFunc: linear }),
        ),
        ...lay(path.map((p) => p.edge.info.id)),
      );
      path.forEach(record);
      await this.scene.play(...tokens.map((token) => new FadeOut(token, { runTime: 0.18 })));
      return;
    }
    let token: Dot | null = null;
    for (let i = 0; i < path.length; i++) {
      const hop = path[i]!;
      if (!token) {
        token = new Dot({ radius: 0.08, color }).moveTo(hop.edge.route!.pointFromProportion(0));
        this.root.add(token);
        await this.scene.play(new FadeIn(token, { runTime: 0.18 }));
      }
      await this.scene.play(
        new MoveAlongPath(token, hop.edge.route!, { runTime, rateFunc: linear }),
        ...lay([hop.edge.info.id]),
      );
      record(hop);
      if (path[i + 1]?.from !== hop.to) {
        await this.scene.play(new FadeOut(token, { runTime: 0.18 }));
        token = null;
      }
    }
  }
  /** A brief pulse. For emphasis that should stay, use `mark`. */
  async highlight(ids: readonly string[], { color = this.accent, runTime = 0.7 } = {}): Promise<void> {
    await this.scene.play(
      ...ids.map((id) => new Indicate(this.get(id), { color, runTime, scaleFactor: 1.025 })),
    );
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
    const mobs = [...this.parts.values()].filter((p) => !p.info.owner).map((p) => p.mob);
    const whole = new Group(...mobs.map((m) => m.copy()));
    if (ids === 'all') {
      // Apply one global affine map from current full diagram bounds to its authored frame.
      const home = this.home.box()!,
        now = whole.box()!;
      const k = Math.min((home[2] - home[0]) / (now[2] - now[0]), (home[3] - home[1]) / (now[3] - now[1]));
      const a: Vec = [(now[0] + now[2]) / 2, (now[1] + now[3]) / 2],
        b: Vec = [(home[0] + home[2]) / 2, (home[1] + home[3]) / 2];
      await this.moveParts(
        mobs,
        (m) => {
          const target = m.copy();
          scaleArtwork(target, k, a);
          target.shift([b[0] - a[0], b[1] - a[1]]);
          return target;
        },
        runTime,
      );
      return;
    }
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
    const at: Vec = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    await this.moveParts(
      mobs,
      (m) => {
        const target = m.copy();
        scaleArtwork(target, k, center);
        target.shift([at[0] - center[0], at[1] - center[1]]);
        return target;
      },
      runTime,
    );
  }
  /**
   * Same-id marks glide to their next place; arrivals fade in, departures fade
   * out. Marks, dimming and notes are reset: the next diagram starts plain.
   */
  async morph(
    next: DiagramSpec,
    { ops, runTime = 1.1 }: { ops?: readonly MutationOp[]; runTime?: number } = {},
  ): Promise<void> {
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
    this.base.clear();
    this.marks.clear();
    this.kept = null;
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
    for (const [id, styles] of this.base) this.parts
        .get(id)!
        .mob.family()
        .forEach((m, i) => (m.style = { ...styles[i]! } as typeof m.style));
    this.base.clear();
    this.marks.clear();
    this.kept = null;
    this.notes = [];
    this.visible.clear();
    for (const child of [...this.root.children]) this.root.remove(child);
  }
}
