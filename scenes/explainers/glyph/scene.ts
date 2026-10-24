import {
  Scene,
  Text,
  Write,
  Create,
  FadeIn,
  FadeOut,
  Transform,
  Group,
  Line,
  Dot,
} from '../../../src/index.ts';
import type { Mobject, Vec } from '../../../src/index.ts';
import { shaperFor } from '../../../src/fonts.ts';
import type { FontName } from '../../../src/fonts.ts';
import { stage, palette, settingsOf, CodeBlock } from '../../../explain/index.ts';

const WORD = 'Hello, outlines';
const SIZE = 0.9; // the size the fidelity test measures
const STYLE = 'pen-and-ink';
const NAME: Record<FontName, string> = { sans: 'Inter', mono: 'JetBrains Mono' };
const pipeline = (font: string) =>
  `graph TB\nFont[${font}] --> Shape[Shape text]\nShape --> Paths[Cubic paths]\nPaths --> SVG[SVG player]\nPaths --> Video[Video frames]`;

type Pathed = Mobject & { subpaths: Float32Array[] };
const segmentsOf = (g: Mobject) => (g as Pathed).subpaths.reduce((n, a) => n + (a.length - 2) / 6, 0);
const contoursOf = (g: Mobject) => (g as Pathed).subpaths.length;

/** What the shaper hands back for a run: segment kinds and per-glyph advances. */
function shape(font: FontName, text: string) {
  const run = shaperFor(font)(text, SIZE);
  const tags: Record<string, number> = {};
  for (const g of run.glyphs) for (const s of g.path ?? []) tags[s.tag] = (tags[s.tag] ?? 0) + 1;
  return {
    width: run.width,
    stops: run.glyphs.map((g) => g.x),
    advances: run.glyphs.map((g) => g.ax),
    quads: tags.QuadTo ?? 0,
    lines: tags.LineTo ?? 0,
    cubics: tags.CubicTo ?? 0,
  };
}

/** A width ruler under a text: a tick at every glyph's pen position, a bracket, the measured number. */
function ruler(text: Text, stops: readonly number[], label: string, color: string, size = 0.24): Group {
  const [x0, y0, x1] = text.box()!;
  const y = y0 - 0.12;
  const g = new Group();
  for (const x of stops.slice(1))
    g.add(new Line([x0 + x, y], [x0 + x, y - 0.14], { stroke: color, strokeWidth: 0.014 }));
  g.add(
    new Line([x0, y + 0.06], [x0, y - 0.32], { stroke: color, strokeWidth: 0.022 }),
    new Line([x1, y + 0.06], [x1, y - 0.32], { stroke: color, strokeWidth: 0.022 }),
    new Line([x0, y - 0.24], [x1, y - 0.24], { stroke: color, strokeWidth: 0.022 }),
  );
  const t = new Text(label, { fontSize: size, color, font: 'mono' });
  t.moveTo([(x0 + x1) / 2, y - 0.3 - size * 0.9]);
  g.add(t);
  return g;
}

/** A glyph's control net: on-curve points, cubic handles and the lines between them. */
function controlNet(glyph: Mobject, on: string, off: string): Group {
  const net = new Group();
  for (const a of (glyph as Pathed).subpaths)
    for (let i = 0; i + 7 < a.length; i += 6) {
      const p0: Vec = [a[i]!, a[i + 1]!],
        c1: Vec = [a[i + 2]!, a[i + 3]!],
        c2: Vec = [a[i + 4]!, a[i + 5]!],
        p1: Vec = [a[i + 6]!, a[i + 7]!];
      net.add(
        new Line(p0, c1, { stroke: off, strokeWidth: 0.008 }),
        new Line(c2, p1, { stroke: off, strokeWidth: 0.008 }),
        new Dot({ radius: 0.024, color: off }).moveTo(c1),
        new Dot({ radius: 0.024, color: off }).moveTo(c2),
        new Dot({ radius: 0.042, color: on }).moveTo(p0),
      );
    }
  return net;
}

/** One glyph's outline as a plain path (no text box), its ink centred on `at`. */
function glyphAlone(font: FontName, ch: string, size: number, at: Vec): Pathed {
  const t = new Text(ch, { font, fontSize: size });
  const g = t.children[0]!;
  t.remove(g);
  g.moveTo(at);
  return g as Pathed;
}

export default class GlyphExplainer extends Scene {
  static meta = {
    id: 'glyph',
    title: 'Lantern draws text from measured glyph outlines',
    sources: ['https://github.com/ivarvong/lantern/blob/2c7bad5/src/text.ts'],
  };
  static settings = [
    {
      id: 'font',
      label: 'Embedded font',
      default: 'sans',
      options: [
        { value: 'sans', label: 'Inter' },
        { value: 'mono', label: 'JetBrains Mono' },
      ],
    },
  ];
  override async construct() {
    const font = settingsOf(this).font as FontName,
      other: FontName = font === 'sans' ? 'mono' : 'sans',
      s = stage(this, { palette: palette(STYLE) }),
      ink = s.palette.ink,
      // emphasis() reads pen-and-ink's near-black accent as a hue; use the warm mark it intends.
      hot = '#d9480f',
      soft = s.soft;
    const mine = shape(font, WORD),
      theirs = shape(other, WORD);

    await this.step('write', {
      title: 'Letters are outlines from an embedded font',
      caption:
        'Each letter is a vector path from a font bundled with Lantern; no installed font is asked for. Write traces every contour. The close-up shows one glyph’s points and handles.',
    });
    const text = new Text(WORD, { font, fontSize: font === 'sans' ? 1.5 : 1.15, color: ink, fillOpacity: 0 });
    text.setStroke(ink, 0.018);
    text.moveTo([0, 1.75]);
    await this.play(new Write(text, { runTime: 2.2 }));
    // The first 'o' of the run, drawn large with its control net.
    const oIndex = text.children.findIndex((g) => WORD[(g as unknown as { cluster: number }).cluster] === 'o');
    const big = glyphAlone(font, 'o', 4.6, [-3.9, -1.95]);
    big.setStyle({ fill: ink, fillOpacity: 0 });
    big.setStroke(hot, 0.022);
    const net = controlNet(big, hot, soft);
    const glyphNote = new Text(`'o': ${contoursOf(big)} contours, ${segmentsOf(big)} cubic curves`, {
      fontSize: 0.22,
      color: soft,
    }).moveTo([-3.9, -4.0]);
    s.keep(big);
    s.keep(net);
    s.keep(glyphNote);
    const ob = text.children[oIndex]!.box()!;
    const underline = s.keep(new Line([ob[0], ob[1] - 0.12], [ob[2], ob[1] - 0.12], { stroke: hot, strokeWidth: 0.04 }));
    await this.play(new Create(big, { runTime: 1.2 }), new Create(underline, { runTime: 0.6 }));
    await this.play(new FadeIn(net, { runTime: 0.6 }), new FadeIn(glyphNote, { runTime: 0.6 }));
    const contours = text.children.reduce((n, g) => n + contoursOf(g), 0),
      segments = text.children.reduce((n, g) => n + segmentsOf(g), 0);
    await s.card(
      [
        ['Characters', WORD.length],
        ['Glyph outlines', `${text.children.length} (a space has none)`],
        ['Closed contours', contours],
        ['Cubic curves', segments],
      ],
      { at: [0.6, -4.25, 7.4, -0.75], title: `${NAME[font]}, as paths` },
    );

    await this.step('measure', {
      title: 'Inter and JetBrains Mono give the same words different widths',
      caption:
        'The shaper gives every glyph an exact advance, and the ticks mark each pen position. Inter’s advances vary by letter while JetBrains Mono’s are all equal, so the two rulers end at different widths.',
    });
    await s.clearOverlays();
    const measured = new Text(WORD, { font, fontSize: SIZE, color: ink });
    measured.setStroke(ink, 0.012);
    const wide = Math.max(mine.width, theirs.width);
    measured.moveTo([-wide / 2, 2.15], [-1, 0]);
    await this.play(new Transform(text, measured, { replace: true }));
    const compare = new Text(WORD, { font: other, fontSize: SIZE, color: soft }).moveTo([-wide / 2, -0.15], [-1, 0]);
    const mineRule = ruler(measured, mine.stops, `${mine.width.toFixed(4)} units · ${NAME[font]}`, hot);
    const theirRule = ruler(compare, theirs.stops, `${theirs.width.toFixed(4)} units · ${NAME[other]}`, soft);
    s.keep(compare);
    s.keep(mineRule);
    s.keep(theirRule);
    await this.play(new Create(mineRule, { runTime: 0.9, lagRatio: 0 }));
    await this.play(new FadeIn(compare, { runTime: 0.5 }), new Create(theirRule, { runTime: 0.9, lagRatio: 0 }));
    const spread = (a: number[]) => {
      const lo = Math.min(...a),
        hi = Math.max(...a);
      return hi - lo < 1e-6 ? `${lo.toFixed(3)} each` : `${lo.toFixed(3)} to ${hi.toFixed(3)}`;
    };
    const advances = { [font]: mine.advances, [other]: theirs.advances } as Record<FontName, number[]>;
    const card = await s.card(
      [
        [`${NAME.sans} advances`, spread(advances.sans)],
        [`${NAME.mono} advances`, spread(advances.mono)],
        [`${NAME[font]} − ${NAME[other]}`, `${(mine.width - theirs.width).toFixed(4)} units`],
      ],
      { at: [-4, -4.25, 4, -2.1] },
    );
    card.bar.style.fill = hot;
    await card.mark(`${NAME[font]} advances`);
    // Measured on a fresh run: moving the drawn copy re-rounds its float32 box.
    const probe = new Text(WORD, { font, fontSize: SIZE });
    this.state = { font, width: probe.advance(), glyphs: probe.children.length };

    await this.step('pipeline', {
      title: 'Lantern converts every font segment to a cubic',
      caption:
        'The font stores quadratic curves and lines, as the note beside it counts. Lantern raises every segment to a cubic, so one kind of path feeds both the SVG player and offline video frames.',
    });
    await s.clear();
    const d = await s.show({ source: pipeline(NAME[font]), style: STYLE }, { box: [-7.55, -4.25, -0.4, 3.25] });
    await d.walk(
      [
        ['Font', 'Shape'],
        ['Shape', 'Paths'],
        ['Paths', 'SVG'],
      ],
      { trail: true, color: hot },
    );
    await d.walk([['Paths', 'Video']], { trail: true, color: hot });
    const raw = mine.cubics
      ? `${mine.quads} quads, ${mine.lines} lines, ${mine.cubics} cubics`
      : `${mine.quads} quads + ${mine.lines} lines`;
    await d.note('Font', raw, { side: 'right', color: hot });
    await d.note('Paths', `${mine.quads + mine.lines + mine.cubics} cubics`, { side: 'right', color: hot });
    const solid = glyphAlone(font, 'o', 3.6, [3.85, 1.95]);
    solid.setStyle({ fill: ink, fillOpacity: 1, stroke: 'none' });
    const o = solid as Pathed;
    const fmt = (a: Float32Array, i: number, n: number) =>
      Array.from(a.slice(i, i + n), (v) => v.toFixed(2)).join(' ');
    const lines = ['<path d="'];
    o.subpaths.forEach((a, c) => {
      const curves = (a.length - 2) / 6;
      lines.push(`  M ${fmt(a, 0, 2)}`);
      lines.push(`  C ${fmt(a, 2, 6)}`);
      if (c === 0) lines.push(`  C ${fmt(a, 8, 6)}`);
      lines.push(`  … ${curves - (c === 0 ? 2 : 1)} more C … Z`);
    });
    lines.push('"/>');
    s.keep(solid);
    await this.play(new FadeIn(solid, { runTime: 0.5 }));
    await s.code(lines, { at: [0.15, -4.25, 7.55, 0.7], title: `the 'o' as SVG path data (scene units)`, fontSize: 0.22 });

    await this.step('morph', {
      title: 'A text diff becomes a glyph morph',
      caption:
        'Transform pairs glyphs in order, then interpolates their points. Six pairs keep their letter, m and s reshape into h and t, and the last s shrinks away.',
    });
    await s.clear();
    const before = new Text('cache miss', { font, fontSize: 1.1, color: ink }).moveTo([-2.7, 1.9]);
    const after = new Text('cache hit', { font, fontSize: 1.1, color: hot }).moveTo([-2.7, -1.6]);
    s.keep(before);
    await this.play(new FadeIn(before, { runTime: 0.5 }));
    const diff = new CodeBlock(this, s.palette, ['- cache miss', '+ cache hit'], {
      at: [3.0, -0.2, 7.55, 3.25],
      fontSize: 0.3,
      title: 'label.txt',
      diff: true,
    });
    s.keep(diff);
    await this.play(new FadeIn(diff, { runTime: 0.4 }));
    const charOf = (t: Text, g: Mobject) => t.text[(g as unknown as { cluster: number }).cluster]!;
    const pairs = new Group(),
      changed: string[] = [],
      gone: string[] = [];
    let kept = 0;
    before.children.forEach((g, i) => {
      const a = g.box()!,
        target = after.children[i],
        b = target?.box();
      const from: Vec = [(a[0] + a[2]) / 2, a[1] - 0.12];
      const to: Vec = b ? [(b[0] + b[2]) / 2, b[3] + 0.12] : after.center();
      const same = !!target && charOf(before, g) === charOf(after, target);
      if (same) kept++;
      else if (target) changed.push(`${charOf(before, g)}→${charOf(after, target)}`);
      else gone.push(charOf(before, g));
      pairs.add(
        new Line(from, to, {
          stroke: same ? soft : hot,
          strokeWidth: same ? 0.012 : 0.026,
          ...(target ? {} : { dashArray: '0.08 0.07' }),
        }),
      );
    });
    const ghost = before.copy().setFill(soft);
    s.keep(ghost);
    s.keep(after);
    await this.play(new Transform(before, after, { replace: true, runTime: 1.4 }), new FadeIn(ghost, { runTime: 1.4 }));
    s.keep(pairs);
    await this.play(new Create(pairs, { runTime: 0.8, lagRatio: 0 }));
    const result = await s.card(
      [
        ['Same letter', `${kept} pairs`],
        ['Reshaped', changed.join(', ')],
        ['Shrinks away', gone.join(', ') || 'none'],
      ],
      { at: [3.0, -4.25, 7.55, -0.6], title: 'Glyph pairs', fontSize: 0.26 },
    );
    result.bar.style.fill = hot;
    await result.mark('Reshaped');

    await this.step('tradeoff', {
      title: 'Diagram labels are Inter outlines stretched to textLength',
      caption:
        'The pen-and-ink style asks for EB Garamond, but Lantern draws labels in embedded Inter, stretched to the width agentic-mermaid wrote into each label’s textLength. Box shapes and strokes come from the style; only the letterforms differ.',
    });
    await s.clear();
    const again = await s.show({ source: pipeline(NAME[font]), style: STYLE }, { box: [-7.55, -4.25, -1.4, 3.25] });
    const run = again.snapshot.parts
      .flatMap((p) => p.shapes)
      .find((sh) => sh.textRun?.text === 'Video frames')!.textRun!;
    const natural = new Text(run.text, { fontSize: run.size }).advance();
    const k = (run.width ?? natural) / natural;
    await again.mark(['Video'], { color: hot });
    await again.note('Video', `stretched ×${k.toFixed(3)}`, { side: 'below', color: hot });
    const plain = new Text(run.text, { fontSize: 0.9, color: soft }).moveTo([-0.6, 2.4], [-1, 0]);
    const fitted = new Text(run.text, { fontSize: 0.9, color: ink });
    fitted.stretch(k, 0);
    fitted.moveTo([-0.6, 0.2], [-1, 0]);
    const w0 = plain.advance(),
      w1 = w0 * k;
    const plainRule = ruler(plain, [0], `Inter's own advance: ${w0.toFixed(3)}`, soft, 0.22);
    const fitRule = ruler(fitted, [0], `textLength width: ${w1.toFixed(3)}`, hot, 0.22);
    s.keep(plain);
    s.keep(fitted);
    s.keep(plainRule);
    s.keep(fitRule);
    await this.play(new FadeIn(plain), new Create(plainRule, { lagRatio: 0 }));
    await this.play(new FadeIn(fitted), new Create(fitRule, { lagRatio: 0 }));
    await s.card(
      [
        ['Shapes and strokes', 'from the style'],
        ['Label width', 'from textLength'],
        ['Letterforms', 'embedded Inter'],
      ],
      { at: [-0.6, -4.25, 7.55, -1.75], title: 'What survives import' },
    );
  }
}
