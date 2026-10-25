// One seeded defect per gate, through the entry points `explain check` uses:
// collectProject (load, cases, named steps, drawable text) and checkProject
// (every check on every case). Each scene breaks exactly one rule and must fail
// with that gate's own message; the clean scene shows the same shape passes.
// Render's own gates (footer fit, hold, footer glyphs) are in explain-video.test.ts.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectProject, writeSnapshots, ROOT } from '../tools/lib/explain-project.ts';
import { checkProject } from '../tools/lib/explain-check.ts';
import { diagramKey } from '../integrations/agentic-mermaid/snapshot.ts';
import type { DiagramSnapshot } from '../explain/index.ts';
import { fixedSnapshot, square } from './lib/random-snapshot.ts';

const folder = await mkdtemp(join(tmpdir(), 'lantern-gates-'));
after(() => rm(folder, { recursive: true, force: true }));

const HEAD = `import{Scene,Text,Dot,Rectangle,FadeIn}from'manim-js';import{stage,settingsOf}from'manim-js/explain';`;
/** A scene module: `pre` at module level, `body` inside construct() after `const s=stage(this)`. */
const scene = (body: string, pre = '', statics = '') =>
  `${HEAD}${pre}export default class Seeded extends Scene{${statics}async construct(){const s=stage(this);${body}}}`;
const label = (words: string, at = '[0,0]', size = 0.4) =>
  `await s.enter(new Text(${JSON.stringify(words)},{fontSize:${size}}).moveTo(${at}),{describe:${JSON.stringify(words)}});`;

let n = 0;
async function write(source: string, snapshots?: Record<string, DiagramSnapshot>): Promise<string> {
  const dir = join(folder, String(n++));
  await mkdir(dir);
  await writeFile(join(dir, 'scene.ts'), source);
  if (snapshots) await writeSnapshots(join(dir, 'scene'), snapshots, 'test');
  return dir;
}
const checked = async (dir: string) => checkProject(await collectProject(dir, { write: false }), join(dir, 'checks'));

test('a clean scene passes every gate', async () => {
  const report = await checked(await write(scene(`await this.step('one',{caption:'A label.'});${label('hello')}await this.step('two',{caption:'Another.'});${label('world', '[0,-2]')}`)));
  assert.equal((report.variants as unknown[]).length, 1);
});

test('numerals outside Latin draw from the fallback faces and pass every gate, in sans and mono', async () => {
  const report = await checked(
    await write(
      scene(
        `await this.step('one',{caption:'Numerals.'});${label('٣ ۳ ३ ３ 三 Ⅻ ² ½ ①')}await this.step('two',{caption:'In code.'});await s.enter(new Text('n = int("٣") # 三 Ⅻ',{fontSize:.4,font:'mono'}).moveTo([0,-2]),{describe:'code'});`,
      ),
    ),
  );
  assert.equal((report.variants as unknown[]).length, 1);
});

// A diagram whose label B is readable only in mid-sweep: focus(['B']) zooms to it, focus('all') ends the step with it at 4 px.
const spec = { source: 'graph LR\nA -->|hello| B', style: 'nord' };
function smallLabel(): DiagramSnapshot {
  const shape = (x: number) => square(x, { fill: '#fff', stroke: '#000' });
  const snapshot = fixedSnapshot(
    spec,
    [
      { id: '__frame', role: 'frame', kind: 'shape', shapes: [shape(0)] },
      { id: 'A', role: 'node', kind: 'shape', shapes: [shape(0)] },
      { id: 'B', role: 'node', kind: 'shape', shapes: [shape(3)] },
      { id: 'edge:A->B#0', role: 'edge', kind: 'connector', shapes: [shape(1)], from: 'A', to: 'B', route: [[0.25, 0], [2.75, 0]] },
      { id: 'edge-label:A->B#0', owner: 'edge:A->B#0', role: 'edge-label', kind: 'text', shapes: [shape(1.5)] },
    ],
    { palette: { paper: '#123456', ink: '#fff', accent: '#ff0', muted: '#aaa' } },
  );
  snapshot.width = 1600;
  snapshot.height = 900;
  snapshot.parts.find((p) => p.id === 'B')!.shapes.push({
    subpaths: [],
    closed: [],
    style: { fill: '#ffffff', stroke: 'none', strokeWidth: 0, fillOpacity: 1, strokeOpacity: 1, opacity: 1 },
    text: 'B',
    fontSize: 0.04,
    textRun: { text: 'B', x: 300, y: 0, size: 4, matrix: [1, 0, 0, 1, 0, 0] },
  });
  return snapshot;
}

const gates: { gate: string; source: string; message: RegExp; snapshots?: () => Record<string, DiagramSnapshot> }[] = [
  {
    gate: 'catch lint: a catch around awaited construct code',
    source: scene(`try{await this.step('one');${label('hello')}}catch(e){}`),
    message: /Do not catch around awaited animation\/step calls/,
  },
  {
    // Module state survives between runs, so the seeked run draws a different count than the played one.
    gate: 'seek = play',
    source: scene(`await this.step('one');await s.enter(new Text('run '+(++runs),{fontSize:.4}),{describe:'runs'});`, 'let runs=0;'),
    message: /Seek mismatch at frame \d+/,
  },
  {
    gate: 'skipped trace = played trace',
    source: scene(`await this.step('one');${label('hello')}this.state.run=++runs;`, 'let runs=0;'),
    message: /Skipped and played traces differ/,
  },
  {
    gate: 'bare runtime',
    source: scene(`await this.step('one');${label('hello')}this.state.where=typeof process==='object'?'node':'bare';`),
    message: /The bare runtime \(no DOM, no Node\) disagrees with the trace/,
  },
  {
    gate: 'motion: a text removed without an animation',
    source: scene(`await this.step('one');const t=new Text('hello',{fontSize:.4});await s.enter(t,{describe:'hello'});await this.step('two');this.remove(t);${label('bye', '[0,-2]')}`),
    message: /Motion failures .*cut-out/,
  },
  {
    // The film holds, and the player stops on, the picture where the caption hold begins.
    gate: 'hold: the picture moves after the step’s last play()',
    source: scene(`await this.step('moves',{caption:'A caption long enough to need a hold of a few seconds at reading pace.'});const d=new Dot();await s.enter(d,{describe:'a dot'});d.addUpdater((m,dt)=>{m.shift([dt*0.5,0])});`),
    message: /The picture changes after the caption hold begins/,
  },
  {
    gate: 'step change: a step that ends on the same picture',
    source: `import{Scene,Text,FadeIn}from'manim-js';import{stage}from'manim-js/explain';export default class Same extends Scene{async construct(){const s=stage(this);await this.step('one',{title:'One'});await this.play(new FadeIn(new Text('hello',{color:s.palette.ink})));await this.step('two',{title:'Two',caption:'Nothing new is drawn.'});await this.wait(.5);}}`,
    message: /Each step must change the picture[^]*two/,
  },
  {
    gate: 'text collision',
    source: scene(`await this.step('one');${label('first label')}${label('second label', '[0.2,0.05]')}`),
    message: /Resting frames have colliding or cut-off text/,
  },
  {
    gate: 'imported legibility: a label readable only mid-sweep',
    source: `import{Scene}from'manim-js';import{stage}from'manim-js/explain';export default class Camera extends Scene{async construct(){const s=stage(this);await this.step('one',{caption:'Read the label.'});const d=await s.show(${JSON.stringify(spec)});await d.focus(['B']);await this.wait(.5);await d.focus('all');await this.wait(.5);}}`,
    snapshots: () => ({ [diagramKey(spec)]: smallLabel() }),
    message: /Imported labels need a readable completed-step view/,
  },
  {
    gate: 'native legibility',
    source: scene(`await this.step('one');${label('tiny', '[0,0]', 0.05)}`),
    message: /Labels never reach 14px at 1280px stage/,
  },
  {
    gate: 'picture descriptions: a drawing with no words',
    source: scene(`await this.step('one');await s.enter(new Rectangle({width:1,height:1}));`),
    message: /Every drawing needs words for readers who cannot see it/,
  },
  {
    gate: 'missing glyphs, named by case, step and code point',
    source: scene(
      `await this.step('one');${label('ok')}await this.step('two');await s.enter(new Text(settingsOf(this).k==='b'?'a中b':'ab',{fontSize:.4}).moveTo([0,-2]),{describe:'text'});`,
      '',
      `static settings=[{id:'k',label:'Kind',default:'a',options:[{value:'a',label:'Plain'},{value:'b',label:'Han'}]}];`,
    ),
    message: /Kind: Han, step two: "a中b" has 中 \(U\+4E2D\)/,
  },
  {
    // The fallback faces hold digits and a few numerals, not their scripts: an Arabic letter, which
    // would need shaping, and a Thai digit still fail, and only they are named.
    gate: 'missing glyphs: a fallback face covers numerals, not its whole script',
    source: scene(`await this.step('one');await s.enter(new Text('٣ب ३ ๓',{fontSize:.4}),{describe:'text'});`),
    message: /step one: "٣ب ३ ๓" has ب \(U\+0628\), ๓ \(U\+0E53\)$/m,
  },
  {
    gate: 'duplicate step names',
    source: `import{Scene}from'manim-js';export default class Bad extends Scene{async construct(){await this.step('same');await this.wait(.5);await this.step('same');await this.wait(.5);}}`,
    message: /Duplicate step names/,
  },
  {
    gate: 'a case with no steps',
    source: `import{Scene,Dot,FadeIn}from'manim-js';export default class Bad extends Scene{async construct(){await this.play(new FadeIn(new Dot()));}}`,
    message: /Each case needs non-empty named steps/,
  },
  {
    gate: 'one scene export',
    source: `import{Scene}from'manim-js';export class A extends Scene{async construct(){await this.step('a');await this.wait(.5)}}export class B extends Scene{async construct(){await this.step('b');await this.wait(.5)}}`,
    message: /Export one Scene subclass/,
  },
];
for (const { gate, source, message, snapshots } of gates)
  test(`gate fails with its own message: ${gate}`, async () => {
    await assert.rejects(checked(await write(source, snapshots?.())), message);
  });

test('explain check exits 1 and names the failing gate on stderr', async () => {
  const dir = await write(gates.find((g) => g.gate === 'seek = play')!.source);
  let refused: { status: number; stderr: Buffer } | undefined;
  try {
    execFileSync(process.execPath, [join(ROOT, 'tools/explain.ts'), 'check', dir, '--out', join(dir, 'checks')], { stdio: 'pipe' });
  } catch (error) {
    refused = error as { status: number; stderr: Buffer };
  }
  assert.equal(refused?.status, 1, 'check must exit 1 on a scene whose seek differs from play');
  assert.match(String(refused?.stderr), /^explain: Seek mismatch at frame \d+/);
});
