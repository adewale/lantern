import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectProject } from '../tools/lib/explain-project.ts';
import { assertStepState } from './lib/explainer-state.ts';
import { run } from '../scenes/tutorial/lru-mru/model.ts';
// The tutorial's own model tests: Wikipedia's worked LRU and MRU examples.
import '../scenes/tutorial/lru-mru/model.test.ts';

const DIR = 'scenes/tutorial/lru-mru/';
const tutorial = readFileSync('docs/TUTORIAL.md', 'utf8');
const block = (name: string) => {
  const code = tutorial.match(new RegExp(`<!-- ${name} -->\\n\`\`\`ts\\n([\\s\\S]*?)\`\`\``))?.[1];
  assert.ok(code, `docs/TUTORIAL.md shows ${name}`);
  return code;
};

test('the tutorial prints the checked-in LRU/MRU model, test and scene, apart from package imports', () => {
  assert.equal(block('lru-mru/model.ts'), readFileSync(DIR + 'model.ts', 'utf8'));
  assert.equal(block('lru-mru/model.test.ts'), readFileSync(DIR + 'model.test.ts', 'utf8'));
  const scene = readFileSync(DIR + 'scene.ts', 'utf8')
    .replace("from '../../../src/index.ts'", "from 'rayner'")
    .replace("from '../../../explain/index.ts'", "from 'rayner/explain'");
  // Step 4 shows the three-step scene; step 7 adds the ending after its last show.
  const last = '    await show(8);\n', close = '  }\n}\n';
  assert.ok(block('lru-mru/scene.ts').endsWith(last + close));
  assert.equal(block('lru-mru/scene.ts').replace(last + close, last + '\n' + block('lru-mru/scene.ts ending') + close), scene);
});

const SEQ = { loop: [...'ABCDABCD'], reuse: [...'ABCDCDCD'] };

test('each case shows the counts, evictions and cache contents the model gives', async () => {
  const project = await collectProject(DIR, { write: false });
  assert.deepEqual(project.variants.map((v) => v.values.next).sort(), ['loop', 'reuse']);
  for (const { values, trace } of project.variants) {
    assert.deepEqual(trace.steps.map((s) => s.step), ['full', 'evict', 'rest', 'verdict']);
    const requests = SEQ[values.next as keyof typeof SEQ];
    for (const [step, n] of [['full', 3], ['evict', 4], ['rest', 8]] as const) {
      const shown = (policy: 'lru' | 'mru') => {
        const done = run(policy, 3, requests).slice(0, n), hits = done.filter((r) => r.hit).map((r) => r.key);
        return {
          'Cache, newest first': done.at(-1)!.cache.join(' '),
          Evicted: done.flatMap((r) => r.evicted ?? []).join(' ') || 'none',
          Hits: hits.length ? `${hits.length}: ${hits.join(' ')}` : '0',
        };
      };
      assertStepState(trace, step, { lru: shown('lru'), mru: shown('mru') });
    }
  }
});

test('the hand-written captions say what the model does', async () => {
  const project = await collectProject(DIR, { write: false });
  const meta = (next: string, step: string) =>
    project.variants.find((v) => v.values.next === next)!.trace.steps.find((s) => s.step === step)!.meta as Record<string, string>;
  // Both cases: "both hold C, B, A"; on D, "LRU drops A ... MRU drops C".
  for (const next of ['loop', 'reuse'] as const) {
    const lru = run('lru', 3, SEQ[next]), mru = run('mru', 3, SEQ[next]);
    assert.deepEqual([lru[2]!.cache, mru[2]!.cache], [['C', 'B', 'A'], ['C', 'B', 'A']]);
    assert.deepEqual([lru[3]!.evicted, mru[3]!.evicted], ['A', 'C']);
    assert.match(meta(next, 'evict').line!, /LRU drops A, the oldest; MRU drops C, the newest/);
  }
  // Loop: each item LRU evicts is the next one the loop asks for; all eight miss.
  // MRU evicted C for D, so on the second pass A, B and D hit and only C misses.
  const loopLru = run('lru', 3, SEQ.loop), loopMru = run('mru', 3, SEQ.loop);
  loopLru.forEach((r, i) => r.evicted && assert.equal(r.evicted, 'ABCD'[(i + 1) % 4], `eviction at request ${i + 1}`));
  assert.ok(loopLru.every((r) => !r.hit));
  assert.deepEqual(loopMru.slice(4).map((r) => (r.hit ? r.key : `miss ${r.key}`)), ['A', 'B', 'miss C', 'D']);
  assert.match(meta('loop', 'rest').caption!, /all eight requests miss.*A, B and D hit and only C misses/);
  // Reuse: LRU still holds C and D after evicting A, so all four repeats hit. MRU evicts the item
  // requested just before, which is always the next one requested, so all four repeats miss.
  const reuseLru = run('lru', 3, SEQ.reuse), reuseMru = run('mru', 3, SEQ.reuse);
  assert.ok(['C', 'D'].every((k) => reuseLru[3]!.cache.includes(k)));
  assert.ok(reuseLru.slice(4).every((r) => r.hit));
  reuseMru.forEach((r, i) => {
    if (!r.evicted) return;
    assert.equal(r.evicted, SEQ.reuse[i - 1], `request ${i + 1} evicts the item requested just before`);
    if (i + 1 < SEQ.reuse.length) assert.equal(SEQ.reuse[i + 1], r.evicted, `which request ${i + 2} asks for`);
  });
  assert.ok(reuseMru.slice(4).every((r) => !r.hit));
  assert.match(meta('reuse', 'rest').caption!, /all four repeats hit.*all four repeats miss/);
  // The loop's ending: "Four items do not fit in three slots". With four slots the loop fits,
  // and both policies hit on every repeat, so the gap needs a loop larger than the cache.
  for (const policy of ['lru', 'mru'] as const) assert.equal(run(policy, 4, SEQ.loop).filter((r) => r.hit).length, 4);
  assert.match(meta('loop', 'verdict').caption!, /MRU hits 3 times and LRU 0/);
  assert.match(meta('reuse', 'verdict').caption!, /LRU hits 4 times and MRU 0/);
});
