import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { builtOutputHashes, checkBuiltOutput } from '../tools/lib/explain-built-files.ts';

test('site export rejects tampered built HTML, pictures and a missing output pin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rayner-built-output-'));
  const paths = ['loader.js', 'index.html', 'embed-lab.html', 'catalog.json', 'evidence.json',
    'cache.html', 'cache.png', 'cache/describe.json', 'cache/inputs.json', 'cache/steps.json', 'cache/one.png'];
  try {
    await mkdir(join(dir, 'cache'), { recursive: true });
    for (const path of paths) await writeFile(join(dir, path), path === 'cache/steps.json' ? JSON.stringify({ steps: [{ step: 'one' }] }) : path);
    await assert.rejects(checkBuiltOutput(dir, ['cache']), /output-hashes\.json.*missing/);
    const pinned = await builtOutputHashes(dir, ['cache']);
    await writeFile(join(dir, 'output-hashes.json'), JSON.stringify(pinned));
    await checkBuiltOutput(dir, ['cache']);
    for (const path of ['cache.html', 'cache/one.png', 'cache/describe.json']) {
      const before = await readFile(join(dir, path));
      await writeFile(join(dir, path), 'changed');
      await assert.rejects(checkBuiltOutput(dir, ['cache']), /Built output changed/);
      await writeFile(join(dir, path), before);
    }
    await writeFile(join(dir, 'output-hashes.json'), JSON.stringify({ ...pinned, 'old.html': '0'.repeat(64) }));
    await assert.rejects(checkBuiltOutput(dir, ['cache']), /[Bb]uilt output manifest differs/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
