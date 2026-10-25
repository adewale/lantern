import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { StringSink, SnapshotSink, indexScene, stepTime, renderAt, traceScene, renderText } from '../src/index.ts';
import { Fixture, explainers } from './lib/scenes.ts';

test('every explainer exposes named steps that tile its duration', async () => {
  for (const [name, Scene] of await explainers()) {
    const ix = await indexScene(Scene);
    assert.ok(ix.steps.length >= 3, `${name} has steps`);
    for (let i = 1; i < ix.steps.length; i++) assert.ok(ix.steps[i]!.t0 >= ix.steps[i - 1]!.t0, `${name} steps are ordered`);
    assert.ok(ix.steps[0]!.t0 === 0);
  }
});

test('seeking to a step renders the identical frame a full run produces', async () => {
  const full = new StringSink(); await new Fixture(full).run();
  const ix = await indexScene(Fixture);
  for (const s of ix.steps) {
    const snap = new SnapshotSink();
    await renderAt(Fixture, s.t0, snap);
    assert.equal(snap.svg, full.frames[s.frame0], `frame at ${s.name}`);
  }
});

test('the golden trace is stable (update with UPDATE_GOLDEN=1)', async () => {
  const file = new URL('./golden-traces.json', import.meta.url);
  const now = { fixture: createHash('sha256').update(JSON.stringify(await traceScene(Fixture))).digest('hex').slice(0, 16) };
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) { writeFileSync(file, JSON.stringify(now, null, 2) + '\n'); return; }
  assert.deepEqual(now, JSON.parse(readFileSync(file, 'utf8')));
});

test('text renderer shows the lit code line, the arrow and the dot', async () => {
  const ix = await indexScene(Fixture);
  const scene = await renderAt(Fixture, stepTime(ix, 'end')!, new SnapshotSink());
  const txt = renderText(scene);
  assert.match(txt, /▌\s*while \(count < 3\) count\+\+;/);
  assert.match(txt, /▶/);
  assert.match(txt, /●/);
  assert.match(txt, /A fixture for the engine tests/);
});
