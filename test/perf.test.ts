import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, VMobject, perf, toSvgString, renderElements, traceScene } from '../src/index.ts';
import type { ElementRecord } from '../src/index.ts';

// Caption holds are thousands of identical frames; the hold rule has its own test
Scene.captionWpm = Infinity;
import { SCENES } from '../scenes/index.ts';

test('render caches are never stale: every scene, every frame, validated', async () => {
  VMobject.validateCaches = true;
  try {
    for (const [name, { Scene }] of Object.entries(SCENES)) {
      // Building records exercises every cache; serializing strings would only add time
      let frames = 0;
      // One path mode per run: the path cache holds one mode, so alternating would only thrash it.
      // Absolute mode is validated in its own test below.
      await new Scene({ async frame(scene) { renderElements(scene); frames++; } }).run(); // throws on any stale hit
      assert.ok(frames > 100, name);
    }
  } finally { VMobject.validateCaches = false; }
});

// Uncached rendering is the expensive reference, so by default it is computed for every
// EVERY-th frame; the cached side still renders every frame, so caches see the full history.
// FULL=1 (CI) compares every frame.
const EVERY = process.env.FULL ? 1 : 15;
// Every mobject, path or not, gets the three cache slots cleared (svg.ts and vmobject.ts own them)
type CacheSlots = { _dCache?: unknown; _rec?: unknown; _mrec?: unknown };
const stripCaches = (scene: Scene): void => { for (const top of scene.mobjects) for (const m of top.family()) { const c = m as CacheSlots; c._dCache = null; c._rec = null; c._mrec = null; } };

test('cached and uncached renders are byte-identical', async () => {
  const { Scene } = SCENES['pyex-limits']!;
  // Cached side renders every frame (caches see the full history), serializes only sampled ones
  const cached: { frames: string[] } = { frames: [] };
  let c = 0;
  await new Scene({ async frame(scene) { if (c++ % EVERY === 0) cached.frames.push(toSvgString(scene)); else renderElements(scene); } }).run();
  const fresh: string[] = [];
  let i = 0;
  await new Scene({ async frame(scene) {
    if (i++ % EVERY) return;
    stripCaches(scene);
    fresh.push(toSvgString(scene));
  } }).run();
  assert.equal(fresh.length, cached.frames.length);
  fresh.forEach((f, k) => assert.equal(f, cached.frames[k], `frame ${k * EVERY}`));
});

test('tracer: spans nest and self time excludes children', () => {
  perf.enable();
  perf.span('outer', () => { const t = performance.now(); while (performance.now() - t < 5); perf.span('inner', () => { const u = performance.now(); while (performance.now() - u < 5); }); });
  perf.disable();
  const rows = Object.fromEntries(perf.rows().map((r) => [r.name, r]));
  assert.ok(rows.outer!.total >= 10 && rows.outer!.self < rows.outer!.total - 4);
  assert.ok(rows.inner!.self >= 5);
});

test('skipping frames changes nothing observable: traces identical with and without skip', async () => {
  const { traceScene } = await import('../src/index.ts');
  for (const [name, { Scene }] of Object.entries(SCENES)) {
    const skipped = await traceScene(Scene);                  // default: skip everything
    const full = await traceScene(Scene, { skipUntil: 0 });   // every frame interpolated
    assert.deepEqual(skipped, full, name);
  }
});

test('seek renders the exact frame of a full run, at arbitrary times, in every scene', async () => {
  const { renderAt, SnapshotSink } = await import('../src/index.ts');
  for (const [name, { Scene }] of Object.entries(SCENES)) {
    // Targets come from the (cheap, skipping) trace; the full run then renders every frame
    // but serializes only the first frame at or after each target
    const { duration } = await traceScene(Scene);
    const targets = (process.env.FULL ? [0.01, 0.13, 0.37, 0.5, 0.71, 0.93] : [0.13, 0.71]).map((f) => duration * f);
    const expected = new Map();
    await new Scene({ async frame(scene) {
      for (const t of targets) if (!expected.has(t) && scene.time + 1e-9 >= t) expected.set(t, toSvgString(scene));
    } }).run();
    for (const t of targets) {
      const snap = new SnapshotSink();
      await renderAt(Scene, t, snap);
      assert.equal(snap.svg, expected.get(t), `${name} @ ${t.toFixed(3)}s`);
    }
  }
});

test('absolute mode (what DomSink renders): validated caches, cached == uncached', async () => {
  const { renderElements } = await import('../src/index.ts');
  const { Scene } = SCENES['pyex-limits']!;
  const snap = (els: ElementRecord[]): string => els.map((e) => `${e.transform ?? ''}|${JSON.stringify(e.attrs)}|${e.text ?? ''}`).join('\n');
  VMobject.validateCaches = true;
  try {
    const cached: string[] = [], fresh: string[] = [];
    let i = 0, j = 0;
    await new Scene({ async frame(scene) { const els = renderElements(scene, { relative: false }); if (i++ % EVERY === 0) cached.push(snap(els)); } }).run();
    await new Scene({ async frame(scene) {
      if (j++ % EVERY) return;
      stripCaches(scene);
      fresh.push(snap(renderElements(scene, { relative: false })));
    } }).run();
    assert.equal(cached.length, fresh.length);
    for (let k = 0; k < cached.length; k++) assert.equal(cached[k], fresh[k], `frame ${k * EVERY}`);
    assert.ok(!cached.join('').includes('translate('), 'absolute mode emits no translations');
  } finally { VMobject.validateCaches = false; }
});

test('DOM output merges same-styled glyph lines into one element, and splits during Write', async () => {
  const { renderElements, Text } = await import('../src/index.ts');
  const { Scene } = SCENES['pyex-limits']!;
  let merged = 0, split = 0;
  await new Scene({ async frame(scene) {
    const els = renderElements(scene, { relative: false });
    const ids = new Set(els.map((e) => e.id));
    for (const top of scene.mobjects) for (const m of top.family()) if (m instanceof Text && m.children.length > 1) {
      if (ids.has(m.id)) merged++; else if (m.children.some((c) => ids.has(c.id))) split++;
    }
  } }).run();
  assert.ok(merged > 1000, `merged lines: ${merged}`);
  assert.ok(split > 0, 'letter-by-letter Write falls back to per-glyph elements');
});
