import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { ROOT } from '../tools/lib/explain-project.ts';

// All npm calls go to a fake executable: these tests cannot contact a registry.
test('publishing uses the tested archive and refuses wrong tags, provenance, gates or modified bytes before invoking npm publish', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rayner-release-'));
  const directory = join(folder, 'out/release');
  const bin = join(folder, 'bin');
  const called = join(folder, 'called.json');
  const sha = 'a'.repeat(40);
  const bytes = Buffer.from('tested tarball');
  const manifest = {
    name: 'rayner', version: '0.1.0', filename: 'rayner-0.1.0.tgz', sourceCommit: sha, dirty: false,
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'),
    gates: { package: true, browser: true, letteringCapture: true },
  };
  const env = { ...process.env, PATH: bin + delimiter + process.env.PATH, GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'adewale/rayner', GITHUB_SHA: sha, GITHUB_REF: 'refs/tags/v0.1.0', NPM_DIST_TAG: 'next' };
  try {
    await mkdir(directory, { recursive: true });
    await mkdir(bin);
    const npm = join(bin, 'npm');
    await writeFile(npm, `#!${process.execPath}\nimport{writeFileSync}from'node:fs';if(process.argv[2]==='--version')console.log('11.20.0');else writeFileSync(${JSON.stringify(called)},JSON.stringify(process.argv.slice(2)));\n`);
    await chmod(npm, 0o755);
    const run = promisify(execFile);
    const publish = () => run(process.execPath, [join(ROOT, 'tools/publish-release.ts')], { cwd: folder, env });
    const reset = async (patch = {}) => {
      await rm(called, { force: true });
      await writeFile(join(directory, manifest.filename), bytes);
      await writeFile(join(directory, 'manifest.json'), JSON.stringify({ ...manifest, ...patch }));
    };
    for (const patch of [
      { version: '0.2.0' }, { sourceCommit: 'b'.repeat(40) }, { dirty: true },
      { gates: { package: true, browser: false, letteringCapture: true } },
      { gates: { package: true, browser: true, letteringCapture: false } },
      { filename: '../other.tgz' },
    ]) {
      await reset(patch);
      await assert.rejects(publish());
      await assert.rejects(readFile(called), { code: 'ENOENT' });
    }
    await reset();
    await writeFile(join(directory, manifest.filename), 'replaced after validation');
    await assert.rejects(publish());
    await assert.rejects(readFile(called), { code: 'ENOENT' });
    await reset();
    await publish();
    assert.deepEqual(JSON.parse(await readFile(called, 'utf8')), ['publish', 'out/release/rayner-0.1.0.tgz', '--tag', 'next']);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
