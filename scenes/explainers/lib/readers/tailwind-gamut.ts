import { Group, Line, Rectangle } from '../../../../src/index.ts';
import { rows, summarize, cssMap, linearRgb } from '../tailwind-gamut.ts';
import type { Shade, Space } from '../tailwind-gamut.ts';
import { bars, label } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(shade: Shade, screen: Space): ReaderFrame[] {
  const all = rows(shade),
    sum = summarize(shade),
    most = all.find((r) => r.family === sum.mostOfSrgb.family)!,
    least = all.find((r) => r.family === sum.leastOfSrgb.family)!;
  const mapped = cssMap(most.L, most.C, most.h, 'srgb');
  const rgb = linearRgb(mapped.L, mapped.C, mapped.h, 'srgb').map((v) =>
    Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))),
  );
  const preview = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  return [
    {
      id: 'reader-edge',
      title: 'Does the written colour fit?',
      line: `Tailwind ${shade}; each colour has its own gamut edge.`,
      caption: `At this shade, ${sum.outsideSrgb.length} of ${all.length} colours exceed sRGB. The bars compare the most and least chromatic relative to their own sRGB edges. The line is 100%: crossing it requires gamut mapping on an sRGB screen. These are calculated limits, not a test of your display.`,
      values: { shade, outside: sum.outsideSrgb, most: most.ofSrgb, least: least.ofSrgb },
      draw: (s) =>
        new Group(
          bars(
            s,
            [
              { label: `${most.family}-${shade}`, value: most.ofSrgb, display: `${most.ofSrgb}%` },
              { label: `${least.family}-${shade}`, value: least.ofSrgb, display: `${least.ofSrgb}%` },
            ],
            200,
          ),
          ...[1.4, -0.9].map((y) => new Line([0.25, y + 0.45], [0.25, y - 0.45], { stroke: s.bad, strokeWidth: 0.04 })),
          label('100% = sRGB edge', 0, -3.2, s.bad, 0.65),
        ),
    },
    {
      id: 'reader-display',
      title: 'What does the screen change?',
      line: `Selected target: ${screen === 'srgb' ? 'sRGB' : 'Display P3'}.`,
      caption:
        screen === 'srgb'
          ? `${most.family}-${shade} is written at chroma ${most.C.toFixed(3)}. The CSS mapping model reduces it to ${most.shown.toFixed(3)} on sRGB. The patch previews that mapped colour. Hue and lightness can shift too; clipping each RGB channel is a different operation.`
          : `All ${all.length} selected colours fit Display P3. ${most.family}-${shade} can retain its written chroma ${most.C.toFixed(3)} there, although the same colour exceeds sRGB. A P3 target alone does not prove a reader’s physical screen supports it.`,
      values: { shade, screen, written: most.C, mapped: screen === 'srgb' ? most.shown : most.C },
      draw: (s) =>
        new Group(
          bars(
            s,
            [
              { label: 'Written chroma', value: most.C, display: most.C.toFixed(3) },
              {
                label: `On ${screen === 'srgb' ? 'sRGB' : 'P3'} target`,
                value: screen === 'srgb' ? most.shown : most.C,
                display: (screen === 'srgb' ? most.shown : most.C).toFixed(3),
              },
            ],
            Math.max(most.C, 0.3),
          ),
          label('Mapped sRGB preview', 0, -2.0, s.palette.ink, 0.65),
          new Rectangle({ width: 6, height: 1, fill: preview, stroke: s.soft, strokeWidth: 0.03 }).moveTo([0, -3.2]),
          label(preview, 5.2, -3.2, s.palette.ink, 0.65),
        ),
    },
  ];
}
