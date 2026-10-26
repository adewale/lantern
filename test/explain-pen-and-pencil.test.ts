// The pen-and-pencil model: the pen's bound, the pencil's clipping and the Hershey letters,
// held to properties and to Paul Bourke's transcription of the Simplex set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fc, params } from './lib/pbt.ts';
import { SIMPLEX } from '../scenes/explainers/lib/hershey-simplex.ts';
import {
  WORLD,
  rng,
  resample,
  penStroke,
  deviation,
  hatch,
  inside,
  hershey,
  fit,
  boundsOf,
  graphFacts,
} from '../scenes/explainers/lib/pen-and-pencil.ts';
import type { Pt, Box } from '../scenes/explainers/lib/pen-and-pencil.ts';

const coord = fc.double({ min: -6, max: 6, noNaN: true });
const point = fc.tuple(coord, coord) as fc.Arbitrary<Pt>;

test('Simplex holds the 95 printable ASCII glyphs, and A is the three strokes Hershey drew', () => {
  assert.equal(SIMPLEX.length, 95);
  assert.deepEqual(hershey('A'), {
    strokes: [
      [[9, 21], [1, 0]],
      [[9, 21], [17, 0]],
      [[4, 7], [14, 7]],
    ],
    width: 18,
  });
  assert.deepEqual(hershey(' '), { strokes: [], width: 16 });
  // Capitals stand 21 units on the baseline; only Q's tail dips below it.
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const b = boundsOf(hershey(ch).strokes);
    assert.equal(b[3], 21, ch);
    assert.equal(b[1], ch === 'Q' ? -2 : 0, ch);
  }
  assert.equal(hershey('Windmill').strokes.length, 17);
  assert.throws(() => hershey('é'), /no glyph for U\+E9/);
});

test('the same seed draws the same stroke; another seed draws another', () => {
  const line: Pt[] = [
    [0, 0],
    [3, 0],
  ];
  const o = { amplitude: 0.05, step: 0.03 };
  assert.deepEqual(penStroke(line, o, rng(1)), penStroke(line, o, rng(1)));
  assert.notDeepEqual(penStroke(line, o, rng(1)), penStroke(line, o, rng(2)));
});

test('the pen never strays farther than its amplitude from a straight line', () => {
  fc.assert(
    fc.property(point, point, fc.double({ min: 0.001, max: 0.5, noNaN: true }), fc.integer(), (a, b, amplitude, seed) => {
      fc.pre(Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.01);
      const stroke = penStroke([a, b], { amplitude, step: 0.05 }, rng(seed));
      assert.ok(deviation(stroke, [a, b]) <= amplitude * (1 + 1e-9));
      assert.equal(stroke.length, resample([a, b], 0.05).length);
    }),
    params(300),
  );
});

test('every pencil stroke lies inside its box and keeps the hatching angle', () => {
  const box = fc
    .tuple(point, fc.double({ min: 0.2, max: 5, noNaN: true }), fc.double({ min: 0.2, max: 5, noNaN: true }))
    .map(([[x, y], w, h]) => [x, y, x + w, y + h] as Box);
  fc.assert(
    fc.property(box, fc.integer({ min: 0, max: 179 }), fc.double({ min: 0.03, max: 0.3, noNaN: true }), fc.integer(), (b, angle, spacing, seed) => {
      const strokes = hatch(b, { angle, spacing, shortfall: spacing * 1.5 }, rng(seed));
      for (const [s, e] of strokes) {
        assert.ok(inside(s, b, 1e-9) && inside(e, b, 1e-9));
        const a = (Math.atan2(e[1] - s[1], e[0] - s[0]) * 180) / Math.PI;
        assert.ok(Math.abs(((a - angle + 540) % 180) - 0) < 1e-6 || Math.abs(((a - angle + 540) % 180) - 180) < 1e-6, `${a} vs ${angle}`);
      }
    }),
    params(300),
  );
});

test('fit scales strokes to a height around a centre', () => {
  const placed = fit(hershey('Harbour').strokes, [1, -2], 0.5);
  const b = boundsOf(placed);
  assert.ok(Math.abs(b[3] - b[1] - 0.5) < 1e-12);
  assert.ok(Math.abs((b[0] + b[2]) / 2 - 1) < 1e-12 && Math.abs((b[1] + b[3]) / 2 + 2) < 1e-12);
});

test('the world names five places and five links and gives no positions', () => {
  const { nodes, links } = graphFacts(WORLD);
  assert.deepEqual([...nodes.values()], ['Glass Spring', 'Windmill', 'Salt Ferry', 'Pear Orchard', 'Harbour']);
  assert.equal(links.length, 5);
  assert.doesNotMatch(WORLD, /\d/);
});
