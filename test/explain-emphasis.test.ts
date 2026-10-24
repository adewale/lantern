import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Scene, NullSink, Rectangle, Text, Dot, FadeIn, SnapshotSink, renderAt, toSvgString, traceScene } from '../src/index.ts';
import { stage, bindSnapshots, diagramKey, emphasis } from '../explain/index.ts';
import type { DiagramSnapshot } from '../explain/index.ts';
import { collectProject } from '../tools/lib/explain-project.ts';
import { checkProject, restingTextProblems } from '../tools/lib/explain-check.ts';

const spec = { source: 'graph LR\nA --> B\nB --> C', style: 'nord' };
const PAPER = '#123456',
  INK = '#ffffff',
  ACCENT = '#ff8800';
function fixture(): DiagramSnapshot {
  const shape = (x: number, extra: Record<string, unknown> = {}) => {
    const m = new Rectangle({ width: 0.5, height: 0.5, fill: '#334455', stroke: '#aabbcc' }).moveTo([x, 0]);
    return { subpaths: m.subpaths.map((a) => Array.from(a)), closed: m.closed, style: { ...m.style, ...extra } };
  };
  const edge = (from: string, to: string, x: number) => ({
    id: `edge:${from}->${to}#0`,
    role: 'edge',
    kind: 'connector',
    svg: '',
    // A stroked line and a filled arrowhead, as Agentic Mermaid draws them.
    shapes: [shape(x, { fill: 'none' }), shape(x + 0.5, { fill: '#aabbcc', stroke: 'none' })],
    from,
    to,
    route: [
      [x - 1, 0],
      [x + 1, 0],
    ] as [number, number][],
  });
  return {
    version: 1,
    renderer: 'agentic-mermaid@0.4.1',
    spec,
    family: 'flowchart',
    width: 800,
    height: 200,
    palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#aaaaaa' },
    svg: '',
    findings: { ok: true, warnings: [] },
    parts: [
      { id: 'A', role: 'node', kind: 'shape', svg: '', shapes: [shape(0)] },
      { id: 'B', role: 'node', kind: 'shape', svg: '', shapes: [shape(3)] },
      { id: 'C', role: 'node', kind: 'shape', svg: '', shapes: [shape(6)] },
      edge('A', 'B', 1.5),
      edge('B', 'C', 4.5),
    ],
  };
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
      assert.equal(d.get('C').family()[1]!.style.opacity, 0.2);
      assert.equal(d.get('edge:B->C#0').family()[1]!.style.opacity, 0.2);
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
      assert.ok(card.box()![0] >= s.regions.side[0] - 1e-6, 'region placement');
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
    '"off the edge" is cut off by the frame',
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
      const card = await s.card([['Rows', 1]], { at: 'side' });
      await card.fade(0.3);
      assert.equal(card.bar.style.opacity, 0, 'hidden bar stays hidden');
      assert.equal(card.panel.style.opacity, 0.3);
      await card.fade(1);
      const code = await s.code(['x'], { at: 'bottom' });
      assert.ok(code.box()![1] >= s.regions.bottom[1] - 1e-6);
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
