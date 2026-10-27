// Property tests for the close-ups a narrow stage opens each step on (app/embed-closeup.ts),
// in Node. The player and `rayner check` both take their phone view from these functions,
// so these contracts are what a phone reader gets: every label near a step's changes at
// 12 px or more, and every change reachable by the overview's tour, with no panning.
// Counts: test/lib/pbt.ts (FULL=1 is 10x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fc, params } from './lib/pbt.ts';
import { Group, Rectangle, Scene, Text } from '../src/index.ts';
import { stage } from '../explain/index.ts';
import { cardRow, explainer, restingBox, wordsOutsideCards } from './lib/scenes.ts';
import type { Box } from '../src/index.ts';
import { clampZoom, ZOOM_MAX } from '../app/embed-zoom.ts';
import {
  NARROW_PX,
  partsOf,
  READ_PX,
  closeUp,
  closeUps,
  focusOf,
  labelsToRead,
  stageScale,
  stepLayouts,
  stressStarts,
  viewBox,
} from '../app/embed-closeup.ts';
import type { StepLayout } from '../app/embed-closeup.ts';

/** A box inside the 16 × 9 frame, at least `min` units on a side. */
const boxIn = (min = 0) =>
  fc
    .tuple(
      fc.double({ min: -8, max: 8 - min, noNaN: true }),
      fc.double({ min: -4.5, max: 4.5 - min, noNaN: true }),
      fc.double({ min, max: 16, noNaN: true }),
      fc.double({ min, max: 9, noNaN: true }),
    )
    .map(([x, y, w, h]): Box => [x, y, Math.min(8, x + w), Math.min(4.5, y + h)]);
const layoutArb: fc.Arbitrary<StepLayout> = fc.array(boxIn(), { minLength: 1, maxLength: 6 }).chain((parts) =>
  fc.record(
    {
      parts: fc.constant(parts),
      lead: fc.nat({ max: parts.length - 1 }),
      labels: fc.array(fc.record({ box: boxIn(), size: fc.double({ min: 0.05, max: 0.8, noNaN: true }) }), { maxLength: 12 }),
      // What the step emphasised: often nothing, else a few boxes, some inside a part.
      stress: fc.array(fc.oneof(boxIn(), fc.constantFrom(...parts)), { maxLength: 4 }),
    },
    { requiredKeys: ['parts', 'lead', 'labels'] },
  ),
);
const holds = (v: Box, [x, y]: readonly [number, number]) => x >= v[0] - 1e-6 && x <= v[2] + 1e-6 && y >= v[1] - 1e-6 && y <= v[3] + 1e-6;
/** A stage: a phone's or a laptop's, mostly 16:9 as the player's is, sometimes not. */
const stageArb = fc.oneof(
  fc.integer({ min: 120, max: 1600 }).map((w) => ({ w, h: Math.round((w * 9) / 16) })),
  fc.record({ w: fc.integer({ min: 120, max: 1600 }), h: fc.integer({ min: 60, max: 1200 }) }),
);

test('a stage NARROW_PX wide or wider keeps the whole picture: one close-up, the identity', () => {
  fc.assert(
    fc.property(layoutArb, fc.integer({ min: NARROW_PX, max: 4000 }), fc.integer({ min: 1, max: 3000 }), (layout, w, h) => {
      assert.deepEqual(closeUps(layout, w, h), [{ k: 1, x: 0, y: 0 }]);
    }),
    params(300),
  );
});

test('every close-up of a step is clamped (the drawing covers the stage) and they share one scale in [1, max]', () => {
  fc.assert(
    fc.property(layoutArb, stageArb, (layout, { w, h }) => {
      const tour = closeUps(layout, w, h);
      assert.ok(tour.length >= 1);
      for (const z of tour) {
        assert.deepEqual(clampZoom(z, w, h), z);
        assert.equal(z.k, tour[0]!.k);
        assert.ok(z.k >= 1 && z.k <= ZOOM_MAX);
      }
      assert.deepEqual(closeUp(layout, w, h), tour[0]);
    }),
    params(500),
  );
});

test('on a narrow stage every label near the changes reads at READ_PX whenever the zoom cap allows, by the least zoom that does it', () => {
  fc.assert(
    fc.property(layoutArb, stageArb, (layout, { w, h }) => {
      fc.pre(w < NARROW_PX);
      const { k } = closeUp(layout, w, h),
        { s } = stageScale(w, h),
        read = labelsToRead(layout);
      if (!read.length) return void assert.equal(k, 1);
      const drawn = read.map((l) => l.size * s * k);
      // No nearby label under READ_PX after the close-up when the cap leaves room to reach it.
      const possible = READ_PX / (Math.min(...read.map((l) => l.size)) * s) <= ZOOM_MAX;
      if (possible) for (const px of drawn) assert.ok(px >= READ_PX - 1e-9, `${px} px at k=${k}`);
      // Least: no zoom at all, the cap, or the smallest label lands exactly on READ_PX.
      assert.ok(k === 1 || k === ZOOM_MAX || Math.abs(Math.min(...drawn) - READ_PX) < 1e-9, `k=${k} is more than reading needs`);
    }),
    params(500),
  );
});

test('a label a few percent under READ_PX is enlarged, not left on the whole picture', () => {
  // A phone's stage, 358 × 201: a 0.5-unit label draws at 11.2 px and needs 1.07×.
  const [w, h] = [358, 201],
    { s } = stageScale(w, h);
  for (const size of [0.488, 0.5, 0.536]) {
    const layout: StepLayout = { parts: [[-1, -0.5, 1, 0.5]], lead: 0, labels: [{ box: [-0.8, -0.2, 0.8, 0.2], size }] };
    const { k } = closeUp(layout, w, h);
    assert.ok(k > 1, `${size}: k=${k}`);
    assert.ok(size * s * k >= READ_PX - 1e-9, `${size}: ${size * s * k} px`);
  }
  // One already at READ_PX keeps the whole picture.
  const read: StepLayout = { parts: [[-1, -0.5, 1, 0.5]], lead: 0, labels: [{ box: [-0.8, -0.2, 0.8, 0.2], size: READ_PX / s }] };
  assert.deepEqual(closeUps(read, w, h), [{ k: 1, x: 0, y: 0 }]);
});

test('the tour of close-ups covers every changed part: each point of a change is inside some close-up', () => {
  fc.assert(
    fc.property(layoutArb, stageArb, (layout, { w, h }) => {
      const views = closeUps(layout, w, h).map((z) => viewBox(z, w, h));
      // A view's edge may round by a hair of a unit; compare with that slack.
      const slack = 1e-6;
      for (const p of layout.parts)
        for (const fx of [0, 0.25, 0.5, 0.75, 1])
          for (const fy of [0, 0.25, 0.5, 0.75, 1]) {
            const x = p[0] + fx * (p[2] - p[0]),
              y = p[1] + fy * (p[3] - p[1]);
            assert.ok(
              views.some((v) => x >= v[0] - slack && x <= v[2] + slack && y >= v[1] - slack && y <= v[3] + slack),
              `(${x}, ${y}) of part ${JSON.stringify(p)} is in no close-up: ${JSON.stringify(views)}`,
            );
          }
    }),
    params(500),
  );
});

test('a part padded to exactly one view wide gets one view, not none', () => {
  // fast-check found it: the padding makes the span a rounding wider than the view, which split it into one view over 0.
  const layout: StepLayout = { parts: [[0, 0, 2.4018880411591708, 0], [0, 0, 0, 0]], lead: 0, labels: [{ box: [0, 0, 0, 0], size: 0.05 }] };
  const tour = closeUps(layout, 120, 66);
  for (const z of tour) assert.ok(Number.isFinite(z.x) && Number.isFinite(z.y), JSON.stringify(z));
  const views = tour.map((z) => viewBox(z, 120, 66));
  assert.ok(views.some((v) => v[0] <= 1e-6 && v[2] >= 2.4018880411591708 - 1e-6), JSON.stringify(views));
});

test('a step opens on its lead part: whole when it fits the view, else from its top-left corner', () => {
  fc.assert(
    fc.property(layoutArb, stageArb, (layout, { w, h }) => {
      fc.pre(w < NARROW_PX);
      const z = closeUp(layout, w, h);
      fc.pre(z.k > 1);
      const v = viewBox(z, w, h),
        first = layout.parts[layout.lead]!,
        slack = 1e-6;
      const fits = first[2] - first[0] <= v[2] - v[0] && first[3] - first[1] <= v[3] - v[1];
      const corners: [number, number][] = fits
        ? [[first[0], first[1]], [first[2], first[3]]]
        : [[first[0], first[3]]];
      for (const [x, y] of corners)
        assert.ok(x >= v[0] - slack && x <= v[2] + slack && y >= v[1] - slack && y <= v[3] + slack, `${x},${y} not in ${v}`);
    }),
    params(500),
  );
});

test('changes merge into parts in reading order, and the part with the most changed lettering leads', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ box: boxIn(), text: fc.boolean() }), { minLength: 1, maxLength: 10 }),
      (changes) => {
        const { parts, lead } = partsOf(changes);
        // Every change lies in exactly one part, and the parts keep apart.
        for (const c of changes) {
          const holding = parts.filter((p) => p[0] <= c.box[0] && p[1] <= c.box[1] && p[2] >= c.box[2] && p[3] >= c.box[3]);
          assert.ok(holding.length >= 1);
        }
        const lettering = parts.map(
          (p) => changes.filter((c) => c.text && p[0] <= c.box[0] && p[1] <= c.box[1] && p[2] >= c.box[2] && p[3] >= c.box[3]).length,
        );
        // Parts are disjoint, so a change inside one is counted there alone.
        assert.equal(lettering.reduce((a, b) => a + b, 0), changes.filter((c) => c.text).length);
        assert.equal(lettering[lead], Math.max(...lettering));
        assert.equal(lead, lettering.indexOf(Math.max(...lettering)), 'ties go to the earlier part in reading order');
      },
    ),
    params(500),
  );
});

/** A scene of `n` rectangles in one group; the second step recolours `marked` and dims `dimmed`. */
function sceneOf(rects: Box[], marked: Set<number>, dimmed: Set<number>, labelled: boolean) {
  return class extends Scene {
    override async construct() {
      const shapes = rects.map(
        (b) =>
          new Rectangle({ width: b[2] - b[0], height: b[3] - b[1], fill: '#336699', stroke: '#000000' }).moveTo([
            (b[0] + b[2]) / 2,
            (b[1] + b[3]) / 2,
          ]),
      );
      const group = new Group(...shapes);
      await this.step('first');
      this.add(group);
      // A label of its own, outside the group: not dimmed, so not part of what a dim points at.
      if (labelled) this.add(new Text('a label', { fontSize: 0.25 }).moveTo([0, -4]));
      await this.wait(0.1);
      await this.step('second');
      shapes.forEach((s, i) => {
        if (marked.has(i)) s.setFill('#cc3300');
        if (dimmed.has(i)) s.setStyle({ opacity: 0.3 });
      });
      await this.wait(0.1);
    }
  };
}
const union = (boxes: Box[]): Box | null =>
  boxes.reduce<Box | null>(
    (a, b) => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : [...b]),
    null,
  );
const near = (a: Box | null, b: Box | null) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]!) < 1e-3);

test('a step changes where it recolours; a step that only dims points at what it left bright', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(boxIn(0.1), { minLength: 1, maxLength: 6 }).chain((rects) =>
        fc.record({
          rects: fc.constant(rects),
          roles: fc.array(fc.constantFrom('mark', 'dim', 'none'), { minLength: rects.length, maxLength: rects.length }),
          labelled: fc.boolean(),
        }),
      ),
      async ({ rects, roles, labelled }) => {
        const marked = new Set(roles.flatMap((r, i) => (r === 'mark' ? [i] : []))),
          dimmed = new Set(roles.flatMap((r, i) => (r === 'dim' ? [i] : [])));
        const layouts = await stepLayouts(sceneOf(rects, marked, dimmed, labelled));
        const first = layouts.get('first')!,
          second = layouts.get('second')!;
        // The first step brings everything in, so all of it changed.
        assert.ok(first.parts.length >= 1);
        for (const r of rects) assert.ok(first.parts.some((p) => p[0] <= r[0] + 1e-3 && p[2] >= r[2] - 1e-3 && p[1] <= r[1] + 1e-3 && p[3] >= r[3] - 1e-3));
        const pick = (keep: (i: number) => boolean) => rects.filter((_, i) => keep(i));
        const expected = marked.size
          ? union(pick((i) => marked.has(i)))
          : dimmed.size && dimmed.size < rects.length
            ? union(pick((i) => !dimmed.has(i)))
            : null;
        if (expected) assert.ok(near(focusOf(second), expected), `${JSON.stringify(focusOf(second))} != ${JSON.stringify(expected)}`);
        // Parts never touch: any two are more than the merging gap apart.
        for (const [i, a] of second.parts.entries())
          for (const b of second.parts.slice(i + 1))
            assert.ok(a[0] - 0.5 > b[2] || b[0] - 0.5 > a[2] || a[1] - 0.5 > b[3] || b[1] - 0.5 > a[3]);
        assert.equal(second.labels.length, labelled ? 1 : 0);
      },
    ),
    params(60),
  );
});

test('emphasis orders the tour and changes nothing else: the same close-ups, the same first one', () => {
  fc.assert(
    fc.property(layoutArb, stageArb, (layout, { w, h }) => {
      const tour = closeUps(layout, w, h),
        plain = closeUps({ ...layout, stress: undefined }, w, h);
      assert.deepEqual(tour[0], plain[0]);
      const key = (z: { k: number; x: number; y: number }) => `${z.k.toFixed(6)} ${z.x.toFixed(4)} ${z.y.toFixed(4)}`;
      assert.deepEqual(tour.map(key).sort(), plain.map(key).sort());
    }),
    params(500),
  );
});

test('where emphasis starts is a point of an emphasised box inside a part, and every emphasised box with area in a part has one there', () => {
  fc.assert(
    fc.property(layoutArb, (layout) => {
      const starts = stressStarts(layout);
      for (const pt of starts) {
        assert.ok((layout.stress ?? []).some((s) => holds(s, pt)), `${pt} is in no emphasised box`);
        assert.ok(layout.parts.some((p) => holds(p, pt)), `${pt} is in no part`);
      }
      // A box sharing area with a part starts there: at the top-left of what they share.
      for (const s of layout.stress ?? [])
        for (const p of layout.parts) {
          const shared: Box = [Math.max(s[0], p[0]), Math.max(s[1], p[1]), Math.min(s[2], p[2]), Math.min(s[3], p[3])];
          if (shared[2] - shared[0] > 1e-3 && shared[3] - shared[1] > 1e-3)
            assert.ok(starts.some(([x, y]) => Math.abs(x - shared[0]) < 1e-9 && Math.abs(y - shared[3]) < 1e-9), JSON.stringify({ s, p }));
        }
    }),
    params(500),
  );
});

test('after the first close-up, every close-up that shows where an emphasised thing starts comes before any that does not', () => {
  fc.assert(
    fc.property(layoutArb, stageArb, (layout, { w, h }) => {
      const marks = stressStarts(layout);
      const shows = closeUps(layout, w, h)
        .slice(1)
        .map((z) => marks.some((m) => holds(viewBox(z, w, h), m)));
      // Once a close-up shows no emphasis, none after it does.
      assert.ok(shows.indexOf(false) < 0 || !shows.slice(shows.indexOf(false)).includes(true), JSON.stringify(shows));
    }),
    params(500),
  );
});

test('a step records what it emphasised with the helpers, and only that step', async () => {
  class Marks extends Scene {
    override async construct() {
      const s = stage(this, { heading: false });
      await this.step('card');
      const card = await s.card([['first', 1], ['second', 2], ['third', 3]], { at: [4, -2] });
      await card.mark('third');
      await this.step('code');
      const code = await s.code(['let a = 1;', 'let b = 2;'], { at: [-4, 2] });
      await code.focus(1);
      await this.step('quiet');
      await card.set({ first: 10 });
      await this.step('unlit');
      await card.mark('first');
      await card.mark(null);
      await this.step('moved');
      await code.focus(0);
    }
  }
  const layouts = await stepLayouts(Marks);
  // Each emphasised box is the lit bar: inside its card, a row high.
  const [card] = layouts.get('card')!.stress!;
  assert.ok(card && card[0] > 2 && card[1] < -2 && card[3] - card[1] < 0.6, JSON.stringify(card));
  const [code] = layouts.get('code')!.stress!;
  assert.ok(code && code[2] < 0 && code[1] > 0, JSON.stringify(code));
  assert.equal(layouts.get('code')!.stress!.length, 1, 'the card row lit a step earlier is not this step\'s emphasis');
  assert.equal(layouts.get('quiet')!.stress, undefined, 'a step that marks nothing emphasised nothing');
  assert.equal(layouts.get('unlit')!.stress, undefined, 'a mark taken back in the step is no emphasis');
  // The same focus bar on another line is new emphasis, where that line is.
  const [moved] = layouts.get('moved')!.stress!;
  assert.ok(moved && moved[1] > code[3] - 1e-6, `${JSON.stringify(moved)} is the first line, above ${JSON.stringify(code)}`);
});

// Issue #21: on a phone, PKCE's `authorize` caption says the verifier stays with the client
// "as the card's last row shows", and the first step's caption describes deriving the
// challenge from the verifier. Both are in a close-up the overview reaches in one press: the
// card was the 7th of 7 close-ups, and the derivation the 4th of 6.
test('PKCE on a phone: what each caption points at is in the first close-up or the next (issue #21)', async () => {
  const Scene = await explainer('oauth-pkce'),
    layouts = await stepLayouts(Scene);
  // The 358 × 201 stage of a 390 px page, the one `rayner check` measures.
  const [w, h] = [358, 201];
  const within = (b: Box, v: Box) => b[0] >= v[0] - 1e-6 && b[2] <= v[2] + 1e-6 && b[1] >= v[1] - 1e-6 && b[3] <= v[3] + 1e-6;
  const evidence: [string, Box][] = [
    ['authorize', await restingBox(Scene, 'authorize', (scene) => cardRow(scene, 'code_verifier', 'not sent'))],
    ['secret', await restingBox(Scene, 'secret', (scene) => wordsOutsideCards(scene, 'code_verifier', 'SHA-256'))],
  ];
  for (const [step, box] of evidence) {
    const views = closeUps(layouts.get(step), w, h).map((z) => viewBox(z, w, h));
    assert.ok(views.length > 1, `${step} needs a tour on a phone`);
    const at = views.findIndex((v) => within(box, v));
    assert.ok(at === 0 || at === 1, `${step}: ${JSON.stringify(box)} first whole in close-up ${at + 1} of ${views.length}`);
  }
});
