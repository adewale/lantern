import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fc, params } from './lib/pbt.ts';
import { covered, storyFrames, inspectStoryFrame, reviewStoryVariant } from '../tools/lib/explain-story-review.ts';
import { collectProject, ROOT } from '../tools/lib/explain-project.ts';
import { buildExplainer } from '../tools/lib/explain-build.ts';
import { serve } from '../tools/lib/explain-serve.ts';
import { launch } from '../tools/lib/browser.ts';
import { Scene, Text, Line, Group, Rectangle, VMobject, renderElements, toSvgString } from '../src/index.ts';
import { emphasises } from '../explain/look.ts';

test('local review server rejects an occupied port so startup failure can be reported', async () => {
  const first = await serve(tmpdir(), 0, 'index.html');
  try {
    await assert.rejects(serve(tmpdir(), Number(new URL(first.url).port), 'index.html'), { code: 'EADDRINUSE' });
    assert.equal((await fetch(first.url + '/missing-story-file')).status, 404, 'the existing host remains usable');
  } finally {
    first.close();
  }
});

test('tour coverage requires every target cell, including holes between views', () => {
  const rect = fc
    .tuple(
      fc.integer({ min: -8, max: 8 }),
      fc.integer({ min: -8, max: 8 }),
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 1, max: 8 }),
    )
    .map(([x, y, w, h]): [number, number, number, number] => [x, y, x + w, y + h]);
  fc.assert(
    fc.property(rect, fc.array(rect), (target, views) => {
      // Integer rectangle boundaries make unit-cell centres an exact, independent
      // oracle; a bounding union alone would incorrectly cover holes.
      let expected = true;
      for (let x = target[0]; x < target[2]; x++)
        for (let y = target[1]; y < target[3]; y++)
          expected &&= views.some((v) => x + 0.5 > v[0] && x + 0.5 < v[2] && y + 0.5 > v[1] && y + 0.5 < v[3]);
      assert.equal(covered(target, views), expected);
    }),
    params(1000, {
      examples: [
        [
          [0, 0, 3, 1],
          [
            [0, 0, 1, 1],
            [2, 0, 3, 1],
          ],
        ],
        [
          [0, 0, 2, 1],
          [
            [0, 0, 1, 1],
            [1, 0, 2, 1],
          ],
        ],
      ],
    }),
  );
});

test('logical story labels reject partially missing glyphs before accepting surviving records', async () => {
  for (const defect of ['opacity', 'clip', 'partial'] as const) {
    class Broken extends Scene {
      override async construct() {
        await this.step('claim');
        const t = new Text('word');
        t.key = 'word';
        this.add(t);
        const glyph = t.children[0]!;
        if (defect === 'opacity') glyph.setOpacity(0);
        else if (defect === 'clip') glyph.clipBox = [999, 999, 1000, 1000];
        else glyph.setStyle({ drawFraction: 0.5 });
      }
    }
    await assert.rejects(
      storyFrames(Broken, [{ step: 'claim', targets: [{ key: 'word' }] }]),
      /missing glyph ink|clipped glyph ink/,
      defect,
    );
  }
  class Windowed extends Scene {
    override async construct() {
      await this.step('window');
      const t = new Text('word');
      t.key = 'word';
      t.clipBox = [0, -1, 2, 1];
      this.add(t);
    }
  }
  assert.equal((await storyFrames(Windowed)).size, 1, 'new context may pass through an authored viewport');
  class HighlightedWindow extends Scene {
    override async construct() {
      await this.step('window');
      const word = new Text('word');
      word.clipBox = [0, -1, 2, 1];
      this.add(word);
      emphasises(this, () => [[word, 'highlighted word']]);
    }
  }
  await assert.rejects(
    storyFrames(HighlightedWindow),
    /clipped glyph ink/,
    'highlighted text stays complete even when route shapes may enter a viewport',
  );

  await assert.rejects(
    storyFrames(Windowed, [{ step: 'window', targets: [{ key: 'word' }] }]),
    /clipped glyph ink/,
    'the complete named subject may not be excused as cropped context',
  );
});

test('declared story subjects do not turn incidental context into extra obligations',async()=>{
  for(const helper of [false,true]){
    class Selection extends Scene {override async construct(){await this.step('picture');const subject=new Text('Subject');subject.key='subject';const context=new Text('Context').moveTo([6,3]);context.key='context';this.add(subject,context);if(helper)emphasises(this,()=>[[subject,'the subject']]);}}
    const frame=(await storyFrames(Selection,helper?[]:[{step:'picture',targets:[{key:'subject'}]}])).get('picture')!;
    assert.deepEqual(frame.targets.map(t=>t.name),[helper?'emphasis: subject':'subject']);
    assert.ok(frame.records.length>frame.targets[0]!.indices.length,'incidental context is still rendered');
  }
});

test('a caption explaining unchanged artwork must declare its subject', async () => {
  class BackdropOnly extends Scene {
    override async construct() {
      await this.step('background');
      const frame = new Group(new Rectangle({ width: 16, height: 9, fill: '#ffffff' }));
      frame.key = '__frame';
      this.add(frame);
    }
  }
  await assert.rejects(
    storyFrames(BackdropOnly),
    /unchanged artwork needs a declared story subject/,
    'reserved diagram paper is not narrative evidence',
  );
  class Unchanged extends Scene {
    override async construct() {
      await this.step('draw');
      const t = new Text('word');
      t.key = 'word';
      this.add(t);
      await this.step('explain');
    }
  }
  await assert.rejects(storyFrames(Unchanged), /unchanged artwork needs a declared story subject/);
  // A view redraws its picture as new objects each sync: the same paint under new ids is still
  // unchanged artwork, not a change the reader is meant to look for.
  class Redrawn extends Scene {
    override async construct() {
      await this.step('draw');
      const first = new Text('word');
      this.add(first);
      await this.step('explain');
      this.remove(first);
      this.add(new Text('word'));
    }
  }
  await assert.rejects(storyFrames(Redrawn), /explain: unchanged artwork needs a declared story subject/);
  const frames = await storyFrames(Unchanged, [{ step: 'explain', targets: [{ key: 'word' }] }]);
  assert.equal(frames.size, 2);
  assert.ok(frames.get('explain')!.targets.some((t) => t.name === 'word'));
});

test('redrawn paint preserves layer order and multiplicity without shifting unchanged context', async () => {
  const cases = [
    { before: ['red', 'blue'], after: ['blue', 'red'], changed: ['layer-blue-0', 'layer-red-0'] },
    { before: ['red'], after: ['red', 'red'], changed: ['layer-red-0', 'layer-red-1'] },
    { before: ['red', 'red'], after: ['red'], changed: ['layer-red-0'] },
    { before: ['red', 'blue'], after: ['red', 'green', 'blue'], changed: ['layer-green-0'] },
    { before: ['red', 'blue'], after: ['red', 'blue'], changed: [] },
  ];
  const check = async (sample: { before: string[]; after: string[]; changed: string[]; positions?: Record<string, [number, number]> }) => {
    class Layers extends Scene {
      override async construct() {
        const draw = (colors: string[], counter: number) => {
          const occurrences = new Map<string, number>();
          return new Group(...colors.map(color => {
            const occurrence = occurrences.get(color) ?? 0;
            occurrences.set(color, occurrence + 1);
            const layer = new Rectangle({ width: 2, height: 2, fill: color, stroke: 'none' })
              .moveTo(sample.positions?.[color] ?? [0, 0]).setOpacity(0.95);
            layer.key = `layer-${color}-${occurrence}`;
            return layer;
          }), new Text(`Step ${counter}`).moveTo([0, -3]));
        };
        await this.step('before');
        const first = draw(sample.before, 1);
        this.add(first);
        await this.step('after');
        this.remove(first);
        this.add(draw(sample.after, 2));
      }
    }
    const frames = await storyFrames(Layers);
    assert.equal(frames.size, 2);
    const targets = frames.get('after')!.targets.map(t => t.name);
    assert.deepEqual(targets.filter(name => name.startsWith('changed: layer-')).sort(),
      sample.changed.map(name => `changed: ${name}`).sort(), JSON.stringify(sample));
    assert.ok(targets.includes('changed: Step 2'), 'the incidental counter remains checked separately');
  };
  for (const sample of cases) await check(sample);
  await check({ before: ['red', 'blue'], after: ['blue', 'red'], changed: [],
    positions: { red: [-3, 0], blue: [3, 0] } });
  const stack = fc.array(fc.constantFrom('red', 'blue', 'green'), { maxLength: 8 });
  const point = fc.tuple(fc.integer({ min: -3, max: 3 }), fc.integer({ min: -1, max: 1 }));
  const locations = fc.record({ red: point, blue: point, green: point });
  await fc.assert(fc.asyncProperty(stack, stack, locations, async (before, after, positions) => {
    // The oracle gives each repeated color an occurrence name, then compares
    // every pair's order and known two-unit rectangle intersection. It does
    // not use the review's matching, parsed path bounds or spatial scan.
    const keys = (colors: string[]) => colors.map((color, index) =>
      `layer-${color}-${colors.slice(0, index).filter(c => c === color).length}`);
    const oldKeys = keys(before), newKeys = keys(after), changed = new Set<string>();
    for (const [index, key] of newKeys.entries()) {
      const color = after[index]!;
      if (before.filter(c => c === color).length !== after.filter(c => c === color).length) changed.add(key);
      for (let j = index + 1; j < newKeys.length; j++) {
        const other = newKeys[j]!, a = positions[color as keyof typeof positions], b = positions[after[j] as keyof typeof positions];
        if (oldKeys.includes(key) && oldKeys.includes(other) && oldKeys.indexOf(key) > oldKeys.indexOf(other) &&
            Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2) {
          changed.add(key); changed.add(other);
        }
      }
    }
    await check({ before, after, changed: [...changed], positions });
  }), params(100));
});

test('persistent layer ids preserve overlapping order changes but do not distinguish identical copies', async () => {
  for (const colors of [['red', 'blue'], ['red', 'red'], ['red', 'blue', 'red']]) {
    class Layers extends Scene {
      override async construct() {
        const layers = colors.map((color, index) => {
          const layer = new Rectangle({ width: 2, height: 2, fill: color, stroke: 'none' }).setOpacity(0.95);
          layer.key = `layer-${index}`;
          return layer;
        });
        await this.step('before');
        const first = new Text('Step 1').moveTo([0, -3]);
        this.add(...layers, first);
        await this.step('after');
        this.remove(...layers, first);
        this.add(...layers.slice().reverse(), new Text('Step 2').moveTo([0, -3]));
      }
    }
    const frames = await storyFrames(Layers);
    const samePaintOrder = colors.join() === colors.slice().reverse().join();
    assert.deepEqual(frames.get('after')!.targets.map(t => t.name).sort(), samePaintOrder ? ['changed: Step 2'] :
      ['changed: Step 2', 'changed: layer-0', 'changed: layer-1']);
  }
});

const strokeOrderCases = [
  { kind: 'miter', pixel: [688, 360], changed: true },
  { kind: 'default-miter', pixel: [656, 360], changed: true },
  { kind: 'square', pixel: [692, 360], changed: true },
  { kind: 'round', pixel: [692, 360], changed: false },
] as const;
function strokeOrderScene(kind: typeof strokeOrderCases[number]['kind']) {
  return class StrokeLayers extends Scene {
    override async construct() {
      const capped = kind === 'square' || kind === 'round';
      const stroke = capped
        ? new VMobject({ stroke: 'red', strokeWidth: 1, fill: 'none', lineCap: kind })
          .startNewPath([-1, -1]).addLineTo([0, 0])
        : new VMobject({ stroke: 'red', strokeWidth: 0.2, fill: 'none', lineJoin: 'miter',
          ...(kind === 'miter' ? { miterLimit: 20 } : {}) })
          .startNewPath([-1, kind === 'miter' ? 0.1 : 0.4]).addLineTo([0, 0])
          .addLineTo([-1, kind === 'miter' ? -0.1 : -0.4]);
      stroke.setOpacity(0.95); stroke.key = 'stroke';
      const size = capped ? 0.05 : kind === 'miter' ? 0.3 : 0.1;
      const patch = new Rectangle({ width: size, height: size, fill: 'blue', stroke: 'none' })
        .moveTo([capped ? 0.65 : kind === 'miter' ? 0.6 : 0.2, 0]).setOpacity(0.95);
      patch.key = 'patch';
      await this.step('before');
      const first = new Text('Step 1').moveTo([0, -3]);
      this.add(stroke, patch, first);
      await this.step('after');
      this.remove(stroke, patch, first);
      this.add(patch, stroke, new Text('Step 2').moveTo([0, -3]));
    }
  };
}

test('paint-order evidence includes acute miter joins and diagonal square caps', async () => {
  for (const sample of strokeOrderCases) {
    const frames = await storyFrames(strokeOrderScene(sample.kind));
    assert.deepEqual(frames.get('after')!.targets.map(t => t.name).sort(), sample.changed ?
      ['changed: Step 2', 'changed: patch', 'changed: stroke'] : ['changed: Step 2'], sample.kind);
  }
});

test('native SVG pixels confirm the stroke-order changes selected by the review',
  { skip: !process.env.EXPLAIN_BROWSER && 'set EXPLAIN_BROWSER=1 for native stroke paint checks' }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    let checked = 0;
    for (const sample of strokeOrderCases) {
      const images = new Map<string, string>();
      const Source = strokeOrderScene(sample.kind);
      await new Source({ async frame() {}, async stepEnd(scene, step) {
        images.set(step.name, toSvgString(scene));
      } }, { skipUntil: Infinity }).run();
      assert.equal(images.size, 2);
      const pixels: number[][] = [];
      for (const step of ['before', 'after']) pixels.push(await page.evaluate(async ({ svg, x, y }) => {
        const image = new Image(); image.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
        await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
        return [...context.getImageData(x, y, 1, 1).data];
      }, { svg: images.get(step)!, x: sample.pixel[0], y: sample.pixel[1] }));
      assert.ok(pixels[0]![2]! > 200 && pixels[0]![0]! < 50, `${sample.kind}: blue initially covers the stroke`);
      assert.ok(sample.changed ? pixels[1]![0]! > 200 && pixels[1]![2]! < 50 :
        pixels[1]![2]! > 200 && pixels[1]![0]! < 50, `${sample.kind}: native paint establishes whether order matters`);
      const frame = (await storyFrames(Source)).get('after')!;
      assert.equal(frame.targets.some(target => target.name === 'changed: stroke'), sample.changed);
      checked++;
    }
    assert.equal(checked, 4);
  } finally { await browser.close(); }
});

test('token-bucket refill does not turn untouched waiting R10 into a story obligation', async () => {
  const project = await collectProject('scenes/explainers/token-bucket', { write: false });
  assert.equal(project.variants.length, 3);
  let checked = 0;
  for (const variant of project.variants) {
    const frame = (await storyFrames(variant.Scene)).get('refill')!;
    await new variant.Scene({
      async frame() {},
      async stepEnd(scene, step) {
        if (step.name !== 'refill') return;
        const labels = scene.familyMembers().filter(m => m instanceof Text && m.text === 'R10');
        assert.equal(labels.length, 1, 'the final waiting request has one label');
        const chip = labels[0]!.parent!.children[0]!;
        assert.ok(chip instanceof Rectangle);
        const records = renderElements(scene, { relative: false });
        const index = records.findIndex(r => r.id === chip.id);
        assert.ok(index >= 0);
        assert.equal(records[index]!.attrs['stroke-dasharray'], '80 60', 'R10 is still waiting');
        assert.deepEqual(frame.records[index]!.attrs, records[index]!.attrs, 'bind the same actual rectangle in the reviewed frame');
        assert.equal(frame.targets.some(target => target.indices.includes(index)), false,
          `rate ${variant.values.rate}: redrawing answered R7-R9 must not make unchanged R10 a subject`);
        checked++;
      },
    }, { skipUntil: Infinity }).run();
  }
  assert.equal(checked, 3);
});

test('fresh helper emphasis must be on stage and painted replacement routes count instead of invisible carriers', async () => {
  class Absent extends Scene {
    override async construct() {
      await this.step('claim');
      const missing = new Text('off stage');
      emphasises(this, () => [[missing, 'off stage']]);
      this.add(new Text('unrelated'));
    }
  }
  await assert.rejects(storyFrames(Absent), /newly emphasised off stage is absent/);
  class Marked extends Scene {
    override async construct() {
      await this.step('claim');
      const carrier = new Line([-1, 0], [1, 0], { fill: '#ff0000', strokeOpacity: 0 });
      const part = new Group(carrier, new Text('word'));
      part.key = 'route';
      const overlay = carrier.copy().setStroke('#ff0000', 0.1, 1);
      this.add(part, overlay);
    }
  }
  class LabelOnly extends Scene {
    override async construct() {
      await this.step('claim');
      const route = new Group(new Line([-1, 0], [1, 0], { strokeOpacity: 0 }), new Text('route label'));
      route.key = 'route';
      this.add(route);
    }
  }
  await assert.rejects(
    storyFrames(LabelOnly, [{ step: 'claim', targets: [{ key: 'route', paint: 'stroke' }] }]),
    /needs painted stroke ink/,
  );
  const frame = (await storyFrames(Marked, [{ step: 'claim', targets: [{ key: 'route', paint: 'stroke' }] }])).get(
    'claim',
  )!;
  const records = frame.targets.find((t) => t.name === 'route')!.indices.map((i) => frame.records[i]!);
  assert.ok(
    records.some((r) => r.attrs['stroke-width'] === '100' && r.attrs['stroke-opacity'] === '1'),
    'the actual replacement stroke belongs to the subject',
  );
  assert.ok(
    records.every((r) => r.attrs['stroke-opacity'] !== '0'),
    'zero-area invisible carriers are not painted subjects',
  );
});

test(
  'served story review visits the final step at each width and rejects missing, hidden or clipped actual subjects',
  { skip: !process.env.EXPLAIN_BROWSER && 'set EXPLAIN_BROWSER=1 for actual story paint checks' },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rayner-story-review-'));
    const browser = await launch();
    let server: ReturnType<typeof serve> extends Promise<infer T> ? T : never;
    try {
      await writeFile(
        join(dir, 'scene.ts'),
        `import{Scene,Text,Line}from'rayner';import{stage,settingsOf}from'rayner/explain';import{emphasises}from${JSON.stringify(join(ROOT, 'explain/look.ts'))};
      export default class Story extends Scene{static meta={id:'story',title:'Story subjects'};static settings=[{id:'route',label:'Route position',default:'visible',options:[{value:'visible',label:'Entering the viewport'},{value:'outside',label:'Outside the authored picture'}]}];async construct(){const s=stage(this);
      await this.step('opening',{caption:'The first subject is shown.'});const a=new Text('First subject',{fontSize:.7});a.key='first';await s.enter(a,{describe:'First subject'});
      await this.step('ending',{caption:'The final subject replaces the first.'});await s.clear();const b=new Text('Final subject',{fontSize:.7});b.key='last';b.clipBox=[-7,-2,7,2];await s.enter(b,{describe:'Final subject'});
      await this.step('split',{caption:'Read the left and right subjects.'});await s.clear();const l=new Text('Left',{fontSize:.2}).moveTo([-5,0]),r=new Text('Right',{fontSize:.2}).moveTo([5,0]);l.key='left';r.key='right';r.clipBox=[4,-1,6,1];await s.enter(l,r,{describe:'The left and right subjects'});await this.step('return',{caption:'Return to the right subject.'});await s.clear();const again=new Text('Again',{fontSize:.7}).moveTo([4,0]);again.key='again';await s.enter(again,{describe:'Again on the right'});await this.step('route',{caption:'The highlighted route enters the window.'});await s.clear();const outside=settingsOf(this).route==='outside';const route=new Line(outside?[20,0]:[-10,0],outside?[21,0]:[0,0],{stroke:'#ff0000',strokeWidth:.05});route.key='window-route';route.clipBox=outside?[19,-1,22,1]:[-1,-1,1,1];this.add(route,new Text('Unrelated context',{fontSize:.2}).moveTo([6,3]));const other=outside?new Text('Other subject',{fontSize:.7}):null;if(other)this.add(other);emphasises(this,()=>other?[[route,'visible route'],[other,'other subject']]:[[route,'visible route']]);}}`,
      );
      const project = await collectProject(dir, { write: false }),
        variant = project.variants[0]!;
      await buildExplainer(project, join(dir, 'story.html'));
      server = await serve(dir, 0, 'story.html');
      const page = await browser.newPage();
      const claims = [
        { step: 'opening', opening: true, targets: [{ key: 'first' }] },
        { step: 'ending', opening: true, targets: [{ key: 'last' }] },
        { step: 'split', targets: [{ key: 'left' }, { key: 'right' }] },
        { step: 'return', opening: true, targets: [{ key: 'again' }] },
      ];
      const results = await reviewStoryVariant(page, server.url + '/story.html', variant, claims);
      assert.deepEqual(
        results.map((r) => [r.step, r.width]),
        [
          ['opening', 390],
          ['ending', 390],
          ['split', 390],
          ['return', 390],
          ['route', 390],
          ['opening', 1180],
          ['ending', 1180],
          ['split', 1180],
          ['return', 1180],
          ['route', 1180],
        ],
      );
      await assert.rejects(
        reviewStoryVariant(page, server.url + '/story.html', variant, [
          ...claims,
          { step: 'route', targets: [{ key: 'window-route', paint: 'stroke' }] },
        ]),
        /route: window-route has hidden or clipped ink/,
        'an explicit arrow claim requires the whole route',
      );
      const outside = project.variants.find((v) => v.values.route === 'outside')!;
      await assert.rejects(
        reviewStoryVariant(page, server.url + '/story.html', outside, claims),
        /route: emphasis: window-route is outside the authored picture/,
        'helper membership cannot excuse an entirely absent subject',
      );
      await page.goto(server.url + '/story.html?step=ending');
      await page.waitForFunction(
        () => (window as unknown as { raynerReviewStep: string }).raynerReviewStep === 'ending',
      );
      await page.locator('.leaving').waitFor({ state: 'detached' });
      const frame = (await storyFrames(variant.Scene, claims)).get('ending')!;
      await assert.rejects(
        storyFrames(variant.Scene, [{ step: 'ending', targets: [{ key: 'absent' }] }]),
        /story target absent is missing/,
      );
      const index = frame.targets.find((t) => t.name === 'last')!.indices[0]!;
      await page.locator('.stage svg:not(.leaving)').evaluate((svg, index) => {
        const elements = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs');
        (elements[index] as SVGElement).style.visibility = 'hidden';
      }, index);
      assert.equal(
        (await inspectStoryFrame(page, frame)).ink.find((p) => p.index === index)!.visible,
        false,
        'actual hidden ink must be rejected despite intact source geometry',
      );
      for (const defect of ['visibility', 'fill', 'clip', 'opacity']) {
        await page.locator('.stage svg:not(.leaving)').evaluate((svg, index) => {
          const e = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs')[index] as SVGElement;
          e.style.visibility = '';
          e.style.fill = '';
          e.style.stroke = '';
          e.style.clipPath = '';
          e.style.opacity = '';
        }, index);
        assert.equal(
          (await inspectStoryFrame(page, frame)).ink.find((p) => p.index === index)!.visible,
          true,
          'each control starts with actually visible ink',
        );
        await page.locator('.stage svg:not(.leaving)').evaluate(
          (svg, { index, defect }) => {
            const e = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs')[index] as SVGElement;
            // CSSOM properties, as the player uses: setAttribute(style,...) is
            // blocked by the page CSP and would leave the previous hidden state.
            if (defect === 'visibility') e.style.visibility = 'hidden';
            if (defect === 'fill') {
              e.style.fill = 'transparent';
              e.style.stroke = 'none';
            }
            if (defect === 'clip') e.style.clipPath = 'inset(100%)';
            if (defect === 'opacity') e.style.opacity = '0';
          },
          { index, defect },
        );
        assert.equal((await inspectStoryFrame(page, frame)).ink.find((p) => p.index === index)!.visible, false, defect);
      }
      for (const defect of ['rect-transform', 'clip-transform', 'units'] as const) {
        await page.locator('.stage svg:not(.leaving)').evaluate(
          (svg, { index, defect }) => {
            const path = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs')[index] as SVGElement;
            path.removeAttribute('style');
            const id = /^url\(#([^)]*)\)$/.exec(path.getAttribute('clip-path')!)![1]!;
            const clip = svg.querySelector(`[id="${id}"]`)!,
              rect = clip.firstElementChild!;
            rect.removeAttribute('transform');
            clip.removeAttribute('transform');
            clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          },
          { index, defect },
        );
        assert.equal(
          (await inspectStoryFrame(page, frame)).ink.find((p) => p.index === index)!.visible,
          true,
          'each clip control starts from a normal visible clip',
        );
        await page.locator('.stage svg:not(.leaving)').evaluate(
          (svg, { index, defect }) => {
            const path = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs')[index] as SVGElement;
            const id = /^url\(#([^)]*)\)$/.exec(path.getAttribute('clip-path')!)![1]!;
            const clip = svg.querySelector(`[id="${id}"]`)!,
              rect = clip.firstElementChild!;
            if (defect === 'rect-transform') rect.setAttribute('transform', 'translate(999999 0)');
            if (defect === 'clip-transform') clip.setAttribute('transform', 'translate(999999 0)');
            if (defect === 'units') clip.setAttribute('clipPathUnits', 'objectBoundingBox');
          },
          { index, defect },
        );
        assert.equal((await inspectStoryFrame(page, frame)).ink.find((p) => p.index === index)!.visible, false, defect);
      }
      await page.locator('.stage svg:not(.leaving)').evaluate((svg, index) => {
        const elements = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs');
        const path = elements[index] as SVGElement;
        path.style.visibility = '';
        path.removeAttribute('style');
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = '<clipPath id="review-hidden"><rect x="999999" y="999999" width="1" height="1"/></clipPath>';
        svg.prepend(defs);
        path.setAttribute('clip-path', 'url(#review-hidden)');
      }, index);
      await assert.rejects(
        inspectStoryFrame(page, frame),
        /painted record .* differs/,
        'a changed declared clip must not earn coverage for absent ink',
      );
      await page
        .locator('.stage svg:not(.leaving)')
        .evaluate(
          (svg, index) => [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs')[index]!.remove(),
          index,
        );
      await assert.rejects(
        inspectStoryFrame(page, frame),
        /painted record count/,
        'other paths and the caption cannot stand in for a missing subject',
      );
      const split = (await storyFrames(variant.Scene, claims)).get('split')!;
      const right = split.targets.find((t) => t.name === 'right')!.indices[0]!;
      for (const mode of ['visibility', 'clip'] as const) {
        const poisoned = await browser.newPage();
        try {
          await poisoned.addInitScript(
            ({ index, mode }) =>
              document.addEventListener('rayner:step', (event) => {
                if ((event as CustomEvent).detail.step !== 'split') return;
                const svg = document.querySelector('.stage svg:not(.leaving)') as SVGSVGElement;
                const path = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs')[
                  index
                ] as SVGGraphicsElement;
                const id = /^url\(#([^)]*)\)$/.exec(path.getAttribute('clip-path')!)![1]!;
                const clip = svg.querySelector(`[id="${id}"] rect`)!;
                const originalX = clip.getAttribute('x')!;
                const hide = () => {
                  const b = path.getBBox(),
                    v = svg.viewBox.baseVal,
                    shown = b.x < v.x + v.width && b.x + b.width > v.x;
                  if (mode === 'visibility') path.style.visibility = shown ? 'hidden' : '';
                  else clip.setAttribute('x', shown ? '999999' : originalX);
                };
                new MutationObserver(hide).observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
                hide();
              }),
            { index: right, mode },
          );
          // Generic new artwork must also be protected when it has no named claim.
          await assert.rejects(
            reviewStoryVariant(
              poisoned,
              server.url + '/story.html',
              variant,
              claims.filter((c) => c.step !== 'split'),
            ),
            /split at 390px: changed: Right is missing/,
            mode,
          );
        } finally {
          await poisoned.close();
        }
      }
    } finally {
      await browser.close();
      server!?.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);


test('served review rejects hidden reordered and duplicated layers despite a changed incidental label',
  { skip: !process.env.EXPLAIN_BROWSER && 'set EXPLAIN_BROWSER=1 for served layer-order checks' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rayner-story-layers-'));
  const browser = await launch();
  let server: Awaited<ReturnType<typeof serve>> | undefined;
  try {
    await writeFile(join(dir, 'scene.ts'), `import{Scene,Group,Rectangle,Text}from'rayner';import{settingsOf}from'rayner/explain';
      export default class Layers extends Scene{
        static meta={id:'layers',title:'Which layers are painted?'};
        static settings=[{id:'mode',label:'Layer change',default:'reordered',options:['reordered','added','removed'].map(value=>({value,label:value}))}];
        async construct(){
          const mode=settingsOf(this).mode;
          const draw=(colors,counter)=>new Group(...colors.map((fill,i)=>{const r=new Rectangle({width:6,height:4,fill,stroke:'none'}).setOpacity(.95);r.key='layer-'+i;return r;}),new Text('Step '+counter,{fontSize:.6}).moveTo([0,-3]));
          await this.step('before',{caption:'The initial layer stack is shown.'});
          const first=draw(mode==='removed'?['#ff0000','#ff0000']:mode==='added'?['#ff0000']:['#ff0000','#0000ff'],1);this.add(first);
          await this.step('after',{caption:mode==='reordered'?'Red now covers blue.':mode==='added'?'Two translucent red layers are painted.':'One red layer remains.'});
          this.remove(first);this.add(draw(mode==='reordered'?['#0000ff','#ff0000']:mode==='added'?['#ff0000','#ff0000']:['#ff0000'],2));
        }
      }`);
    const project = await collectProject(dir, { write: false });
    assert.equal(project.variants.length, 3);
    await buildExplainer(project, join(dir, 'layers.html'));
    server = await serve(dir, 0, 'layers.html');
    let baselineRows = 0, rejected = 0;
    for (const variant of project.variants) {
      const page = await browser.newPage();
      try {
        baselineRows += (await reviewStoryVariant(page, server.url + '/layers.html', variant)).length;
      } finally { await page.close(); }
      const poisoned = await browser.newPage();
      try {
        const index = variant.values.mode === 'removed' ? 0 : 1;
        await poisoned.addInitScript(index => {
          document.addEventListener('rayner:step', event => {
            if ((event as CustomEvent).detail.step !== 'after') return;
            const svg = document.querySelector('.stage svg:not(.leaving)')!;
            const path = [...svg.children].filter(e => e.tagName.toLowerCase() !== 'defs')[index] as SVGGraphicsElement;
            const paint = getComputedStyle(path);
            (window as unknown as { visibleBeforePoison: boolean }).visibleBeforePoison =
              Number(paint.opacity) >= 0.95 && paint.fill !== 'none' && path.getBBox().width > 0;
            // CSSOM applies under the artifact CSP; changing the style attribute
            // instead could be blocked and make a poison control meaningless.
            path.style.opacity = '0';
          });
        }, index);
        await assert.rejects(reviewStoryVariant(poisoned, server.url + '/layers.html', variant),
          /after: changed: layer-.* has hidden or clipped ink/, variant.values.mode);
        assert.equal(await poisoned.evaluate(() =>
          (window as unknown as { visibleBeforePoison: boolean }).visibleBeforePoison), true,
        'each defect starts from actually painted ink');
        assert.equal(await poisoned.locator('.stage svg:not(.leaving)').evaluate((svg, index) => {
          const path = [...svg.children].filter(e => e.tagName.toLowerCase() !== 'defs')[index]!;
          return getComputedStyle(path).opacity;
        }, index), '0', 'the intended CSS poison actually applies');
        rejected++;
      } finally { await poisoned.close(); }
    }
    assert.equal(baselineRows, 12, 'three cases, two steps, two widths');
    assert.equal(rejected, 3, 'every changed-layer defect is rejected');
  } finally {
    await browser.close(); server?.close(); await rm(dir, { recursive: true, force: true });
  }
});
