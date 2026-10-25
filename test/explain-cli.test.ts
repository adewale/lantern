import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { Scene, traceScene } from '../src/index.ts';
import { loadScene, collectProject, ROOT } from '../tools/lib/explain-project.ts';

test('external source and compiled ESM scenes share the CLI engine; source hashes ignore checkout paths', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lantern-cli-'));
  try {
    const source = `import{Scene,Text,FadeIn}from'manim-js';import{stage}from'manim-js/explain';export default class Author extends Scene{static meta={id:'author',title:'External author'};async construct(){const s=stage(this);await this.step('one',{caption:'A real native scene.'});await this.play(new FadeIn(new Text('hello',{color:s.palette.ink})));this.state.answer=42;}}`;
    const a = join(folder, 'a', 'scene.ts'),
      b = join(folder, 'b', 'scene.ts');
    await mkdir(join(folder, 'a'));
    await mkdir(join(folder, 'b'));
    await writeFile(a, source);
    await writeFile(b, source);
    const first = await loadScene(a),
      second = await loadScene(b);
    assert.equal(first.sourceHash, second.sourceHash);
    assert.ok(first.Scene.prototype instanceof Scene);
    const compiled = join(folder, 'compiled.js');
    await build({
      entryPoints: [a],
      bundle: false,
      format: 'esm',
      platform: 'neutral',
      outfile: compiled,
      logLevel: 'silent',
    });
    const loaded = await loadScene(compiled);
    assert.ok(loaded.Scene.prototype instanceof Scene);
    assert.deepEqual(await traceScene(loaded.Scene), await traceScene(first.Scene));
    const cli = join(ROOT, 'tools/explain.ts');
    const output = execFileSync(
      process.execPath,
      [cli, 'build', compiled, '--out', join(folder, 'page.html')],
      { encoding: 'utf8' },
    );
    assert.match(output, /Built/);
    const html = await readFile(join(folder, 'page.html'), 'utf8');
    assert.match(html, /External author/);
    assert.match(html, /<summary>Transcript<\/summary>/);
    assert.match(html, /Copyright \(c\) 2026 Ivar Vong/);
    assert.match(html, /SIL OPEN FONT LICENSE/);
    const duplicate = join(folder, 'duplicate.ts');
    await writeFile(
      duplicate,
      `import{Scene}from'manim-js';export default class Bad extends Scene{async construct(){await this.step('same');await this.wait(.5);await this.step('same');await this.wait(.5);}}`,
    );
    await assert.rejects(collectProject(duplicate, { write: false }), /Duplicate step names/);
    assert.throws(
      () => execFileSync(process.execPath, [cli, 'not-a-command', a], { stdio: 'pipe' }),
      /Command failed/,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
