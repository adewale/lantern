// TransformMatchingText through the motion verifier: a Text is one unit to
// MotionSink, its box the union of every glyph (faded ones too), so a glyph
// waiting or fading outside its line would make the line's extent jump.
//
// The lagged property stops at lagRatio 0.2: past about 0.25, a long
// rearrangement gives each matched glyph a window of a few frames to cross the
// line in, and the line's edge, handed from one fast glyph to a still one,
// spikes in the verifier's eyes (about 1 morph in 300 at lag 0.6 and moves of
// 3 units). That is a matched glyph genuinely moving fast, not a fade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Text, Code, TransformMatchingText, StringSink, SnapshotSink, MotionSink, analyzeMotion, renderAt, loadFonts } from '../src/index.ts';
import type { Vec } from '../src/index.ts';
import { fc, params } from './lib/pbt.ts';

Scene.captionWpm = Infinity;
await loadFonts();

interface Morph { a: string; b: string; size: number; move: Vec; lag: number; font: 'sans' | 'mono' }

const sceneOf = ({ a, b, size, move, lag, font }: Morph) => class extends Scene {
  override async construct() {
    await this.step('s');
    const src = new Text(a, { font }).shift([-2, 1]);
    this.add(src);
    await this.play(new TransformMatchingText(src, new Text(b, { font, fontSize: size }).shift(move), { lagRatio: lag }), { runTime: 1 });
    await this.wait(0.2);
  }
};

async function jumps(m: Morph): Promise<string[]> {
  const sink = new MotionSink();
  await new (sceneOf(m))(sink).run();
  return analyzeMotion(sink).map((e) => `${e.kind} @${e.frame}: ${e.what} ${e.detail}`);
}

test('the cases the verifier caught: a removed glyph past the end, a lagged morph that moves and grows', async () => {
  for (const m of [
    { a: 'c a', b: 'c', size: 0.4, move: [0, 0], lag: 0, font: 'mono' },
    { a: 'c a', b: 'c', size: 0.6, move: [1, -1], lag: 0, font: 'sans' },
    { a: '(x(a', b: ' ccbx c', size: 0.4, move: [3, -2], lag: 0.44, font: 'mono' },
    { a: '(x(a', b: ' ccbx c', size: 0.6, move: [1, -1], lag: 0.44, font: 'sans' },
  ] as Morph[]) assert.deepEqual(await jumps(m), [], JSON.stringify(m));
});

const word = fc.stringMatching(/^[abcx( ]{0,8}$/);
const morph: fc.Arbitrary<Morph> = fc.record({
  a: word, b: word,
  size: fc.double({ min: 0.25, max: 0.7, noNaN: true }),
  move: fc.tuple(fc.double({ min: -3, max: 3, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true })),
  lag: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 0.2, noNaN: true })),
  font: fc.constantFrom('sans' as const, 'mono' as const),
});

test('property: a text morph (removals, insertions, resize, move, lag) has no motion discontinuities', async () => {
  await fc.assert(fc.asyncProperty(morph, async (m) => { assert.deepEqual(await jumps(m), [], JSON.stringify(m)); }), params(300));
});

test('seeking into a lagged text morph renders the frame a full run renders', async () => {
  const S = sceneOf({ a: '(x(a', b: ' ccbx c', size: 0.6, move: [1, -1], lag: 0.44, font: 'sans' });
  const full = new StringSink();
  await new S(full).run();
  for (const k of [0, 1, 5, 12, 18, 24, 30, 31, full.frames.length - 1]) {
    const snap = new SnapshotSink();
    await renderAt(S, k / 30, snap);
    assert.equal(snap.svg, full.frames[k], `frame ${k}`);
  }
});

test('a Code block morphs without jumps too', async () => {
  for (const [a, b] of [[['c a'], ['c']], [['let total = 0;', 'return total;'], ['let t = 0;', 'return t;']]]) {
    const S = class extends Scene {
      override async construct() {
        const src = new Code(a!);
        this.add(src);
        await this.play(new TransformMatchingText(src, new Code(b!).scale(1.3).shift([0.5, -0.5]), { lagRatio: 0.2 }), { runTime: 1 });
        await this.wait(0.2);
      }
    };
    const sink = new MotionSink();
    await new S(sink).run();
    assert.deepEqual(analyzeMotion(sink).map((e) => `${e.kind} @${e.frame}: ${e.what} ${e.detail}`), [], JSON.stringify(a));
  }
});
