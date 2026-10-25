// Property tests: random scenes must satisfy the engine's invariants. The
// hand-written scenes exercise the paths their authors thought of; these
// exercise the rest. fast-check draws each scene from a tape of choices
// (test/lib/random-scene.ts), so a failure shrinks to a smaller scene and
// prints its seed and path: rerun it with FC_SEED=<seed> FC_PATH=<path>.
// SEED=<n> still runs the one seeded scene n. Case counts are below the usual
// 1000 where each case runs whole scenes several times over (about 5 ms each);
// FULL=1 runs ten times as many.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Scene, StringSink, SnapshotSink, NullSink, Transform, Line, Arc, Text, VMobject,
  renderAt, traceScene, indexScene, renderText, renderElements, toSvgString, loadFonts,
} from '../src/index.ts';
import type { Box, ElementRecord, Mobject } from '../src/index.ts';
import { tapeRng, makeScene, place, randomShape, tape, drawsFrom } from './lib/random-scene.ts';
import type { Draws } from './lib/random-scene.ts';
import { fc, params } from './lib/pbt.ts';

await loadFonts();
/** Each property over random draws: the one seeded case under SEED=n, else fast-check tapes. */
async function forDraws(cases: number, check: (draws: Draws, ctx: string) => Promise<void> | void): Promise<void> {
  if (process.env.SEED) return void (await check(Number(process.env.SEED), `seed ${process.env.SEED}`));
  await fc.assert(fc.asyncProperty(tape(), async (t) => check(t, 'tape')), params(cases));
}

const bruteBox = (m: Mobject): Box | null => {
  let b: Box | null = null;
  for (const f of m.family()) for (const a of f.pointArrays()) for (let i = 0; i < a.length; i += 2) {
    const x = a[i]!, y = a[i + 1]!;
    if (!b) b = [x, y, x, y];
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return b;
};
/** A scene holding copies of these mobjects: a copy hits none of the original's render caches. */
const fresh = (scene: Scene): Scene => new Scene(new NullSink()).add(...scene.mobjects.map((m) => m.copy()));
/** The SVG a fresh scene draws with exactly these mobjects on it. */
const drawn = (...mobs: Mobject[]): string => toSvgString(new Scene(new NullSink()).add(...mobs));
const absolute = (els: ElementRecord[]): string => els.map((e) => `${e.transform ?? ''}|${JSON.stringify(e.attrs)}|${e.text ?? ''}`).join('\n');

test('random scenes: deterministic, finite, cache-exact in both output modes, box-exact, seek-exact, skip-exact', async () => {
  await forDraws(300, async (seed, ctx) => {
    const S = makeScene(seed);
    const a = new StringSink(), b = new StringSink();
    // Relative mode (SVG strings): each frame equals a cache-free render of copies, and every box equals a fresh computation
    await new S({ async frame(scene) {
      await a.frame(scene);
      assert.equal(a.last(), toSvgString(fresh(scene)), `${ctx}: stale render cache at t=${scene.time}`);
      for (const top of scene.mobjects) for (const m of top.family())
        assert.deepEqual(m.box(), bruteBox(m), `${ctx}: stale box on ${m.constructor.name}#${m.id} at t=${scene.time}`);
    } }, { fps: 20 }).run();
    // Absolute mode (what DomSink draws), in a run of its own: the path cache holds one mode, so alternating would bypass it
    await new S({ async frame(scene) {
      assert.equal(absolute(renderElements(scene, { relative: false })), absolute(renderElements(fresh(scene), { relative: false })), `${ctx}: stale absolute record at t=${scene.time}`);
    } }, { fps: 20 }).run();
    await new S(b, { fps: 20 }).run();
    assert.ok(a.frames.length > 1, ctx);
    assert.deepEqual(a.frames, b.frames, `${ctx}: not deterministic`);
    for (const f of a.frames) assert.ok(!/NaN|Infinity|undefined/.test(f), `${ctx}: non-finite output`);
    // seeking to 3 times lands on the exact frame
    const ix = await indexScene(S, { fps: 20 });
    const r = typeof seed === 'number' ? drawsFrom(seed * 7919) : tapeRng(seed.slice(400));
    for (let k = 0; k < 3; k++) {
      const t = r(0, ix.duration);
      const snap = new SnapshotSink();
      const scene = await renderAt(S, t, snap, { fps: 20 });
      const i = Math.round(scene.time * 20);
      assert.equal(snap.svg, a.frames[i], `${ctx}: seek to ${t.toFixed(3)} (frame ${i}) differs from the full run`);
      assert.doesNotThrow(() => renderText(scene), `${ctx}: renderText`);
    }
    // A trace from a skipped run records the same boundaries and state as a played one
    assert.deepEqual(await traceScene(S, { fps: 20 }), await traceScene(S, { fps: 20, skipUntil: 0 }), `${ctx}: skipped trace differs`);
  });
});

test('Transform ends drawing exactly what its target, as authored, draws', async () => {
  // The oracle is the target as the author built it, not the copy Transform aligned: a
  // container morphed into a lone path used to end drawing nothing (D1).
  await forDraws(300, async (seed, ctx) => {
    const S = makeScene(seed);
    const scene = new S(new NullSink(), { fps: 20 });
    const origPlay = scene.play.bind(scene);
    // Check right after each play, before the next one moves things again
    scene.play = async (...args) => {
      const plain = (args as unknown[]).filter((an): an is Transform => an instanceof Transform && an.constructor === Transform && !an.replace && !an.remover);
      const want = plain.map((an) => drawn(an.target.copy()));
      const r = await origPlay(...args);
      // play()'s options set the rate function: only one that ends at 1 lands on the target
      plain.forEach((an, i) => {
        if (Math.abs(an.rateFunc(1) - 1) < 1e-9) assert.equal(drawn(an.mobject.copy()), want[i], `${ctx}: ${an.mobject.constructor.name} -> ${an.target.constructor.name} ended off its target`);
      });
      return r;
    };
    await scene.run();
  });
});

test('subdividing any cubic path preserves its geometry (random paths, random n)', async () => {
  // 200 cases: each samples the path 4000 times per curve as its reference.
  await forDraws(200, (seed) => {
    const r = drawsFrom(seed);
    const n = r.int(1, 6), p = new VMobject();
    p.startNewPath([r(-2, 2), r(-2, 2)]);
    for (let i = 0; i < n; i++) p.addCubic([r(-2, 2), r(-2, 2)], [r(-2, 2), r(-2, 2)], [r(-2, 2), r(-2, 2)]);
    // Every point of the subdivided path must lie on the original. The reference is
    // the original sampled 4000 times per curve (about 2e-3 apart on the longest
    // paths here), so 3e-3 is the resolution of the check, not slack in the code.
    const ref: Array<[number, number]> = [];
    for (let c = 0; c < n; c++) for (let i = 0; i <= 4000; i++) ref.push(p.pointOnCurve(0, c, i / 4000));
    const start = p.pointFromProportion(0), end = p.pointFromProportion(1);
    const extra = r.int(1, 12);
    p.insertNCurves(0, extra);
    assert.equal(p.numCurves(), n + extra, 'exactly n more curves');
    assert.deepEqual(p.pointFromProportion(0), start); assert.deepEqual(p.pointFromProportion(1), end);
    for (let c = 0; c < p.numCurves(); c++) for (const t of [0, 0.25, 0.5, 0.75]) {
      const q = p.pointOnCurve(0, c, t);
      let d = Infinity;
      for (const a of ref) { const e = Math.hypot(a[0] - q[0], a[1] - q[1]); if (e < d) d = e; }
      assert.ok(d < 3e-3, `curve ${c} t=${t} is ${d.toFixed(4)} off the original path`);
    }
  });
});

test('copy() is deep: mutating a copy never touches the original', async () => {
  await forDraws(1000, (seed) => {
    const r = drawsFrom(seed);
    const m = place(r, randomShape(r));
    const before = JSON.stringify(m.family().map((f) => [f.style, f.pointArrays().map((a) => Array.from(a))]));
    const c = m.copy();
    c.shift([1, 1]).scale(2).setFill('#000000');
    for (const f of c.family()) for (const a of f.pointArrays()) if (a.length) a[0]! += 1;
    assert.equal(JSON.stringify(m.family().map((f) => [f.style, f.pointArrays().map((a) => Array.from(a))])), before);
    assert.ok(c.family().every((f) => !m.family().includes(f)), 'copy shares no mobjects with the original');
  });
});

test('a one-curve path morphing into a Text heads for the text’s centre, not onto its advance box', () => {
  // Regression: a one-curve path and a Text's advance box are both 8 floats, and equal length
  // alone used to make them blend, so the line flew to the box's corners. The path is emptied
  // once it lands, so the check is mid-morph, where a reader sees it.
  fc.assert(
    fc.property(
      fc.tuple(fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -3, max: 3, noNaN: true }), fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -3, max: 3, noNaN: true })),
      fc.string({ unit: 'grapheme', minLength: 1, maxLength: 6 }),
      fc.boolean(),
      fc.double({ min: 0.05, max: 0.99, noNaN: true }),
      ([x0, y0, x1, y1], text, arc, alpha) => {
        const path = arc ? new Arc({ radius: 1, angle: 0.5 }).moveTo([x0, y0]) : new Line([x0, y0], [x1, y1]);
        const target = new Text(text, { fontSize: 0.3 }).moveTo([x1, y1]);
        const start = path.pointArrays()[0]!.slice();
        const morph = new Transform(path, target);
        morph.begin();
        morph.interpolate(alpha);
        const c = target.center(), now = path.pointArrays()[0]!;
        for (let j = 0; j < start.length; j += 2) {
          const want = [start[j]! + (c[0] - start[j]!) * alpha, start[j + 1]! + (c[1] - start[j + 1]!) * alpha];
          assert.ok(Math.hypot(now[j]! - want[0]!, now[j + 1]! - want[1]!) < 1e-4, `point ${j / 2} at alpha ${alpha}`);
        }
      },
    ),
    params(),
  );
});
