import { Group } from '../../../../src/index.ts';
import { CHARS, guarded, intOf } from '../isdigit.ts';
import type { CharId, Predicate } from '../isdigit.ts';
import { tile, label, flow, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(char: CharId, predicate: Predicate): ReaderFrame[] {
  const c = CHARS[char],
    selected = guarded(c, predicate),
    parsed = intOf(c),
    safe = guarded(c, 'isdecimal');
  const outcome = (g: ReturnType<typeof guarded>) =>
    g.outcome === 'parsed' ? 'integer' : g.outcome === 'raised' ? 'ValueError' : 'refused';
  return [
    {
      id: 'reader-predict',
      title: 'Will a passing digit check make int safe?',
      line: `Selected character: ${c.char}; guard: ${predicate}.`,
      caption: `Consider this one-character input. Predict whether the guard passes, and whether int accepts it. Python’s numeric predicates classify Unicode properties; they do not all recognise the same set of characters. The next picture keeps the guard result beside the parse result.`,
      values: { char, predicate },
      draw: (s) =>
        new Group(tile(c.char, 0, 1, 4, 2, s, { size: 1.3 }), label(`${predicate} → int`, 0, -1.8, s.palette.ink, 0.9)),
    },
    {
      id: 'reader-result',
      title: 'A property test is not a parser contract',
      line: `${predicate}: ${selected.passes ? 'True' : 'False'}; guarded result: ${outcome(selected)}.`,
      caption: `For ${c.char}, ${predicate} ${selected.passes ? 'passes' : 'refuses the input'}. ${'value' in parsed ? `int itself returns ${parsed.value}` : 'int itself raises ValueError'}. For a single Unicode decimal digit, isdecimal aligns with int’s accepted character set; whole strings still need the parser to handle signs, whitespace and invalid structure. The implementation fields remain in Details and sources.`,
      values: { char, predicate, selected, safe },
      draw: (s) =>
        table(
          ['Guard', 'Passes?', 'Then int'],
          [
            [predicate, selected.passes ? 'True' : 'False', outcome(selected)],
            ['isdecimal', safe.passes ? 'True' : 'False', outcome(safe)],
          ],
          s,
          { xs: [-4.8, 0, 5], y: 2, gap: 1.7 },
        ),
    },
  ];
}
