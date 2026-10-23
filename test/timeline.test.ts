import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { StringSink, SnapshotSink, indexScene, stepTime, renderAt, traceScene, renderText } from '../src/index.ts';
import { SCENES } from '../scenes/index.ts';

test('every scene exposes named steps that tile its duration', async () => {
  for (const [name, { Scene }] of Object.entries(SCENES)) {
    const ix = await indexScene(Scene);
    assert.ok(ix.steps.length >= 3, `${name} has steps`);
    for (let i = 1; i < ix.steps.length; i++) assert.ok(ix.steps[i]!.t0 >= ix.steps[i - 1]!.t0, `${name} steps are ordered`);
    assert.ok(ix.steps[0]!.t0 === 0);
  }
});

test('seeking to a step renders the identical frame a full run produces', async () => {
  const { Scene } = SCENES['ring-buffer']!;
  const full = new StringSink(); await new Scene(full).run();
  const ix = await indexScene(Scene);
  for (const name of ['push-c', 'pop-a', 'wrap']) {
    const s = ix.steps.find((x) => x.name === name)!;
    const snap = new SnapshotSink();
    await renderAt(Scene, s.t0, snap);
    assert.equal(snap.svg, full.frames[s.frame0], `frame at ${name}`);
  }
});

test('golden traces are stable (update with UPDATE_GOLDEN=1)', async () => {
  const update = process.env.UPDATE_GOLDEN === '1';
  const file = new URL('./golden-traces.json', import.meta.url);
  const golden = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const now: Record<string, string> = {};
  for (const [name, { Scene }] of Object.entries(SCENES)) {
    const tr = await traceScene(Scene);
    now[name] = createHash('sha256').update(JSON.stringify(tr)).digest('hex').slice(0, 16);
  }
  if (update || !existsSync(file)) { writeFileSync(file, JSON.stringify(now, null, 2)); return; }
  assert.deepEqual(now, golden);
});

test('ring-buffer.doc.json is the generated doc (update with UPDATE_GOLDEN=1)', async () => {
  const { ringBufferDoc } = await import('../scenes/ring-buffer.doc.ts');
  const file = new URL('../scenes/ring-buffer.doc.json', import.meta.url);
  const json = JSON.stringify(ringBufferDoc, null, 2) + '\n';
  if (process.env.UPDATE_GOLDEN === '1') writeFileSync(file, json);
  assert.equal(readFileSync(file, 'utf8'), json);
});

test('text renderer shows the lit code line and the pointers', async () => {
  const { Scene } = SCENES['ring-buffer']!;
  const ix = await indexScene(Scene);
  const snap = new SnapshotSink();
  const scene = await renderAt(Scene, stepTime(ix, 'wrap')! + 0.6, snap);
  const txt = renderText(scene);
  assert.match(txt, /▌\s+this\.tail = \(this\.tail \+ 1\) % CAP;/);
  assert.match(txt, /tail wraps/);
  assert.match(txt, /head/);
});
