import {Scene, Text, ItalicText, Group} from '../../../src/index.ts';
import {stage} from '../../../explain/index.ts';

const SAMPLE = 'Ink on paper';

export default class FontMetrics extends Scene {
  static meta = {
    id: 'font-metrics',
    title: 'A font’s advance places the next word',
    sources: ['https://github.com/googlefonts/ebgaramond'],
    lettering: {faces: {sans: 'eb-garamond'}, styles: ['bold', 'italic'] as const},
  };

  override async construct() {
    const s = stage(this, {style: 'pen-and-ink'});
    const color = s.palette.ink;
    await this.step('advance', {
      title: 'The font gives the word its advance',
      line: 'The ruler measures where the following word would start.',
      caption: 'These letters are EB Garamond, explicitly requested by the scene. The pen-and-ink style chooses the paper and colours. The ruler measures the text’s advance, including the space each letter leaves before the next.',
    });
    const text = new Text(SAMPLE, {fontSize: 1.2, color}).moveTo([0, 0.8]);
    await s.enter(text);
    const start = text.anchorPoint()[0] - text.advance() / 2;
    await s.dimension([start, -0.4], [start + text.advance(), -0.4], `${text.advance().toFixed(2)} units`, {size: 0.7, offset: -0.4});
    this.state.advance = text.advance();

    await this.step('cuts', {
      title: 'Real bold and italic have their own measurements',
      line: 'The words stay the same; each cut supplies its own outlines and advance.',
      caption: 'Each row draws the same words at the same size. Regular, Bold and Italic are three source-font cuts, and the number at the right is that row’s advance. The page carries their captured paths, so it needs no font download or system-font match.',
    });
    await s.clear();
    const rows = new Group();
    const advances: Record<string, number> = {};
    for (const [index, cut] of ['Regular', 'Bold', 'Italic'].entries()) {
      const word = cut === 'Italic' ? new ItalicText(SAMPLE, {fontSize: 0.9, color}) : new Text(SAMPLE, {fontSize: 0.9, color, weight: cut === 'Bold' ? 'bold' : 'normal'});
      const y = 2.0 - index * 2.0;
      word.moveTo([0, y]);
      advances[cut] = word.advance();
      rows.add(new Text(cut, {fontSize: 0.7, color}).moveTo([-5.6, y]), word, new Text(word.advance().toFixed(2), {fontSize: 0.7, color}).moveTo([5.2, y]));
    }
    this.state.advances = advances;
    await s.enter(rows, {describe: () => `The same words in three EB Garamond cuts: ${Object.entries(advances).map(([cut, advance]) => `${cut}, advance ${advance.toFixed(2)}`).join('; ')}. Each cut was requested and captured from its own source font.`});
  }
}
