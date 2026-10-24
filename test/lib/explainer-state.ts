import assert from 'node:assert/strict';
import type { Trace } from '../../src/trace.ts';
/** Named pattern: inspect the scene boundary and compare it to an executed program's answers. */
export function assertStepState(trace: Trace, step: string, expected: Record<string, unknown>): void {
  const actual = trace.steps.find((s) => s.step === step)?.after;
  assert.ok(actual, `No completed step: ${step}`);
  for (const [key, value] of Object.entries(expected))
    assert.deepEqual(actual[key], value, `${step}.${key} disagrees with the program`);
}
