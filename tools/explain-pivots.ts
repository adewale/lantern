#!/usr/bin/env node
// Record a pivot for every catalog explainer that has none: at its catalog step (the poster
// step, which the catalog declares as the payoff) in the default case, the state values that
// step changed. The values are read from the model's current output and written beside the
// scene for an author to review; from then on `rayner check` fails when the scene or model
// moves them, and `rayner review` checks the step's subjects are painted. Run with --write.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { collectProject, defaultVariant, ROOT } from './lib/explain-project.ts';
import { caseValues } from '../explain/index.ts';

const write = process.argv.includes('--write');
const SKIP = new Set(['picture', 'walks']);
for (const item of EXPLAINERS) {
  const project = await collectProject(join(ROOT, 'scenes/explainers', item.id), { write: false });
  const file = project.file.replace(/\.[^.]+$/, '.review.json');
  const existing = JSON.parse(await readFile(file, 'utf8').catch(() => '{"version":1,"claims":[]}'));
  if (existing.pivots?.length) {
    console.log(`${item.id}: ${existing.pivots.length} pivot(s) already recorded`);
    continue;
  }
  const v = defaultVariant(project);
  const steps = v.trace.steps;
  let at = steps.findIndex((s) => s.step === item.step);
  if (at < 0) at = steps.length - 1;
  // The catalog step, or the nearest earlier step whose state changed.
  let state: Record<string, unknown> = {};
  for (let i = at; i >= 0 && !Object.keys(state).length; i--) {
    const before = (steps[i - 1]?.after ?? {}) as Record<string, unknown>, after = (steps[i]!.after ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(after))
      if (!SKIP.has(key) && JSON.stringify(before[key]) !== JSON.stringify(value)) state[key] = value;
    if (Object.keys(state).length) at = i;
  }
  if (!Object.keys(state).length) {
    console.log(`${item.id}: no state changes to record`);
    continue;
  }
  // Keep the record short: at most four keys, the smallest values first.
  const entries = Object.entries(state).sort((a, b) => JSON.stringify(a[1]).length - JSON.stringify(b[1]).length).slice(0, 4);
  state = Object.fromEntries(entries);
  const settings = caseValues(project.Scene, v.values);
  const pivot = { step: steps[at]!.step, ...(Object.keys(settings).length ? { settings } : {}), state };
  console.log(`${item.id}: ${pivot.step} ${JSON.stringify(state).slice(0, 160)}`);
  if (write) {
    existing.version = 1;
    existing.claims ??= [];
    existing.pivots = [pivot];
    await writeFile(file, JSON.stringify(existing, null, 2) + '\n');
  }
}
