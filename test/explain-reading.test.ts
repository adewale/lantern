import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Group, Text, Rectangle } from '../src/index.ts';
import { stage } from '../explain/index.ts';
import { stepLayouts, closeUps, viewBox, stageScale } from '../app/embed-closeup.ts';

class Comparison extends Scene {
  override async construct() {
    const s = stage(this);
    await this.step('compare', { caption: 'Compare the old value with the new value.' });
    const left = new Text('Before: 1', { fontSize: 0.7 }).moveTo([-2, 1]);
    const right = new Text('After: 2', { fontSize: 0.7 }).moveTo([2, -1]);
    const detail = new Text('Implementation details', { fontSize: 0.22 }).moveTo([4, -3]);
    await s.enter(left, right, detail);
    s.reading(left, right);
    await this.step('next', { caption: 'A new step has its own subjects.' });
  }
}
test('an authored comparison opens together at readable size, retaining separate detail views', async () => {
  const layouts = await stepLayouts(Comparison),
    layout = layouts.get('compare')!;
  assert.ok(layout.reading);
  assert.equal(layout.reading.labels.length, 2, 'the nearby implementation label cannot set comparison scale');
  for (const width of [288, 358]) {
    const height = (width * 9) / 16,
      views = closeUps(layout, width, height),
      box = viewBox(views[0]!, width, height),
      want = layout.reading.box;
    assert.ok(
      box[0] <= want[0] && box[1] <= want[1] && box[2] >= want[2] && box[3] >= want[3],
      'both complete subjects are in the opening',
    );
    assert.ok(
      Math.min(...layout.reading.labels.map((l) => l.size)) * stageScale(width, height).s * views[0]!.k >= 12 - 1e-7,
    );
    assert.ok(views.length > 1, 'the small implementation detail remains reachable');
  }
  assert.equal(layouts.get('next')!.reading, undefined, 'previous subjects do not leak into the next caption');
});
test('reading intent cannot bless an absent or unpainted subject', async () => {
  for (const fill of ['none', '#ffffff']) {
    class Missing extends Scene {
      override async construct() {
        const s = stage(this);
        await this.step('bad');
        const object = new Group(new Rectangle({ width: 2, height: 1, fill, stroke: 'none' }));
        if (fill === 'none') this.add(object);
        s.reading(object);
      }
    }
    await assert.rejects(stepLayouts(Missing), /reading\(\): bad names a subject with no painted ink/);
  }
});

test('a declared drawing group cannot satisfy an independent claim after one comparison label is hidden', async () => {
  const { storyFrames } = await import('../tools/lib/explain-story-review.ts');
  const claims = [{ step: 'compare', opening: true, targets: [{ text: 'Before: 1' }, { text: 'After: 2' }] }];
  class Both extends Scene {
    static hideAfter = false;
    override async construct() {
      const s = stage(this);
      await this.step('compare', { caption: 'Compare before and after.' });
      const before = new Text('Before: 1', { fontSize: 0.7 }).moveTo([-2, 1]);
      const after = new Text('After: 2', { fontSize: 0.7 }).moveTo([2, -1]);
      if ((this.constructor as typeof Both).hideAfter) after.setOpacity(0);
      const group = new Group(before, after);
      s.reading(group);
      await s.enter(group);
    }
  }
  const good = await storyFrames(Both, claims);
  assert.equal(good.get('compare')!.targets.filter((t) => t.opening).length, 2);
  class Hidden extends Both {
    static override hideAfter = true;
  }
  // reading() still has visible before ink; the separately named After obligation must reject.
  await assert.rejects(storyFrames(Hidden, claims), /After: 2.*(no painted paths|missing glyph ink)/);
});

test('a wordless subject opens whole while small implementation labels retain their readable tour', async () => {
  class Shape extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('shape', { caption: 'The rectangle is the subject.' });
      const rect = new Rectangle({ width: 12, height: 4, fill: '#d45d00', stroke: 'none' });
      await s.enter(rect, new Text('Details', { fontSize: 0.22 }).moveTo([4, -3]));
      s.reading(rect);
    }
  }
  const layout = (await stepLayouts(Shape)).get('shape')!;
  assert.equal(layout.reading!.labels.length, 0);
  for (const width of [288, 358]) {
    const views = closeUps(layout, width, (width * 9) / 16),
      box = viewBox(views[0]!, width, (width * 9) / 16),
      subject = layout.reading!.box;
    assert.ok(box[0] <= subject[0] && box[1] <= subject[1] && box[2] >= subject[2] && box[3] >= subject[3]);
    assert.ok(views.length > 1, 'the detail label still has readable close-ups');
  }
});

test('the legibility report measures each label at a tour stop that actually contains it', async () => {
  const { collectProject } = await import('../tools/lib/explain-project.ts');
  const { checkProject } = await import('../tools/lib/explain-check.ts');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const folder = await mkdtemp(join(tmpdir(), 'rayner-reading-gate-'));
  try {
    const p = await collectProject('test/fixtures/reading-comparison', { write: false });
    const report = await checkProject(p, folder);
    const variants = report.variants as {
      legibility: { labelsUnder12PxAt390: number; labelsOutsideCloseUpsAt390: number };
    }[];
    assert.equal(variants.length, 1);
    assert.equal(variants[0]!.legibility.labelsUnder12PxAt390, 0);
    assert.equal(variants[0]!.legibility.labelsOutsideCloseUpsAt390, 0);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
