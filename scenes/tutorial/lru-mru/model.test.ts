import test from 'node:test';
import assert from 'node:assert/strict';
import { run, type Policy } from './model.ts';

const evictions = (policy: Policy, requests: string) =>
  run(policy, 4, [...requests]).map((r) => r.evicted ?? '-').join(' ');

test("LRU matches Wikipedia's example: E replaces A, then F replaces B", () => {
  assert.equal(evictions('lru', 'ABCDEDF'), '- - - - A - B');
});

test("MRU matches Wikipedia's example: E replaces D, then D replaces C", () => {
  assert.equal(evictions('mru', 'ABCDECDB'), '- - - - D - C -');
});
