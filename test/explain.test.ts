import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Scene,
  NullSink,
  Dot,
  FadeIn,
  FadeOut,
  AnimationGroup,
  linear,
  Transform,
  thereAndBack,
} from '../src/index.ts';

test('nested AnimationGroup adds every leaf mobject to the scene', async () => {
  const scene = new Scene(new NullSink(), { fps: 4 });
  const a = new Dot(),
    b = new Dot().shift([2, 0]);
  await scene.play(
    new AnimationGroup([new AnimationGroup([new FadeIn(a)], { rateFunc: linear }), new FadeIn(b)], {
      rateFunc: linear,
    }),
  );
  assert.deepEqual(scene.mobjects, [a, b]);
  assert.equal(a.style.opacity, 1);
});

test('FadeOut preserves authored opacity when artwork is shown again', async () => {
  const scene = new Scene(new NullSink(), { fps: 30 });
  const mark = new Dot().setOpacity(0.14);
  await scene.play(new FadeIn(mark));
  await scene.play(new FadeOut(mark));
  assert.equal(mark.style.opacity, 0.14);
  assert.ok(!scene.mobjects.includes(mark));
  await scene.play(new FadeIn(mark));
  assert.equal(mark.style.opacity, 0.14);
});

test('Transform adds and removes optional SVG paint at exact endpoints without NaN', async () => {
  const scene = new Scene(new NullSink(), { fps: 30 });
  const mark = new Dot(),
    styled = mark.copy().setStyle({
      lineCap: 'butt',
      lineJoin: 'miter',
      dashArray: '0.1 0.2',
      dashOffset: 0.05,
      fillRule: 'evenodd',
    });
  await scene.play(new Transform(mark, styled));
  assert.deepEqual(mark.style, styled.style);
  const native = new Dot();
  const returnToStart = mark.copy();
  await scene.play(new Transform(mark, native, { rateFunc: thereAndBack }));
  assert.deepEqual(mark.style, returnToStart.style);
  await scene.play(new Transform(mark, native));
  assert.deepEqual(mark.style, native.style);
});
