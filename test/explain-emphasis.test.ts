// The stage (explain/stage.ts) and the step pictures it records (explain/trace.ts):
// the heading, clearing, resting frames, and the descriptions readers get.
// A Diagram's own promises are properties in explain-diagrams.property.test.ts;
// descriptions of the shipped explainers are in explain-real.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, Rectangle, Text, FadeIn, SnapshotSink, renderAt, toSvgString, traceScene } from '../src/index.ts';
import { stage, bindSnapshots } from '../explain/index.ts';
import { dimOpacity } from '../explain/look.ts';
import { diagramKey } from '../integrations/agentic-mermaid/snapshot.ts';
import type { DiagramSnapshot } from '../explain/index.ts';
import { fixedSnapshot, square } from './lib/random-snapshot.ts';
import { pictureSummary, pictureHtml, undescribed, picture, shownNames, restingTime, restingFrame } from '../explain/trace.ts';

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

test('a note follows its part through focus; clear() leaves paper and heading, and a cleared diagram can be drawn again', async () => {
  class Notes extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('one');
      const d = await s.show(spec);
      const note = await d.note('C', 'here', { side: 'above' });
      const gap = () => note.center()[0] - d.get('C').center()[0];
      assert.ok(Math.abs(gap()) < 1e-6);
      await d.focus(['A']);
      // Centred over C again, unless the frame's edge holds it back.
      assert.ok(Math.abs(gap()) < 1e-6 || note.center()[0] >= d.frameBox[2] - note.width() / 2 - 0.06);
      await d.focus('all');
      assert.ok(Math.abs(gap()) < 1e-6 && note.center()[1] > d.get('C').box()![3]);
      await s.card([['k', 1]]);
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

test('the time a player, poster or screenshot shows for a step renders that step’s resting frame', async () => {
  class Ends extends Scene {
    override async construct() {
      stage(this, { palette: { paper: PAPER, ink: INK, accent: ACCENT, muted: '#999999' } });
      await this.step('one', { title: 'Fades in to the last frame' });
      await this.play(new FadeIn(new Text('arrives', { color: INK })), { runTime: 1 });
      // The next step changes the picture at its first instant: the step before must not show it.
      await this.step('two', { title: 'Next' });
      this.add(new Text('later', { color: INK }).moveTo([0, -2]));
      await this.wait(0.5);
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
    // The resting frame is the last one the step draws: everything it played has arrived.
    assert.equal(restingFrame(step), step.frame1, step.step);
    const sink = new SnapshotSink();
    await renderAt(Ends, restingTime(step, trace.fps), sink);
    assert.equal(sink.svg, played.get(restingFrame(step)), `${step.step} rests on its final frame`);
  }
});

test('descriptions read chart values as written, name marks by their word, and report drawings with no words', async () => {
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
      await this.step('faint');
      await s.clear();
      // Words too faint to read are not words a reader is given.
      await s.enter(new Text('ghost', { color: INK }).setOpacity(0.3));
      await this.step('described');
      await s.clear();
      await s.enter(new Rectangle({ width: 1, height: 1 }), { describe: 'A square' });
    }
  }
  const steps = (await traceScene(bindSnapshots(Described, { [diagramKey(chartSpec)]: chart }))).steps;
  const [first, drawn, faint, described] = steps.map((s) => s.after);
  assert.equal(
    pictureSummary(first),
    'XY chart: Tokens from 0 to 5, 2 categories from R1 to R2. Note: “full” beside R1: 4; rejected: R2: 0.5.',
  );
  assert.equal(
    pictureHtml(first),
    '<ul><li>XY chart: Tokens from 0 to 5, 2 categories from R1 to R2:<ul><li>“full” beside R1: 4 (note);</li><li>R2: 0.5 (rejected);</li><li>R1: 4.</li></ul></li></ul>',
  );
  assert.match(undescribed(drawn).join(), /1 kept drawing with no text/);
  assert.match(undescribed(faint).join(), /1 kept drawing with no text/);
  assert.doesNotMatch(pictureSummary(faint), /ghost/);
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

test('a description separates its items and sentences once, even when an item ends in a comma', () => {
  // Focused lines of code that end in commas, as state-machine's transition table has.
  const lines = ['1: const next = {', "2:   'idle:CONNECT': 'connecting',", "3:   'connecting:OPENED': 'open',", '4: };'];
  const code = (focus: number[]) => ({ what: 'Code, 4 lines', parts: lines.map((name, i) => ({ name, ...(focus.includes(i) ? { mark: 'focused' } : {}) })) });
  const state = (v: string) => ({ what: '1 labelled value', parts: [{ name: `State: ${v}` }] });
  assert.equal(
    pictureSummary({ picture: picture([code([1]), state('connecting')], shownNames([code([0]), state('idle')])) }),
    "Code, 4 lines; 1 labelled value. Focused: 2: 'idle:CONNECT': 'connecting'. New in this step: 1 labelled value.",
  );
  assert.equal(
    pictureSummary({ picture: picture([code([1, 2])], new Set()) }),
    "Code, 4 lines. Focused: 2: 'idle:CONNECT': 'connecting'; 3: 'connecting:OPENED': 'open'.",
  );
});
