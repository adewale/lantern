import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Rectangle, Square, VMobject, Line, Arrow, Text, Dot, Transform, AnimationGroup, FadeIn, linear, thereAndBack,
  Scene, NullSink, toSvgString, UP, DOWN, UR, rotate,
  loadFonts,
} from '../src/index.ts';

// Text shapes on glyph outlines; scenes load fonts in run(), bare tests do it here
await loadFonts();

test('SVG output: a fixed 16 x 9 frame at 1000 units per scene unit, sized to the width asked for, text drawn as outlines', () => {
  const scene = new Scene(new NullSink());
  scene.add(new Text('handler', { fontSize: 0.4 }), new Arrow([-4, 0], [-1.5, 0]));
  const svg = toSvgString(scene, { width: 320 });
  assert.match(svg, /^<svg[^>]* width="320" height="180" viewBox="-8000 -4500 16000 9000"/);
  assert.ok(!svg.includes('<text'), 'text is outlines, not <text>: a page needs no font');
  // the arrow's line and tip, and one outline per glyph
  assert.equal((svg.match(/<path/g) || []).length, 2 + 'handler'.length);
});

test('y is up in the model and flipped once, in path data; angles turn counterclockwise', () => {
  assert.deepEqual(UP, [0, 1]); assert.deepEqual(DOWN, [0, -1]); assert.deepEqual(UR, [1, 1]);
  const q = rotate([1, 0], Math.PI / 2);
  assert.ok(Math.abs(q[0]) < 1e-12 && Math.abs(q[1] - 1) < 1e-12, 'a quarter turn takes +x to +y');
  const r = new Rectangle({ width: 2, height: 2 }).shift(UP);
  assert.deepEqual(r.center(), [0, 1]);
  assert.ok(r.top()[1] > r.bottom()[1], 'top() is the larger y');
  const d = new Line([0, 0], [0, 1]).toPathD();
  assert.match(d, /^M0 0C0 -333 0 -667 0 -1000$/, 'y = 1 is written as SVG y = -1000 (above center)');
});

test('ArcBetweenPoints hits both endpoints and bulges to the signed side', async () => {
  const { ArcBetweenPoints } = await import('../src/index.ts');
  const a = new ArcBetweenPoints([0, 0], [2, 0], { angle: Math.PI / 2 });
  const end = a.pointFromProportion(1), mid = a.pointFromProportion(0.5);
  assert.ok(Math.hypot(end[0] - 2, end[1]) < 1e-5);
  assert.ok(Math.abs(mid[0] - 1) < 1e-5 && Math.abs(mid[1] + (Math.SQRT2 - 1)) < 1e-5);
  const b = new ArcBetweenPoints([0, 0], [2, 0], { angle: -Math.PI / 2 });
  assert.ok(b.pointFromProportion(0.5)[1] > 0, 'negative angle bulges the other way');
});

test('DecimalNumber blends its value through Transform', async () => {
  const { DecimalNumber } = await import('../src/index.ts');
  const seen: string[] = [];
  const n = new DecimalNumber(0, { decimals: 1, suffix: 's' });
  const scene = new Scene({ frame: async () => { seen.push(n.text); } }, { fps: 10 });
  scene.add(n);
  await scene.play(new Transform(n, n.copy().setValue(2.5)), { runTime: 0.5 });
  assert.equal(n.text, '2.5s');
  assert.ok(seen.some((t) => /^1\.\ds$/.test(t)), `an intermediate value was rendered: ${seen}`);
});

test('a copied Arrow owns its line and tip (no reference back to the original)', () => {
  const a = new Arrow([0, 0], [1, 0]);
  const c = a.copy();
  assert.equal(c.line, c.children[0]);
  assert.notEqual(c.line, a.line);
  c.putStartAndEndOn([0, 0], [0, 5]);
  assert.deepEqual(a.line.end().map((v) => +v.toFixed(3)), [0.7, 0], 'the original did not move');
});

test('a nested AnimationGroup adds every leaf mobject to the scene', async () => {
  const scene = new Scene(new NullSink(), { fps: 4 });
  const a = new Dot(), b = new Dot().shift([2, 0]);
  await scene.play(new AnimationGroup([new AnimationGroup([new FadeIn(a)], { rateFunc: linear }), new FadeIn(b)], { rateFunc: linear }));
  assert.deepEqual(scene.mobjects, [a, b]);
  assert.equal(a.style.opacity, 1);
});

test('Transform adds and removes optional SVG paint at exact endpoints, there-and-back included', async () => {
  const scene = new Scene(new NullSink(), { fps: 30 });
  const mark = new Dot(),
    styled = mark.copy().setStyle({ lineCap: 'butt', lineJoin: 'miter', dashArray: '0.1 0.2', dashOffset: 0.05, fillRule: 'evenodd' });
  await scene.play(new Transform(mark, styled));
  assert.deepEqual(mark.style, styled.style);
  const native = new Dot(), returnToStart = mark.copy();
  await scene.play(new Transform(mark, native, { rateFunc: thereAndBack }));
  assert.deepEqual(mark.style, returnToStart.style);
  await scene.play(new Transform(mark, native));
  assert.deepEqual(mark.style, native.style);
});

test('alignData pads a path at its centre as the points stand, whether or not its box was cached', () => {
  // A path with no subpaths of its own whose shape sits in a child (alignFamily leaves a path so
  // after a Transform into a container) is padded to a two-subpath target. The first pad sits on the
  // target's first point; the second at the centre of the path with that pad. A box cached before
  // alignment (any layout call does it) used to give the second pad the old centre instead, so a
  // property test found frames that differed with and without a box() call (random-scene tape).
  const build = () => {
    const holder = new VMobject();
    holder.add(new Square({ side: 1 }).moveTo([-4, 0]));
    const target = new VMobject();
    target.startNewPath([4, 2]).addLineTo([5, 2]);
    target.startNewPath([4, -2]).addLineTo([5, -2]);
    return { holder, target };
  };
  const fresh = build(), cached = build();
  cached.holder.box();
  fresh.holder.alignData(fresh.target);
  cached.holder.alignData(cached.target);
  assert.deepEqual(cached.holder.subpaths.map((a) => Array.from(a)), fresh.holder.subpaths.map((a) => Array.from(a)));
  // The second pad is at the centre of the child square (-4.5..-3.5, -0.5..0.5) and the first pad
  // (4, 2), not at the square's own centre (-4, 0).
  assert.deepEqual(Array.from(fresh.holder.subpaths[0]!.slice(0, 2)), [4, 2]);
  assert.deepEqual(Array.from(fresh.holder.subpaths[1]!.slice(0, 2)), [-0.25, 0.75]);
});
