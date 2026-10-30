import assert from 'node:assert/strict';
import type { Trace } from '../../../src/trace.ts';
import { assertStepState } from '../explainer-state.ts';
import * as M from '../../../scenes/explainers/lib/manhattanhenge.ts';
import { PUBLISHED, cycleOf, gridDays } from '../../../scenes/explainers/manhattanhenge/scene.ts';

const YEAR = 2026;

/** Every case's step state equals the solar model's answers for its cycle and horizon. */
export function check(trace: Trace, values: Record<string, string>): void {
  const cycle = values.cycle as 'may' | 'july';
  const horizon = { flat: 0, raised: 0.5 }[values.horizon as 'flat' | 'raised']!;
  assertStepState(trace, 'grid', { bearing: 299.1, northOfWest: 29.1 });
  const year = M.sunsetYear(YEAR);
  const az = year.filter((a): a is number => a != null);
  assertStepState(trace, 'year', {
    sunsetRange: { min: +Math.min(...az).toFixed(1), max: +Math.max(...az).toFixed(1) },
    gridDays: gridDays(year).map((d) => M.label(YEAR, d)),
  });
  const c = cycleOf(cycle, horizon);
  // The dial chooses which of the six evenings is drawn; at its default, the first named one.
  const dial = Number(values.evening ?? '0'),
    shown = c.ladder[2 + dial]!;
  assert.equal(c.ladder[2]!.doy, Math.min(c.half.doy, c.full.doy));
  assertStepState(trace, 'evening', {
    evening: { date: M.label(YEAR, shown.doy), time: M.clock(shown.ms, { seconds: true }), apparent: +shown.apparent.toFixed(3) },
    dial,
  });
  assertStepState(trace, 'ladder', {
    ladder: c.ladder.map((x) => ({ date: M.label(YEAR, x.doy), apparent: +x.apparent.toFixed(3) })),
    perEvening: +c.rate.toFixed(3),
  });
  assertStepState(trace, 'names', {
    half: { date: M.label(YEAR, c.half.doy), time: M.clock(c.half.ms, { seconds: true }), apparent: +c.half.apparent.toFixed(3) },
    full: { date: M.label(YEAR, c.full.doy), time: M.clock(c.full.ms, { seconds: true }), apparent: +c.full.apparent.toFixed(3) },
    published: PUBLISHED[cycle],
    horizon,
  });
  // The ladder is six consecutive evenings and the named pair lies inside it.
  for (let i = 1; i < c.ladder.length; i++) assert.equal(c.ladder[i]!.doy, c.ladder[i - 1]!.doy + 1);
  assert.ok(c.ladder.some((x) => x.doy === c.half.doy) && c.ladder.some((x) => x.doy === c.full.doy));
}
