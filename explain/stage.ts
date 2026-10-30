import { Mobject, Group, Rectangle, Circle, Line, Arrow, Text, FadeIn, FadeOut, Transform, Create } from '../src/index.ts';
import { isDiagramConnector, labelOf } from './diagrams.ts';
import type { Scene, Vec, Box, FadeOpts, Animation } from '../src/index.ts';
import { dimension, pin, callout, tool, Draw, oneStrokeEach } from './annotate.ts';
import type { Side, ToolKind } from './annotate.ts';
import { Diagram } from './diagrams.ts';
import type { ShowOptions } from './diagrams.ts';
import { Card, CodeBlock } from './panels.ts';
import type { CardRow, CardOptions, CodeOptions } from './panels.ts';
import { diagramsOf } from '../integrations/agentic-mermaid/snapshot.ts';
import type { Palette, DiagramSpec } from '../integrations/agentic-mermaid/snapshot.ts';
import { palette } from './palettes.ts';
import { soft, emphasis, good, bad, regionBox } from './look.ts';
import type { Region } from './look.ts';
import { picture, shownNames } from './trace.ts';
import { wordsOf, langOf } from './words.ts';
import type { Seen } from './trace.ts';
import { layoutDirection } from './layout-direction.ts';
import type { LayoutDirection } from './layout-direction.ts';

/** Physical regions retain their coordinates; start/end follow the stage's direction. */
export type StageRegion = Region | 'start' | 'end';

export interface StageOptions {
  /** Default card field order and the meaning of logical start/end regions. */
  direction?: LayoutDirection;
  /** An Agentic Mermaid style: the stage's palette and the style of every diagram that names none. */
  style?: string;
  /** Colours for a stage that differ from its style's (or that has no diagrams). */
  palette?: Palette;
  /**
   * What the heading shows. By default it follows each step's `title`, so the
   * stage itself (poster, still) says which idea is on screen.
   * A string fixes it; `false` leaves the whole frame to the scene.
   */
  heading?: 'step' | string | false;
  /** The heading's font size; at the default 0.36 it is under 12 px on a 390 px phone, at 0.5 about 12. */
  headingSize?: number;
  /** Number each step's heading (a circled 1, 2, 3 before the title). On by default when the heading follows the steps. */
  numbered?: boolean;
}
/** `enter: false` makes the panel and keeps it without playing, for `s.enter` to bring in with others. */
type Entry = { enter?: boolean };
/**
 * `until: 'next'` keeps something only for the step that made it: the stage fades it out as the
 * next step begins, in the same play as the heading change, so a callout, dimension or card that
 * explains one step never has to be removed by hand (and never lingers over the next step's
 * labels). The step's resting picture keeps it; the next step's does not.
 */
export type Scoped = { until?: 'next' };
/**
 * What kept native objects show, in words, for the description: a sentence, or a
 * function for a drawing that changes. Without it, their visible text is listed.
 */
export type Describe = { describe?: string | (() => string) };

/**
 * Part of the stage's heading: its title (`__heading`), or its number, line or band
 * (`__chrome`), or inside one of them. Everything that leaves the heading out of a picture
 * (the checks, the phone close-ups, the text drawing agents read) asks here, so a part
 * added to the heading is left out everywhere at once.
 */
export function isHeading(m: Mobject): boolean {
  for (let x: Mobject | null = m; x; x = x.parent) if (x.key === '__heading' || x.key === '__chrome') return true;
  return false;
}
const isOptions = (v: unknown): v is object => !!v && !(v instanceof Mobject);
const HEADING_Y = 3.8;
/** With a line under it, the heading moves up to make room. */
const HEADING_Y_WITH_LINE = 3.98;
/** A step's `line`: one line under the heading, in the soft colour. */
const LINE_SIZE = 0.3;
/** The widest the heading and its line may be, in scene units. */
const CHROME_WIDTH = 14.6;
/** Where content goes when the camera focuses on it: the stage below the heading and its line. */
const CONTENT: Box = [-7.55, -4.25, 7.55, 3.25];
/** The camera's home box: the whole stage. */
const HOME: Box = [-8, -4.5, 8, 4.5];

export function stage(scene: Scene, options: StageOptions = {}) {
  const direction = layoutDirection(options);
  const physical = <T extends Vec | Box | StageRegion | undefined>(at: T): Exclude<T, 'start' | 'end'> | Region =>
    (at === 'start' ? (direction === 'ltr' ? 'left' : 'right') : at === 'end' ? (direction === 'ltr' ? 'right' : 'left') : at) as Exclude<T, 'start' | 'end'> | Region;
  // Without a style or palette, the stage adopts the first diagram's palette.
  const adopt = !options.palette && !options.style;
  let colors = options.palette ?? palette(options.style ?? 'nord');
  const mode = options.heading ?? 'step';
  const paper = new Rectangle({ width: 16, height: 9, fill: colors.paper, stroke: 'none' });
  paper.key = '__paper';
  scene.add(paper);
  const numbered = options.numbered ?? mode === 'step';
  const headingSize = options.headingSize ?? 0.36;
  /**
   * The heading, at home (camera at rest): the title, a circled step number before it when
   * numbered, and the step's line under it. The number and line are keyed `__chrome`: like the
   * heading they belong to the stage, not the picture a step leaves.
   */
  const makeChrome = (text: string, line: string, number: number | null, step: string) => {
    const t = new Text(text, { fontSize: headingSize, color: colors.ink, weight: 'bold' });
    t.key = '__heading';
    const y = line ? HEADING_Y_WITH_LINE : HEADING_Y;
    const parts: Mobject[] = [];
    let badge: Group | null = null;
    if (number != null && text) {
      const r = headingSize * 0.62;
      const digit = new Text(String(number), { fontSize: headingSize * 0.72, color: emphasis(colors), weight: 'bold' });
      badge = new Group(new Circle({ radius: r, stroke: emphasis(colors), strokeWidth: headingSize * 0.06, fill: 'none' }), digit);
      badge.key = '__chrome';
    }
    const badgeW = badge ? headingSize * 1.24 + headingSize * 0.5 : 0;
    if (t.width() + badgeW > CHROME_WIDTH) t.setWidth(CHROME_WIDTH - badgeW);
    t.moveTo([badgeW / 2, y]);
    if (badge) {
      badge.moveTo([t.box()![0] - headingSize * 0.5 - headingSize * 0.62, y]);
      (badge.children[1] as Text).moveTo(badge.children[0]!.center());
      parts.push(badge);
    }
    if (line) {
      const l = new Text(line, { fontSize: LINE_SIZE, color: soft(colors) });
      if (l.width() > CHROME_WIDTH)
        throw new Error(
          `Step "${step}": its line is ${l.width().toFixed(1)} units wide, longer than one line under the heading (${CHROME_WIDTH}); shorten it`,
        );
      l.moveTo([0, t.box()![1] - 0.08 - l.height() / 2]);
      l.key = '__chrome';
      parts.push(l);
    }
    return { heading: t, chrome: parts };
  };
  const first = makeChrome(typeof mode === 'string' && mode !== 'step' ? mode : '', '', null, '');
  let heading = first.heading;
  let chrome: Mobject[] = [];
  /**
   * A paper band behind the heading. Invisible at home, where content keeps below the heading;
   * while the camera is away, zoomed content passes under it instead of through the title.
   */
  const band = new Rectangle({ width: 16, height: 4.5 - CONTENT[3], fill: colors.paper, stroke: 'none' }).moveTo([0, (4.5 + CONTENT[3]) / 2]);
  band.style.opacity = 0;
  band.key = '__chrome';
  scene.add(band, heading);
  /** Each heading part's home placement; the camera maps it to the screen while it is away. */
  const home = new Map<Mobject, Mobject>([
    [heading, heading.copy()],
    [band, band.copy()],
  ]);
  /** The heading, its band, number and line draw last, over anything added after them. */
  const onTop = () => {
    const top = [band, heading, ...chrome].filter((m) => scene.mobjects.includes(m));
    scene.mobjects = [...scene.mobjects.filter((m) => !top.includes(m)), ...top];
  };
  const add = scene.add.bind(scene);
  scene.add = (...mobs: Mobject[]) => {
    add(...mobs);
    onTop();
    return scene;
  };
  /** The camera's map from home to the world: world = shift + k × home. */
  let view = { k: 1, shift: [0, 0] as Vec };
  const pinned = (m: Mobject, v = view) => {
    const at = home.get(m)!.copy();
    at.scale(v.k, { aboutPoint: [0, 0] });
    for (const x of at.family()) if (x.style.strokeWidth) x.style.strokeWidth *= v.k;
    return at.shift(v.shift);
  };
  /** Kept objects, each with what describes it (several kept together share one). */
  const overlays = new Map<Mobject, (() => string) | undefined>();
  const diagrams = new Set<Diagram>();
  /** Kept for one step only (`until: 'next'`): faded out as the next step begins. */
  let scoped: Mobject[] = [];
  /** Labels placed with `s.label` but not yet drawn (`enter: false`): the next label keeps clear of them too. */
  const pending = new Set<Mobject>();
  const scope = (mobs: Mobject[], { until }: Scoped) => {
    if (until === 'next') scoped.push(...mobs);
  };
  /** The fade-outs of what the step before kept for itself alone, and the end of their keeping. */
  const releaseScoped = (): Animation[] => {
    const present = new Set(scene.familyMembers());
    const gone = scoped.filter((m) => present.has(m));
    scoped = [];
    for (const m of gone) overlays.delete(m);
    return gone.map((m) => new FadeOut(m, { runTime: 0.3 }));
  };

  async function setHeading(text: string, line: string, number: number | null, step: string, also: Animation[] = []): Promise<void> {
    const next = makeChrome(text, line, number, step);
    const was = [heading.text, ...chrome.map((c) => (c as { text?: string }).text ?? '')].join('|'),
      now = [next.heading.text, ...next.chrome.map((c) => (c as { text?: string }).text ?? '')].join('|');
    if (was === now && chrome.length === next.chrome.length) {
      if (also.length) await scene.play(...also);
      return;
    }
    // Away from home, the new heading arrives where the camera shows the old one.
    for (const m of [next.heading, ...next.chrome]) {
      home.set(m, m.copy());
      if (view.k === 1 && !view.shift[0] && !view.shift[1]) continue;
      m.scale(view.k, { aboutPoint: [0, 0] });
      for (const x of m.family()) if (x.style.strokeWidth) x.style.strokeWidth *= view.k;
      m.shift(view.shift);
    }
    const anims: Animation[] = [...also];
    if (heading.text) anims.push(new FadeOut(heading, { runTime: 0.3 }));
    else scene.remove(heading);
    for (const c of chrome) anims.push(new FadeOut(c, { runTime: 0.3 }));
    if (text) anims.push(new FadeIn(next.heading, { runTime: 0.3 }));
    for (const c of next.chrome) anims.push(new FadeIn(c, { runTime: 0.3 }));
    for (const m of [heading, ...chrome]) home.delete(m);
    heading = next.heading;
    chrome = next.chrome;
    if (!text) scene.add(heading);
    if (anims.length) await scene.play(...anims);
  }
  // Follow step titles (and lines) without asking authors to repeat them; what the step before
  // kept for itself alone leaves in the same play.
  if (mode === 'step')
    scene.onStep((s) =>
      setHeading(
        typeof s.meta.title === 'string' ? s.meta.title : '',
        typeof s.meta.line === 'string' ? s.meta.line.trim() : '',
        numbered ? scene.steps.length : null,
        s.name,
        releaseScoped(),
      ),
    );
  else
    scene.onStep(async () => {
      const gone = releaseScoped();
      if (gone.length) await scene.play(...gone);
    });
  /** What a sighted reader sees: diagrams, then panels and described drawings, then other kept text. */
  function look(): Seen[] {
    const w = wordsOf(scene);
    const present = new Set(scene.familyMembers());
    const seen: Seen[] = [];
    for (const d of diagrams) if (present.has(d.root)) seen.push(d.describe());
    const told = new Set<() => string>();
    const labels: string[] = [];
    let blank = 0;
    for (const [m, describe] of overlays)
      if (!present.has(m)) continue;
      else if (m instanceof Card || m instanceof CodeBlock) seen.push(m.describe());
      else if (describe) {
        if (!told.has(describe)) seen.push({ what: describe(), parts: [] });
        told.add(describe);
      } else {
        const words = m.family().filter((t): t is Text => t instanceof Text && !!t.text.trim() && (t.style.opacity ?? 1) >= 0.5);
        labels.push(...words.map((t) => t.text));
        if (!words.length) blank++;
      }
    if (labels.length) seen.push({ what: w.count(labels.length, w.label), parts: labels.map((name) => ({ name })) });
    if (blank) seen.push({ what: '', parts: [], blank: [`${blank} kept drawing${blank > 1 ? 's' : ''} with no text: give s.keep or s.enter a describe`] });
    return seen;
  }
  // Each step's state records its resting picture and what changed since the step began.
  let before = new Set<string>();
  scene.onStep(() => {
    before = shownNames(look());
  });
  scene.addDescriber(() => ({ picture: picture(look(), before, langOf(scene)) }));
  const keepAll = (mobs: Mobject[], { describe }: Describe) => {
    const say = typeof describe === 'string' ? () => describe : describe;
    for (const m of mobs) overlays.set(m, say);
  };
  /**
   * Annotations are sized for the screen: made in home coordinates from the points the camera
   * shows, then mapped into the world as the heading is, so a zoomed camera shows them at size.
   */
  const toScreen = (p: Vec): Vec => [(p[0] - view.shift[0]) / view.k, (p[1] - view.shift[1]) / view.k];
  function onScreen<T extends Mobject>(m: T): T {
    if (view.k === 1 && !view.shift[0] && !view.shift[1]) return m;
    m.scale(view.k, { aboutPoint: [0, 0] });
    for (const x of m.family()) if (x.style.strokeWidth) x.style.strokeWidth *= view.k;
    m.shift(view.shift);
    return m;
  }
  /** The camera box that shows `target` in the content area below the heading. */
  function viewFor(target: Mobject | readonly Mobject[] | Box, margin: number): Box {
    let b: Box | null;
    if (Array.isArray(target) && typeof target[0] === 'number') b = target as Box;
    else {
      const mobs = (Array.isArray(target) ? target : [target]) as Mobject[];
      const boxes = mobs.map((m) => m.box()).filter((x): x is Box => !!x);
      if (!boxes.length) throw new Error('focus(): nothing to look at');
      b = [Math.min(...boxes.map((x) => x[0])), Math.min(...boxes.map((x) => x[1])), Math.max(...boxes.map((x) => x[2])), Math.max(...boxes.map((x) => x[3]))];
    }
    const w = b[2] - b[0] + 2 * margin,
      h = b[3] - b[1] + 2 * margin;
    const z = Math.max(1, Math.min((CONTENT[2] - CONTENT[0]) / Math.max(w, 1e-6), (CONTENT[3] - CONTENT[1]) / Math.max(h, 1e-6)));
    const cc: Vec = [(CONTENT[0] + CONTENT[2]) / 2, (CONTENT[1] + CONTENT[3]) / 2],
      tc: Vec = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    const hw = 8 / z,
      hh = 4.5 / z;
    // Put the target's centre where the content area's centre is on screen, then keep the view on the stage.
    const cx = Math.min(8 - hw, Math.max(-8 + hw, tc[0] - cc[0] / z)),
      cy = Math.min(4.5 - hh, Math.max(-4.5 + hh, tc[1] - cc[1] / z));
    return [cx - hw, cy - hh, cx + hw, cy + hh];
  }
  /**
   * The animations that move the camera to `box`, with the heading's parts moving in step so
   * they stay put on screen: the camera's map from home is linear in the box, so both
   * interpolate together exactly.
   */
  function cameraTo(box: Box, runTime: number): Animation[] {
    const k = (box[2] - box[0]) / 16,
      next = { k, shift: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] as Vec };
    const anims: Animation[] = [new Transform(scene.frame, scene.frame.copy().fit(box, { margin: 0 }), { runTime })];
    for (const m of [heading, ...chrome]) if (home.has(m)) anims.push(new Transform(m, pinned(m, next), { runTime }));
    const away = Math.abs(k - 1) > 1e-9 || Math.abs(next.shift[0]) > 1e-9 || Math.abs(next.shift[1]) > 1e-9;
    const banded = pinned(band, next);
    banded.style.opacity = away ? 0.94 : 0;
    anims.push(new Transform(band, banded, { runTime }));
    view = next;
    return anims;
  }
  async function enterPanel<T extends Mobject>(panel: T, { enter = true, until }: Entry & Scoped, fade: FadeOpts): Promise<T> {
    overlays.set(panel, undefined);
    scope([panel], { until });
    if (enter) await scene.play(new FadeIn(panel, fade));
    return panel;
  }
  /** Where content may sit: the stage below the heading, a little inside its edges. */
  const CLEAR_BOUNDS: Box = [CONTENT[0] - 0.3, CONTENT[1] - 0.15, CONTENT[2] + 0.3, CONTENT[3]];
  const visibleEnough = (m: Mobject) => {
    for (let a: Mobject | null = m; a; a = a.parent) if ((a.style.opacity ?? 1) < 0.5) return false;
    return true;
  };
  /** A straight connector a label should not sit on: a line, an arrow's shaft or a diagram's edge. */
  const connectors = (): [Vec, Vec][] => {
    const out: [Vec, Vec][] = [];
    for (const m of scene.familyMembers()) {
      if (!visibleEnough(m) || isHeading(m)) continue;
      if (m instanceof Line && (m.style.strokeWidth ?? 0) > 0 && m.style.stroke !== 'none') out.push([m.start(), m.end()]);
      else if (m instanceof Arrow) {
        const shaft = m.children[0];
        if (shaft instanceof Line) out.push([shaft.start(), shaft.end()]);
      } else if (isDiagramConnector(m)) {
        const b = m.box();
        if (b) out.push([[b[0], b[1]], [b[2], b[3]]]);
      }
    }
    return out;
  };
  const otherText = (except: Set<Mobject>): Box[] => {
    const boxes: Box[] = [];
    const seen = new Set<Mobject>();
    const present = new Set(scene.familyMembers());
    for (const p of pending) {
      if (present.has(p)) pending.delete(p);
      else if (!except.has(p)) {
        const b = p.box();
        if (b) boxes.push(b);
      }
    }
    for (const m of scene.familyMembers()) {
      if (seen.has(m) || except.has(m) || isHeading(m) || !labelOf(m) || !visibleEnough(m)) continue;
      seen.add(m);
      let inside = false;
      for (let a = m.parent; a; a = a.parent) if (except.has(a) || labelOf(a)) inside = true;
      if (inside) continue;
      const b = m.box();
      if (b) boxes.push(b);
    }
    return boxes;
  };
  const overlapping = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  /** Whether the segment a→b passes through `box` (Liang–Barsky). */
  const crosses = ([a, b]: [Vec, Vec], box: Box): boolean => {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - box[0]], [dx, box[2] - a[0]], [-dy, a[1] - box[1]], [dy, box[3] - a[1]]] as [number, number][]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t0 <= t1;
  };
  /**
   * Move `m` (text, or a text with its paper) by the smallest nudge that puts it inside the stage,
   * off every other label and off every straight connector; by up to 1.2 units up or down and 0.6 sideways, trying
   * up and down before sideways. Left where it is when no such place is near.
   */
  function clearOf(target: Mobject | Mobject[], extra: Mobject[] = []): void {
    const parts = Array.isArray(target) ? target : [target];
    const boxes = parts.map((p) => p.box()).filter((b): b is Box => !!b);
    if (!boxes.length) return;
    const box: Box = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
    const except = new Set([...parts, ...extra, ...parts.flatMap((p) => p.family()), ...extra.flatMap((x) => x.family())]);
    const lines = connectors(), texts = otherText(except);
    const pad = 0.04;
    const fits = (dx: number, dy: number) => {
      const b: Box = [box[0] + dx - pad, box[1] + dy - pad, box[2] + dx + pad, box[3] + dy + pad];
      if (b[0] < CLEAR_BOUNDS[0] || b[1] < CLEAR_BOUNDS[1] || b[2] > CLEAR_BOUNDS[2] || b[3] > CLEAR_BOUNDS[3]) return false;
      return !texts.some((t) => overlapping(b, t)) && !lines.some((l) => crosses(l, b));
    };
    for (const dy of [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6, 0.75, -0.75, 0.9, -0.9, 1.05, -1.05, 1.2, -1.2])
      for (const dx of [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6])
        if (fits(dx, dy)) {
          if (dx || dy) for (const p of parts) p.shift([dx, dy]);
          return;
        }
  }

  return {
    scene,
    paper,
    get heading() {
      return heading;
    },
    get palette() {
      return colors;
    },
    /** The colour helpers use for emphasis; use it for native emphasis too. */
    get emphasis() {
      return emphasis(colors);
    },
    /** Secondary text colour that still reads on the paper. */
    get soft() {
      return soft(colors);
    },
    /** Outcome colours that read on the paper: accepted, passed (`good`) and rejected, failed (`bad`). */
    get good() {
      return good(colors);
    },
    get bad() {
      return bad(colors);
    },
    async show(spec: DiagramSpec, opts: Omit<ShowOptions, 'box'> & { box?: Box | StageRegion } = {}): Promise<Diagram> {
      if (options.style && spec.style == null) spec = { ...spec, style: options.style };
      const snapshot = await diagramsOf(scene).diagram(spec);
      if (adopt) {
        colors = snapshot.palette;
        paper.setFill(colors.paper);
        heading.setFill(colors.ink);
        band.setFill(colors.paper);
        home.get(band)!.setFill(colors.paper);
        // The number and line take the adopted palette too, here and in their home copies.
        for (const c of chrome)
          for (const m of [c, home.get(c)!])
            if (m instanceof Group) {
              m.children[0]!.setStroke(emphasis(colors));
              m.children[1]!.setFill(emphasis(colors));
            } else m.setFill(soft(colors));
      }
      const diagram = new Diagram(scene, spec, snapshot, { ...opts, box: physical(opts.box) });
      diagrams.add(diagram);
      await diagram.build(opts.build, opts.runTime);
      return diagram;
    },
    /** Labelled values; `card.set({...})` updates them, `card.mark(row)` lights one. */
    async card(rows: readonly CardRow[], opts: Omit<CardOptions, 'at'> & { at?: Vec | Box | StageRegion } & Entry & Scoped = {}): Promise<Card> {
      const cardDirection = layoutDirection(opts, direction);
      return enterPanel(new Card(scene, colors, rows, { ...opts, at: physical(opts.at), direction: cardDirection }), opts, { runTime: 0.35, shift: [0, -0.08] });
    },
    /** Code on a panel; `code.focus(line)` keeps a bar on it. */
    async code(lines: readonly string[], opts: Omit<CodeOptions, 'at'> & { at?: Vec | Box | StageRegion } & Entry & Scoped = {}): Promise<CodeBlock> {
      return enterPanel(new CodeBlock(scene, colors, lines, { ...opts, at: physical(opts.at) }), opts, { runTime: 0.4 });
    },
    /** A plain line of supporting text in the stage's secondary colour. */
    async note(text: string, { at = [0, -3.9], size = 0.24, until }: { at?: Vec; size?: number } & Scoped = {}): Promise<Text> {
      const t = new Text(text, { fontSize: size, color: soft(colors) }).moveTo(at);
      if (t.width() > 15) t.setWidth(15);
      return enterPanel(t, { until }, { runTime: 0.3 });
    },
    /**
     * A label on the picture: `text` with its `edge` (centre by default; `[1, 0]` puts its right
     * edge, `[-1, 0]` its left edge) at `at`, in the stage's ink. With `clear` (on by default) it
     * is nudged, by the least needed, so that it sits inside the stage, off other labels and off
     * any straight line it would otherwise lie across; `clear: false` leaves it exactly at `at`.
     * Kept, and faded in unless `enter: false`; `until: 'next'` keeps it for this step alone.
     */
    async label(
      text: string,
      at: Vec,
      { size = 0.22, color, edge = [0, 0], font, clear = true, enter = true, until, describe }: { size?: number; color?: string; edge?: Vec; font?: 'sans' | 'mono'; clear?: boolean } & Entry & Scoped & Describe = {},
    ): Promise<Text> {
      const t = new Text(text, { fontSize: size, color: color ?? colors.ink, ...(font ? { font } : {}) }).moveTo(at, edge);
      if (clear) clearOf(t);
      keepAll([t], { describe });
      scope([t], { until });
      if (enter) await scene.play(new FadeIn(t, { runTime: 0.3 }));
      else pending.add(t);
      return t;
    },
    /**
     * Track native objects so `clearOverlays` and `clear` remove them with the rest; returns
     * the first. A last `{ describe }` says in words what they show together.
     */
    keep<T extends Mobject>(first: T, ...rest: Mobject[] | [...Mobject[], Describe & Scoped]): T {
      const options = isOptions(rest.at(-1)) ? (rest.pop() as Describe & Scoped) : {};
      keepAll([first, ...(rest as Mobject[])], options);
      scope([first, ...(rest as Mobject[])], options);
      return first;
    },
    /** Keep these and fade them in together, in one play (options as for FadeIn, plus `describe` and `until`). */
    async enter(...args: Mobject[] | [...Mobject[], FadeOpts & Describe & Scoped]): Promise<void> {
      const { describe, until, ...fade } = isOptions(args.at(-1)) ? (args.pop() as FadeOpts & Describe & Scoped) : {};
      const mobs = args as Mobject[];
      keepAll(mobs, { describe });
      scope(mobs, { until });
      if (mobs.length) await scene.play(...mobs.map((m) => new FadeIn(m, fade)));
    },
    /** Fade out cards, code, kept objects and diagram notes, in one play. */
    async clearOverlays() {
      const present = new Set(scene.familyMembers());
      const notes = [...diagrams].flatMap((d) => d.notes.splice(0).map((n) => n.mob));
      const shown = [...overlays.keys(), ...notes].filter((g) => present.has(g));
      if (shown.length) await scene.play(...shown.map((g) => new FadeOut(g, { runTime: 0.3 })));
      overlays.clear();
    },
    /**
     * Fade everything but paper and heading in one play: a clean slate for the
     * next idea. A camera moved by `focus` glides home in the same play.
     */
    async clear({ runTime = 0.4 } = {}) {
      const gone = scene.mobjects.filter((m) => m !== paper && m !== heading && m !== band && !chrome.includes(m));
      const atHome = scene.frame.box()!.every((v, i) => Math.abs(v - HOME[i]!) < 1e-6);
      const anims: Animation[] = gone.map((m) => new FadeOut(m, { runTime }));
      if (!atHome) anims.push(...cameraTo(HOME, runTime));
      if (anims.length) await scene.play(...anims);
      for (const d of diagrams) d.forget();
      overlays.clear();
    },
    /**
     * Move the camera so `target` (mobjects or a box) fills the stage below the heading, with
     * `margin` around it, or back home with `'all'`. The heading, its number and its line stay
     * where they are on screen, at their size; everything else is seen closer. The camera never
     * zooms out past the stage, and never shows beyond its edges. `exact: true` takes `target`, a
     * 16:9 box, as the camera's view as it is. `with` plays other animations in the same play.
     */
    async focus(
      target: Mobject | readonly Mobject[] | Box | 'all',
      { margin = 0.4, runTime = 0.9, exact = false, with: also = [] }: { margin?: number; runTime?: number; exact?: boolean; with?: Animation[] } = {},
    ) {
      const box = target === 'all' ? HOME : exact ? (target as Box) : viewFor(target, margin);
      await scene.play(...cameraTo(box, runTime), ...also.map((a) => a.setOptions({ runTime })));
    },
    /**
     * Move a kept object to a new place in one glide: a point, or a box or region it is scaled
     * down to fit (never up). The idea carried on from the step before, rather than cleared.
     */
    async carry(m: Mobject, destination: Vec | Box | StageRegion, { runTime = 0.8 } = {}) {
      const to = physical(destination);
      const target = m.copy();
      if (typeof to === 'string' || to.length === 4) {
        const b = typeof to === 'string' ? regionBox(to) : (to as Box);
        const k = Math.min(1, (b[2] - b[0]) / Math.max(1e-6, target.width()), (b[3] - b[1]) / Math.max(1e-6, target.height()));
        target.scale(k).moveTo([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
      } else target.moveTo(to as Vec);
      await scene.play(new Transform(m, target, { runTime }));
    },
    /** A dimension line from `a` to `b` with `label`, set off by `offset`; drawn in, and kept (`until: 'next'`: for this step alone). */
    async dimension(a: Vec, b: Vec, label: string, { until, ...opts }: { offset?: number; color?: string; size?: number } & Scoped = {}) {
      const g = onScreen(dimension(toScreen(a), toScreen(b), label, { color: opts.color ?? emphasis(colors), background: colors.paper, ...opts }));
      keepAll([g], { describe: () => `A dimension line marked “${label}”` });
      scope([g], { until });
      await scene.play(new Create(g, { runTime: 0.6, lagRatio: 0.1 }));
      return g;
    },
    /** A pin stuck in at `at`, with an optional label; drawn in, and kept (`until: 'next'`: for this step alone). */
    async pin(at: Vec, { until, ...opts }: { label?: string; color?: string; size?: number } & Scoped = {}) {
      const g = onScreen(pin(toScreen(at), { color: opts.color ?? emphasis(colors), ...opts }));
      keepAll([g], { describe: () => (opts.label ? `A pin marked “${opts.label}”` : 'A pin') });
      scope([g], { until });
      await scene.play(new FadeIn(g, { runTime: 0.4, shift: [0, -0.15] }));
      return g;
    },
    /**
     * Words beside a target with a leader line to it; drawn in, and kept (`until: 'next'`: for this
     * step alone). With `clear` (on by default) the words and their paper are nudged off other labels,
     * off straight lines and inside the stage; the leader keeps its end on the target.
     */
    async callout(target: Vec | Box | Mobject, text: string, { until, clear = true, ...opts }: { side?: Side; gap?: number; color?: string; size?: number; clear?: boolean } & Scoped = {}) {
      const box = Array.isArray(target) ? (target.length === 2 ? ([...target, ...target] as Box) : (target as Box)) : (target as Mobject).box();
      if (!box) throw new Error('callout(): the target has no extent');
      const [a, b] = [toScreen([box[0], box[1]]), toScreen([box[2], box[3]])];
      const g = onScreen(callout([a[0], a[1], b[0], b[1]], text, { color: opts.color ?? colors.ink, background: colors.paper, ...opts }));
      // The words and their paper move together; the leader line and its dot stay on the target.
      if (clear) clearOf(g.children.slice(2), [g]);
      keepAll([g], {});
      scope([g], { until });
      await scene.play(new Create(g, { runTime: 0.6, lagRatio: 0.15 }));
      return g;
    },
    /**
     * Draw `m` stroke by stroke at an even speed, with a pen or pencil riding the tip (or none),
     * and keep it. `m` must not be on stage yet. A path of several strokes is split into one path
     * per stroke first; the result is what was drawn and kept. `describe` says what it shows.
     */
    async draw(m: Mobject, { tool: kind = 'pen', color, runTime = 1.5, describe, until }: { tool?: ToolKind | false; color?: string; runTime?: number } & Describe & Scoped = {}) {
      // One path per stroke, so the tool can follow each in turn.
      m = oneStrokeEach(m);
      keepAll([m], { describe });
      scope([m], { until });
      const t = kind ? tool(kind, { ink: colors.ink, body: color ?? (kind === 'pen' ? soft(colors) : emphasis(colors)) }) : null;
      if (t) {
        // The tool is sized to the stage, as the camera shows it.
        t.scale(view.k, { aboutPoint: [0, 0] });
        for (const x of t.family()) if (x.style.strokeWidth) x.style.strokeWidth *= view.k;
      }
      await scene.play(new Draw(m, t, { runTime }));
      if (t) scene.remove(t);
      return m;
    },
  };
}
export type Stage = ReturnType<typeof stage>;
