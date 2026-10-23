// Differential tests against manim itself. tools/oracle/manim_math.py runs
// manim's own functions (extracted from a pinned checkout, not retyped) and
// these compare our numbers with theirs. Needs python3 + numpy and
// MANIM_DIR=<checkout of 3b1b/manim>; without MANIM_DIR the tests are skipped,
// and CI sets it (.github/workflows/ci.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { VMobject, distributeCurves } from '../src/vmobject.ts';
import { linear, smooth, rushInto, rushFrom, thereAndBack } from '../src/rate.ts';

const MANIM_DIR = process.env.MANIM_DIR;
const skip = MANIM_DIR ? false : 'set MANIM_DIR to a checkout of 3b1b/manim';
/** manim_math.py's answers, keyed like the request. */
interface Answers { rates: Record<string, number[]>; distribute: number[][]; partial: Array<Array<[number, number]>> }
const ask = (req: object): Answers => JSON.parse(execFileSync('python3', ['-I', new URL('../tools/oracle/manim_math.py', import.meta.url).pathname],
  { input: JSON.stringify(req), env: { ...process.env, MANIM_DIR }, encoding: 'utf8' })) as Answers;

const ts = Array.from({ length: 101 }, (_, i) => i / 100);

test('rate functions equal manim\'s to 1e-12', { skip }, () => {
  const { rates } = ask({ rates: ts });
  const ours = { linear, smooth, rush_into: rushInto, rush_from: rushFrom, there_and_back: thereAndBack };
  for (const [name, f] of Object.entries(ours)) {
    ts.forEach((t, i) => assert.ok(Math.abs(f(t) - rates[name]![i]!) < 1e-12, `${name}(${t}): ${f(t)} vs manim ${rates[name]![i]!}`));
  }
});

test('extra curves are distributed across a path the way manim distributes them', { skip }, () => {
  const cases = [
    { lengths: [4, 0.25, 2, 0.25], n: 5 },       // a rounded rectangle: edges and corner arcs
    { lengths: [4, 0.25, 4, 0.25, 4, 0.25, 4, 0.25], n: 7 },
    { lengths: [1, 2, 3, 4, 5], n: 1 },
    { lengths: [1, 2, 3, 4, 5], n: 14 },
    { lengths: [1.3, 2.1, 0.7, 3.9, 5.2], n: 11 },  // irrational-ish ratios: no ties, exact match required
    { lengths: [0.37, 1.91, 2.63], n: 9 },
    { lengths: [10, 1], n: 30 },
    { lengths: [0.3, 0.1, 0, 0.2], n: 4 },       // a zero-length curve is never cut
    { lengths: [1, 1, 1, 1], n: 3 },             // ties: any assignment with the same multiset is right
    { lengths: [2, 2, 1], n: 2 },
  ];
  const { distribute } = ask({ distribute: cases });
  // The rule picks the n largest values of L / j over all curves and piece counts. When
  // the n-th and (n+1)-th largest tie, either choice is correct and manim's argpartition
  // picks arbitrarily, so a tie is checked on the objective (the longest piece left)
  // and everything else exactly.
  const longestPiece = (lengths: number[], counts: number[]): number => Math.max(...lengths.map((l, c) => l / counts[c]!));
  const ambiguous = (lengths: number[], n: number): boolean => {
    const vals = lengths.flatMap((l) => Array.from({ length: n }, (_, j) => l / (j + 1))).sort((a, b) => b - a);
    return Math.abs(vals[n - 1]! - vals[n]!) < 1e-12;
  };
  cases.forEach(({ lengths, n }, i) => {
    const ours = distributeCurves(lengths, n), theirs = distribute[i]!;
    assert.equal(ours.reduce((a, b) => a + b, 0), lengths.length + n);
    if (ambiguous(lengths, n)) {
      assert.ok(Math.abs(longestPiece(lengths, ours) - longestPiece(lengths, theirs)) < 1e-9, `lengths ${lengths} n=${n}: ${ours} vs manim ${theirs}`);
    } else assert.deepEqual(ours, theirs, `lengths ${lengths} n=${n}`);
  });
});

test('splitting a cubic matches manim\'s partial_bezier_points piece by piece', { skip }, () => {
  const P: Array<[number, number]> = [[0, 0], [1, 2], [3, 2], [4, 0]];
  const parts = 5;
  const a = new Float32Array(P.flat());
  const split = VMobject.splitCurve(a, 0, parts);
  const req = Array.from({ length: parts }, (_, j) => ({ points: P, a: j / parts, b: (j + 1) / parts }));
  const { partial } = ask({ partial: req });
  for (let j = 0; j < parts; j++) {
    for (let q = 0; q < 4; q++) {
      const x = split[6 * j + 2 * q]!, y = split[6 * j + 2 * q + 1]!, m = partial[j]![q]!;
      assert.ok(Math.abs(x - m[0]) < 1e-5 && Math.abs(y - m[1]) < 1e-5,
        `piece ${j} point ${q}: (${x}, ${y}) vs manim (${m})`);
    }
  }
});
