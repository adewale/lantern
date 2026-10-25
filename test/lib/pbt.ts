// Shared fast-check settings for the property tests. Case counts come from
// here so one switch scales every suite: FULL=1 runs ten times as many cases.
// A failure prints its seed and counterexample path; rerun exactly that case
// with FC_SEED=<seed> FC_PATH=<path> (and the test's name via --test-name-pattern).
import fc from 'fast-check';
import type { Parameters } from 'fast-check';

const FULL = !!process.env.FULL;
const SEED = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;
const PATH = process.env.FC_PATH || undefined;

/** Cases for one property: `cheap` by default, ten times that under FULL=1. */
export const runs = (cheap = 1000): number => (FULL ? cheap * 10 : cheap);

/** fast-check parameters for one property, honouring FC_SEED / FC_PATH replays. */
export function params<T>(cheap = 1000, extra: Parameters<T> = {}): Parameters<T> {
  return {
    numRuns: runs(cheap),
    ...(SEED != null ? { seed: SEED } : {}),
    ...(PATH ? { path: PATH } : {}),
    ...extra,
  };
}

export { fc };
