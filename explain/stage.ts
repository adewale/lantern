import { Rectangle, Text, Group, FadeIn, FadeOut } from '../src/index.ts';
import type { Scene, Vec, Box, Mobject } from '../src/index.ts';
import { Diagram } from './diagrams.ts';
import type { ShowOptions } from './diagrams.ts';
import { Card, CodeBlock } from './panels.ts';
import type { CardRow, CardOptions, CodeOptions } from './panels.ts';
import { diagramsOf } from '../integrations/agentic-mermaid/snapshot.ts';
import type { Palette, DiagramSpec } from '../integrations/agentic-mermaid/snapshot.ts';
import { palette } from './palettes.ts';
import { REGIONS, regionBox, soft, raised, emphasis } from './look.ts';
import type { Region } from './look.ts';

export interface StageOptions {
  palette?: Palette;
  /**
   * What the heading shows. By default it follows each step's `title`, so the
   * stage itself (poster, still, stage-only video) says which idea is on screen.
   * A string fixes it; `false` leaves the whole frame to the scene.
   */
  heading?: 'step' | string | false;
  /** @deprecated A fixed heading; use `heading`. */
  title?: string;
}
const HEADING_Y = 3.8;

export function stage(scene: Scene, options: StageOptions = {}) {
  let colors = options.palette ?? palette('nord');
  const mode = options.heading ?? options.title ?? 'step';
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
  const place = (at: Vec | Box | Region | undefined): Vec | Box | undefined =>
    typeof at === 'string' ? regionBox(at) : at;

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
    /** Named stage areas below the heading; see `REGIONS`. */
    regions: REGIONS,
    /** Replace the heading now (it still follows the next step's title). */
    async title(text: string) {
      await setHeading(text);
    },
    async show(spec: DiagramSpec, opts: ShowOptions = {}): Promise<Diagram> {
      const snapshot = await diagramsOf(scene).diagram(spec);
      if (!options.palette) {
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
    async card(rows: readonly CardRow[], opts: Omit<CardOptions, 'at'> & { at?: Vec | Box | Region } = {}) {
      const { at: where, ...rest } = opts,
        at = place(where);
      const card = new Card(scene, colors, rows, { ...rest, ...(at ? { at } : {}) });
      overlays.add(card);
      await scene.play(new FadeIn(card, { runTime: 0.35, shift: [0, -0.08] }));
      return card;
    },
    /** Code on a panel; `code.focus(line)` keeps a bar on it. */
    async code(lines: readonly string[], opts: Omit<CodeOptions, 'at'> & { at?: Vec | Box | Region } = {}) {
      const { at: where, ...rest } = opts,
        at = place(where);
      const block = new CodeBlock(scene, colors, lines, { ...rest, ...(at ? { at } : {}) });
      overlays.add(block);
      await scene.play(new FadeIn(block, { runTime: 0.4 }));
      return block;
    },
    /** A short status line, bottom left by default. */
    async chip(text: string, { at = [-7.45, -4.05], color }: { at?: Vec; color?: string } = {}): Promise<Group> {
      const label = new Text(text, { fontSize: 0.22, font: 'mono', color: color ?? colors.ink });
      const bg = new Rectangle({
        width: label.width() + 0.4,
        height: 0.44,
        fill: raised(colors),
        stroke: color ?? colors.accent,
        strokeWidth: 0.014,
        cornerRadius: 0.1,
      });
      label.moveTo(bg.center());
      const g = new Group(bg, label);
      // `at` is the chip's left edge when it is the default corner.
      g.moveTo(at, [-1, 0]);
      overlays.add(g);
      await scene.play(new FadeIn(g, { runTime: 0.25 }));
      return g;
    },
    /** A plain line of supporting text in the stage's secondary colour. */
    async note(text: string, { at = [0, -3.9], size = 0.24 }: { at?: Vec; size?: number } = {}): Promise<Text> {
      const t = new Text(text, { fontSize: size, color: soft(colors) }).moveTo(at);
      if (t.width() > 15) t.setWidth(15);
      overlays.add(t);
      await scene.play(new FadeIn(t, { runTime: 0.3 }));
      return t;
    },
    /** Track a native object so `clearOverlays` and `clear` remove it with the rest. */
    keep<T extends Mobject>(mob: T): T {
      overlays.add(mob);
      return mob;
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
