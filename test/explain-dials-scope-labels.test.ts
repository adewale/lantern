// Dials, step-scoped keeping, placed labels, the Create stagger cap, pivots, the stills page
// and the check summary: each new behaviour with the case that would have shown it missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { variantsOf, sweepsOf, caseValues, caseName, isDial, resolveSettings, withSettings } from '../explain/index.ts';
import type { ExplainerClass } from '../explain/index.ts';
import { Scene, Group, Line, Text, Create, MotionSink, analyzeMotion, NullSink } from '../src/index.ts';
import { sharePaths } from '../tools/lib/explain-stills.ts';
import { captionDensity } from '../tools/lib/explain-check.ts';
import { checkSummary } from '../tools/explain.ts';

const Dialled: ExplainerClass = class extends Scene {
  static settings = [
    { id: 'kind', label: 'Kind', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { id: 'turn', label: 'Turn', default: '0', dial: true, options: [{ value: '-1', label: 'before' }, { value: '0', label: 'now' }, { value: '1', label: 'after' }] },
  ];
};

test('a dial is not a case: variants hold its default, sweeps hold every value, case values and names leave it out', () => {
  assert.deepEqual(variantsOf(Dialled), [{ kind: 'a', turn: '0' }, { kind: 'b', turn: '0' }]);
  assert.equal(sweepsOf(Dialled).length, 6);
  assert.deepEqual(sweepsOf(Dialled).map((v) => v.turn), ['-1', '0', '1', '-1', '0', '1']);
  assert.deepEqual(caseValues(Dialled, { kind: 'b', turn: '1' }), { kind: 'b' });
  assert.equal(caseName(Dialled, { kind: 'b', turn: '1' }), 'Kind: B · Turn: after');
  assert.equal(caseName(Dialled, caseValues(Dialled, { kind: 'b', turn: '1' })), 'Kind: B');
  assert.ok(isDial(Dialled.settings![1]!) && !isDial(Dialled.settings![0]!));
  // A dial value binds like any setting, and an unknown one is refused.
  assert.equal(resolveSettings(Dialled, { turn: '1' }).turn, '1');
  assert.throws(() => resolveSettings(Dialled, { turn: '2' }), /Unknown turn option/);
  assert.equal(resolveSettings(withSettings(Dialled, { turn: '-1' })).turn, '0', 'the class itself still resolves to defaults');
});

test('sweeps refuse an explosion the cases alone would allow', () => {
  const Wide: ExplainerClass = class extends Scene {
    static settings = Array.from({ length: 9 }, (_, i) => ({ id: `d${i}`, label: `D${i}`, default: '0', dial: true, options: [{ value: '0', label: '0' }, { value: '1', label: '1' }] }));
  };
  assert.equal(variantsOf(Wide).length, 1);
  assert.throws(() => sweepsOf(Wide), /exceed 256 checked combinations/);
});

test('Create never gives a staggered row less than a quarter of a second, so a wide group has no pops', async () => {
  // Sixty lines at the default lagRatio over one second popped before: each row had 1/12.8 s.
  const lines = new Group(...Array.from({ length: 60 }, (_, i) => new Line([-7 + i * 0.23, -1], [-7 + i * 0.23, 1], { stroke: '#fff', strokeWidth: 0.04 })));
  const motion = new MotionSink();
  const scene = new (class extends Scene {
    override async construct() {
      await this.step('one');
      await this.play(new Create(lines), { runTime: 1 });
    }
  })(motion);
  await scene.run();
  assert.deepEqual(analyzeMotion(motion), []);
  // The cap is a lowering, never a raising: a single row keeps its lagRatio.
  const one = new Create(new Line([0, 0], [1, 1]), { lagRatio: 0.2 });
  one.begin();
  assert.equal(one.lagRatio, 0.2);
  const wide = new Create(lines, { runTime: 1 });
  wide.begin();
  assert.ok(wide.lagRatio < 0.2 && wide.lagRatio > 0, `lowered to ${wide.lagRatio}`);
  assert.ok(Math.abs(1 / (1 + wide.lagRatio * 59) - Create.MIN_ROW_SECONDS) < 1e-9, 'each row gets exactly the floor');
});

test('sharePaths moves repeated path data to one defs block and leaves single paths alone', () => {
  const a = '<svg><path fill="#f00" d="M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 Z"/><path d="M 9 9 L 8 8 L 7 7 L 6 6 L 5 5"/></svg>';
  const b = '<svg><path fill="#0f0" d="M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 Z"/></svg>';
  const { defs, svgs } = sharePaths([a, b]);
  assert.match(defs, /<defs><path id="p0" d="M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 Z"\/><\/defs>/);
  assert.equal(svgs[0], '<svg><use href="#p0" fill="#f00"/><path d="M 9 9 L 8 8 L 7 7 L 6 6 L 5 5"/></svg>');
  assert.equal(svgs[1], '<svg><use href="#p0" fill="#0f0"/></svg>');
  assert.deepEqual(sharePaths(['<svg><path d="M 0 0"/></svg>']), { defs: '', svgs: ['<svg><path d="M 0 0"/></svg>'] });
});

test('caption density counts words and numerals as a reader meets them', () => {
  assert.deepEqual(captionDensity(''), { captionWords: 0, captionNumerals: 0 });
  assert.deepEqual(captionDensity('Its centre reaches 299.1° at 8:13:17 PM, 0.45° up; 1,000 readers.'), { captionWords: 11, captionNumerals: 4 });
});

test('a passing check prints a summary a person can read', () => {
  const summary = checkSummary(
    {
      scene: 'demo', diagrams: 1,
      variants: [
        { steps: 3, frames: 400, motionEvents: 0, legibility: { minLabelPx1280: 16, minLabelPx390: 12.4, labelsUnder12PxAt390: 0, labels: 9 }, density: { maxLabels: 7, maxCaptionWords: 40, maxCaptionNumerals: 3, steps: { a: { labels: 7, captionNumerals: 3 }, b: { labels: 2, captionNumerals: 0 } } } },
        { steps: 3, frames: 420, motionEvents: 0, legibility: { minLabelPx1280: 15, minLabelPx390: 11.5, labelsUnder12PxAt390: 1, labels: 9 }, density: { maxLabels: 5, maxCaptionWords: 30, maxCaptionNumerals: 2, steps: { a: { labels: 5, captionNumerals: 2 }, b: { labels: 1, captionNumerals: 0 } } } },
      ],
    },
    '/tmp/report.json',
  );
  assert.equal(
    summary,
    [
      'rayner check: demo passed',
      '  2 cases · 3 steps · 1 diagram · 420 frames at most · 0 motion events',
      '  labels: smallest 15 px at 1280 px, 11.5 px in a phone close-up (1 under 12 px)',
      '  density: up to 7 labels at rest (a), up to 3 numerals and 40 words in a caption',
      '  report: /tmp/report.json',
    ].join('\n'),
  );
});

// ---- scenes: scoped keeping, placed labels, pivots and the stills page ------------------------
import { collectProject } from '../tools/lib/explain-project.ts';
import { checkProject } from '../tools/lib/explain-check.ts';
import { readReviewFile, assertPivots } from '../tools/lib/explain-pivots.ts';
import { buildStills } from '../tools/lib/explain-stills.ts';
import { stage } from '../explain/index.ts';
import { Dot } from '../src/index.ts';

const HEAD = `import{Scene,Text,Dot,Line,FadeIn}from'rayner';import{stage,settingsOf}from'rayner/explain';`;
const module = (body: string, statics = '') => `${HEAD}export default class Made extends Scene{${statics}async construct(){const s=stage(this);${body}}}`;
async function project(source: string, review?: object) {
  const dir = await mkdtemp(join(tmpdir(), 'rayner-scoped-'));
  await writeFile(join(dir, 'scene.ts'), source);
  if (review) await writeFile(join(dir, 'scene.review.json'), JSON.stringify(review));
  return { dir, project: await collectProject(dir, { write: false }) };
}

test('until: next keeps a callout for its own step and the stage removes it as the next begins', async () => {
  const { dir, project: p } = await project(
    module(
      `await this.step('one',{caption:'One.'});const d=new Dot({radius:.3}).moveTo([0,0]);await s.enter(d,{describe:'A dot'});await s.callout(d,'for one only',{until:'next'});` +
        `await this.step('two',{caption:'Two.'});await s.label('for two',[0,-2]);`,
    ),
  );
  try {
    const [one, two] = p.variants[0]!.trace.steps;
    const shown = (s: { after?: Record<string, unknown> }) => ((s.after?.picture as { entries: { items: string[] }[] }).entries).flatMap((e) => e.items);
    assert.ok(shown(one!).includes('for one only'), JSON.stringify(one!.after));
    assert.ok(!shown(two!).includes('for one only') && shown(two!).includes('for two'), JSON.stringify(two!.after));
    await checkProject(p, join(dir, 'checks'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('s.label moves off a line it would lie across, and only then; clear: false leaves it where asked', async () => {
  const placed: Record<string, number> = {};
  const scene = new (class extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('one', { caption: 'Lines.' });
      await s.enter(new Line([-6, 0], [6, 0], { stroke: '#fff', strokeWidth: 0.03 }), { describe: 'A line' });
      placed.onLine = (await s.label('on the line', [0, 0], { enter: false })).center()[1];
      placed.clearAlready = (await s.label('clear already', [0, 2], { enter: false })).center()[1];
      placed.forced = (await s.label('forced', [-4, 0], { clear: false, enter: false })).center()[1];
      // Two labels asked for the same place: the second keeps clear of the first, drawn or not.
      placed.first = (await s.label('first', [4, 2], { enter: false })).center()[1];
      placed.second = (await s.label('second', [4, 2], { enter: false })).center()[1];
    }
  })(new NullSink());
  await scene.run();
  assert.ok(Math.abs(placed.onLine!) >= 0.14, `moved off the line: ${placed.onLine}`);
  assert.equal(placed.clearAlready, 2);
  assert.equal(placed.forced, 0);
  assert.equal(placed.first, 2);
  assert.ok(Math.abs(placed.second! - 2) >= 0.14, `second label moved: ${placed.second}`);
});

test('a pivot holds the step state check asserts, and a wrong one fails check with its own message', async () => {
  const source = module(`await this.step('one',{caption:'One.'});this.state.count=1;await s.label('one',[0,0]);await this.step('two',{caption:'Two.'});this.state.count=2;await s.label('two',[0,-2]);`);
  const right = await project(source, { version: 1, pivots: [{ step: 'two', state: { count: 2 }, witness: [{ text: 'two' }] }] });
  const wrong = await project(source, { version: 1, pivots: [{ step: 'two', state: { count: 3 } }] });
  try {
    const file = await readReviewFile(right.project);
    assert.equal(file.pivots.length, 1);
    assertPivots(right.project, file.pivots);
    const report = await checkProject(right.project, join(right.dir, 'checks'));
    assert.equal(report.pivots, 1);
    await assert.rejects(checkProject(wrong.project, join(wrong.dir, 'checks')), /pivot at two: count is not what the review file says/);
    await assert.rejects(project(source, { version: 1, pivots: [{ step: 'three', state: { count: 2 } }] }).then(({ project: p }) => readReviewFile(p)), /pivot step three is missing/);
  } finally {
    await rm(right.dir, { recursive: true, force: true });
    await rm(wrong.dir, { recursive: true, force: true });
  }
});

test('the stills page holds every step of every case as a figure, shares paths, and carries no engine', async () => {
  const { dir, project: p } = await project(
    module(
      `const k=settingsOf(this).k;await this.step('one',{title:'One',caption:'First.'});await s.label('k is '+k,[0,0]);await this.step('two',{title:'Two',caption:'Second.'});await s.label('still '+k,[0,-2]);`,
      `static settings=[{id:'k',label:'K',default:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}]}];`,
    ),
  );
  try {
    const out = await buildStills(p, join(dir, 'page.html'));
    const html = await readFile(out.out, 'utf8');
    assert.equal(out.stills, 4);
    assert.equal((html.match(/<figure class="still"/g) ?? []).length, 4);
    assert.equal((html.match(/<section class="case-section"/g) ?? []).length, 2);
    assert.match(html, /<defs>/);
    assert.ok(html.includes('First.') && html.includes('Second.') && html.includes('<details class="transcript">'));
    assert.ok(out.bytes < 400 * 1024, `no engine: ${out.bytes} bytes`);
    assert.ok(!html.includes('mountEmbed') && !html.includes('DecompressionStream'));
    const receipt = JSON.parse(await readFile(out.out + '.receipt.json', 'utf8'));
    assert.equal(receipt.kind, 'stills');
    assert.equal(receipt.stills, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
