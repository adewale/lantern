// The pivotal claim of an explainer, written down beside its scene and checked against the scene:
// at one step of one or more cases, the recorded state must hold these values, and (if named)
// these subjects must be painted where the reader lands. The fidelity tests derive the same
// values from the model; the pivot is the author's reviewed statement of them, so a model or
// scene change that moves the pivotal number fails here until the statement is re-read.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Project } from './explain-project.ts';
import type { StoryClaim } from './explain-story-review.ts';

export interface Pivot {
  step: string;
  settings?: Record<string, string>;
  /** Values the step's recorded state must hold, key by key (deep equality). */
  state: Record<string, unknown>;
  /** Painted subjects the reader must see at that step: as a claim's targets. Optional. */
  witness?: StoryClaim['targets'];
  opening?: boolean;
}
export interface ReviewFile {
  claims: StoryClaim[];
  pivots: Pivot[];
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const assertTargets = (targets: unknown, path: string) => {
  assert.ok(Array.isArray(targets) && targets.length, `${path}: a claim needs targets`);
  for (const target of targets)
    assert.ok(object(target) && ((typeof target.key === 'string' && !!target.key.trim() && target.text === undefined) ||
      (typeof target.text === 'string' && !!target.text.trim() && target.key === undefined)) &&
      (target.paint === undefined || target.paint === 'stroke') && Object.keys(target).every(key => ['key', 'text', 'paint'].includes(key)), `${path}: targets need a key or text, with optional paint: "stroke"`);
};
/** The cases a claim or pivot selects: those whose values match its settings. */
export const selectedCases = (project: Project, settings: Record<string, string> | undefined) =>
  project.variants.filter(v => Object.entries(settings ?? {}).every(([key, value]) => v.values[key] === value));

/** `<scene>.review.json` beside the scene (or `file`): caption claims and pivots, validated against the project's cases and steps. */
export async function readReviewFile(project: Project, file?: string): Promise<ReviewFile> {
  const path = file ? resolve(file) : project.file.replace(/\.[^.]+$/, '.review.json');
  const raw = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (!file && error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (raw === undefined) return { claims: [], pivots: [] };
  const value = JSON.parse(raw);
  assert.ok(object(value) && value.version === 1 && Array.isArray(value.claims ?? []), `${path}: expected { version: 1, claims: [...] }`);
  assert.ok(Object.keys(value).every(key => ['version', 'claims', 'pivots'].includes(key)), `${path}: unknown review field`);
  const claims = (value.claims ?? []) as unknown[];
  for (const claim of claims) {
    assert.ok(object(claim) && typeof claim.step === 'string' && claim.step.trim(), `${path}: a claim needs a step`);
    assert.ok(Object.keys(claim).every(key => ['step', 'settings', 'opening', 'targets'].includes(key)), `${path}: unknown claim field`);
    assert.ok(claim.opening === undefined || typeof claim.opening === 'boolean', `${path}: opening must be boolean`);
    assert.ok(claim.settings === undefined || (object(claim.settings) && Object.values(claim.settings).every(v => typeof v === 'string')), `${path}: settings must map names to values`);
    assertTargets(claim.targets, path);
    const applicable = selectedCases(project, claim.settings as Record<string, string> | undefined);
    assert.ok(applicable.length, `${path}: claim settings select no case`);
    for (const variant of applicable)
      assert.ok(variant.trace.steps.some(s => s.step === claim.step), `${path}: ${claim.step} is missing from a selected case`);
  }
  const pivots = (value.pivots ?? []) as unknown[];
  assert.ok(Array.isArray(pivots), `${path}: pivots must be a list`);
  for (const pivot of pivots) {
    assert.ok(object(pivot) && typeof pivot.step === 'string' && pivot.step.trim(), `${path}: a pivot needs a step`);
    assert.ok(Object.keys(pivot).every(key => ['step', 'settings', 'state', 'witness', 'opening'].includes(key)), `${path}: unknown pivot field`);
    assert.ok(object(pivot.state) && Object.keys(pivot.state).length, `${path}: a pivot needs state values`);
    assert.ok(pivot.settings === undefined || (object(pivot.settings) && Object.values(pivot.settings).every(v => typeof v === 'string')), `${path}: settings must map names to values`);
    assert.ok(pivot.opening === undefined || typeof pivot.opening === 'boolean', `${path}: opening must be boolean`);
    if (pivot.witness !== undefined) assertTargets(pivot.witness, path);
    const applicable = selectedCases(project, pivot.settings as Record<string, string> | undefined);
    assert.ok(applicable.length, `${path}: pivot settings select no case`);
    for (const variant of applicable)
      assert.ok(variant.trace.steps.some(s => s.step === pivot.step), `${path}: pivot step ${pivot.step} is missing from a selected case`);
  }
  return { claims: claims as StoryClaim[], pivots: pivots as Pivot[] };
}

/** Every pivot's state holds at its step in every case it selects. */
export function assertPivots(project: Project, pivots: readonly Pivot[]): void {
  for (const pivot of pivots)
    for (const variant of selectedCases(project, pivot.settings)) {
      const step = variant.trace.steps.find(s => s.step === pivot.step)!;
      const where = Object.keys(variant.values).length ? ` (${JSON.stringify(variant.values)})` : '';
      for (const [key, value] of Object.entries(pivot.state))
        assert.deepEqual(step.after?.[key], value, `pivot at ${pivot.step}${where}: ${key} is not what the review file says`);
    }
}
/** A pivot's witness as a caption claim, so the served review checks it is painted where the reader lands. */
export const pivotClaims = (pivots: readonly Pivot[]): StoryClaim[] =>
  pivots.filter(p => p.witness).map(p => ({ step: p.step, ...(p.settings ? { settings: p.settings } : {}), ...(p.opening !== undefined ? { opening: p.opening } : {}), targets: p.witness! }));
