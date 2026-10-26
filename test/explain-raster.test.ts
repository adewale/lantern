// PNG output (explain shots and preview's contact sheet, the gallery tiles, the film)
// rasterises with resvg 2.6.2, which aborts the whole process (a Rust panic, exit 134)
// on a translucent element the camera has left outside its view. Every path culls what
// the camera cannot show first. The shots path runs in a child process: an abort would
// take the test runner down with it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Scene, NullSink, Rectangle, Text, toSvgString, loadFonts } from '../src/index.ts';
import type { Box } from '../src/index.ts';
import { ROOT, collectProject } from '../tools/lib/explain-project.ts';
import { band } from '../tools/lib/explain-video.ts';
import { contactSheet } from '../tools/lib/explain-shots.ts';

// resvg is a devDependency here and an optional peer for users: without it there is no PNG to make.
const resvg = await import('@resvg/resvg-js').then(
  () => true,
  () => false,
);
const skip = resvg ? false : '@resvg/resvg-js is not installed (PNG and video only)';

const folder = await mkdtemp(join(tmpdir(), 'lantern-raster-'));
after(() => rm(folder, { recursive: true, force: true }));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A scene that passes `explain check`: the camera zooms onto one label while another, off to
// the side, fades to 0.3. The faded label is then outside the view, and translucent.
const DIM = `import{Scene,Text}from'rayner';import{stage}from'rayner/explain';
export default class Dim extends Scene{async construct(){const s=stage(this);
await this.step('one',{caption:'Two labels.'});
const far=new Text('dimmed node',{fontSize:0.3}).moveTo([6,3]);
await s.enter(new Text('here',{fontSize:0.4}),{describe:'here'});
await s.enter(far,{describe:'elsewhere'});
await this.step('two',{caption:'Zoom on one; the other dims.'});
await this.play(this.frame.animate.fit([-2,-1.125,2,1.125],{margin:0}),far.animate.setOpacity(0.3));
}}`;

test('explain shots draws a zoomed frame with a translucent label outside the view', { skip }, async () => {
  const dir = join(folder, 'dim');
  await mkdir(dir);
  await writeFile(join(dir, 'scene.ts'), DIM);
  const out = join(dir, 'sheet.png');
  const run = spawnSync(process.execPath, [join(ROOT, 'tools/explain.ts'), 'shots', dir, '--out', out], { encoding: 'utf8' });
  assert.equal(run.status, 0, `explain shots exited ${run.status} (signal ${run.signal}):\n${run.stderr.slice(-2000)}`);
  assert.deepEqual((await readFile(out)).subarray(0, 8), PNG);
  assert.match(await readFile(join(dir, 'sheet.svg'), 'utf8'), /^<svg /);
});

test('the film leaves out what the camera cannot show', async () => {
  // explain-video's band() is every film frame's SVG; resvg aborts on this frame uncut.
  await loadFonts();
  const scene = new Scene(new NullSink());
  scene.add(new Rectangle({ width: 1, height: 1 }));
  scene.add(new Text('label', { fontSize: 0.3, color: '#ab1234' }).moveTo([6.5, 3.8]).setOpacity(0.3));
  scene.frame.fit([-2, -1.125, 2, 1.125] as Box, { margin: 0 });
  assert.match(toSvgString(scene, { width: 640 }), /#ab1234/, 'uncut, the label is drawn');
  assert.doesNotMatch(band(scene, 640, 9), /#ab1234/, 'the film frame leaves the off-view label out');
});

test('a contact sheet --out with no extension writes NAME.png and NAME.svg beside it', { skip }, async () => {
  const dir = join(folder, 'plain');
  await mkdir(dir);
  await writeFile(
    join(dir, 'scene.ts'),
    `import{Scene,Text}from'rayner';import{stage}from'rayner/explain';export default class Plain extends Scene{async construct(){const s=stage(this);await this.step('one',{caption:'A label.'});await s.enter(new Text('hello',{fontSize:0.4}),{describe:'hello'});}}`,
  );
  // A dot in the folder's name, none in the file's: the SVG used to land in the parent folder.
  const sheets = join(dir, 'v1.2');
  await contactSheet(await collectProject(dir, { write: false }), join(sheets, 'sheet'));
  assert.deepEqual((await readdir(sheets)).sort(), ['sheet.png', 'sheet.svg']);
  assert.deepEqual((await readFile(join(sheets, 'sheet.png'))).subarray(0, 8), PNG);
  assert.deepEqual((await readdir(dir)).sort(), ['scene.ts', 'v1.2']);
});

// resvg 2.6.2 also panics (geom.rs: unwrap on None) on a compositing layer round a path with no
// area, such as a horizontal line fading in or out: a callout's leader or a dimension line. A path
// showing one paint carries its opacity on that paint, so it needs no layer.
test('a fading horizontal line rasterises: its opacity rides on its stroke', { skip }, async () => {
  const { Line, Circle } = await import('../src/index.ts');
  const scene = new Scene(new NullSink());
  const line = new Line([-2, 0], [2, 0], { stroke: '#000000', strokeWidth: 0.004 });
  line.style.opacity = 0.79;
  // Fill and stroke together still need the element's opacity, where they overlap.
  const both = new Circle({ radius: 0.5, fill: '#ff0000', fillOpacity: 1, stroke: '#000000', strokeWidth: 0.05 }).moveTo([0, 1]);
  both.style.opacity = 0.5;
  scene.add(line, both);
  const svg = toSvgString(scene, { width: 480 });
  assert.match(svg, /stroke-opacity="0\.79"/);
  assert.equal((svg.match(/ opacity="/g) ?? []).length, 1);
  // In a child process: an abort would take the test runner down.
  const file = join(folder, 'fade.svg');
  await writeFile(file, svg);
  const run = spawnSync(process.execPath, ['-e', `import('@resvg/resvg-js').then(({Resvg})=>{new Resvg(require('node:fs').readFileSync(${JSON.stringify(file)},'utf8')).render();console.log('ok')})`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
