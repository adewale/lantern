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
import { Scene, Text, Line, Group, Rectangle } from '../src/index.ts';
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
