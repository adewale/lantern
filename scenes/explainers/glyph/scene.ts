import { Scene, Text, Write, FadeIn, FadeOut, Transform, Rectangle } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
export default class GlyphExplainer extends Scene {
  static meta = {
    id: 'glyph',
    title: 'Text is geometry you can measure',
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
    const font = settingsOf(this).font as 'sans' | 'mono',
      s = stage(this, {
        palette: palette('pen-and-ink'),
        title: 'No installed fonts. No guessed character widths.',
      });
    await this.step('write', {
      title: 'Write the outlines',
      caption:
        'Each letter is a vector path from an embedded font. Writing a word reveals its glyphs in order. Rendering does not ask the browser or operating system to choose a font.',
    });
    const text = new Text('Hello, outlines', { font, fontSize: 0.9, color: s.palette.ink }).moveTo([0, 0]);
    await this.play(new Write(text, { runTime: 2 }));
    await this.step('measure', {
      title: 'Measure the actual advances',
      caption:
        'The shaper measures each glyph in the chosen font. The highlighted rectangle uses the actual text bounds. Switching fonts changes the measured width, not an estimate based on character count.',
    });
    const bounds = new Rectangle({
      width: text.width(),
      height: text.height(),
      stroke: s.palette.accent,
      strokeWidth: 0.015,
      fill: 'none',
    }).moveTo(text);
    await this.play(new FadeIn(bounds));
    this.state = { font, width: text.advance(), glyphs: text.children.length };
    await s.card(
      [
        ['Font', font === 'sans' ? 'Inter' : 'JetBrains Mono'],
        ['Advance', text.advance().toFixed(4) + ' scene units'],
      ],
      { at: [0, -2.25], width: 8 },
    );
    await this.step('pipeline', {
      title: 'A font becomes ordinary paths',
      caption:
        'Shaping produces glyph outlines and advances. Lantern converts quadratic curves to cubic paths. The same geometry then goes to a live SVG player or an offline video frame.',
    });
    await this.play(new FadeOut(text), new FadeOut(bounds));
    await s.clearOverlays();
    const d = await s.show({
      source:
        'graph LR\nFont[Embedded font] --> Shape[Shape text]\nShape --> Paths[Cubic paths]\nPaths --> SVG[SVG player]\nPaths --> Video[Video frames]',
      style: 'pen-and-ink',
    });
    await d.walk([
      ['Font', 'Shape'],
      ['Shape', 'Paths'],
      ['Paths', 'Video'],
    ]);
    const fontLabel = font === 'sans' ? 'Inter' : 'JetBrains Mono';
    await d.morph(
      {
        source: `graph LR\nFont[${fontLabel}] --> Shape[Shape text]\nShape --> Paths[Cubic paths]\nPaths --> SVG[SVG player]\nPaths --> Video[Video frames]`,
        style: 'pen-and-ink',
      },
      { ops: [{ kind: 'set_label', target: 'Font', label: fontLabel }] },
    );
    await this.step('morph', {
      title: 'The same geometry can transform',
      caption:
        'Native Transform aligns glyph structures, then interpolates paths. The diagram importer is not a separate animation runtime: its marks use these same Lantern objects.',
    });
    await d.hide();
    const before = new Text('cache miss', { font, fontSize: 1, color: s.palette.ink }).moveTo([0, 0]);
    const after = new Text('cache hit', { font, fontSize: 1, color: s.palette.accent }).moveTo([0, 0]);
    await this.play(new FadeIn(before));
    await this.play(new Transform(before, after, { replace: true }));
    await this.step('tradeoff', {
      title: 'Deterministic lettering has a tradeoff',
      caption:
        'Agentic Mermaid’s shapes and rough strokes survive importing. Its style-specific font does not yet: diagram labels use these embedded outlines. That difference is explicit, not a claim of pixel-identical typography.',
    });
    await s.chip('Same points → browser, still, video');
  }
}
