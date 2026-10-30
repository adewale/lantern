import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectProject } from '../tools/lib/explain-project.ts';
import { RECIPES } from '../scenes/explainers/feature-tour/scene.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';

const source = readFileSync('scenes/explainers/hello-world/scene.ts', 'utf8');

test('the installed-package Hello World in the tutorial is the actual minimal scene', async () => {
  const tutorial = readFileSync('docs/TUTORIAL.md', 'utf8');
  const sample = tutorial.match(/## 0\. Hello, world!\s+```ts\n([\s\S]*?)\n```/)?.[1];
  assert.ok(sample, 'the first example shows all the code, not just an excerpt');
  assert.equal(sample.trim(), source.replace("from '../../../src/index.ts'", "from 'rayner'").trim());
  const project = await collectProject('scenes/explainers/hello-world', { write: false });
  assert.equal(project.variants.length, 1);
  assert.deepEqual(project.variants[0]!.trace.steps.map(s => s.step), ['hello']);
  assert.match(String(project.variants[0]!.trace.steps[0]!.meta?.caption), /Hello, world!/);
  assert.equal(EXPLAINERS.find(e => e.id === 'hello-world')?.step, 'hello');
});

test('every authoring feature offers a case with its user-side code before its result', async () => {
  const project = await collectProject('scenes/explainers/feature-tour', { write: false });
  assert.equal(project.variants.length, Object.keys(RECIPES).length);
  assert.ok(project.variants.length >= 15, 'documented authoring families are represented');
  const seen = new Set<string>();
  for (const { values, trace } of project.variants) {
    const feature = values.feature as keyof typeof RECIPES;
    assert.ok(RECIPES[feature], `unexpected setting ${feature}`);
    seen.add(feature);
    assert.deepEqual(trace.steps.map(s => s.step), ['recipe', 'result'], feature);
    const recipe = trace.steps[0]!, resultStep = trace.steps[1]!;
    assert.equal(recipe.after!.phase, 'recipe');
    assert.equal(resultStep.after!.phase, 'result');
    assert.equal(resultStep.after!.feature, feature);
    const pictured = recipe.after!.picture as { entries: { items?: string[] }[] };
    const lines = pictured.entries.flatMap(entry => entry.items ?? []);
    assert.deepEqual(lines.map(line => line.replace(/^\d+: /, '')), RECIPES[feature].code, feature);
    const result = resultStep.after!.picture as { entries: unknown[] };
    assert.ok(result.entries.length > 0, `${feature}: show the actual feature result, not just source text`);
  }
  assert.deepEqual([...seen].sort(), Object.keys(RECIPES).sort());
  assert.equal(EXPLAINERS.find(e => e.id === 'feature-tour')?.step, 'result');
  const state = project.variants.find(v => v.values.feature === 'state')!;
  assert.equal(state.trace.steps[1]!.after!.count, 1, 'the view case must update recorded state');
  assert.match(JSON.stringify(state.trace.steps[1]!.after!.picture), /Recorded count: 1/);
});
