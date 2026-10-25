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
import { Scene, StringSink, SnapshotSink, Text, Transform, renderAt, traceScene, indexScene, renderText, loadFonts, VMobject } from '../src/index.ts';
import type { Box, Mobject, Sink, StyleRecord } from '../src/index.ts';
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

test('random scenes: deterministic, finite, cache-exact, box-exact, seek-exact', async () => {
  await forDraws(300, async (seed, ctx) => {
    VMobject.validateCaches = true;
    try {
      const S = makeScene(seed);
      const a = new StringSink(), b = new StringSink();
      const sa = new Scene(a, { fps: 20 }); Object.setPrototypeOf(sa, S.prototype);
      // box(): the cache must agree with a fresh computation at every frame
      const boxSink: Sink = { async frame(scene) {
        await a.frame(scene);
        for (const top of scene.mobjects) for (const m of top.family()) {
          const cached = m.box(), fresh = bruteBox(m);
          assert.deepEqual(cached, fresh, `${ctx}: stale box on ${m.constructor.name}#${m.id} at t=${scene.time}`);
        }
      } };
      await new S(boxSink, { fps: 20 }).run();
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
        renderText(scene); // must not throw
      }
      await traceScene(S); // must not throw
    } finally { VMobject.validateCaches = false; }
  });
});

test('Transform lands exactly on its target: same path data and style, leaf by leaf', async () => {
  await forDraws(300, async (seed) => {
    const S = makeScene(seed);
    const checks: number[] = [];
    const scene = new S({ async frame() {} }, { fps: 20 });
    const origPlay = scene.play.bind(scene);
    // Check right after each play, before the next one moves things again
    scene.play = async (...args) => {
      const r = await origPlay(...args);
      for (const an of args) if (an instanceof Transform && an.constructor === Transform && !an.replace && !an.remover && Math.abs(an.rateFunc(1) - 1) < 1e-9) {
        const got = an.mobject.family(), want = an.targetCopy.family();
        assert.equal(got.length, want.length, `${typeof seed === 'number' ? 'seed ' + seed : 'tape'}: family sizes differ after Transform`);
        got.forEach((g, i) => {
          const w = want[i]!; // same length, asserted above
          if (g instanceof VMobject && w instanceof VMobject) assert.equal(g.toPathD(), w.toPathD(), `${g.constructor.name}#${g.id} ended off its target`);
          else if (g instanceof VMobject) {
            // A path morphing into something with no path of its own collapses to its center
            const c = w.center();
            for (const arr of g.pointArrays()) for (let j = 0; j < arr.length; j += 2) assert.ok(Math.hypot(arr[j]! - c[0], arr[j + 1]! - c[1]) < 1e-4, `${g.constructor.name}#${g.id} should have collapsed to its target's center`);
          }
          for (const k of Object.keys(w.style) as Array<keyof StyleRecord>) if (k !== 'drawFraction') assert.equal(g.style[k], w.style[k], `style ${k} ended as ${g.style[k]}, target ${w.style[k]}`);
        });
        checks.push(1);
      }
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
    p.insertNCurves(0, r.int(1, 12));
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

test('a one-curve path morphing into a Text collapses to the text’s centre, not onto its advance box', async () => {
  // Regression: a one-curve path and a Text's advance box are both 8 floats, and equal length
  // alone used to make them blend, so the line landed on the box's corners.
  const { Line, Arc, Text: T, Transform: Tr, NullSink } = await import('../src/index.ts');
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -3, max: 3, noNaN: true }), fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -3, max: 3, noNaN: true })),
      fc.string({ unit: 'grapheme', minLength: 1, maxLength: 6 }),
      fc.boolean(),
      async ([x0, y0, x1, y1], text, arc) => {
        const path = arc ? new Arc({ radius: 1, angle: 0.5 }).moveTo([x0, y0]) : new Line([x0, y0], [x1, y1]);
        const target = new T(text, { fontSize: 0.3 }).moveTo([x1, y1]);
        const scene = new Scene(new NullSink());
        scene.add(path);
        await scene.play(new Tr(path, target));
        const c = target.center();
        for (const a of path.pointArrays()) for (let j = 0; j < a.length; j += 2) assert.ok(Math.hypot(a[j]! - c[0], a[j + 1]! - c[1]) < 1e-4);
      },
    ),
    params(),
  );
});
