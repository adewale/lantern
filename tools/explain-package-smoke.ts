#!/usr/bin/env node
// Explicit distribution gate: pack, install in a fresh author project, run the installed CLI.
import { mkdtemp, mkdir, writeFile, readFile, copyFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { ROOT } from './lib/explain-project.ts';
const run = promisify(execFile),
  folder = await mkdtemp(join(tmpdir(), 'rayner-package-'));
try {
  const { values } = parseArgs({ options: { archive: { type: 'string' } } });
  const packed = values.archive ? undefined : await run('npm', ['pack', '--json', '--pack-destination', folder], {
    cwd: ROOT,
    maxBuffer: 4 * 1024 * 1024,
  });
  const archive = values.archive ? resolve(values.archive) : join(folder, JSON.parse(packed!.stdout)[0].filename);
  await writeFile(
    join(folder, 'package.json'),
    JSON.stringify({ name: 'outside-author', private: true, type: 'module' }),
  );
  await run('npm', ['install', '--no-audit', '--no-fund', archive], {
    cwd: folder,
    maxBuffer: 4 * 1024 * 1024,
  });
  const cli = join(folder, 'node_modules/rayner/dist/tools/explain.js');
  const bin = join(folder, 'node_modules/.bin/rayner');
  const { version, peerDependencies: peers } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  assert.ok((await run(bin, ['--help'], { cwd: folder })).stdout.startsWith(`Rayner ${version} (Node 26+)`));
  assert.equal((await run(bin, ['--version'], { cwd: folder })).stdout.trim(), version);
  const installed = join(folder, 'node_modules/rayner');
  assert.equal(JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')).version, version);
  for (const file of ['tools/lettering.py', 'tools/lettering-requirements.txt', 'tools/lettering-outline-fonts.sh', 'tools/lib/lettering.ts', 'vendor/glyph-math.js', 'vendor/licenses/LatinModernMath-GUST.txt', 'vendor/licenses/glyph-MIT.txt', 'LICENSE'])
    assert.ok(existsSync(join(installed, file)), `archive is missing ${file}`);
  await copyFile(join(ROOT, 'test/consumer/consumer.ts'), join(folder, 'consumer.ts'));
  await copyFile(join(ROOT, 'test/consumer/tsconfig.json'), join(folder, 'tsconfig.json'));
  await run(join(folder, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], { cwd: folder });

  await run(process.execPath, [cli, 'init', 'first'], { cwd: folder });
  // A default install leaves the optional peers out; the template's diagram then names what to install.
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
  const native = `import{Scene,Text,FadeIn}from'rayner';import{stage,settingsOf}from'rayner/explain';export default class Outside extends Scene{static meta={id:'outside',title:'An outside author'};static settings=[{id:'case',label:'Case',default:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}]}];async construct(){const s=stage(this);await this.step('one',{title:'First step',caption:'A native scene outside the checkout.'});await this.play(new FadeIn(new Text(settingsOf(this).case,{color:s.palette.ink})));}}`;
  await writeFile(join(folder, 'first/scene.ts'), native);
  await run(process.execPath, [cli, 'check', 'first'], { cwd: folder });
  // `see` reads a step from the terminal with no browser or optional renderer installed.
  const seen = await run(process.execPath, [cli, 'see', 'first', 'one', '--case', 'case=b'], { cwd: folder });
  assert.match(seen.stdout, /^outside · step 1 of 1: one · Case: B$/m);
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
  // Outline snapshots captured against source .ts must remain fresh against
  // the archive's compiled .js engine, without Python or source font caches.
  for (const name of ['arabic', 'devanagari', 'math', 'style', 'styles']) {
    const source = join(ROOT, 'test/lettering', name);
    const target = join(folder, 'outline-' + name);
    await mkdir(target);
    await copyFile(join(source, 'scene.ts'), join(target, 'scene.ts'));
    await copyFile(join(source, 'scene.lettering.json'), join(target, 'scene.lettering.json'));
    if (name === 'style') {
      await cp(join(source, 'scene.snapshots'), join(target, 'scene.snapshots'), { recursive: true });
    }
    const env = {
      ...process.env,
      RAYNER_LETTERING_PYTHON: join(folder, 'no-python-here'),
      RAYNER_LETTERING_FONTS: join(folder, 'no-source-fonts-here'),
    };
    await run(process.execPath, [cli, 'check', target, '--out', join(folder, 'checks', name)], { cwd: folder, env });
    await run(process.execPath, [cli, 'build', target, '--out', `public/outline-${name}.html`], { cwd: folder, env });
    const receipt = JSON.parse(await readFile(join(folder, `public/outline-${name}.html.receipt.json`), 'utf8'));
    assert.ok(receipt.letteringHash, name);
  }
  if (process.env.EXPLAIN_LETTERING === '1') {
    const target = join(folder, 'captured-lettering');
    await mkdir(target);
    await writeFile(join(target, 'scene.ts'), `import{Scene,Text,Math as Formula}from'rayner';import{stage}from'rayner/explain';export default class L extends Scene{static meta={id:'captured-lettering',title:'Captured lettering',lettering:{scripts:['Arab'],math:true}};async construct(){const s=stage(this,{heading:false});await this.step('arabic',{caption:'Arabic'});await s.enter(new Text('السَّلَامُ عَلَيْكُمْ',{color:s.palette.ink}));await this.step('math',{caption:'Maths'});await s.clear();await s.enter(new Formula('\\\\frac{1}{2}+x^2',{color:s.palette.ink}));}}`);
    await run(bin, ['snapshots', target, '--refresh'], {
      cwd: folder,
      env: { ...process.env, RAYNER_LETTERING_FONTS: process.env.RAYNER_LETTERING_FONTS ?? join(ROOT, 'out/lettering-fonts') },
    });
    const env = { ...process.env, RAYNER_LETTERING_PYTHON: join(folder, 'no-python-here'), RAYNER_LETTERING_FONTS: join(folder, 'no-source-fonts-here') };
    await run(bin, ['check', target], { cwd: folder, env });
    await run(bin, ['build', target, '--out', 'public/captured-lettering.html'], { cwd: folder, env });
    const receipt = JSON.parse(await readFile(join(folder, 'public/captured-lettering.html.receipt.json'), 'utf8'));
    assert.ok(receipt.letteringHash);
  }
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
  // The example in REFERENCE "Describe", verbatim: on the `rayner init` template and its captured
  // diagram when capture is installed, else on the native scene with an empty snapshot index.
  const describeSection = (await readFile(join(ROOT, 'docs/REFERENCE.md'), 'utf8')).split(/^## /m).find((s) => s.startsWith('Describe\n')),
    example = /^```ts\n([\s\S]*?)^```/m.exec(describeSection ?? '')?.[1];
  assert.ok(example, 'docs/REFERENCE.md "Describe" has a ts example');
  await run(process.execPath, [cli, 'init', 'my-explainer'], { cwd: folder });
  if (!process.env.EXPLAIN_BROWSER) await writeFile(join(folder, 'my-explainer/scene.ts'), native);
  await run(process.execPath, [cli, 'snapshots', 'my-explainer'], { cwd: folder });
  await writeFile(join(folder, 'describe.ts'), example);
  const walked = (await run(process.execPath, ['describe.ts'], { cwd: folder })).stdout;
  assert.match(
    walked,
    process.env.EXPLAIN_BROWSER ? /^Follow a request: Cache miss · request: .+\n  changed: .*\breads\b/m : /^Case: B · one: .+\n  changed: nothing$/m,
  );
  if (process.env.EXPLAIN_VIDEO) {
    await run('npm', ['i', `@resvg/resvg-js@${peers['@resvg/resvg-js']}`, '--no-audit', '--no-fund'], { cwd: folder });
    await run(bin, ['render', 'first', '--out', 'public/outside.mp4', '--footer', '--fps', '4'], {
      cwd: folder,
    });
  }
  console.log(
    'Package gate passed: tested archive install without optional peers, installed TypeScript consumer, executable JS bin, install hint, external native author, settings, checks, see, build, describeExplainer and its REFERENCE example, notices, lettering on request, one compiled engine' +
      (process.env.EXPLAIN_LETTERING === '1' ? ', installed Arabic and maths capture' : '') +
      (process.env.EXPLAIN_VIDEO ? ', installed video export' : '') +
      (process.env.EXPLAIN_BROWSER ? ', installed diagram capture' : '') +
      '.',
  );
} finally {
  await rm(folder, { recursive: true, force: true });
}
