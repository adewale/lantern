import { Group } from '../../../../src/index.ts';
import { flow, label, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(): ReaderFrame[] {
  return [
    {
      id: 'reader-build',
      title: 'Who does the rendering work?',
      line: 'Move diagram layout from the reader’s browser to the build.',
      caption:
        'Rayner captures diagram geometry while building. It packages that geometry with the scene and reader in one HTML page. Opening the page still runs Rayner’s SVG animation code, but it does not download or run the diagram layout engine. This is the central trade: a larger portable file in exchange for fewer runtime dependencies.',
      values: { layout: 'build', runtime: 'SVG scene' },
      draw: (s) =>
        new Group(
          flow(s, ['Author scene', 'Build diagrams', 'Portable page']),
          label('Build machine', -4.7, 2.6, s.soft, 0.7),
          label('Reader', 4.7, 2.6, s.soft, 0.7),
          label('Captured geometry travels with the page', 0, -1.8, s.palette.ink, 0.7),
        ),
    },
    {
      id: 'reader-cost',
      title: 'What do extra settings cost?',
      line: 'Every combination is a case to build and verify.',
      caption:
        'Three refill rates and two policies make six cases. A reader can switch among those prepared cases. Adding an unrestricted input would change that promise: the author would need a runtime model and a way to check values outside the built cases. Start with the few choices that teach the comparison.',
      values: { rates: 3, policies: 2, cases: 6 },
      draw: (s) =>
        table(
          ['', 'Policy A', 'Policy B'],
          [
            ['Rate 1', 'case 1', 'case 2'],
            ['Rate 2', 'case 3', 'case 4'],
            ['Rate 4', 'case 5', 'case 6'],
          ],
          s,
          { xs: [-5, 0, 5], y: 2.6, gap: 1.55 },
        ),
    },
  ];
}
