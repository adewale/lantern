import { Scene, Text, ItalicText, Group, Circle, Line } from '../../../src/index.ts';
import { stage } from '../../../explain/index.ts';

const SAMPLE = 'Ink on paper';

export default class FontMetrics extends Scene {
  static meta = {
    id: 'font-metrics',
    title: 'Why must font measurement match the drawn face?',
    sources: ['https://github.com/googlefonts/ebgaramond'],
    lettering: { faces: { sans: 'eb-garamond' }, styles: ['bold', 'italic'] as const },
  };

  override async construct() {
    const s = stage(this, { style: 'pen-and-ink' });
    const color = s.palette.ink;
    await this.step('layout', {
      title: 'What if layout measures the wrong face?',
      line: 'Same phrase and size; only the measurement changes.',
      caption:
        'Both rows draw EB Garamond at 0.9 units. The upper marker is placed using JetBrains Mono’s advance, leaving an unnecessary gap. The lower marker uses the phrase’s actual advance and a fixed 0.5-unit gap. The face used for measurement must match the face used for drawing.',
    });
    const comparison = new Group();
    comparison.key = 'font-layout';
    const wrong = new Text(SAMPLE, { font: 'mono', fontSize: 0.9 }).advance();
    for (const [i, name] of ['Measured as Mono', 'Measured as Garamond'].entries()) {
      const y = 1.4 - i * 3.0;
      const word = new Text(SAMPLE, { fontSize: 0.9, color }).moveTo([-5.3, y], [-1, 0]);
      const width = i === 0 ? wrong : word.advance();
      comparison.add(
        word,
        new Circle({ radius: 0.22, fill: s.emphasis, stroke: 'none' }).moveTo([-5.3 + width + 0.5, y]),
        new Text(name, { fontSize: 0.7, color }).moveTo([0, y + 1.1]),
      );
    }
    this.state.layout = { wrong, actual: new Text(SAMPLE, { fontSize: 0.9 }).advance() };
    s.reading(comparison);
    await s.enter(comparison);
    await this.step('advance', {
      title: 'The ruler spans the phrase’s advance',
      line: 'The ruler ends after the final glyph’s advance.',
      caption:
        '“Ink on paper” advances 5.88 scene units in EB Garamond, including the spaces between its words. A following word would add another space, which this ruler does not include. This scene explicitly requests EB Garamond; pen-and-ink supplies the paper and colours.',
    });
    await s.clear();
    const text = new Text(SAMPLE, { fontSize: 1.2, color }).moveTo([0, 0.8]);
    await s.enter(text);
    const start = text.anchorPoint()[0] - text.advance() / 2;
    await s.dimension([start, -0.4], [start + text.advance(), -0.4], `${text.advance().toFixed(2)} units`, {
      size: 0.7,
      offset: -0.4,
    });
    this.state.advance = text.advance();

    await this.step('cuts', {
      title: 'The same phrase advances differently in each cut',
      line: 'Regular, Bold and Italic keep the text and size fixed.',
      caption:
        'The first ruler measured text at 1.2 units; these three rows use 0.9. At that shared size, “Ink on paper” advances 4.41 units in Regular, 4.85 in Bold and 4.24 in Italic. Each EB Garamond cut supplies its own captured paths, so the page needs no font download.',
    });
    await s.clear();
    const rows = new Group();
    const advances: Record<string, number> = {};
    for (const [index, cut] of ['Regular', 'Bold', 'Italic'].entries()) {
      const word =
        cut === 'Italic'
          ? new ItalicText(SAMPLE, { fontSize: 0.9, color })
          : new Text(SAMPLE, { fontSize: 0.9, color, weight: cut === 'Bold' ? 'bold' : 'normal' });
      const y = 2.0 - index * 2.0;
      word.moveTo([0, y]);
      advances[cut] = word.advance();
      rows.add(
        new Text(cut, { fontSize: 0.7, color }).moveTo([-5.6, y]),
        word,
        new Text(word.advance().toFixed(2), { fontSize: 0.7, color }).moveTo([5.2, y]),
      );
    }
    this.state.advances = advances;
    s.reading(rows);
    await s.enter(rows, {
      describe: () =>
        `The same words in three EB Garamond cuts: ${Object.entries(advances)
          .map(([cut, advance]) => `${cut}, advance ${advance.toFixed(2)}`)
          .join('; ')}. Each cut was requested and captured from its own source font.`,
    });

    await this.step('diagram', {
      title: 'The diagram measures labels before placing nodes',
      line: 'Ink and Paper keep EB Garamond’s measured proportions.',
      caption:
        'The arrow connects Ink and Paper, both drawn in the requested EB Garamond face. Natural lettering captures their advances, so the renderer places the boxes without stretching either label to a preset width.',
    });
    await s.clear();
    await s.show({ source: 'graph LR\nA["Ink"] --> B["Paper"]', lettering: 'natural' });
  }
}
