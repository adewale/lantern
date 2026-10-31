import { Group, Arrow } from '../../../../src/index.ts';
import { build, threads } from '../send-sync.ts';
import type { Wrapper, Inner } from '../send-sync.ts';
import { tile, label, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(wrapper: Wrapper, inner: Inner): ReaderFrame[] {
  const layers = build(wrapper, inner),
    run = threads(wrapper, inner),
    last = layers.at(-1)!;
  return [
    {
      id: 'reader-threads',
      title: 'Move the value or share a reference?',
      line: run.name,
      caption: `Send asks whether ownership can move to another thread. Sync asks whether shared references can cross threads: &T is Send when T is Sync. For ${run.name}, the move closure is ${run.spawnMove ? 'accepted' : 'rejected'} and the scoped shared borrow is ${run.scopeBorrow ? 'accepted' : 'rejected'}. All types in this model are ’static; lifetimes can impose further restrictions in real programs.`,
      values: { ...run },
      draw: (s) =>
        new Group(
          tile('Thread A', -4.8, 1.8, 4, 1, s),
          tile('Thread B', 4.8, 1.8, 4, 1, s),
          new Arrow([-2.5, 0.1], [2.5, 0.1], {
            stroke: run.spawnMove ? s.good : s.bad,
            strokeWidth: 0.06,
            tipLength: 0.18,
            tipWidth: 0.18,
          }),
          label(`owned T: ${run.spawnMove ? 'yes' : 'no'}`, 0, 0.8, s.palette.ink, 0.7),
          new Arrow([-2.5, -2], [2.5, -2], {
            stroke: run.scopeBorrow ? s.good : s.bad,
            strokeWidth: 0.06,
            tipLength: 0.18,
            tipWidth: 0.18,
          }),
          label(`shared &T: ${run.scopeBorrow ? 'yes' : 'no'}`, 0, -1.3, s.palette.ink, 0.7),
        ),
    },
    {
      id: 'reader-wrappers',
      title: 'Does wrapping it make sharing safe?',
      line: 'Read the requirements from the inside out.',
      caption: `The selected wrappers produce ${last.name}. Arc protects its reference count, not arbitrary access to its contents. Mutex requires its contents to be Send before the mutex can be Sync. The table applies each wrapper’s rule; adding a wrapper is not a blanket thread-safety guarantee.`,
      values: { layers },
      draw: (s) =>
        table(
          ['Type', 'Send', 'Sync'],
          layers.map((l) => [l.name, l.send ? 'yes' : 'no', l.sync ? 'yes' : 'no']),
          s,
          { xs: [-3.5, 2.9, 5.9], y: 2.5, gap: 1.5 },
        ),
    },
  ];
}
