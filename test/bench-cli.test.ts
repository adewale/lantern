import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
for (const args of [
  ['--reps', '0'], ['--reps', '-1'], ['--reps', '1.5'], ['--reps', 'NaN'], ['--reps', 'Infinity'],
  ['--cpu', '0'], ['--cpu', 'NaN'], ['--cpu', 'Infinity'],
  ['--read-ms', '-1'], ['--read-ms', 'NaN'],
  ['--explainers', ''], ['--explainers', '../README'], ['--explainers', 'mr-cache,mr-cache'],
]) test('benchmark refuses invalid options before building: ' + args.join(' '), () => {
  const result = spawnSync(process.execPath, ['tools/bench.ts', args[0] + '=' + args[1]], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--(?:reps|cpu|read-ms|explainers) must/);
});
