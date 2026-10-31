import { Group, Circle, Rectangle } from '../../../../src/index.ts';
import { TokenBucket } from '../models.ts';
import { label, tile, bars } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
import type { Stage } from '../../../../explain/index.ts';
export function frames(rate: number): ReaderFrame[] {
  const b = new TokenBucket(rate, 5);
  const burst = Array.from({ length: 6 }, () => b.allow(0));
  const before = b.tokens,
    ok = b.allow(0.5),
    found = b.tokens + (ok ? 1 : 0),
    after = b.tokens;
  const tokens = (s: Stage, n: number, y: number) =>
    new Group(
      ...Array.from({ length: 5 }, (_, i) =>
        new Circle({
          radius: 0.38,
          fill: i < n ? s.emphasis : s.palette.paper,
          stroke: s.soft,
          strokeWidth: 0.04,
        }).moveTo([(i - 2) * 1.45, y]),
      ),
    );
  return [
    {
      id: 'reader-burst',
      title: 'Can six requests spend five tokens?',
      line: 'One accepted request costs one token.',
      caption:
        'Five tokens pay for the first five requests. The sixth arrives at the same instant, so no time has passed to refill. It gets 429. Burst capacity and refill speed are different limits.',
      values: { rate, burst },
      draw: (s) =>
        new Group(
          tokens(s, 5, 2.1),
          ...burst.map((yes, i) =>
            tile(`R${i + 1}: ${yes ? 200 : 429}`, ((i % 3) - 1) * 4.8, 0.1 - Math.floor(i / 3) * 2.1, 4.2, 1.1, s, {
              bad: !yes,
              size: 0.66,
              key: `burst:${i}:${yes ? 200 : 429}`,
            }),
          ),
        ),
    },
    {
      id: 'reader-refill',
      title: 'What does half a second buy?',
      line: `Refill speed: ${rate} token${rate === 1 ? '' : 's'} per second.`,
      caption: `The next request arrives at 0.5 s. Refill adds 0.5 × ${rate} = ${found} tokens to the empty bucket. It ${ok ? 'spends one and gets 200' : 'finds less than one and gets 429'}, leaving ${after}. Refill is calculated on arrival; no background timer runs. Try another speed above.`,
      values: { rate, before, found, after, ok },
      draw: (s) =>
        new Group(
          bars(
            s,
            [
              { label: 'Before the wait', value: before, display: String(before) },
              { label: 'On arrival: add elapsed × rate', value: found, display: String(found) },
              { label: `After the request: ${ok ? 200 : 429}`, value: after, display: String(after) },
            ],
            5,
          ),
          label('Five-token capacity', 0, -4, s.soft, 0.6),
        ),
    },
  ];
}
