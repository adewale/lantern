import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { SnapshotSink, indexScene, stepTime, renderAt, traceScene, renderText } from '../src/index.ts';
import { Fixture } from './lib/scenes.ts';

// The trace is what agents read and what fidelity tests compare: its records, timing and
// state at every step boundary. The file holds the whole trace, so a change shows as a diff.
test('the golden trace of the fixture is unchanged (UPDATE_GOLDEN=1 rewrites it after a deliberate change)', async () => {
  const file = new URL('./golden-traces.json', import.meta.url);
  const now = { fixture: await traceScene(Fixture) };
  if (process.env.UPDATE_GOLDEN === '1') writeFileSync(file, JSON.stringify(now, null, 2) + '\n');
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
