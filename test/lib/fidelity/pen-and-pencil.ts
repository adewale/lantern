import assert from 'node:assert/strict';
import type { Trace } from '../../../src/trace.ts';
import { assertStepState } from '../explainer-state.ts';
import { WORLD, TITLE, HAND, timelineFacts, hershey } from '../../../scenes/explainers/lib/pen-and-pencil.ts';

/** Counts come from the world's text, letters from Hershey Simplex; no scenery on owned paper; ink stays near its marks. */
export function check(trace: Trace): void {
  const facts = timelineFacts(WORLD);
  assertStepState(trace, 'text', { periods: facts.length });
  const after = (step: string) => trace.steps.find((s) => s.step === step)!.after!;
  const marks = after('marks').marks as { words: number };
  assert.equal(marks.words, facts.reduce((n, f) => n + 1 + f.events.length, 0));
  const strayBound = HAND.tremor * Math.SQRT2 * 2;
  assert.ok((after('hand').hand as { stray: number }).stray <= strayBound);
  assertStepState(trace, 'scene', {
    scene: { layers: ['hills', 'sea', 'rock', 'lighthouse', 'beam', 'gulls'], trespass: 0 },
  });
  const plate = after('plate').plate as { objects: number; stray: number; letters: number };
  assert.equal(plate.objects, facts.length * 3 + 1);
  assert.ok(plate.stray <= strayBound, `stray ${plate.stray}`);
  const words = [...facts.flatMap((f) => [f.period, ...f.events]), TITLE];
  assert.equal(plate.letters, words.reduce((n, w) => n + hershey(w).strokes.length, 0));
}
