import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fc, params } from './lib/pbt.ts';
import { reviewScope, mergeStoryReviews, reviewCodeHash } from '../tools/lib/explain-review-plan.ts';
import type { PlannedCase, ReviewReceipt } from '../tools/lib/explain-review-plan.ts';

test('story shard arguments accept complete integer scopes and reject malformed selections', () => {
  assert.deepEqual(reviewScope([]), { part: 1, total: 1 });
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 100 }), fc.nat(100), (total, n) => {
      const part = (n % total) + 1;
      assert.deepEqual(reviewScope(['--shard', `${part}/${total}`]), { part, total });
    }),
    params(100),
  );
  for (const arg of ['0/3', '4/3', '1/0', '-1/3', '1.5/3', '1/3x', '1/9007199254740992', '1/3/4', ' 1/3'])
    assert.throws(() => reviewScope(['--shard', arg]), /usage|invalid/);
  assert.throws(() => reviewScope(['--unknown', '1/3']), /usage/);
  assert.throws(() => reviewScope(['--shard', '1/3', 'extra']), /usage/);
});
function receipts(expected: PlannedCase[], total: number): ReviewReceipt[] {
  const parts: ReviewReceipt[] = Array.from({ length: total }, (_, i) => ({
    scope: { part: i + 1, total },
    catalogHash: 'catalog',
    reviewCodeHash: 'code',
    cases: 0,
    stepWidths: 0,
    results: [],
    consoleErrors: [],
    runtimeConnections: [],
  }));
  // Round-robin assignment is independent of the production modulo selector.
  let cursor = 0;
  for (const c of expected) {
    const p = parts[cursor]!;
    cursor++;
    if (cursor === total) cursor = 0;
    p.results.push({
      scene: c.scene,
      settings: c.settings,
      steps: [390, 1180].flatMap((width) =>
        c.steps.map((step) => ({ step, width, views: 1, targets: ['visible subject'] })),
      ),
    });
  }
  for (const p of parts) {
    p.cases = p.results.length;
    p.stepWidths = p.results.reduce((n, c) => n + c.steps.length, 0);
  }
  return parts;
}
test('merging story shards preserves every case, final step and width across generated inventories', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 1, max: 8 }), { minLength: 5, maxLength: 20 }),
      fc.integer({ min: 1, max: 5 }),
      (counts, total) => {
        const expected = counts.map((n, i) => ({
          scene: `scene-${i}`,
          settings: { case: String(i) },
          steps: Array.from({ length: n }, (_, j) => `step-${j}`),
        }));
        const merged = mergeStoryReviews(receipts(expected, total).reverse(), expected, 'catalog', 'code');
        assert.deepEqual(
          merged.results.map((c) => [c.scene, c.settings]),
          expected.map((c) => [c.scene, c.settings]),
        );
        assert.equal(merged.cases, counts.length);
        assert.equal(merged.stepWidths, 2 * counts.reduce((a, b) => a + b, 0));
      },
    ),
    params(300),
  );
});
test('a passing story result requires all matching shards with complete nonempty subject inventories', () => {
  const expected = Array.from({ length: 6 }, (_, i) => ({
    scene: `scene-${i}`,
    settings: { case: String(i) },
    steps: ['first', 'final'],
  }));
  const empty = [{ scene: 'empty', settings: {}, steps: [] }];
  assert.throws(() => mergeStoryReviews(receipts(empty, 1), empty, 'catalog', 'code'), /at least one step/);
  const good = receipts(expected, 3);
  assert.equal(mergeStoryReviews(good, expected, 'catalog', 'code').stepWidths, 24);
  const defects: Record<string, (p: ReviewReceipt[]) => void> = {
    'missing shard': (p) => {
      p.pop();
    },
    'duplicate shard': (p) => {
      p[1] = p[0]!;
    },
    'missing case': (p) => {
      p[0]!.results.pop();
    },
    'duplicate case': (p) => {
      p[0]!.results[1] = p[0]!.results[0]!;
    },
    'missing final step': (p) => {
      p[0]!.results[0]!.steps.pop();
    },
    'missing desktop': (p) => {
      p[0]!.results[0]!.steps[2]!.width = 390;
    },
    'no subject': (p) => {
      p[0]!.results[0]!.steps[0]!.targets = [];
    },
    'stale catalog': (p) => {
      p[0]!.catalogHash = 'old';
    },
    'stale reviewer': (p) => {
      p[0]!.reviewCodeHash = 'old';
    },
    'console error': (p) => {
      p[0]!.consoleErrors.push('broken');
    },
    'external connection': (p) => {
      p[0]!.runtimeConnections.push('remote');
    },
  };
  for (const [name, defect] of Object.entries(defects)) {
    const parts = structuredClone(good);
    defect(parts);
    assert.throws(() => mergeStoryReviews(parts, expected, 'catalog', 'code'), {code:'ERR_ASSERTION'}, name);
  }
});

test('story receipts expire when authored companion claims or their loader change', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rayner-review-fingerprint-'));
  try {
    for (const file of [
      'tools/explain-review.ts', 'tools/explain-review-merge.ts',
      'tools/lib/explain-story-review.ts', 'tools/lib/explain-review-scene.ts',
      'tools/lib/explain-review-plan.ts', 'tools/lib/explain-serve.ts',
    ]) {
      await mkdir(dirname(join(root, file)), {recursive: true});
      await copyFile(new URL('../' + file, import.meta.url), join(root, file));
    }
    const withoutClaims = await reviewCodeHash(root);
    const claimsFile = join(root, 'scenes/explainers/example/scene.review.json');
    const original = JSON.stringify({version: 1, claims: [{step: 'first', targets: [{text: 'Visible subject'}]}]});
    await mkdir(dirname(claimsFile), {recursive: true});
    await writeFile(claimsFile, original);
    const current = await reviewCodeHash(root);
    assert.notEqual(current, withoutClaims, 'adding companion expectations must invalidate previous review');
    const expected = Array.from({length: 3}, (_, i) => ({scene: `scene-${i}`, settings: {}, steps: ['first', 'final']}));
    const old = receipts(expected, 3);
    for (const part of old) part.reviewCodeHash = current;
    const merge = async () => mergeStoryReviews(old, expected, 'catalog', await reviewCodeHash(root));
    assert.equal((await merge()).cases, 3, 'unchanged claims and implementation retain valid receipts');
    await writeFile(claimsFile, original.replace('Visible subject', 'A newly required subject'));
    await assert.rejects(merge(), /stale review implementation/, 'an edited expectation cannot reuse an old passing receipt');
    await writeFile(claimsFile, original);
    assert.equal(await reviewCodeHash(root), current);
    const added = join(root, 'scenes/explainers/second/scene.review.json');
    await mkdir(dirname(added), {recursive: true});
    await writeFile(added, original);
    await assert.rejects(merge(), /stale review implementation/, 'identical bytes at a new companion path also add expectations');
    await unlink(added);
    assert.equal(await reviewCodeHash(root), current);
    await unlink(claimsFile);
    await assert.rejects(merge(), /stale review implementation/, 'deleted expectations cannot reuse old receipts');
    await writeFile(claimsFile, original);
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'docs/notes.md'), 'Unrelated documentation changes.');
    assert.equal(await reviewCodeHash(root), current, 'unrelated prose does not invalidate paint review');
    const loader = join(root, 'tools/lib/explain-review-scene.ts');
    const loaderBytes = await readFile(loader);
    await writeFile(loader, Buffer.concat([loaderBytes, Buffer.from('\n// changed claim loading\n')]));
    await assert.rejects(merge(), /stale review implementation/, 'the claim loader remains part of the fingerprint');
    await writeFile(loader, loaderBytes);
    assert.equal((await merge()).cases, 3);
  } finally { await rm(root, {recursive: true, force: true}); }
});
