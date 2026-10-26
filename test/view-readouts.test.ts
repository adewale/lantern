// The explainers' state readouts against the traced state, with the expected
// text written here from the state's fields: not from the View's own render,
// which test/lib/view-fidelity.ts compares the picture with (a render that
// pairs a label with the wrong field agrees with itself).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, TraceSink, loadFonts } from '../src/index.ts';
import type { SceneClass, SceneState, Step, View } from '../src/index.ts';
import { withSettings } from '../explain/index.ts';
import RingBufferExplainer from '../scenes/explainers/ring-buffer/scene.ts';
import TokenBucketExplainer from '../scenes/explainers/token-bucket/scene.ts';

await loadFonts();
Scene.captionWpm = Infinity;

/** At the end of every step: the step, its traced state, and the text the readout shows (null before it exists). */
async function readoutAtSteps(S: SceneClass): Promise<Array<{ step: string; state: SceneState; shown: string[] | null }>> {
  const out: Array<{ step: string; state: SceneState; shown: string[] | null }> = [];
  class Sink extends TraceSink {
    override async stepEnd(scene: Scene, s: Step): Promise<void> {
      await super.stepEnd(scene, s);
      const v = (scene as unknown as { readout?: View | null }).readout;
      out.push({ step: s.path, state: this.events.at(-1)!.state, shown: v ? v.shown : null });
    }
  }
  await new S(new Sink(), { skipUntil: Infinity }).run();
  return out;
}

test('ring-buffer: the readout pairs head, tail and length with their traced values at every step', async () => {
  const moved = new Set<string>();
  for (const operations of ['wrap', 'full']) {
    const rows = (await readoutAtSteps(withSettings(RingBufferExplainer, { operations }))).filter((r) => r.shown);
    assert.ok(rows.length >= 4, `${operations}: the readout is on screen for ${rows.length} steps`);
    for (const { step, state, shown } of rows) {
      const { head, tail, length } = state as { head: number; tail: number; length: number };
      assert.deepEqual(shown, ['head', String(head), 'tail', String(tail), 'length', String(length)], `${operations}, step "${step}"`);
      moved.add(`${head},${tail}`);
    }
  }
  // head and tail differ at some step, so a readout that swapped them would show
  assert.ok([...moved].some((p) => p.split(',')[0] !== p.split(',')[1]), 'head and tail differ at some step');
});

/** A number as the token-bucket readout writes it: whole numbers plain, anything else to one decimal. */
const tenths = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(1));

test('token-bucket: the readout pairs tokens, lastRefill, allowed and rejected with their traced values at every step', async () => {
  for (const rate of ['1', '2', '4']) {
    const rows = (await readoutAtSteps(withSettings(TokenBucketExplainer, { rate }))).filter((r) => r.shown);
    assert.equal(rows.length, 5, `rate ${rate}: the readout is on screen at all five steps`);
    for (const { step, state, shown } of rows) {
      const { tokens, lastRefill, allowed, rejected } = state as { tokens: number; lastRefill: number; allowed: number; rejected: string[] };
      assert.deepEqual(
        shown,
        ['tokens', tenths(tokens), 'lastRefill', tenths(lastRefill), 'allowed', String(allowed), 'rejected', rejected.length ? rejected.join(', ') : 'none'],
        `rate ${rate}, step "${step}"`,
      );
    }
  }
});
