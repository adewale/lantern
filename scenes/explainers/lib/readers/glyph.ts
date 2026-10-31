import { Group, Text, Line, shaperFor } from '../../../../src/index.ts';
import type { FontName } from '../../../../src/index.ts';
import { label } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
const word = 'Hello, outlines',
  size = 0.9;
export function frames(font: FontName): ReaderFrame[] {
  const other: FontName = font === 'sans' ? 'mono' : 'sans',
    name = (f: FontName) => (f === 'sans' ? 'Inter' : 'JetBrains Mono');
  const widths = [font, other].map((f) => shaperFor(f)(word, size).width);
  return [
    {
      id: 'reader-width',
      title: 'Same letters, same width?',
      line: 'Measure the selected face before placing the next object.',
      caption: `Both rows use “${word}” at the same font size. Their left pen positions align, but their advances differ: ${widths[0]!.toFixed(2)} and ${widths[1]!.toFixed(2)} scene units. The rulers measure advance, which includes spacing; the visible ink can overhang it.`,
      values: { font, other, word, widths },
      draw: (s) => {
        const g = new Group();
        [font, other].forEach((f, i) => {
          const y = 1.5 - i * 3,
            w = widths[i]!,
            text = new Text(word, { font: f, fontSize: size, color: s.palette.ink }).moveTo([-6.5, y], [-1, 0]);
          text.key = `word:${f}`;
          g.add(
            text,
            label(name(f), 0, y + 1.1, s.soft, 0.65),
            new Line([-6.5, y - 0.9], [-6.5 + w, y - 0.9], { stroke: s.emphasis, strokeWidth: 0.05 }),
            label(w.toFixed(2), -6.5 + w / 2, y - 1.55, s.palette.ink, 0.65),
          );
        });
        return g;
      },
    },
    {
      id: 'reader-shape',
      title: 'Does a matching letter imply a matching outline?',
      line: 'Text identity and shape identity answer different questions.',
      caption:
        'The same character can have different contours in two faces. Matching text pairs letters by identity; matching shapes pairs equal geometry. Choose the rule that fits the change you want to explain. The detailed walkthrough traces the real quadratic-to-cubic conversion and matching results.',
      values: { font, other },
      draw: (s) => {
        const a = new Text('a', { font, fontSize: 3.8, color: s.palette.ink }).moveTo([-4.2, 0.3]),
          b = new Text('a', { font: other, fontSize: 3.8, color: s.palette.ink }).moveTo([4.2, 0.3]);
        return new Group(
          a,
          b,
          label(name(font), -4.2, -2.6, s.soft, 0.7),
          label(name(other), 4.2, -2.6, s.soft, 0.7),
          label('Same character', 0, 2.7, s.palette.ink, 0.7),
        );
      },
    },
  ];
}
