// Differential tests against manim itself. test/manim-oracle.json holds manim's own
// answers, computed by tools/oracle/manim_math.py from the pinned checkout it names
// (manim's functions are extracted from its source, not retyped), so these run
// everywhere without Python. With MANIM_DIR=<checkout of 3b1b/manim> (and python3 +
// numpy) the fixture is also checked against the live oracle; UPDATE_ORACLE=1 rewrites it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { VMobject, linear, smooth, rushInto, rushFrom, thereAndBack } from '../src/index.ts';
import type { Vec } from '../src/index.ts';

interface Answers { rates: Record<string, number[]>; distribute: number[][]; partial: Array<Array<[number, number]>> }
interface Fixture {
  manim: string;
  request: { rates: number[]; distribute: Array<{ lengths: number[]; n: number }>; partial: Array<{ points: Vec[]; a: number; b: number }> };
  answers: Answers;
}
const file = new URL('./manim-oracle.json', import.meta.url);
const { request, answers, manim } = JSON.parse(readFileSync(file, 'utf8')) as Fixture;

test('the frozen answers are what manim answers now', { skip: process.env.MANIM_DIR ? false : 'set MANIM_DIR to a checkout of 3b1b/manim' }, () => {
  const live = JSON.parse(execFileSync('python3', ['-I', new URL('../tools/oracle/manim_math.py', import.meta.url).pathname], { input: JSON.stringify(request), encoding: 'utf8' })) as Answers;
  if (process.env.UPDATE_ORACLE === '1') writeFileSync(file, JSON.stringify({ manim, request, answers: live }) + '\n');
  assert.deepEqual(live, answers);
});

test("rate functions equal manim's to 1e-12", () => {
  const ours = { linear, smooth, rush_into: rushInto, rush_from: rushFrom, there_and_back: thereAndBack };
  for (const [name, f] of Object.entries(ours)) {
    request.rates.forEach((t, i) => assert.ok(Math.abs(f(t) - answers.rates[name]![i]!) < 1e-12, `${name}(${t}): ${f(t)} vs manim ${answers.rates[name]![i]!}`));
  }
});

test('extra curves are distributed across a path the way manim distributes them', () => {
  // The rule picks the n largest values of L / j over all curves and piece counts. When
  // the n-th and (n+1)-th largest tie, either choice is correct and manim's argpartition
  // picks arbitrarily, so a tie is checked on the objective (the longest piece left)
  // and everything else exactly.
  const longestPiece = (lengths: number[], counts: number[]): number => Math.max(...lengths.map((l, c) => l / counts[c]!));
  const ambiguous = (lengths: number[], n: number): boolean => {
    const vals = lengths.flatMap((l) => Array.from({ length: n }, (_, j) => l / (j + 1))).sort((a, b) => b - a);
    return Math.abs(vals[n - 1]! - vals[n]!) < 1e-12;
  };
  request.distribute.forEach(({ lengths, n }, i) => {
    // A straight path along x with curves of these lengths; count the pieces each curve became
    const xs = lengths.reduce((acc, l) => [...acc, acc.at(-1)! + l], [0]);
    const p = new VMobject();
    p.startNewPath([0, 0]);
    for (const x of xs.slice(1)) p.addLineTo([x, 0]);
    p.insertNCurves(0, n);
    const ours = lengths.map(() => 0);
    for (let c = 0; c < p.numCurves(); c++) {
      const a = p.pointOnCurve(0, c, 0)[0], b = p.pointOnCurve(0, c, 1)[0], mid = (a + b) / 2;
      // A zero-length piece belongs to the zero-length curve at its point; any other lies inside its curve
      const k = Math.abs(b - a) < 1e-9 ? lengths.findIndex((l, j) => l === 0 && Math.abs(xs[j]! - a) < 1e-6) : lengths.findIndex((_, j) => mid > xs[j]! && mid < xs[j + 1]!);
      ours[k]!++;
    }
    const theirs = answers.distribute[i]!;
    assert.equal(ours.reduce((a, b) => a + b, 0), lengths.length + n);
    if (ambiguous(lengths, n)) {
      assert.ok(Math.abs(longestPiece(lengths, ours) - longestPiece(lengths, theirs)) < 1e-9, `lengths ${lengths} n=${n}: ${ours} vs manim ${theirs}`);
    } else assert.deepEqual(ours, theirs, `lengths ${lengths} n=${n}`);
  });
});

test("splitting a cubic matches manim's partial_bezier_points piece by piece", () => {
  const parts = request.partial.length, P = request.partial[0]!.points;
  const p = new VMobject();
  p.startNewPath(P[0]!);
  p.addCubic(P[1]!, P[2]!, P[3]!);
  p.insertNCurves(0, parts - 1);
  const split = p.subpaths[0]!;
  for (let j = 0; j < parts; j++) {
    for (let q = 0; q < 4; q++) {
      const x = split[6 * j + 2 * q]!, y = split[6 * j + 2 * q + 1]!, m = answers.partial[j]![q]!;
      assert.ok(Math.abs(x - m[0]) < 1e-5 && Math.abs(y - m[1]) < 1e-5, `piece ${j} point ${q}: (${x}, ${y}) vs manim (${m})`);
    }
  }
});
