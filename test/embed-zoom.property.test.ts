// Property tests for the stage zoom arithmetic (app/embed-zoom.ts), in Node.
// The player's StageZoom only reads the stage size and paints; every number it
// paints comes from these pure functions, so their contracts are the zoom's.
// Runs: 1000 per property by default, FULL=1 for 10x. A failure prints its seed
// and path; replay one with FC_SEED=<seed> FC_PATH=<path>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { clampZoom, zoomAt, panBy, zoomTransform, IDENTITY, ZOOM_MAX } from '../app/embed-zoom.ts';
import type { Zoom } from '../app/embed-zoom.ts';

const runs = (n = 1000) => ({
  numRuns: n * (process.env.FULL ? 10 : 1),
  ...(process.env.FC_SEED ? { seed: Number(process.env.FC_SEED) } : {}),
  ...(process.env.FC_PATH ? { path: process.env.FC_PATH } : {}),
});
const EPS = Number.EPSILON;

// Stage sizes are clientWidth/clientHeight: non-negative integers, zero included.
const size = fc.nat();
// The cap is a configuration knob: any finite cap of at least 1 (the player uses 6).
const cap = fc.oneof(fc.constant(ZOOM_MAX), fc.double({ min: 1, max: 1e12, noNaN: true }));
// Hostile numbers: NaN, ±Infinity, ±0, negatives, subnormals and huge magnitudes.
// The special values are also drawn on their own, so a 40-gesture session meets them often.
const any = fc.oneof(fc.double(), fc.constantFrom(NaN, Infinity, -Infinity, 0, -0, -1, Number.MIN_VALUE, Number.MAX_VALUE));
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });

type Op =
  | { op: 'zoom'; factor: number; px: number; py: number }
  | { op: 'pan'; dx: number; dy: number }
  | { op: 'reset' }
  | { op: 'resize'; w: number; h: number };
const opOf = (num: fc.Arbitrary<number>): fc.Arbitrary<Op> =>
  fc.oneof(
    fc.record({ op: fc.constant('zoom' as const), factor: num, px: num, py: num }),
    fc.record({ op: fc.constant('pan' as const), dx: num, dy: num }),
    fc.constant({ op: 'reset' as const }),
    fc.record({ op: fc.constant('resize' as const), w: size, h: size }),
  );
/** What StageZoom does for each gesture: zoom/pan/reset clamp to the current stage, a resize re-clamps. */
function play(ops: Op[], w0: number, h0: number, max: number): { z: Zoom; w: number; h: number } {
  let z: Zoom = clampZoom(IDENTITY, w0, h0, max),
    w = w0,
    h = h0;
  for (const o of ops) {
    if (o.op === 'zoom') z = zoomAt(z, o.factor, o.px, o.py, w, h, max);
    else if (o.op === 'pan') z = panBy(z, o.dx, o.dy, w, h, max);
    else if (o.op === 'reset') z = clampZoom(IDENTITY, w, h, max);
    else {
      w = o.w;
      h = o.h;
      z = clampZoom(z, w, h, max);
    }
  }
  return { z, w, h };
}
const session = (num: fc.Arbitrary<number>) =>
  fc.record({ ops: fc.array(opOf(num), { maxLength: 40 }), w: size, h: size, max: cap });
/** A reachable zoom on a stage: what a reader can leave the player in with ordinary (finite) gestures. */
const reachableWith = (max: fc.Arbitrary<number>) =>
  fc
    .record({ ops: fc.array(opOf(finite), { maxLength: 40 }), w: size, h: size, max })
    .map(({ ops, w, h, max }) => ({ ...play(ops, w, h, max), max }));

test('zoom: after any gesture sequence the drawing covers the stage (no gap at any edge)', () => {
  fc.assert(
    fc.property(session(any), ({ ops, w, h, max }) => {
      const { z, w: W, h: H } = play(ops, w, h, max);
      assert.ok(z.x <= 0 && z.y <= 0, `left/top gap: ${JSON.stringify(z)}`);
      assert.ok(z.x + W * z.k >= W && z.y + H * z.k >= H, `right/bottom gap: ${JSON.stringify({ z, W, H })}`);
    }),
    {
      ...runs(),
      // Ledger Z1 (NaN pan) and Z3 (w - w·k rounding a hair short at large w·k).
      examples: [
        [{ ops: [{ op: 'pan', dx: NaN, dy: 0 }], w: 0, h: 0, max: 1 }],
        [{ ops: [{ op: 'zoom', factor: 617606720.9185677, px: 0, py: 0 }, { op: 'pan', dx: -9007199254741028, dy: NaN }], w: 14584037, h: 0, max: 617606720.9185677 }],
        [{ ops: [{ op: 'zoom', factor: 1.7976931348623157e308, px: 0, py: 14460.999999999998 }], w: 0, h: 14461, max: 983381559425.8154 }],
      ],
    },
  );
});

test('zoom: the scale stays within [1, max] after any gesture sequence', () => {
  fc.assert(
    fc.property(session(any), ({ ops, w, h, max }) => {
      const { z } = play(ops, w, h, max);
      assert.ok(z.k >= 1 && z.k <= max, `k=${z.k} max=${max}`);
    }),
    runs(),
  );
});

test('zoom: hostile numbers (NaN, ±Infinity, 0, negative factors, zero-size stages) never paint a non-finite transform', () => {
  fc.assert(
    fc.property(session(any), ({ ops, w, h, max }) => {
      const { z } = play(ops, w, h, max);
      assert.ok(Number.isFinite(z.k) && Number.isFinite(z.x) && Number.isFinite(z.y), JSON.stringify(z));
      assert.doesNotMatch(zoomTransform(z), /NaN|Infinity/);
    }),
    runs(),
  );
});

// The "unclamped" subset is constructed, not filtered from the full domain: a
// target scale inside [1, max] gives the factor, and the point's drawing
// coordinate after the zoom must land the pan inside the clamp's bounds (the
// meaning of "unclamped"). Tolerance, fixed before any run: a few roundings on
// the magnitudes involved (px, x, and their difference scaled by the ratio).
const fixedPointCase = fc
  .record({ s: reachableWith(cap), target: fc.double({ min: 0, max: 1, noNaN: true }), u: fc.double({ min: -0.5, max: 1.5, noNaN: true }), v: fc.double({ min: -0.5, max: 1.5, noNaN: true }) })
  .map(({ s, target, u, v }) => ({ ...s, k2: 1 + target * (s.max - 1), px: u * s.w, py: v * s.h }));
const inBounds = (pos: number, side: number, k: number) => pos <= 0 && pos >= side - side * k;
// Standard floating-point error model: each of the few operations in one zoom
// adds at most eps/2 of its operands' magnitude, or one subnormal step near zero.
// `err` bounds one zoom's rounding over the magnitudes it touches; the factor 2·eps
// covers the four roundings in px - (px - x)·(k'/k), and 4·MIN_VALUE their
// subnormal floor. A second zoom by ratio r multiplies the first one's error by r.
const err = (...m: number[]) => 2 * EPS * m.reduce((a, b) => a + Math.abs(b), 0) + 4 * Number.MIN_VALUE;

test('zoom: zoomAt keeps the given stage point over the same drawing point when nothing clamps', () => {
  fc.assert(
    fc.property(fixedPointCase, ({ z, w, h, max, k2, px, py }) => {
      const factor = k2 / z.k;
      // The drawing point under (px, py), in drawing units, before the zoom.
      const u = (px - z.x) / z.k,
        v = (py - z.y) / z.k;
      fc.pre(z.k * factor >= 1 && z.k * factor <= max);
      fc.pre(inBounds(px - u * k2, w, k2) && inBounds(py - v * k2, h, k2));
      const after = zoomAt(z, factor, px, py, w, h, max);
      const u2 = (px - after.x) / after.k,
        v2 = (py - after.y) / after.k;
      // Both drawing coordinates are themselves computed (one subtraction, one division each).
      const ex = err(px, z.x, after.x, (px - z.x) * (after.k / z.k)) / after.k + err(u, u2),
        ey = err(py, z.y, after.y, (py - z.y) * (after.k / z.k)) / after.k + err(v, v2);
      assert.ok(Math.abs(u2 - u) <= ex, `x drift ${u2 - u} > ${ex}`);
      assert.ok(Math.abs(v2 - v) <= ey, `y drift ${v2 - v} > ${ey}`);
    }),
    { ...runs(), maxSkipsPerRun: 1000 },
  );
});

test('zoom: zoomAt(f) then zoomAt(1/f) about the same point returns to the start when nothing clamps', () => {
  fc.assert(
    fc.property(fixedPointCase, ({ z, w, h, max, k2, px, py }) => {
      const f = k2 / z.k;
      const u = (px - z.x) / z.k,
        v = (py - z.y) / z.k;
      fc.pre(z.k * f >= 1 && z.k * f <= max);
      fc.pre(inBounds(px - u * k2, w, k2) && inBounds(py - v * k2, h, k2));
      const there = zoomAt(z, f, px, py, w, h, max);
      fc.pre(there.k / f >= 1 && there.k / f <= max);
      const back = zoomAt(there, 1 / f, px, py, w, h, max);
      // k: k·f, 1/f and their product, three roundings.
      assert.ok(Math.abs(back.k - z.k) <= 2 * EPS * z.k, `k ${z.k} -> ${back.k}`);
      const r1 = there.k / z.k,
        r2 = back.k / there.k;
      const ex = err(px, there.x, (px - z.x) * r1) * r2 + err(px, back.x, (px - there.x) * r2),
        ey = err(py, there.y, (py - z.y) * r1) * r2 + err(py, back.y, (py - there.y) * r2);
      assert.ok(Math.abs(back.x - z.x) <= ex, `x ${z.x} -> ${back.x} (> ${ex})`);
      assert.ok(Math.abs(back.y - z.y) <= ey, `y ${z.y} -> ${back.y} (> ${ey})`);
    }),
    { ...runs(), maxSkipsPerRun: 1000 },
  );
});

test('zoom: reset from any state and any stage is exactly the identity, painted as no transform', () => {
  fc.assert(
    fc.property(size, size, cap, (w, h, max) => {
      const z = clampZoom(IDENTITY, w, h, max);
      assert.ok(z.k === 1 && z.x === 0 && z.y === 0, JSON.stringify(z));
      assert.equal(zoomTransform(z), '');
    }),
    runs(),
  );
});

test('zoom: zooming all the way out (any factor at or below 1/k) is exactly the identity, whatever the pan was', () => {
  fc.assert(
    fc.property(reachableWith(cap), fc.double({ min: 0, max: 1, noNaN: true }), finite, finite, ({ z, w, h, max }, t, px, py) => {
      const out = zoomAt(z, t / z.k, px, py, w, h, max);
      assert.ok(out.k === 1 && out.x === 0 && out.y === 0, JSON.stringify(out));
      assert.equal(zoomTransform(out), '');
    }),
    runs(),
  );
});

test('zoom: zooming by a factor of exactly 1 leaves any reachable state unchanged', () => {
  fc.assert(
    fc.property(reachableWith(cap), finite, finite, ({ z, w, h, max }, px, py) => {
      const after = zoomAt(z, 1, px, py, w, h, max);
      assert.ok(after.k === z.k && after.x === z.x && after.y === z.y, `${JSON.stringify(z)} -> ${JSON.stringify(after)}`);
    }),
    runs(),
  );
});

test('zoom: zooming further in at the cap leaves the view unchanged', () => {
  fc.assert(
    fc.property(reachableWith(cap), fc.double({ min: 1, noNaN: true }), finite, finite, ({ z, w, h, max }, factor, px, py) => {
      const atCap = zoomAt(z, Infinity, w / 2, h / 2, w, h, max);
      fc.pre(atCap.k === max);
      const after = zoomAt(atCap, factor, px, py, w, h, max);
      assert.ok(after.k === atCap.k && after.x === atCap.x && after.y === atCap.y, `${JSON.stringify(atCap)} -> ${JSON.stringify(after)}`);
    }),
    runs(),
  );
});

test('zoom: panning by (0, 0) leaves any reachable state unchanged', () => {
  fc.assert(
    fc.property(reachableWith(cap), ({ z, w, h, max }) => {
      const still = panBy(z, 0, 0, w, h, max);
      assert.ok(still.k === z.k && still.x === z.x && still.y === z.y, JSON.stringify({ z, still }));
    }),
    runs(),
  );
});

test('zoom: a pan by any amount never changes the scale', () => {
  fc.assert(
    fc.property(reachableWith(cap), any, any, ({ z, w, h, max }, dx, dy) => {
      assert.equal(panBy(z, dx, dy, w, h, max).k, z.k);
    }),
    runs(),
  );
});

// Regression (ledger Z1): NaN deltas and points at infinity used to paint translate(NaNpx, …).
test('zoom: a NaN factor or a point at infinity leaves the view exactly unchanged', () => {
  const hostilePoint = fc.oneof(finite, fc.constantFrom(NaN, Infinity, -Infinity));
  fc.assert(
    fc.property(reachableWith(cap), any, hostilePoint, hostilePoint, ({ z, w, h, max }, f, px, py) => {
      fc.pre(Number.isNaN(f) || !Number.isFinite(px) || !Number.isFinite(py));
      const after = zoomAt(z, f, px, py, w, h, max);
      assert.ok(after.k === z.k && after.x === z.x && after.y === z.y, `${JSON.stringify(z)} -> ${JSON.stringify(after)}`);
    }),
    { ...runs(), maxSkipsPerRun: 100 },
  );
});

test('zoom: a NaN pan delta leaves that axis exactly where it was', () => {
  fc.assert(
    fc.property(reachableWith(cap), any, ({ z, w, h, max }, dy) => {
      const after = panBy(z, NaN, dy, w, h, max);
      assert.equal(after.x, z.x);
    }),
    runs(),
  );
});

test('zoom: the painted transform reads back as exactly the zoom it paints', () => {
  fc.assert(
    fc.property(reachableWith(cap), ({ z }) => {
      const t = zoomTransform(z);
      if (z.k === 1) return assert.equal(t, '');
      const m = t.match(/^translate\((\S+)px, (\S+)px\) scale\((\S+)\)$/);
      assert.ok(m, t);
      assert.ok(Number(m[1]) === z.x && Number(m[2]) === z.y && Number(m[3]) === z.k, t);
    }),
    runs(),
  );
});

test('zoom: clamping is idempotent (re-clamping on a resize to the same size changes nothing)', () => {
  fc.assert(
    fc.property(session(any), ({ ops, w, h, max }) => {
      const { z, w: W, h: H } = play(ops, w, h, max);
      const again = clampZoom(z, W, H, max);
      assert.ok(again.k === z.k && again.x === z.x && again.y === z.y, JSON.stringify({ z, again }));
    }),
    runs(),
  );
});

test('zoom: scale probe, 200 000 gestures on a large stage stay covered, bounded and fast', () => {
  const r = fc.sample(opOf(finite), { numRuns: 200_000, seed: 42 });
  const t = performance.now();
  const { z, w, h } = play(r, 1e6, 5e5, ZOOM_MAX);
  assert.ok(performance.now() - t < 2000);
  assert.ok(z.k >= 1 && z.k <= ZOOM_MAX && z.x <= 0 && z.y <= 0 && z.x + w * z.k >= w && z.y + h * z.k >= h, JSON.stringify(z));
});

// ---------------------------------------------------------------------------
// StageZoom itself, on a fake stage: the gestures, the paint and the callback.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  disconnect() {}
};
const { StageZoom } = await import('../app/embed-zoom.ts');
type Handler = (e: Record<string, unknown>) => void;
function fakeStage(w: number, h: number) {
  const handlers: Record<string, Handler[]> = {};
  const svg = { classList: { toggle() {} }, style: { transform: '', transformOrigin: '' } };
  const classes = new Set<string>();
  const stage = {
    clientWidth: w,
    clientHeight: h,
    addEventListener(name: string, f: Handler) {
      (handlers[name] ??= []).push(f);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    querySelector: () => svg,
    classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
    setPointerCapture() {},
  };
  const fire = (name: string, e: Record<string, unknown>) => {
    for (const f of handlers[name] ?? []) f({ preventDefault() {}, ...e });
  };
  return { stage: stage as unknown as HTMLElement, svg, classes, fire };
}
type Gesture =
  | { kind: 'down' | 'move'; id: number; x: number; y: number }
  | { kind: 'up' | 'cancel' | 'lost'; id: number }
  | { kind: 'wheel'; ctrl: boolean; dy: number; x: number; y: number }
  | { kind: 'dblclick'; x: number; y: number }
  | { kind: 'zoomIn' | 'zoomOut' | 'reset' | 'apply' };
const coord = fc.oneof(fc.double({ min: -2000, max: 4000, noNaN: true }), finite);
const pointerId = fc.integer({ min: 1, max: 4 });
const gesture: fc.Arbitrary<Gesture> = fc.oneof(
  fc.record({ kind: fc.constantFrom('down' as const, 'move' as const), id: pointerId, x: coord, y: coord }),
  fc.record({ kind: fc.constantFrom('up' as const, 'cancel' as const, 'lost' as const), id: pointerId }),
  fc.record({ kind: fc.constant('wheel' as const), ctrl: fc.boolean(), dy: fc.oneof(finite, fc.integer({ min: -1000, max: 1000 })), x: coord, y: coord }),
  fc.record({ kind: fc.constant('dblclick' as const), x: coord, y: coord }),
  fc.record({ kind: fc.constantFrom('zoomIn' as const, 'zoomOut' as const, 'reset' as const, 'apply' as const) }),
);
function perform(z: InstanceType<typeof StageZoom>, fire: (n: string, e: Record<string, unknown>) => void, g: Gesture, down: Set<number>) {
  if (g.kind === 'down' || g.kind === 'move') {
    if (g.kind === 'down') down.add(g.id);
    fire(g.kind === 'down' ? 'pointerdown' : 'pointermove', { pointerId: g.id, clientX: g.x, clientY: g.y });
  } else if (g.kind === 'up' || g.kind === 'cancel' || g.kind === 'lost') {
    down.delete(g.id);
    fire({ up: 'pointerup', cancel: 'pointercancel', lost: 'lostpointercapture' }[g.kind], { pointerId: g.id });
  } else if (g.kind === 'wheel') fire('wheel', { ctrlKey: g.ctrl, deltaY: g.dy, clientX: g.x, clientY: g.y });
  else if (g.kind === 'dblclick') fire('dblclick', { clientX: g.x, clientY: g.y });
  else if (g.kind === 'zoomIn') z.zoomAt(1.6, undefined, undefined, true);
  else if (g.kind === 'zoomOut') z.zoomAt(1 / 1.6, undefined, undefined, true);
  else if (g.kind === 'reset') z.reset(true);
  else z.apply();
}
const gestures = fc.record({ list: fc.array(gesture, { maxLength: 60 }), w: size, h: size });

test('StageZoom: after any pointer, wheel, double-click and button sequence the stage is covered, finite and within [1, 6]', () => {
  fc.assert(
    fc.property(gestures, ({ list, w, h }) => {
      const { stage, fire } = fakeStage(w, h);
      const z = new StageZoom(stage, () => {});
      const down = new Set<number>();
      for (const g of list) perform(z, fire, g, down);
      assert.ok(Number.isFinite(z.k) && Number.isFinite(z.x) && Number.isFinite(z.y), JSON.stringify(z));
      assert.ok(z.k >= 1 && z.k <= 6 && z.x <= 0 && z.y <= 0 && z.x + w * z.k >= w && z.y + h * z.k >= h, JSON.stringify({ k: z.k, x: z.x, y: z.y, w, h }));
    }),
    runs(),
  );
});

test('StageZoom: what it paints, the zoomed class and the callback always describe its current zoom', () => {
  fc.assert(
    fc.property(gestures, ({ list, w, h }) => {
      const { stage, svg, classes, fire } = fakeStage(w, h);
      let seen: { k: number; x: number; y: number } | null = null;
      const z: InstanceType<typeof StageZoom> = new StageZoom(stage, () => (seen = { k: z.k, x: z.x, y: z.y }));
      const down = new Set<number>();
      for (const g of list) {
        perform(z, fire, g, down);
        if (seen === null) continue; // nothing has been applied yet
        assert.deepEqual(seen, { k: z.k, x: z.x, y: z.y }, 'the callback saw the final state');
        assert.equal(svg.style.transform, zoomTransform(z));
        assert.equal(classes.has('zoomed'), z.k > 1);
      }
    }),
    runs(),
  );
});

// Regression (ledger Z4): pointers 1, 2 down (pinch 100), 3 down, 1 up: the pair 2–3 is 400
// apart but the stale 100 made a motionless move zoom from 1 to 5.
test('StageZoom: a motionless move while exactly two pointers are down never changes the zoom, whatever pointers came and went before', () => {
  fc.assert(
    fc.property(gestures, fc.tuple(coord, coord, coord, coord), ({ list, w, h }, [ax, ay, bx, by]) => {
      const { stage, fire } = fakeStage(w, h);
      const z = new StageZoom(stage, () => {});
      const down = new Set<number>();
      for (const g of list) perform(z, fire, g, down);
      // Bring the set of fingers to exactly two by ordinary gestures: lift extras, add new ones.
      for (const id of [...down].slice(2)) perform(z, fire, { kind: 'up', id }, down);
      const fresh = [10, 11];
      if (down.size < 2) perform(z, fire, { kind: 'down', id: fresh[0]!, x: ax, y: ay }, down);
      if (down.size < 2) perform(z, fire, { kind: 'down', id: fresh[1]!, x: bx, y: by }, down);
      const before = { k: z.k, x: z.x, y: z.y };
      // Where is one of the two? Move it to exactly where it is.
      const id = [...down][0]!;
      const last = list.filter((g): g is Extract<Gesture, { kind: 'down' | 'move' }> => (g.kind === 'down' || g.kind === 'move') && g.id === id).at(-1);
      const at = fresh.includes(id) ? (id === fresh[0] ? { x: ax, y: ay } : { x: bx, y: by }) : { x: last!.x, y: last!.y };
      perform(z, fire, { kind: 'move', id, ...at }, down);
      assert.deepEqual({ k: z.k, x: z.x, y: z.y }, before);
    }),
    runs(),
  );
});
