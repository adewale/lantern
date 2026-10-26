import { Scene, VMobject, Group, Line, Text, Create, FadeOut, LaggedStart } from '../../../src/index.ts';
import type { Mobject, Vec } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
import type { Diagram } from '../../../explain/index.ts';
import { WORLD, BOUND, rng, penStroke, deviation, hatch, inside, hershey, fit, boundsOf, graphFacts } from '../lib/pen-and-pencil.ts';
import type { Pt, Box } from '../lib/pen-and-pencil.ts';

const STYLE = 'pen-and-ink';
const FOCUS = 'Mill';
const PEN = { step: 0.025, waves: [1.1, 0.27] as const };
const HATCH = { angle: 60, spacing: 0.085 };
/** One coloured pencil per place; the palette is the same in every case. */
const PENCILS: Record<string, string> = {
  Spring: '#4f7aa8',
  Mill: '#b9832c',
  Ferry: '#5f8a55',
  Orchard: '#b0564b',
  Harbour: '#7d5f99',
};
const SEEDS: Record<string, number> = { first: 1967, second: 7 };

type Pathed = Mobject & { subpaths: Float32Array[]; closed: boolean[] };
const pathed = (m: Mobject): m is Pathed => Array.isArray((m as Pathed).subpaths) && m.hasPoints();

/** Points along one subpath of a captured path, eight per cubic. */
function samples(m: Pathed, i: number): Pt[] {
  const a = m.subpaths[i]!,
    vm = m as unknown as VMobject,
    curves = (a.length / 2 - 1) / 3;
  const out: Pt[] = [[a[0]!, a[1]!]];
  for (let c = 0; c < curves; c++) for (let k = 1; k <= 8; k++) out.push(vm.pointOnCurve(i, c, k / 8) as Pt);
  return out;
}
/** Every subpath of a part's paths, split into stroked outlines and filled shapes (letters, arrowheads). */
function pieces(d: Diagram, id: string) {
  const outlines: Pt[][] = [],
    filled: { pts: Pt[]; box: Box }[] = [];
  for (const m of d.get(id).family())
    if (pathed(m))
      m.subpaths.forEach((_, i) => {
        const pts = samples(m, i);
        if (m.style.fill === 'none' || !m.style.fillOpacity) outlines.push(pts);
        else filled.push({ pts, box: boundsOf([pts]) });
      });
  return { outlines, filled };
}
const unionOf = (boxes: readonly Box[]): Box => boundsOf(boxes.map((b) => [[b[0], b[1]] as Pt, [b[2], b[3]] as Pt]));
const scaleAbout = (pts: readonly Pt[], c: Pt, k: number, to: Pt): Pt[] =>
  pts.map(([x, y]) => [to[0] + (x - c[0]) * k, to[1] + (y - c[1]) * k]);
/** Polylines as one path, a subpath each. */
function polylines(lines: readonly (readonly Pt[])[], stroke: string, strokeWidth: number, closed = false): VMobject {
  const vm = new VMobject({ stroke, strokeWidth, fill: closed ? stroke : 'none', fillOpacity: closed ? 1 : 0, lineCap: 'round', lineJoin: 'round' });
  for (const line of lines) {
    vm.startNewPath(line[0]! as Vec);
    for (const p of line.slice(1)) vm.addLineTo(p as Vec);
    if (closed) vm.closePath();
  }
  return vm;
}
const fmt = (n: number, d = 4) => n.toFixed(d);

export default class PenAndPencil extends Scene {
  static meta = {
    id: 'pen-and-pencil',
    title: 'A pen and coloured pencils redraw a laid-out diagram without moving it',
    sources: [
      'https://pele-art-diagrams.vercel.app/',
      'https://pele.run',
      'https://paulbourke.net/dataformats/hershey/',
    ],
  };
  static settings = [
    {
      id: 'hand',
      label: 'Draw the plate',
      default: 'first',
      options: [
        { value: 'first', label: 'First drawing' },
        { value: 'second', label: 'Second drawing' },
      ],
    },
  ];
  override async construct() {
    const hand = settingsOf(this).hand as string,
      seed = SEEDS[hand]!,
      s = stage(this, { style: STYLE, headingSize: 0.5 }),
      ink = s.palette.ink,
      hot = s.emphasis,
      soft = s.soft;
    const facts = graphFacts(WORLD);
    const label = (id: string) => facts.nodes.get(id)!;

    await this.step('text', {
      title: 'Each plate starts as Mermaid text with no positions in it',
      caption:
        'The page gives each of its four made-up worlds one Mermaid diagram; this explainer models the method on a world of its own, not the page’s code. The text names five places and five links, as the card counts, and says nothing about where anything goes.',
    });
    const source = await s.code(WORLD.split('\n'), { at: 'main', fontSize: 0.3, enter: false });
    const counts = await s.card(
      [
        ['places', facts.nodes.size],
        ['links', facts.links.length],
        ['positions given', 'none'],
      ],
      { at: 'side', enter: false },
    );
    await s.enter(source, counts);
    this.state.places = facts.nodes.size;
    this.state.links = facts.links.length;

    await this.step('layout', {
      title: 'The layout engine fixes every box, link and label',
      caption:
        'On the page pele does this job; here Agentic Mermaid does it, from the same kind of text. The card gives the Windmill box as laid out, in stage units; the pen, pencils and letters below work from this captured geometry alone.',
    });
    await s.clearOverlays();
    const d = await s.show({ source: WORLD }, { box: 'main' });
    // Read the geometry before any mark restyles it.
    const geometry = new Map(
      [...facts.nodes.keys(), ...facts.links.map(([a, b]) => `edge:${a}->${b}#0`)].map((id) => [id, pieces(d, id)]),
    );
    const focus = geometry.get(FOCUS)!;
    const focusBox = unionOf(focus.outlines.map((o) => boundsOf([o])));
    await d.mark([FOCUS], { as: 'measured' });
    await s.card(
      [
        ['left', fmt(focusBox[0], 2)],
        ['bottom', fmt(focusBox[1], 2)],
        ['width', fmt(focusBox[2] - focusBox[0], 2)],
        ['height', fmt(focusBox[3] - focusBox[1], 2)],
      ],
      { at: 'side', title: label(FOCUS) },
    );

    // The Windmill box, magnified into the side column, for three close looks.
    const side = regionBox('side');
    const k = (side[2] - side[0] - 0.7) / (focusBox[2] - focusBox[0]);
    const c: Pt = [(focusBox[0] + focusBox[2]) / 2, (focusBox[1] + focusBox[3]) / 2];
    const to: Pt = [(side[0] + side[2]) / 2, 1.75];
    const big = (pts: readonly Pt[]) => scaleAbout(pts, c, k, to);
    const bigBox = unionOf(focus.outlines.map((o) => boundsOf([big(o)])));
    const exact = polylines(focus.outlines.map(big), soft, 0.02);

    const rand = rng(seed);
    const bigPen = focus.outlines.map((o) => penStroke(big(o), { amplitude: BOUND * k, step: PEN.step * k, waves: [PEN.waves[0] * k, PEN.waves[1] * k] }, rand));
    const bigWobble = Math.max(...bigPen.map((p, i) => deviation(p, big(focus.outlines[i]!)))) / k;
    await this.step('pen', {
      title: `The pen strays at most ${BOUND} units from each laid-out edge`,
      caption: `Magnified, the thin line is the Windmill box as laid out and the orange line is the pen following it. Two sine waves push each point sideways, and their weights add to one, so the pen never strays more than the bound; this drawing’s widest swing is ${fmt(bigWobble)}.`,
    });
    await s.clearOverlays();
    const pen = polylines(bigPen, hot, 0.045);
    s.keep(exact, pen, { describe: `The ${label(FOCUS)} box magnified: its laid-out outline as a thin line and the pen’s wavering stroke over it, never more than ${BOUND} units away at the plate’s size` });
    await this.play(new Create(exact, { runTime: 0.5 }));
    await this.play(new Create(pen, { runTime: 1.6 }));
    const penCard = await s.card(
      [
        ['bound', BOUND],
        ['widest swing', fmt(bigWobble)],
        ['pen strokes', bigPen.length],
      ],
      { at: regionBox('side', { top: -0.35 }) },
    );
    this.state.pen = { bound: BOUND, widestSwing: Number(fmt(bigWobble)), strokes: bigPen.length };

    const bigHatch = hatch(bigBox, { angle: HATCH.angle, spacing: HATCH.spacing * k, shortfall: HATCH.spacing * k * 1.5 }, rand);
    const escaped = bigHatch.flat().filter((p) => !inside(p, bigBox)).length;
    await this.step('pencil', {
      title: `A coloured pencil hatches the box in ${bigHatch.length} strokes`,
      caption: `The pencil lays parallel strokes at ${HATCH.angle} degrees across the box, clipped to its laid-out edges. Each end stops short by a random amount, as a hand does, so the fill looks drawn, and the card counts ${escaped} stroke ends outside the box.`,
    });
    await this.play(new FadeOut(penCard, { runTime: 0.3 }));
    const pencil = new Group(...bigHatch.map(([a, b]) => new Line(a as Vec, b as Vec, { stroke: PENCILS[FOCUS]!, strokeWidth: 0.035, strokeOpacity: 0.8, lineCap: 'round' })));
    s.keep(pencil, { describe: `${bigHatch.length} parallel ${HATCH.angle}° pencil strokes filling the magnified ${label(FOCUS)} box, every end inside its outline` });
    await this.play(new Create(pencil, { runTime: 1.8, lagRatio: 0.15 }));
    const hatchCard = await s.card(
      [
        ['pencil strokes', bigHatch.length],
        ['angle', `${HATCH.angle}°`],
        ['ends outside the box', escaped],
      ],
      { at: regionBox('side', { top: -0.35 }) },
    );
    this.state.pencil = { strokes: bigHatch.length, endsOutside: escaped };

    // The label, as Hershey strokes in the place of the font's letters, and the same word in Inter.
    const labelBox = unionOf(focus.filled.map((f) => boundsOf([big(f.pts)])));
    const word = hershey(label(FOCUS));
    const letters = fit(word.strokes, [(labelBox[0] + labelBox[2]) / 2, (labelBox[1] + labelBox[3]) / 2], labelBox[3] - labelBox[1]);
    const inter = new Text(label(FOCUS), { fontSize: 0.62, color: ink, fillOpacity: 0 });
    inter.setStroke(ink, 0.014);
    inter.moveTo([to[0], -0.75]);
    const contours = inter.family().filter(pathed).reduce((n, g) => n + g.subpaths.length, 0);
    const below = fit(word.strokes, [to[0], -1.65], inter.height());
    await this.step('letters', {
      title: 'Hershey letters are pen strokes, not outlines',
      caption: `A screen font such as Inter, on top, stores ${label(FOCUS)} as ${contours} closed outlines to be filled. A. V. Hershey’s 1967 letters, below and in the box, are the paths a pen takes, ${word.strokes.length} open strokes inked once, so the pen can write the label it was given.`,
    });
    await this.play(new FadeOut(hatchCard, { runTime: 0.3 }));
    const written = polylines(letters, ink, 0.04);
    const compare = polylines(below, ink, 0.03);
    s.keep(written, inter, compare, {
      describe: `“${label(FOCUS)}” written in the magnified box in Hershey strokes; below it the same word as Inter outlines, then as Hershey strokes`,
    });
    await this.play(new Create(written, { runTime: 1.4 }), new Create(inter, { runTime: 1.4 }), new Create(compare, { runTime: 1.4 }));
    await s.card(
      [
        ['Inter, above', `${contours} outlines`],
        ['Hershey, below', `${word.strokes.length} strokes`],
      ],
      { at: regionBox('side', { top: -2.35 }) },
    );
    this.state.letters = { word: label(FOCUS), contours, strokes: word.strokes.length };

    // The whole plate: every outline in pen, every box in pencil, every label in Hershey strokes.
    const plate = new Group();
    const deviations: number[] = [];
    let penCount = 0,
      pencilCount = 0,
      letterCount = 0,
      ends = 0;
    const plateRand = rng(seed);
    for (const [id] of facts.nodes) {
      const { outlines, filled } = geometry.get(id)!;
      const box = unionOf(outlines.map((o) => boundsOf([o])));
      const strokes = hatch(box, { ...HATCH, shortfall: HATCH.spacing * 1.5 }, plateRand);
      ends += strokes.flat().filter((p) => !inside(p, box)).length;
      pencilCount += strokes.length;
      plate.add(new Group(...strokes.map(([a, b]) => new Line(a as Vec, b as Vec, { stroke: PENCILS[id]!, strokeWidth: 0.02, strokeOpacity: 0.7, lineCap: 'round' }))));
      const drawn = outlines.map((o) => penStroke(o, { amplitude: BOUND, ...PEN }, plateRand));
      drawn.forEach((p, i) => deviations.push(deviation(p, outlines[i]!)));
      penCount += drawn.length;
      plate.add(polylines(drawn, ink, 0.026));
      const lb = unionOf(filled.map((f) => f.box));
      const text = hershey(label(id));
      letterCount += text.strokes.length;
      plate.add(polylines(fit(text.strokes, [(lb[0] + lb[2]) / 2, (lb[1] + lb[3]) / 2], lb[3] - lb[1]), ink, 0.024));
    }
    for (const [from, toId] of facts.links) {
      const { outlines, filled } = geometry.get(`edge:${from}->${toId}#0`)!;
      const drawn = outlines.map((o) => penStroke(o, { amplitude: BOUND, ...PEN }, plateRand));
      drawn.forEach((p, i) => deviations.push(deviation(p, outlines[i]!)));
      penCount += drawn.length + filled.length;
      plate.add(polylines(drawn, ink, 0.02), polylines(filled.map((f) => f.pts), ink, 0.01, true));
    }
    const widest = Math.max(...deviations);
    this.state.plate = { penCount, pencilCount, letterCount, widest: Number(fmt(widest)), ends };
    await this.step('plate', {
      title: 'The finished plate keeps every position the layout gave',
      caption:
        hand === 'first'
          ? `Pen, pencil and Hershey letters redraw all ${facts.nodes.size} places and ${facts.links.length} links from the laid-out geometry alone, and no stroke lies more than ${fmt(widest)} units from it. A second drawing with a new seed changes every wobble but moves no box.`
          : `This second drawing used another seed, so every wobble and pencil end differs from the first, yet no stroke lies more than ${fmt(widest)} units from the same layout. Only the hand changed; the boxes stayed put.`,
    });
    await s.clearOverlays();
    await d.hide();
    s.keep(plate, {
      describe: `The whole diagram redrawn by hand: wavering pen outlines, a different coloured pencil hatching each of the five places, Hershey-lettered labels and pen-drawn links, all on the laid-out positions`,
    });
    await this.play(new Create(plate, { runTime: 4, lagRatio: 0.12 }));
    await s.card(
      [
        ['pen strokes', penCount],
        ['pencil strokes', pencilCount],
        ['letter strokes', letterCount],
        ['farthest from layout', fmt(widest)],
        ['image files', 0],
      ],
      { at: 'side' },
    );
  }
}
