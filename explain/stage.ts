import { Mobject, Rectangle, Text, FadeIn, FadeOut } from '../src/index.ts';
import type { Scene, Vec, FadeOpts } from '../src/index.ts';
import { Diagram } from './diagrams.ts';
import type { ShowOptions } from './diagrams.ts';
import { Card, CodeBlock } from './panels.ts';
import type { CardRow, CardOptions, CodeOptions } from './panels.ts';
import { diagramsOf } from '../integrations/agentic-mermaid/snapshot.ts';
import type { Palette, DiagramSpec } from '../integrations/agentic-mermaid/snapshot.ts';
import { palette } from './palettes.ts';
import { soft, emphasis, good, bad } from './look.ts';
import type { PictureEntry } from './trace.ts';

export interface StageOptions {
  /** An Agentic Mermaid style: the stage's palette and the style of every diagram that names none. */
  style?: string;
  /** Colours for a stage that differ from its style's (or that has no diagrams). */
  palette?: Palette;
  /**
   * What the heading shows. By default it follows each step's `title`, so the
   * stage itself (poster, still, stage-only video) says which idea is on screen.
   * A string fixes it; `false` leaves the whole frame to the scene.
   */
  heading?: 'step' | string | false;
}
/** `enter: false` makes the panel and keeps it without playing, for `s.enter` to bring in with others. */
type Entry = { enter?: boolean };
const HEADING_Y = 3.8;

export function stage(scene: Scene, options: StageOptions = {}) {
  // Without a style or palette, the stage adopts the first diagram's palette.
  const adopt = !options.palette && !options.style;
  let colors = options.palette ?? palette(options.style ?? 'nord');
  const mode = options.heading ?? 'step';
  const paper = new Rectangle({ width: 16, height: 9, fill: colors.paper, stroke: 'none' });
  paper.key = '__paper';
  scene.add(paper);
  const makeHeading = (text: string) => {
    const t = new Text(text, { fontSize: 0.36, color: colors.ink, weight: 'bold' });
    if (t.width() > 14.6) t.setWidth(14.6);
    t.moveTo([0, HEADING_Y]);
    t.key = '__heading';
    return t;
  };
  let heading = makeHeading(typeof mode === 'string' && mode !== 'step' ? mode : '');
  scene.add(heading);
  const overlays = new Set<Mobject>();
  const diagrams = new Set<Diagram>();

  async function setHeading(text: string): Promise<void> {
    if (heading.text === text) return;
    const next = makeHeading(text);
    const anims = [];
    if (heading.text) anims.push(new FadeOut(heading, { runTime: 0.3 }));
    else scene.remove(heading);
    if (text) anims.push(new FadeIn(next, { runTime: 0.3 }));
    heading = next;
    if (!text) scene.add(next);
    if (anims.length) await scene.play(...anims);
  }
  // Follow step titles without asking authors to repeat them.
  if (mode === 'step') scene.onStep((s) => setHeading(typeof s.meta.title === 'string' ? s.meta.title : ''));
  // What a sighted reader sees, in each step's state: diagrams, then panels, then other kept text.
  scene.addDescriber(() => {
    const present = new Set(scene.familyMembers());
    const picture: PictureEntry[] = [];
    for (const d of diagrams) if (present.has(d.root)) picture.push(...d.describe());
    const labels: string[] = [];
    for (const m of overlays)
      if (!present.has(m)) continue;
      else if (m instanceof Card || m instanceof CodeBlock) picture.push(m.describe());
      else
        for (const t of m.family())
          if (t instanceof Text && t.text.trim() && (t.style.opacity ?? 1) >= 0.5) labels.push(t.text);
    if (labels.length) picture.push({ what: 'Labels', items: labels });
    return { picture: picture.filter((e) => e.items.length) };
  });
  async function enterPanel<T extends Mobject>(panel: T, { enter = true }: Entry, fade: FadeOpts): Promise<T> {
    overlays.add(panel);
    if (enter) await scene.play(new FadeIn(panel, fade));
    return panel;
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
    async show(spec: DiagramSpec, opts: ShowOptions = {}): Promise<Diagram> {
      if (options.style && spec.style == null) spec = { ...spec, style: options.style };
      const snapshot = await diagramsOf(scene).diagram(spec);
      if (adopt) {
        colors = snapshot.palette;
        paper.setFill(colors.paper);
        heading.setFill(colors.ink);
      }
      const diagram = new Diagram(scene, spec, snapshot, opts);
      diagrams.add(diagram);
      await diagram.build(opts.build, opts.runTime);
      return diagram;
    },
    /** Labelled values; `card.set({...})` updates them, `card.mark(row)` lights one. */
    async card(rows: readonly CardRow[], opts: CardOptions & Entry = {}): Promise<Card> {
      return enterPanel(new Card(scene, colors, rows, opts), opts, { runTime: 0.35, shift: [0, -0.08] });
    },
    /** Code on a panel; `code.focus(line)` keeps a bar on it. */
    async code(lines: readonly string[], opts: CodeOptions & Entry = {}): Promise<CodeBlock> {
      return enterPanel(new CodeBlock(scene, colors, lines, opts), opts, { runTime: 0.4 });
    },
    /** A plain line of supporting text in the stage's secondary colour. */
    async note(text: string, { at = [0, -3.9], size = 0.24 }: { at?: Vec; size?: number } = {}): Promise<Text> {
      const t = new Text(text, { fontSize: size, color: soft(colors) }).moveTo(at);
      if (t.width() > 15) t.setWidth(15);
      return enterPanel(t, {}, { runTime: 0.3 });
    },
    /** Track a native object so `clearOverlays` and `clear` remove it with the rest. */
    keep<T extends Mobject>(mob: T): T {
      overlays.add(mob);
      return mob;
    },
    /** Keep these and fade them in together, in one play (options as for FadeIn). */
    async enter(...args: Mobject[] | [...Mobject[], FadeOpts]): Promise<void> {
      const last = args.at(-1);
      const fade = last && !(last instanceof Mobject) ? (args.pop() as FadeOpts) : {};
      const mobs = args as Mobject[];
      for (const m of mobs) overlays.add(m);
      if (mobs.length) await scene.play(...mobs.map((m) => new FadeIn(m, fade)));
    },
    async clearOverlays() {
      const present = new Set(scene.familyMembers());
      const shown = [...overlays].filter((g) => present.has(g));
      if (shown.length) await scene.play(...shown.map((g) => new FadeOut(g, { runTime: 0.3 })));
      overlays.clear();
    },
    /** Fade everything but paper and heading in one play: a clean slate for the next idea. */
    async clear({ runTime = 0.4 } = {}) {
      const gone = scene.mobjects.filter((m) => m !== paper && m !== heading);
      if (gone.length) await scene.play(...gone.map((m) => new FadeOut(m, { runTime })));
      for (const d of diagrams) d.forget();
      overlays.clear();
    },
  };
}
export type Stage = ReturnType<typeof stage>;
