#!/usr/bin/env node
// Explicit distribution gate: pack, install in a fresh author project, run the installed CLI.
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
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
  const cli = join(folder, 'node_modules/rayner/dist/tools/explain.js');
  const bin = join(folder, 'node_modules/.bin/explain');
  assert.match((await run(bin, ['--help'], { cwd: folder })).stdout, /Rayner \(Node 26\+\)/);
  await run(process.execPath, [cli, 'init', 'first'], { cwd: folder });
  // A default install leaves the optional peers out; the template's diagram then names what to install.
  const peers = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).peerDependencies;
  for (const name of Object.keys(peers)) assert.ok(!existsSync(join(folder, 'node_modules', name)), `${name} installed by default`);
  const refused: string = await run(bin, ['snapshots', 'first'], { cwd: folder }).then(() => '', (e) => e.stderr);
  const install = /Install: npm (i .+)/.exec(refused)?.[1];
  assert.ok(install, refused);
  if (process.env.EXPLAIN_BROWSER) {
    await run('npm', [...install.split(' '), '--no-audit', '--no-fund'], { cwd: folder, maxBuffer: 4 * 1024 * 1024 });
    await run(bin, ['snapshots', 'first', '--refresh'], { cwd: folder });
    const cache = JSON.parse(await readFile(join(folder, 'first/scene.snapshots/index.json'), 'utf8'));
    assert.equal(Object.keys(cache.diagrams).length, 1);
  }
  // Use native objects only, so this distribution smoke needs no browser or optional renderer.
  await writeFile(
    join(folder, 'first/scene.ts'),
    `import{Scene,Text,FadeIn}from'rayner';import{stage,settingsOf}from'rayner/explain';export default class Outside extends Scene{static meta={id:'outside',title:'An outside author'};static settings=[{id:'case',label:'Case',default:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}]}];async construct(){const s=stage(this);await this.step('one',{title:'First step',caption:'A native scene outside the checkout.'});await this.play(new FadeIn(new Text(settingsOf(this).case,{color:s.palette.ink})));}}`,
  );
  await run(process.execPath, [cli, 'check', 'first'], { cwd: folder });
  await run(process.execPath, [cli, 'build', 'first', '--out', 'public/outside.html'], { cwd: folder });
  const html = await readFile(join(folder, 'public/outside.html'), 'utf8');
  assert.match(html, /An outside author/);
  assert.match(html, /id="licenses"/);
  assert.ok(!html.includes('node_modules/agentic-mermaid'));
  // Lettering on request from the installed package: the fixture scene with its pinned cuts,
  // so the build reads vendor/lettering/ and src/lettering.js from the archive and needs no fonttools.
  const fixture = join(ROOT, 'test/fixtures/lettering');
  await mkdir(join(folder, 'greek'));
  await writeFile(
    join(folder, 'greek/scene.ts'),
    (await readFile(join(fixture, 'scene.ts'), 'utf8'))
      .replace("'../../../src/index.ts'", "'rayner'")
      .replace("'../../../explain/index.ts'", "'rayner/explain'")
      .replace("'../../../src/lettering.ts'", "'rayner/lettering'"),
  );
  await copyFile(join(fixture, 'scene.lettering.json'), join(folder, 'greek/scene.lettering.json'));
  await run(process.execPath, [cli, 'build', 'greek', '--out', 'public/greek.html'], {
    cwd: folder,
    env: { ...process.env, PYFTSUBSET: join(folder, 'no-fonttools-here') },
  });
  const lettered = JSON.parse(await readFile(join(folder, 'public/greek.html.receipt.json'), 'utf8'));
  assert.deepEqual(lettered.lettering.scripts, ['Grek']);
  assert.ok(!JSON.parse(await readFile(join(folder, 'public/outside.html.receipt.json'), 'utf8')).lettering);
  const result = await run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import{Scene,NullSink}from'rayner';import{stage}from'rayner/explain';const scene=new Scene(new NullSink());await scene.run();stage(scene);console.log(scene.mobjects.length);`,
    ],
    { cwd: folder },
  );
  assert.equal(result.stdout.trim(), '2');
  // describeExplainer from the installed package: the outside author's scene, both cases.
  const described = await run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import{describeExplainer}from'rayner/explain';import S from'./first/scene.ts';const d=await describeExplainer(S);console.log(d.cases.map((c)=>c.values.case+':'+c.steps.map((s)=>s.step).join(',')).join(' '));`,
    ],
    { cwd: folder },
  );
  assert.equal(described.stdout.trim(), 'a:one b:one');
  if (process.env.EXPLAIN_VIDEO) {
    await run('npm', ['i', `@resvg/resvg-js@${peers['@resvg/resvg-js']}`, '--no-audit', '--no-fund'], { cwd: folder });
    await run(bin, ['render', 'first', '--out', 'public/outside.mp4', '--footer', '--fps', '4'], {
      cwd: folder,
    });
  }
  console.log(
    'Package gate passed: archive install without optional peers, executable JS bin, install hint, external native author, settings, checks, build, describeExplainer, notices, lettering on request, one compiled engine' +
      (process.env.EXPLAIN_VIDEO ? ', installed video export' : '') +
      (process.env.EXPLAIN_BROWSER ? ', installed diagram capture' : '') +
      '.',
  );
} finally {
  await rm(folder, { recursive: true, force: true });
}
