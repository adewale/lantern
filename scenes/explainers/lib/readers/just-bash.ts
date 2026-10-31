import { Group } from '../../../../src/index.ts';
import { exec } from '../models.ts';
import { flow, label, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(which: string): ReaderFrame[] {
  const original = { fs: {}, steps: 0 },
    run = exec(
      original,
      [
        ['echo', 'hello'],
        ['tr', 'a-z', 'A-Z'],
      ],
      'shout.txt',
    );
  const old = exec(original, [['cat', 'shout.txt']]).stdout,
    next = exec(run.shell, [['cat', 'shout.txt']]).stdout;
  return [
    {
      id: 'reader-pipeline',
      title: 'Where does HELLO go?',
      line: 'A pipeline passes text; a redirect stores the result.',
      caption:
        'Echo produces hello plus a newline. Tr uppercases that text. The redirect stores HELLO in shout.txt in the returned shell. This is an in-memory model, not a claim that every Bash command is supported.',
      values: { file: run.shell.fs['shout.txt'], stdout: run.stdout },
      draw: (s) =>
        new Group(
          flow(s, ['echo hello', 'tr → HELLO', 'shout.txt']),
          label('hello', -2.55, 2.25, s.emphasis, 0.65),
          label('HELLO', 2.55, 2.25, s.emphasis, 0.65),
          label('Redirected stdout: empty', 0, -1.8, s.palette.ink, 0.7),
        ),
    },
    {
      id: 'reader-values',
      title: 'Which shell can read the file?',
      line: `Selected case: cat receives the ${which === 'new' ? 'returned' : 'original'} shell.`,
      caption:
        'The original shell still has no files. The returned shell owns the new file, so cat prints HELLO only when passed that value. Keeping an old shell is enough to reproduce the apparent lost write; exec did not mutate it.',
      values: { old, next, chosen: which === 'new' ? next : old },
      draw: (s) =>
        table(
          ['Shell', 'shout.txt', 'cat prints'],
          [
            ['original', 'missing', old.trim() || 'nothing'],
            ['returned', run.shell.fs['shout.txt']!.trim(), next.trim()],
          ],
          s,
          { xs: [-5, 0, 5], y: 2, gap: 1.6 },
        ),
    },
  ];
}
