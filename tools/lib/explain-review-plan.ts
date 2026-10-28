import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export interface ReviewScope {
  part: number;
  total: number;
}
export interface PlannedCase {
  scene: string;
  settings: Record<string, string>;
  steps: string[];
}
export interface ReviewedCase {
  scene: string;
  settings: Record<string, string>;
  steps: { step: string; width: number; views: number; targets: string[] }[];
}
export interface ReviewReceipt {
  scope: ReviewScope;
  catalogHash: string;
  reviewCodeHash: string;
  cases: number;
  stepWidths: number;
  results: ReviewedCase[];
  consoleErrors: string[];
  runtimeConnections: string[];
}
export function reviewScope(args: readonly string[]): ReviewScope {
  if (!args.length) return { part: 1, total: 1 };
  const match = args.length === 2 && args[0] === '--shard' && /^([1-9]\d*)\/([1-9]\d*)$/.exec(args[1]!);
  assert.ok(match, 'usage: demos:review [--shard part/total]');
  const part = Number(match[1]),
    total = Number(match[2]);
  assert.ok(Number.isSafeInteger(part) && Number.isSafeInteger(total) && part <= total, 'invalid story shard');
  return { part, total };
}
export function inReviewScope(index: number, scope: ReviewScope) {
  return index % scope.total === scope.part - 1;
}
export async function readStoryPlan(directory: string) {
  const raw = await readFile(join(directory, 'evidence.json'), 'utf8');
  const catalog = JSON.parse(raw) as { scenes: { id: string; cases: Record<string, string>[] }[] };
  const cases: PlannedCase[] = [];
  for (const scene of catalog.scenes) {
    const description = JSON.parse(await readFile(join(directory, scene.id, 'describe.json'), 'utf8')) as {
      cases: { values: Record<string, string>; steps: { step: string }[] }[];
    };
    assert.deepEqual(
      description.cases.map((c) => c.values),
      scene.cases,
      `${scene.id}: description/case inventory differs`,
    );
    cases.push(
      ...description.cases.map((c) => ({ scene: scene.id, settings: c.values, steps: c.steps.map((s) => s.step) })),
    );
  }
  return { cases, catalogHash: createHash('sha256').update(raw).digest('hex') };
}
export async function reviewCodeHash(root: string) {
  const files = [
    'tools/explain-review.ts',
    'tools/explain-review-merge.ts',
    'tools/lib/explain-story-review.ts',
    'tools/lib/explain-review-plan.ts',
    'tools/lib/explain-serve.ts',
  ];
  const bytes = await Promise.all(files.map((f) => readFile(join(root, f))));
  return createHash('sha256').update(Buffer.concat(bytes)).digest('hex');
}
export function validateReviewedCases(actual: ReviewedCase[], expected: PlannedCase[]) {
  assert.deepEqual(
    actual.map(({ scene, settings }) => ({ scene, settings })),
    expected.map(({ scene, settings }) => ({ scene, settings })),
    'exact case inventory',
  );
  for (const [i, c] of actual.entries()) {
    assert.ok(expected[i]!.steps.length, `${c.scene}: a story needs at least one step`);
    assert.deepEqual(
      c.steps.map(({ step, width }) => ({ step, width })),
      [390, 1180].flatMap((width) => expected[i]!.steps.map((step) => ({ step, width }))),
      `${c.scene}: exact step/width inventory`,
    );
    assert.ok(
      c.steps.every((s) => s.targets.length > 0 && s.views >= 1),
      `${c.scene}: each step needs a verified subject and reader view`,
    );
  }
}
const caseKey = (c: { scene: string; settings: Record<string, string> }) =>
  JSON.stringify([c.scene, Object.entries(c.settings).sort()]);
export function mergeStoryReviews(
  parts: ReviewReceipt[],
  expected: PlannedCase[],
  catalogHash: string,
  codeHash: string,
): ReviewReceipt {
  assert.ok(parts.length, 'missing story shards');
  const total = parts[0]!.scope.total;
  assert.equal(parts.length, total, 'missing story shards');
  const ordered = [...parts].sort((a, b) => a.scope.part - b.scope.part);
  for (const [i, p] of ordered.entries()) {
    assert.deepEqual(p.scope, { part: i + 1, total }, 'exact shard inventory');
    assert.equal(p.catalogHash, catalogHash, 'stale catalog artifact');
    assert.equal(p.reviewCodeHash, codeHash, 'stale review implementation');
    assert.equal(p.cases, p.results.length);
    assert.equal(
      p.stepWidths,
      p.results.reduce((n, c) => n + c.steps.length, 0),
    );
    assert.deepEqual(p.consoleErrors, []);
    assert.deepEqual(p.runtimeConnections, []);
    validateReviewedCases(
      p.results,
      expected.filter((_, n) => inReviewScope(n, p.scope)),
    );
  }
  const byKey = new Map(ordered.flatMap((p) => p.results).map((c) => [caseKey(c), c]));
  assert.equal(byKey.size, expected.length, 'missing or duplicate cases across shards');
  const results = expected.map((c) => byKey.get(caseKey(c))!);
  validateReviewedCases(results, expected);
  return {
    scope: { part: 1, total: 1 },
    catalogHash,
    reviewCodeHash: codeHash,
    cases: results.length,
    stepWidths: results.reduce((n, c) => n + c.steps.length, 0),
    results,
    consoleErrors: [],
    runtimeConnections: [],
  };
}
