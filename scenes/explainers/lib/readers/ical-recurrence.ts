import { Group } from '../../../../src/index.ts';
import { SERIES, expand, copyOf, organiserCopy, short } from '../ical-recurrence.ts';
import type { Change, Copy } from '../ical-recurrence.ts';
import { label, tile } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(change: Change, copy: Copy): ReaderFrame[] {
  const before = expand(SERIES),
    after = expand(organiserCopy(change)),
    mine = expand(copyOf(change, copy)),
    alice = expand(copyOf(change, 'organiser')),
    bob = expand(copyOf(change, 'guest'));
  return [
    {
      id: 'reader-series',
      title: 'What identifies a moved meeting?',
      line: 'One weekly rule produces six dated occurrences.',
      caption:
        'The master gives the series its UID and weekly rule. Each tile is an occurrence’s original slot. Moving a meeting changes its start time, but its RECURRENCE-ID still names that original slot. Skipping one adds an exclusion instead of shifting the weeks after it.',
      values: { change, before, after },
      draw: (s) => {
        const g = new Group();
        before.forEach((m, i) => {
          const x = ((i % 3) - 1) * 4.8,
            y = 1.7 - Math.floor(i / 3) * 3,
            a = after.find((n) => n.slot === m.slot),
            changed = !a || a.start !== m.start;
          g.add(
            tile(short(m.slot).split(',')[0]!, x, y, 4.3, 1.1, s, {
              bad: !a,
              active: changed,
              size: 0.65,
              key: `meeting:${i}`,
            }),
            label(
              !a ? 'skipped' : a.start !== m.start ? `→ ${short(a.start).split(',')[0]}` : '09:00 UTC',
              x,
              y - 0.95,
              changed ? s.emphasis : s.soft,
              0.62,
            ),
          );
          if (a && a.start !== m.start)
            g.add(label(`${a.start.slice(9, 11)}:${a.start.slice(11, 13)} UTC`, x, y - 1.75, s.emphasis, 0.62));
        });
        return g;
      },
    },
    {
      id: 'reader-copies',
      title: 'Does an invitation copy the series?',
      line: `Inspecting the ${copy}’s calendar.`,
      caption:
        copy === 'guest' && change === 'skip'
          ? 'Bob’s one invited occurrence has been cancelled. The delivered CANCEL message leaves a stored component marked CANCELLED; it does not restore the organiser’s six-week series. A stored component and an active meeting are different things.'
          : copy === 'guest'
            ? 'Bob was invited only to the third occurrence. His delivered calendar contains that meeting, not all six weeks. An attendee’s copy is produced by scheduling messages; it need not contain the organiser’s master and every override.'
            : 'Alice’s copy contains the recurring master and the components needed for invitations and exceptions. Bob’s one-occurrence invitation does not turn him into an attendee of the whole series. Compare the guest copy above.',
      values: {
        copy,
        count: mine.length,
        cancelled: mine.filter((m) => m.cancelled).length,
        components: copyOf(change, copy).length,
      },
      draw: (s) => {
        const g = new Group();
        for (const [index, who, meetings] of [
          [0, 'organiser', alice],
          [1, 'guest', bob],
        ] as const) {
          const x = index === 0 ? -4 : 4,
            active = meetings.filter((m) => !m.cancelled).length;
          g.add(
            tile(index === 0 ? 'Alice' : 'Bob', x, 2, 6.6, 1.1, s, { active: copy === who, size: 0.75 }),
            label(`Active: ${active}`, x, 0.1, s.palette.ink, 0.85, `copy:${who}:active`),
            label(
              index === 0
                ? 'Series with exceptions'
                : change === 'skip'
                  ? 'Invited slot cancelled'
                  : 'One invited slot',
              x,
              -1.3,
              active ? s.palette.ink : s.bad,
              0.65,
            ),
            label(
              `${copyOf(change, who).length} VEVENT${copyOf(change, who).length === 1 ? '' : 's'}`,
              x,
              -2.8,
              s.soft,
              0.7,
            ),
          );
        }
        return g;
      },
    },
  ];
}
