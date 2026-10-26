import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { traceScene } from '../src/index.ts';
import { collectProject, ROOT } from '../tools/lib/explain-project.ts';

/** The error a child process failed with, or undefined when it succeeded. */
const failure = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error as { status: number; stderr: Buffer };
  }
};

// The gates `explain check` runs, each with a seeded defect, are in explain-gates.test.ts.
test('external source and compiled ESM scenes share the CLI engine; source hashes ignore checkout paths', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lantern-cli-'));
  try {
    const source = `import{Scene,Text,FadeIn}from'rayner';import{stage}from'rayner/explain';export default class Author extends Scene{static meta={id:'author',title:'External author'};async construct(){const s=stage(this);await this.step('one',{caption:'A real native scene.'});await this.play(new FadeIn(new Text('hello',{color:s.palette.ink})));this.state.answer=42;}}`;
    const a = join(folder, 'a', 'scene.ts'),
      b = join(folder, 'b', 'scene.ts');
    await mkdir(join(folder, 'a'));
    await mkdir(join(folder, 'b'));
    await writeFile(a, source);
    await writeFile(b, source);
    const first = await collectProject(a, { write: false }),
      second = await collectProject(b, { write: false });
    assert.equal(first.sourceHash, second.sourceHash);
    const compiled = join(folder, 'compiled.js');
    await build({
      entryPoints: [a],
      bundle: false,
      format: 'esm',
      platform: 'neutral',
      outfile: compiled,
      logLevel: 'silent',
    });
    const loaded = await collectProject(compiled, { write: false });
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
    // The notices every built page carries: Lantern's MIT licence and the fonts' OFL.
    assert.match(html, /Copyright \(c\) 2026 Ivar Vong/);
    assert.match(html, /SIL OPEN FONT LICENSE/);
    const refused = failure(() => execFileSync(process.execPath, [cli, 'not-a-command', a], { stdio: 'pipe' }));
    assert.equal(refused?.status, 1, 'an unknown command must exit 1');
    assert.match(String(refused?.stderr), /^explain: Unknown command: not-a-command/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('the README shows the scene `explain init` writes, byte for byte', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'explain-init-'));
  try {
    execFileSync(process.execPath, [join(ROOT, 'tools/explain.ts'), 'init', join(folder, 'first')], { stdio: 'pipe' });
    const scene = await readFile(join(folder, 'first', 'scene.ts'), 'utf8'),
      readme = await readFile(join(ROOT, 'README.md'), 'utf8');
    assert.ok(readme.includes('```ts\n' + scene + '```'), 'README "Write one" must show the template from tools/explain.ts');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
