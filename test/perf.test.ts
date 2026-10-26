import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, Text, perf, toSvgString, renderElements } from '../src/index.ts';
import type { ElementRecord } from '../src/index.ts';
import { Fixture, explainers } from './lib/scenes.ts';

// Caption holds are thousands of identical frames; the hold rule has its own test
Scene.captionWpm = Infinity;

// Render caches (path data, element records, merged glyph lines) are checked against a
// cache-free render: a copy of a mobject hits none of its original's caches. The scene
// renders every frame, so its caches see the whole history; every EVERY-th frame is compared
// (FULL=1: every third). One output mode per run: the path cache holds one mode, so
// alternating modes would bypass it.
const EVERY = process.env.FULL ? 3 : 15;
// The camera comes along: an explainer that zooms (seasons) renders a viewBox of its own
const fresh = (scene: Scene): Scene => {
  const s = new Scene(new NullSink());
  s.frame = scene.frame.copy();
  return s.add(...scene.mobjects.map((m) => m.copy()));
};
const absolute = (els: ElementRecord[]): string => els.map((e) => `${e.transform ?? ''}|${JSON.stringify(e.attrs)}|${e.text ?? ''}`).join('\n');

test('render caches are never stale: every explainer, both output modes, each sampled frame equals a cache-free render', async () => {
  for (const [name, Explainer] of await explainers()) {
    let i = 0, compared = 0;
    await new Explainer({ async frame(scene) {
      if (i++ % EVERY) return void renderElements(scene);
      assert.equal(toSvgString(scene), toSvgString(fresh(scene)), `${name}: relative mode, frame ${i - 1}`);
      compared++;
    } }).run();
    let j = 0;
    await new Explainer({ async frame(scene) {
      const els = renderElements(scene, { relative: false });
      if (j++ % EVERY) return;
      const got = absolute(els);
      assert.equal(got, absolute(renderElements(fresh(scene), { relative: false })), `${name}: absolute mode, frame ${j - 1}`);
      assert.ok(!got.includes('translate('), `${name}: absolute mode emits no translations`);
    } }).run();
    assert.ok(compared > 10, `${name}: ${compared} frames compared`);
  }
});

test('tracer: spans nest and self time excludes children', () => {
  perf.enable();
  perf.span('outer', () => { const t = performance.now(); while (performance.now() - t < 5); perf.span('inner', () => { const u = performance.now(); while (performance.now() - u < 5); }); });
  perf.disable();
  const rows = Object.fromEntries(perf.rows().map((r) => [r.name, r]));
  assert.ok(rows.outer!.total >= 10 && rows.outer!.self < rows.outer!.total - 4);
  assert.ok(rows.inner!.self >= 5);
});

test('DOM output merges same-styled glyph lines into one element, and splits during Write', async () => {
  let merged = 0, split = 0;
  await new Fixture({ async frame(scene) {
    const els = renderElements(scene, { relative: false });
    const ids = new Set(els.map((e) => e.id));
    for (const top of scene.mobjects) for (const m of top.family()) if (m instanceof Text && m.children.length > 1) {
      if (ids.has(m.id)) merged++; else if (m.children.some((c) => ids.has(c.id))) split++;
    }
  } }).run();
  assert.ok(merged > 500, `merged lines: ${merged}`);
  assert.ok(split > 0, 'letter-by-letter Write falls back to per-glyph elements');
});
