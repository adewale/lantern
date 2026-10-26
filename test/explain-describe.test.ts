import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceScene } from '../src/index.ts';
import { describeExplainer, withSettings, variantsOf, bindSnapshots } from '../explain/index.ts';
import type { ExplainerClass } from '../explain/index.ts';
import { readSnapshots } from '../tools/lib/explain-project.ts';
import RingBuffer from '../scenes/explainers/ring-buffer/scene.ts';
import OauthPkce from '../scenes/explainers/oauth-pkce/scene.ts';

test('describeExplainer gives every case and step: the words, the state the trace recorded and what each step changed', async () => {
  const d = await describeExplainer(RingBuffer as ExplainerClass);
  assert.equal(d.schema, 1);
  assert.equal(d.id, 'ring-buffer');
  assert.deepEqual(d.cases.map((c) => c.values), variantsOf(RingBuffer as ExplainerClass));
  for (const c of d.cases) {
    const trace = await traceScene(withSettings(RingBuffer as ExplainerClass, c.values));
    assert.equal(c.duration, trace.duration);
    assert.deepEqual(c.steps.map((s) => s.step), trace.steps.map((s) => s.step));
    c.steps.forEach((s, i) => {
      const t = trace.steps[i]!;
      assert.equal(s.title, t.meta.title);
      assert.equal(s.caption, t.meta.caption);
      const { picture, ...state } = t.after ?? {};
      assert.deepEqual(s.state, state, `${s.step}: state is the trace's, without the picture`);
      assert.ok(picture === undefined || s.picture.length > 0, `${s.step}: the picture in words`);
      for (const [k, change] of Object.entries(s.changed)) {
        // A side is there exactly when the value was set, so the JSON says the same as the object.
        assert.equal('before' in change, k in t.before);
        assert.equal('after' in change, k in state);
        assert.deepEqual(change.before, t.before[k]);
        assert.deepEqual(change.after, state[k]);
        assert.notDeepEqual(change.before, change.after);
      }
      assert.match(s.drawing!, /[┌─│]/, `${s.step}: the resting picture drawn as text`);
    });
  }
  // The ring after the last pushes, as `explain see` reports it.
  const result = d.cases[0]!.steps.find((s) => s.step === 'result')!;
  assert.deepEqual(result.changed.tail, { before: 0, after: 2 });
  // JSON-safe: what an agent reads from a file is what the function returned.
  assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
});

test('a scene with diagrams describes from its pinned snapshots, case by case, and fails without them', async () => {
  const snapshots = await readSnapshots('scenes/explainers/oauth-pkce/scene');
  const d = await describeExplainer(OauthPkce as ExplainerClass, { snapshots, drawings: false });
  assert.deepEqual(d.settings.map((s) => s.id), ['attacker']);
  assert.equal(d.cases.length, 2);
  const steps = (attacker: string) => d.cases.find((c) => c.values.attacker === attacker)!.steps.map((s) => s.step);
  // The setting changes which steps exist: only the attacker case has the attack.
  assert.ok(steps('yes').includes('attack'));
  assert.ok(!steps('no').includes('attack'));
  assert.ok(d.cases.every((c) => c.steps.every((s) => s.drawing === undefined)), 'drawings: false leaves them out');
  assert.ok(d.cases[0]!.steps.some((s) => /Sequence diagram/.test(s.picture)), 'diagrams are described in words');
  // Same answer as binding the snapshots by hand.
  const trace = await traceScene(withSettings(bindSnapshots(OauthPkce as ExplainerClass, snapshots), d.cases[0]!.values));
  assert.deepEqual(d.cases[0]!.steps.map((s) => s.step), trace.steps.map((s) => s.step));
  await assert.rejects(describeExplainer(OauthPkce as ExplainerClass, { drawings: false }));
});
