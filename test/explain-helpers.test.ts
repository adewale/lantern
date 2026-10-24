import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, Rectangle, traceScene } from '../src/index.ts';
import { stage, bindSnapshots, diagramKey, snapshotResolver } from '../explain/index.ts';
import type { DiagramSnapshot } from '../explain/index.ts';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProject } from '../tools/lib/explain-project.ts';
import { checkProject, lintConstruct } from '../tools/lib/explain-check.ts';
import { resizeHeight, exactHttpOrigin } from '../app/embed-protocol.ts';

const spec = { source: 'graph LR\nA -->|hello| B', style: 'nord' };
function fixture(): DiagramSnapshot {
  const shape = (x: number) => {
    const m = new Rectangle({ width: 0.5, height: 0.5, fill: '#fff', stroke: '#000' }).moveTo([x, 0]);
    return { subpaths: m.subpaths.map((a) => Array.from(a)), closed: m.closed, style: m.style };
  };
  return {
    version: 1,
    renderer: 'agentic-mermaid@0.4.1',
    spec,
    family: 'flowchart',
    width: 400,
    height: 200,
    palette: { paper: '#123456', ink: '#fff', accent: '#ff0', muted: '#aaa' },
    svg: '',
    findings: { ok: true, warnings: [] },
    parts: [
      { id: '__frame', role: 'frame', kind: 'shape', svg: '', shapes: [shape(0)] },
      { id: 'A', role: 'node', kind: 'shape', svg: '', shapes: [shape(0)] },
      { id: 'B', role: 'node', kind: 'shape', svg: '', shapes: [shape(3)] },
      {
        id: 'edge:A->B#0',
        role: 'edge',
        kind: 'connector',
        svg: '',
        shapes: [shape(1)],
        from: 'A',
        to: 'B',
        route: [
          [0.25, 0],
          [2.75, 0],
        ],
      },
      {
        id: 'edge-label:A->B#0',
        owner: 'edge:A->B#0',
        role: 'edge-label',
        kind: 'text',
        svg: '',
        shapes: [shape(1.5)],
      },
    ],
  };
}
test('frame reveal, semantic labels, real-link walks and palette adoption use native objects', async () => {
  class Demo extends Scene {
    override async construct() {
      const s = stage(this);
      await this.step('frame');
      const d = await s.show(spec, { build: 'frame' });
      assert.equal(s.paper.style.fill, '#123456');
      assert.deepEqual([...d.visible], ['__frame']);
      await d.focus(['A']);
      assert.ok(!this.familyMembers().some((m) => m.key === 'A'));
      await d.reveal(['A', 'B', 'edge:A->B#0']);
      assert.equal(d.get('edge-label:A->B#0').parent, d.get('edge:A->B#0'));
      await d.walk([['A', 'B']]);
      await assert.rejects(d.walk([['B', 'A']]), /not a real link/);
      await assert.rejects(d.reveal(-1), /non-negative/);
      this.state = { answer: 42 }; // Model replacement must not erase helper evidence.
    }
  }
  const trace = await traceScene(bindSnapshots(Demo, { [diagramKey(spec)]: fixture() }));
  assert.deepEqual(trace.steps[0]!.after!.walks, [
    { step: 'frame', from: 'A', to: 'B', edge: 'edge:A->B#0' },
  ]);
});
test('snapshot JSON rejects corrupt points, paint, ownership and source identity without dropping artwork', async () => {
  const good = fixture();
  assert.equal(await snapshotResolver({ [diagramKey(spec)]: good }).diagram(spec), good);
  const corruptions = [
    (s: DiagramSnapshot) => {
      s.parts[0]!.shapes[0]!.subpaths[0]![0] = null as unknown as number;
    },
    (s: DiagramSnapshot) => {
      s.parts[0]!.shapes[0]!.style.fill = 'url(https://outside.test/image)';
    },
    (s: DiagramSnapshot) => {
      s.parts[0]!.owner = s.parts[0]!.id;
    },
    (s: DiagramSnapshot) => {
      s.parts[0]!.shapes[0]!.closed = [];
    },
    (s: DiagramSnapshot) => {
      s.width = Infinity;
    },
  ];
  for (const corrupt of corruptions) {
    const broken = JSON.parse(JSON.stringify(good));
    corrupt(broken);
    await assert.rejects(
      snapshotResolver({ [diagramKey(spec)]: broken }).diagram(spec),
      /Invalid diagram snapshot/,
    );
  }
  await assert.rejects(
    snapshotResolver({ [diagramKey(spec)]: { ...good, spec: { source: 'graph LR\\nX-->Y' } } }).diagram(spec),
    /does not match/,
  );
});

test('legibility requires a readable completed step, not just a transient camera sweep', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lantern-legibility-'));
  try {
    const snapshot = fixture();
    snapshot.width = 1600;
    snapshot.height = 900;
    snapshot.parts
      .find((p) => p.id === 'B')!
      .shapes.push({
        subpaths: [],
        closed: [],
        style: {
          fill: '#ffffff',
          stroke: 'none',
          strokeWidth: 0,
          fillOpacity: 1,
          strokeOpacity: 1,
          opacity: 1,
        },
        text: 'B',
        fontSize: 0.04,
        textRun: { text: 'B', x: 300, y: 0, size: 4, matrix: [1, 0, 0, 1, 0, 0] },
      });
    const file = join(folder, 'scene.ts');
    await writeFile(
      file,
      `import{Scene}from'manim-js';import{stage}from'manim-js/explain';export default class Camera extends Scene{async construct(){const s=stage(this);await this.step('one',{caption:'Read the label.'});const d=await s.show(${JSON.stringify(spec)});await d.focus(['B']);await this.wait(.5);await d.focus('all');await this.wait(.5);}}`,
    );
    await writeFile(
      join(folder, 'scene.snapshots.json'),
      JSON.stringify({ version: 1, importer: 4, diagrams: { [diagramKey(spec)]: snapshot } }),
    );
    const project = await collectProject(file, { write: false });
    await assert.rejects(checkProject(project, join(folder, 'checks')), /readable completed-step view/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('construct lint distinguishes pure model catches from catches around animations', () => {
  assert.deepEqual(
    lintConstruct(
      'class S { async construct(){ try { model.push(1) } catch(e) { report(e) } await this.step("ok"); } }',
    ),
    [],
  );
  assert.match(
    lintConstruct('class S { async construct(){ try { await this.step("x") } catch(e) {} } }')[0]!,
    /StopScene/,
  );
});
test('resize protocol validates both authorities and a finite bounded integer payload', () => {
  const source = {} as MessageEventSource,
    origin = 'https://example.test';
  const event = { source, origin, data: { type: 'lantern:resize', version: 1, height: 742 } };
  assert.equal(resizeHeight(event, origin, source), 742);
  assert.equal(resizeHeight({ ...event, source: {} as MessageEventSource }, origin, source), null);
  assert.equal(resizeHeight({ ...event, origin: 'https://other.test' }, origin, source), null);
  for (const height of [-1, 0, 100001, 0.5, NaN, Infinity, -Infinity, '742', null, {}, []])
    assert.equal(resizeHeight({ ...event, data: { ...event.data, height } }, origin, source), null);
  for (const data of [
    null,
    [],
    {},
    'message',
    { ...event.data, version: 2 },
    { ...event.data, type: 'other' },
  ])
    assert.equal(resizeHeight({ ...event, data }, origin, source), null);
  for (const input of [
    null,
    '*',
    'null',
    'file:///tmp/x',
    'https://example.test/path',
    'https://example.test/',
    'javascript:alert(1)',
  ])
    assert.equal(exactHttpOrigin(input), null);
  assert.equal(exactHttpOrigin(origin), origin);
});
test('inline script escaping neutralises </script without changing what the code does', async () => {
  const { scriptEscape } = await import('../tools/lib/explain-project.ts');
  const vm = await import('node:vm');
  // The regex that broke the built Lantern page, plus the cases HTML parsing cares about.
  const code =
    'globalThis.out = ["a<b</c".replace(/</g, "&lt;"), "</script>".length, /<\\/SCRIPT>/i.test("</script>"), "x\\u2028y".length];';
  const escaped = scriptEscape(code);
  assert.doesNotMatch(escaped, /<\/script/i);
  const run = (source: string) => {
    const context = vm.createContext({});
    vm.runInContext(source, context);
    return JSON.stringify((context as { out: unknown }).out);
  };
  assert.equal(run(escaped), run(code));
});
