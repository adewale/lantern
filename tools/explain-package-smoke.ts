#!/usr/bin/env node
// Explicit distribution gate: pack, install in a fresh author project, run the installed CLI.
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { ROOT } from './lib/explain-project.ts';
const run = promisify(execFile),
  folder = await mkdtemp(join(tmpdir(), 'lantern-package-'));
try {
  const packed = await run('npm', ['pack', '--json', '--pack-destination', folder], {
    cwd: ROOT,
    maxBuffer: 4 * 1024 * 1024,
  });
  const file = JSON.parse(packed.stdout)[0].filename;
  await writeFile(
    join(folder, 'package.json'),
    JSON.stringify({ name: 'outside-author', private: true, type: 'module' }),
  );
  await run('npm', ['install', '--no-audit', '--no-fund', join(folder, file)], {
    cwd: folder,
    maxBuffer: 4 * 1024 * 1024,
  });
  const cli = join(folder, 'node_modules/manim-js/dist/tools/explain.js');
  const bin = join(folder, 'node_modules/.bin/explain');
  assert.match((await run(bin, ['--help'], { cwd: folder })).stdout, /Lantern Explainers/);
  await run(process.execPath, [cli, 'init', 'lesson'], { cwd: folder });
  if (process.env.EXPLAIN_BROWSER) {
    await run(bin, ['snapshots', 'lesson', '--refresh'], { cwd: folder });
    const cache = JSON.parse(await readFile(join(folder, 'lesson/scene.snapshots.json'), 'utf8'));
    assert.equal(Object.keys(cache.diagrams).length, 1);
  }
  // Use native objects only, so this distribution smoke needs no browser or optional renderer.
  await writeFile(
    join(folder, 'lesson/scene.ts'),
    `import{Scene,Text,FadeIn}from'manim-js';import{stage,settingsOf}from'manim-js/explain';export default class Outside extends Scene{static meta={id:'outside',title:'An outside author'};static settings=[{id:'case',label:'Case',default:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}]}];async construct(){const s=stage(this);await this.step('one',{title:'First step',caption:'A native scene outside the checkout.'});await this.play(new FadeIn(new Text(settingsOf(this).case,{color:s.palette.ink})));}}`,
  );
  await run(process.execPath, [cli, 'check', 'lesson'], { cwd: folder });
  await run(process.execPath, [cli, 'build', 'lesson', '--out', 'public/outside.html'], { cwd: folder });
  const html = await readFile(join(folder, 'public/outside.html'), 'utf8');
  assert.match(html, /An outside author/);
  assert.match(html, /id="licenses"/);
  assert.ok(!html.includes('node_modules/agentic-mermaid'));
  const result = await run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import{Scene,NullSink}from'manim-js';import{stage}from'manim-js/explain';const scene=new Scene(new NullSink());await scene.run();stage(scene);console.log(scene.mobjects.length);`,
    ],
    { cwd: folder },
  );
  assert.equal(result.stdout.trim(), '2');
  if (process.env.EXPLAIN_VIDEO)
    await run(bin, ['render', 'lesson', '--out', 'public/outside.mp4', '--footer', '--fps', '4'], {
      cwd: folder,
    });
  console.log(
    'Package gate passed: archive install, executable JS bin, external native author, settings, checks, build, notices, one compiled engine' +
      (process.env.EXPLAIN_VIDEO ? ', installed video export' : '') +
      (process.env.EXPLAIN_BROWSER ? ', installed diagram capture' : '') +
      '.',
  );
} finally {
  await rm(folder, { recursive: true, force: true });
}
