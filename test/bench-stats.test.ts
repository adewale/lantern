// The decisions behind `npm run bench` (tools/lib/bench-stats.ts): the browser half only
// records timestamps, so whether a change fails the gate is decided here.
// Counts: test/lib/pbt.ts (FULL=1 is 10x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fc, params } from './lib/pbt.ts';
import { MIN_PAIRS, PAIRS, blocking, compare, longestGap, median, order, verdict } from '../tools/lib/bench-stats.ts';

const rule = { rel: 0.1, floor: 50 };
const ms = fc.integer({ min: 0, max: 5000 });
// 5 to 15 interleaved pairs: enough to be judged.
const pairs = fc.integer({ min: MIN_PAIRS, max: 15 }).chain((n) => fc.tuple(fc.array(ms, { minLength: n, maxLength: n }), fc.array(ms, { minLength: n, maxLength: n })));

test('median: the middle value, the mean of the middle two for an even count, and the input left as it was', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
  assert.ok(Number.isNaN(median([])));
  const xs = [3, 1, 2];
  median(xs);
  assert.deepEqual(xs, [3, 1, 2]);
  // An outlier moves a mean, not a median.
  assert.equal(median([100, 101, 102, 103, 5000]), 102);
});

test('blocking: the part of each long task over 50 ms, for tasks that start in the window', () => {
  const tasks = [
    [0, 200], // before the window: not counted, though it runs into it
    [100, 80], // 30 over
    [150, 50], // exactly 50: blocks nothing
    [300, 120], // 70 over, runs past the end: counted whole, as TBT counts it
    [401, 500], // after the window
  ] as const;
  assert.equal(blocking(tasks, 100, 400), 100);
  assert.equal(blocking([], 0, 1000), 0);
});

test('longestGap: the longest wait between frames in the window, counting the wait for the first', () => {
  assert.equal(longestGap([0, 16, 33, 50, 150, 166, 300], 20, 170), 100);
  // The first frame after `from` is 80 ms away: a tap followed by 80 ms of nothing is a hitch.
  assert.equal(longestGap([0, 100, 116], 20, 120), 80);
  assert.equal(longestGap([0, 300], 10, 200), 0);
});

test('order: BASE and HEAD alternate which goes first, so each goes first in half the pairs', () => {
  const firsts = Array.from({ length: 8 }, (_, rep) => order(rep)[0]);
  assert.deepEqual(firsts, ['base', 'head', 'base', 'head', 'base', 'head', 'base', 'head']);
  for (let rep = 0; rep < 8; rep++) assert.deepEqual([...order(rep)].sort(), ['base', 'head']);
});

test('compare: a consistent slowdown past both thresholds regresses', () => {
  const base = [400, 410, 395, 420, 405, 398, 412];
  const c = compare(base, base.map((v) => v + 120), rule);
  assert.equal(c.delta, 120);
  assert.equal(c.slower, 1);
  assert.equal(c.regressed, true);
});

test('compare: under either threshold is not a regression', () => {
  const base = [400, 410, 395, 420, 405, 398, 412];
  // 45 ms is 11% of 405 but under the 50 ms floor.
  assert.equal(compare(base, base.map((v) => v + 45), rule).regressed, false);
  // 300 ms on a 4 s motion is over the floor but 7%, under 10%.
  const long = base.map((v) => v * 10);
  assert.equal(compare(long, long.map((v) => v + 300), rule).regressed, false);
  // Faster is never a regression.
  assert.equal(compare(base, base.map((v) => v - 200), rule).regressed, false);
});

test('compare: a median moved by a few disturbed samples, with HEAD slower in under 70% of pairs, is not a regression', () => {
  const base = [400, 400, 400, 400, 400, 400, 400];
  // Four of seven pairs hit by another job on the machine: the median moves 400 → 900.
  const head = [900, 900, 900, 900, 380, 380, 380];
  const c = compare(base, head, rule);
  assert.equal(c.head, 900);
  assert.equal(c.slower, 4 / 7);
  assert.ok(c.slower < PAIRS);
  assert.equal(c.regressed, false);
  // Five of seven is enough.
  assert.equal(compare(base, [900, 900, 900, 900, 900, 380, 380], rule).regressed, true);
  // A tie is not HEAD being slower: three ties and four slower pairs is 4/7.
  assert.equal(compare(base, [900, 900, 900, 900, 400, 400, 400], rule).slower, 4 / 7);
});

test('compare: needs pairs, one sample on each side for each, and judges no fewer than five', () => {
  assert.throws(() => compare([1, 2], [1], rule));
  assert.throws(() => compare([], [], rule));
  // Four pairs each 300 ms slower are shown, not judged; five are judged.
  assert.equal(MIN_PAIRS, 5);
  assert.equal(compare([100, 100, 100, 100], [400, 400, 400, 400], rule).regressed, false);
  assert.equal(compare([100, 100, 100, 100, 100], [400, 400, 400, 400, 400], rule).regressed, true);
});

test('compare: the same samples on both sides never regress, and neither do HEAD samples no slower than BASE', () => {
  fc.assert(
    fc.property(pairs, ([base]) => !compare(base, base, rule).regressed),
    params(),
  );
  fc.assert(
    fc.property(pairs, ([base, d]) => !compare(base, base.map((v, i) => v - d[i]!), rule).regressed),
    params(),
  );
});

test('compare: every pair slower by more than both thresholds always regresses', () => {
  fc.assert(
    fc.property(pairs, ([base, extra]) => {
      const worst = Math.max(...base);
      const head = base.map((v, i) => v + Math.max(rule.floor, rule.rel * worst) + 1 + extra[i]!);
      return compare(base, head, rule).regressed;
    }),
    params(),
  );
});

test('compare: a regression is the same regression whichever order the pairs were taken in', () => {
  fc.assert(
    fc.property(pairs, fc.integer({ min: 0, max: 14 }), ([base, head], k) => {
      const n = base.length,
        rot = <T>(xs: T[]) => [...xs.slice(k % n), ...xs.slice(0, k % n)];
      return compare(base, head, rule).regressed === compare(rot(base), rot(head), rule).regressed;
    }),
    params(),
  );
});

test('verdict: a regression must show on both rounds', () => {
  const base = [100, 100, 100, 100, 100];
  const slow = compare(base, [300, 300, 300, 300, 300], rule),
    fine = compare(base, base, rule);
  assert.equal(verdict(fine), 'ok');
  assert.equal(verdict(fine, slow), 'ok');
  assert.equal(verdict(slow, fine), 'not reproduced');
  assert.equal(verdict(slow), 'not reproduced');
  assert.equal(verdict(slow, slow), 'regression');
});
