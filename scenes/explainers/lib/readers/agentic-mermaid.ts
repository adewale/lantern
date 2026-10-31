import { Group, Arrow } from '../../../../src/index.ts';
import { tile, label } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
import type { Stage } from '../../../../explain/index.ts';
function branches(s: Stage, labelled: boolean, follow = false) {
  return new Group(
    tile('Cached?', -4.8, 0.3, 4.2, 1.3, s),
    tile('Reply', 4.8, 1.8, 4, 1.1, s),
    tile('Database', 4.8, -1.8, 4, 1.1, s),
    new Arrow([-2.5, 0.6], [2.6, 1.8], {
      stroke: follow ? s.good : s.emphasis,
      strokeWidth: follow ? 0.08 : 0.05,
      tipLength: 0.18,
      tipWidth: 0.16,
    }),
    new Arrow([-2.5, -0.1], [2.6, -1.8], { stroke: s.emphasis, strokeWidth: 0.05, tipLength: 0.18, tipWidth: 0.16 }),
    label(labelled ? 'yes' : '?', 0, 2, s.palette.ink, 0.8),
    label(labelled ? 'no' : '?', 0, -2.1, s.palette.ink, 0.8),
  );
}
export function frames(missing: boolean): ReaderFrame[] {
  return [
    {
      id: 'reader-branches',
      title: 'Which branch means “cache hit”?',
      line: missing ? 'The first edit omits both branch labels.' : 'The first edit labels both branches.',
      caption: missing
        ? 'Two arrows leave Cached?, but neither tells the reader which answer takes it. The verifier can report the missing branch labels by edge ID. It cannot infer what the application ought to do from an unlabelled shape.'
        : 'Both branches are labelled. A reader can follow yes to Reply and no to Database. A verifier can check these structural properties; it cannot prove that this cache policy is correct for the application.',
      values: { missing },
      draw: (s) => branches(s, !missing),
    },
    {
      id: 'reader-repair',
      title: missing ? 'Repair the edge, then check the route' : 'Check the labels, then follow the route',
      line: 'yes → Reply; no → Database.',
      caption: missing
        ? 'The repair assigns yes and no to the existing edges. The highlighted yes route reaches Reply. The source walkthrough replays the typed edit, verifies the snapshot and walks the captured routes. Zero warnings supports those checks; it does not prove the diagram’s meaning.'
        : 'The labels are already present, so no repair is needed. The highlighted yes route reaches Reply. The source walkthrough verifies the snapshot and walks its captured routes. Zero warnings supports those checks; it does not prove the application’s cache policy.',
      values: { labels: ['yes', 'no'] },
      draw: (s) => branches(s, true, true),
    },
  ];
}
