import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Scene, NullSink, Rectangle, Text, Dot, FadeIn, SnapshotSink, renderAt, toSvgString, traceScene } from '../src/index.ts';
import { stage, bindSnapshots, REGIONS } from '../explain/index.ts';
import { emphasis, dimOpacity } from '../explain/look.ts';
import { diagramKey } from '../integrations/agentic-mermaid/snapshot.ts';
import type { DiagramSnapshot } from '../explain/index.ts';
import { fixedSnapshot, square } from './lib/random-snapshot.ts';
import { pictureSummary, pictureHtml, undescribed, picture, shownNames } from '../explain/trace.ts';
import { collectProject } from '../tools/lib/explain-project.ts';
import { checkProject, restingTextProblems } from '../tools/lib/explain-check.ts';

const spec = { source: 'graph LR\nA --> B\nB --> C', style: 'nord' };
const PAPER = '#123456',
  INK = '#ffffff',
  ACCENT = '#ff8800';
function fixture(): DiagramSnapshot {
  const shape = (x: number, extra: Record<string, unknown> = {}) => square(x, { fill: '#334455', stroke: '#aabbcc', ...extra });
  const edge = (from: string, to: string, x: number) => ({
    id: `edge:${from}->${to}#0`,
    role: 'edge',
    kind: 'connector',
   
    // A stroked line and a filled arrowhead, as Agentic Mermaid draws them.
    shapes: [shape(x, { fill: 'none' }), shape(x + 0.5, { fill: '#aabbcc', stroke: 'none' })],
    from,
    to,
    route: [
      [x - 1, 0],
      [x + 1, 0],
    ] as [number, number][],
  });
  return fixedSnapshot(
    spec,
    [
      { id: 'A', role: 'node', kind: 'shape', shapes: [shape(0)] },
      { id: 'B', role: 'node', kind: 'shape', shapes: [shape(3)] },
      { id: 'C', role: 'node', kind: 'shape', shapes: [shape(6)] },
      edge('A', 'B', 1.5),
      edge('B', 'C', 4.5),
    ],
    { width: 800, palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#aaaaaa' } },
  );
}
const bound = (S: typeof Scene) => bindSnapshots(S, { [diagramKey(spec)]: fixture() });
const strokes = (m: { family(): { style: { stroke?: string } }[] }) =>
  m.family().map((x) => x.style.stroke).filter((s) => s && s !== 'none');

test('the heading follows step titles; a fixed or absent heading is still possible', async () => {
  const seen: string[] = [];
  class Steps extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('one', { title: 'First idea' });
      seen.push(s.heading.text);
      await this.step('two', { title: 'Second idea' });
      seen.push(s.heading.text);
      await this.step('three');
      seen.push(s.heading.text);
      assert.equal(this.mobjects.filter((m) => m.key === '__heading').length, 1);
    }
  }
  await new Steps(new NullSink()).run();
  assert.deepEqual(seen, ['First idea', 'Second idea', '']);
  class Fixed extends Scene {
    override async construct() {
      const s = stage(this, { heading: 'Always this' });
      await this.step('one', { title: 'Not shown on stage' });
      assert.equal(s.heading.text, 'Always this');
    }
  }
  await new Fixed(new NullSink()).run();
});

test('mark, dim and trails persist into the resting frame and restore exactly', async () => {
  class Emphasis extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('walk');
      const d = await s.show(spec);
      const edge = d.get('edge:A->B#0');
      const before = edge.family().map((m) => ({ ...m.style }));
      await d.walk(
        [
          ['A', 'B'],
          ['B', 'C'],
        ],
        { trail: true },
      );
      // One journey, one token, and none left behind.
      assert.equal(this.familyMembers().filter((m) => m instanceof Dot).length, 0);
      assert.ok(strokes(edge).every((c) => c === d.accent));
      assert.equal(edge.family().find((m) => m.style.fill !== 'none' && m.style.stroke === 'none')?.style.fill, d.accent);
      // Focus moves geometry but keeps the look.
      await d.focus(['B']);
      assert.ok(strokes(edge).every((c) => c === d.accent));
      await d.focus('all');
      await d.unmark();
      assert.deepEqual(
        edge.family().map((m) => m.style),
        before,
      );
      await this.step('dim');
      await d.dim(['A', 'B']);
      const faint = dimOpacity(d.snapshot.palette);
      assert.equal(d.get('C').family()[1]!.style.opacity, faint);
      assert.equal(d.get('edge:B->C#0').family()[1]!.style.opacity, faint);
      assert.equal(d.get('edge:A->B#0').family()[1]!.style.opacity, 1, 'links between kept parts stay');
      await d.dim(null);
      assert.equal(d.get('C').family()[1]!.style.opacity, 1);
      this.state.done = true;
    }
  }
  const trace = await traceScene(bound(Emphasis));
  assert.deepEqual(
    (trace.steps.at(-1)!.after!.walks as { edge: string }[]).map((w) => w.edge),
    ['edge:A->B#0', 'edge:B->C#0'],
  );
});

test('notes follow their part through focus and leave with the diagram; clear() resets for reuse', async () => {
  class Notes extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('one');
      const d = await s.show(spec);
      const note = await d.note('C', 'here', { side: 'above' });
      const gap = () => note.center()[0] - d.get('C').center()[0];
      assert.ok(Math.abs(gap()) < 1e-6);
      await d.focus(['A']);
      assert.ok(Math.abs(gap()) < 1e-6 || note.center()[0] >= d.frameBox[2] - note.width() / 2 - 0.06);
      await d.focus('all');
      assert.ok(note.center()[1] > d.get('C').box()![3]);
      await d.hide();
      assert.equal(d.notes.length, 0);
      assert.ok(!this.familyMembers().includes(note));
      await d.reveal('rest');
      await s.clear();
      assert.deepEqual(
        this.mobjects.map((m) => m.key),
        ['__paper', '__heading'],
      );
      await d.reveal(['A']);
      assert.ok(this.familyMembers().includes(d.get('A')));
    }
  }
  await new (bound(Notes))(new NullSink()).run();
});

test('cards update and mark rows; code keeps a focus bar on the chosen lines', async () => {
  class Panels extends Scene {
    override async construct() {
      const s = stage(this, { palette: { paper: PAPER, ink: INK, accent: '#888888', muted: '#555555' } });
      await this.step('one');
      const card = await s.card(
        [
          ['Tokens', 5],
          ['Status', 200],
        ],
        { at: 'side', title: 'Bucket' },
      );
      await card.set({ Tokens: 4, Status: 200 });
      assert.equal(card.values.get('Tokens')!.text, '4');
      assert.ok(!this.familyMembers().some((m) => m instanceof Text && m.text === '5'));
      await card.mark('Status');
      assert.equal(card.bar.style.opacity, 1);
      assert.ok(Math.abs(card.bar.center()[1] - card.values.get('Status')!.anchorPoint()[1]) < 1e-6);
      // A grey accent is not emphasis: helpers use a real hue instead.
      assert.equal(card.bar.style.fill, emphasis(s.palette));
      assert.notEqual(emphasis(s.palette), '#888888');
      const code = await s.code(['a()', 'b()', 'c()'], { at: 'main' });
      await code.focus([1, 2]);
      const middle = (code.code.lines[1]!.anchorPoint()[1] + code.code.lines[2]!.anchorPoint()[1]) / 2;
      assert.ok(Math.abs(code.bar.center()[1] - middle) < 1e-6);
      assert.ok(card.box()![0] >= REGIONS.side[0] - 1e-6, 'region placement');
    }
  }
  await new Panels(new NullSink()).run();
});

test('check rejects steps that end on the same picture, and colliding or cut-off text', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lantern-gates-'));
  try {
    const file = join(folder, 'scene.ts');
    await writeFile(
      file,
      `import{Scene,Text,FadeIn}from'manim-js';import{stage}from'manim-js/explain';export default class Same extends Scene{async construct(){const s=stage(this);await this.step('one',{title:'One'});await this.play(new FadeIn(new Text('hello',{color:s.palette.ink})));await this.step('two',{title:'Two',caption:'Nothing new is drawn.'});await this.wait(.5);}}`,
    );
    await assert.rejects(
      checkProject(await collectProject(file, { write: false }), join(folder, 'checks')),
      /Each step must change the picture[^]*two/,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  const scene = new Scene(new NullSink());
  scene.add(
    new Text('first label', { fontSize: 0.3 }).moveTo([0, 0]),
    new Text('second label', { fontSize: 0.3 }).moveTo([0.2, 0.05]),
    new Text('far away', { fontSize: 0.3 }).moveTo([0, -2]),
    new Text('off the edge', { fontSize: 0.3 }).moveTo([7.9, 0]),
  );
  assert.deepEqual(restingTextProblems(scene), [
    '"off the edge" crosses the stage edge',
    '"first label" overlaps "second label"',
  ]);
});

test('a step is shown at its true resting frame, not one frame before the end', async () => {
  class Ends extends Scene {
    override async construct() {
      stage(this, { palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#999999' } });
      await this.step('one', { title: 'Fades in to the last frame' });
      await this.play(new FadeIn(new Text('arrives', { color: INK })), { runTime: 1 });
      await this.step('two', { title: 'Next' });
      await this.play(new FadeIn(new Text('later', { color: INK }).moveTo([0, -2])));
    }
  }
  const trace = await traceScene(Ends);
  const played = new Map<number, string>();
  await new Ends({
    async frame(scene: Scene) {
      played.set(scene.frameCount, toSvgString(scene));
    },
  }).run();
  for (const step of trace.steps) {
    const sink = new SnapshotSink();
    await renderAt(Ends, step.t1! - 0.5 / trace.fps, sink);
    assert.equal(sink.svg, played.get(step.frame1!), `${step.step} rests on its final frame`);
  }
});

test('helper fixes: near-black accents get a real emphasis hue, notes avoid their part, fades spare hidden bars', async () => {
  // pen-and-ink's accent is a warm near-black, not a hue.
  assert.equal(emphasis({ paper: '#faf6ec', ink: '#241f1a', accent: '#2b241d', muted: '#241f1a' }), '#d9480f');
  assert.equal(emphasis({ paper: '#2e3440', ink: '#d8dee9', accent: '#88c0d0', muted: '#616e88' }), '#88c0d0');
  class Fixes extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('one');
      const d = await s.show(spec, { box: 'full' });
      // C is at the right edge: a right-hand note would be clamped onto it, so it moves.
      const note = await d.note('C', 'a long note that cannot fit on the right', { side: 'right' });
      const [nb, cb] = [note.box()!, d.get('C').box()!];
      assert.ok(nb[2] <= cb[0] || nb[0] >= cb[2] || nb[3] <= cb[1] || nb[1] >= cb[3], 'note clear of its part');
      const code = await s.code(['x'], { at: 'bottom' });
      assert.ok(code.box()![1] >= REGIONS.bottom[1] - 1e-6);
    }
  }
  await new (bound(Fixes))(new NullSink()).run();
});

test('a captioned step records where its reading hold begins, so the player can stop when the picture does', async () => {
  class Held extends Scene {
    override async construct() {
      stage(this, { palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#999999' } });
      await this.step('one', { title: 'Short motion, long caption', caption: 'word '.repeat(40) });
      await this.play(new FadeIn(new Text('moves', { color: INK })), { runTime: 1 });
      await this.step('two', { title: 'No hold needed' });
      await this.play(new FadeIn(new Text('more', { color: INK }).moveTo([0, -2])), { runTime: 1 });
    }
  }
  const [one, two] = (await traceScene(Held)).steps;
  assert.ok(one!.hold! > one!.t0 && one!.hold! < one!.t1!, 'the hold starts after the motion and before t1');
  assert.ok(Math.abs(one!.t1! - one!.t0 - (40 / 160) * 60) < 1e-6, 'video keeps the full reading time');
  assert.equal(two!.hold, undefined);
});

test('code morphs by line identity: surviving lines move, others fade, added lines are marked', async () => {
  const { matchLines } = await import('../explain/panels.ts');
  assert.deepEqual([...matchLines(['a', 'b', 'c'], ['a', 'x', 'c', 'y'])], [
    [0, 0],
    [2, 2],
  ]);
  class Morph extends Scene {
    override async construct() {
      const s = stage(this, { palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#999999' } });
      await this.step('one');
      const code = await s.code(['function f() {', '  return a;', '}'], { at: 'bottom' });
      const [first, , last] = code.code.lines;
      await code.morph(['function f() {', '  const b = a;', '  return b;', '}'], { markAdded: true });
      assert.equal(code.code.lines[0], first, 'the first line is the same object, moved');
      assert.equal(code.code.lines[3], last);
      assert.deepEqual(
        code.code.lines.map((l) => l.text),
        ['function f() {', '  const b = a;', '  return b;', '}'],
      );
      assert.equal(code.marks.length, 2);
      assert.ok(!this.familyMembers().some((m) => m instanceof Text && m.text === '  return a;'));
      assert.ok(code.box()![1] >= REGIONS.full[1] - 1e-6, 'the grown block stays on stage');
      await code.clearMarks();
      assert.equal(code.marks.length, 0);
    }
  }
  await new Morph(new NullSink()).run();
});

test('snapshots are stored one file per diagram and pruned', async () => {
  const { readSnapshots, writeSnapshots, snapshotFileName } = await import('../tools/lib/explain-project.ts');
  const { readdir, readFile: read } = await import('node:fs/promises');
  const folder = await mkdtemp(join(tmpdir(), 'lantern-snapshots-'));
  try {
    const base = join(folder, 'scene');
    const a = fixture(),
      b = { ...fixture(), spec: { source: 'graph LR\nX --> Y', style: 'nord' } };
    const keyA = diagramKey(a.spec),
      keyB = diagramKey(b.spec);
    await writeSnapshots(base, { [keyA]: a, [keyB]: b }, 'source');
    assert.deepEqual((await readdir(base + '.snapshots')).sort(), [snapshotFileName(keyA), snapshotFileName(keyB), 'index.json'].sort());
    const before = await read(join(base + '.snapshots', snapshotFileName(keyA)), 'utf8');
    await writeSnapshots(base, { [keyA]: a }, 'source');
    assert.deepEqual((await readdir(base + '.snapshots')).sort(), [snapshotFileName(keyA), 'index.json'].sort());
    assert.equal(await read(join(base + '.snapshots', snapshotFileName(keyA)), 'utf8'), before, 'unchanged diagrams are not rewritten');
    assert.deepEqual(await readSnapshots(base), { [keyA]: a });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('engine hooks replace monkey-patching: step listeners run after the sink and can be removed', async () => {
  const seen: string[] = [];
  class Hooks extends Scene {
    override async construct() {
      const off = this.onStep((s) => void seen.push(s.name));
      this.addDescriber(() => ({ extra: 1 }));
      await this.step('one');
      off();
      await this.step('two');
      this.state = { replaced: true };
      assert.deepEqual(this.describe(), { replaced: true, extra: 1 });
    }
  }
  await new Hooks(new NullSink()).run();
  assert.deepEqual(seen, ['one']);
});

test('descriptions read chart values as written, name marks by their word, and report undescribed drawings', async () => {
  const chartSpec = { source: 'xychart-beta\n x-axis [R1,R2]\n y-axis "Tokens" 0 --> 5\n bar [4,0.5]', style: 'nord' };
  const text = (id: string, words: string, x: number) => ({ id, role: 'axis', kind: 'text', shapes: [{ ...square(x, { fill: INK, stroke: 'none' }), text: words, fontSize: 0.2 }] });
  // Channels hold values normalised to the largest (0.5 / 4); the description must not.
  const bar = (cat: string, value: number, x: number) => ({ id: `bar:0:${cat}`, role: 'bar', kind: 'shape', channels: { category: 'bar-0', value }, shapes: [square(x, { fill: ACCENT, stroke: 'none' })] });
  const chart = {
    ...fixedSnapshot(chartSpec, [text('axis:y:title', 'Tokens', -1), text('axis:y:label:0', '0', -1), text('axis:y:label:5', '5', -1), bar('R1', 1, 0), bar('R2', 0.125, 1)], {
      family: 'xychart',
      palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#aaaaaa' },
    }),
    chart: { categories: ['R1', 'R2'], series: [{ kind: 'bar', values: [4, 0.5] }] },
  };
  class Described extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('chart');
      const d = await s.show(chartSpec);
      await d.mark(['bar:0:R2'], { as: 'rejected' });
      await d.note('bar:0:R1', 'full');
      await this.step('drawing');
      await s.enter(new Rectangle({ width: 1, height: 1 }).moveTo([5, 2]));
      await this.step('described');
      await s.clear();
      await s.enter(new Rectangle({ width: 1, height: 1 }), { describe: 'A square' });
    }
  }
  const steps = (await traceScene(bindSnapshots(Described, { [diagramKey(chartSpec)]: chart }))).steps;
  const [first, drawn, described] = steps.map((s) => s.after);
  assert.equal(
    pictureSummary(first),
    'XY chart: Tokens from 0 to 5, 2 categories from R1 to R2. Note: “full” beside R1: 4; rejected: R2: 0.5.',
  );
  assert.equal(
    pictureHtml(first),
    '<ul><li>XY chart: Tokens from 0 to 5, 2 categories from R1 to R2:<ul><li>“full” beside R1: 4 (note);</li><li>R2: 0.5 (rejected);</li><li>R1: 4.</li></ul></li></ul>',
  );
  assert.match(undescribed(drawn).join(), /1 kept drawing with no text/);
  assert.deepEqual(undescribed(described), []);
  assert.equal(pictureSummary(described), 'A square.');
});

test("a participant's bare name and its actor id name the same part, so dimming to two participants keeps their message", async () => {
  const seqSpec = { source: 'sequenceDiagram\n A->>C: hi', style: 'nord' };
  const box = (x: number) => square(x, { fill: '#334455', stroke: '#aabbcc' });
  const seq = fixedSnapshot(
    seqSpec,
    [
      { id: 'actor:A', role: 'actor', kind: 'shape', shapes: [box(0)] },
      { id: 'actor:B', role: 'actor', kind: 'shape', shapes: [box(2)] },
      { id: 'actor:C', role: 'actor', kind: 'shape', shapes: [box(4)] },
      { id: 'message:A->C#0', role: 'message', kind: 'connector', shapes: [box(2)], from: 'A', to: 'C', route: [[0, 0], [4, 0]] },
      { id: 'message:A->B#0', role: 'message', kind: 'connector', shapes: [box(1)], from: 'A', to: 'B', route: [[0, 0], [2, 0]] },
    ],
    { family: 'sequence', palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#aaaaaa' } },
  );
  class Seq extends Scene {
    override async construct() {
      const d = await stage(this).show(seqSpec);
      assert.equal(d.get('A'), d.get('actor:A'));
      await d.dim(['actor:A', 'C']);
      assert.equal(d.get('message:A->C#0').family()[0]!.style.opacity, 1);
      assert.equal(d.get('message:A->B#0').family()[0]!.style.opacity, dimOpacity(seq.palette));
      await d.walk([['actor:A', 'C']]);
    }
  }
  await new (bindSnapshots(Seq, { [diagramKey(seqSpec)]: seq }))(new NullSink(), { skipUntil: Infinity }).run();
});

test('a picture names what is new since the step began, and records nothing new when everything is', () => {
  const card = (value: number) => ({ what: '2 labelled values', parts: [{ name: 'rate: 1' }, { name: `last: ${value}`, mark: 'marked' }] });
  const next = picture([card(2)], shownNames([card(1)]));
  assert.deepEqual(next.changed, ['last: 2']);
  // A new part that is also emphasised is said once, with its emphasis.
  assert.equal(pictureSummary({ picture: next }), '2 labelled values. Marked: last: 2.');
  const unmarked = (value: number) => ({ ...card(value), parts: card(value).parts.map(({ name }) => ({ name })) });
  assert.equal(pictureSummary({ picture: picture([unmarked(2)], shownNames([unmarked(1)])) }), '2 labelled values. New in this step: last: 2.');
  assert.equal(picture([card(2)], new Set()).changed, undefined);
});
