// Parallel test files and concurrent builds import the same bundled scene from one temporary
// folder. A half-written bundle once failed CI with "Export one Scene subclass": loadScene must
// never let another process import a file it is still writing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../tools/lib/explain-project.ts';

const skip = process.env.FULL ? false : 'set FULL=1 to start 24 processes';
const load = `const { collectProject } = await import(${JSON.stringify(pathToFileURL(join(ROOT, 'tools/lib/explain-project.ts')).href)});
await collectProject(${JSON.stringify(join(ROOT, 'scenes/explainers/ring-buffer'))}, { write: false });`;

test('eight processes loading one scene with a cold bundle cache all find its Scene export', { skip }, async () => {
  for (let round = 1; round <= 3; round++) {
    // A fresh TMPDIR per round, so every process finds the bundle missing and writes it.
    const dir = await mkdtemp(join(tmpdir(), 'rayner-bundle-race-'));
    try {
      const exits = await Promise.all(
        Array.from({ length: 8 }, () =>
          new Promise<string>((done) => {
            const child = spawn(process.execPath, ['--input-type=module', '-e', load], { env: { ...process.env, TMPDIR: dir } });
            let err = '';
            child.stderr.on('data', (d) => (err += d));
            child.on('exit', (code) => done(code === 0 ? 'ok' : err.split('\n').find((l) => l.includes('Error')) ?? `exit ${code}`));
          }),
        ),
      );
      assert.deepEqual(exits, Array(8).fill('ok'), `round ${round}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
