// The arithmetic behind `npm run bench` (tools/bench.ts), kept apart so the tests can hold
// it to its decisions: windows over what the page recorded, and whether HEAD is slower.

/** Middle value; the mean of the two middle ones for an even count. Does not reorder `xs`. */
export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b),
    m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Main-thread blocking in [from, to]: for each long task that starts in the window, the part
 * over 50 ms, the time a tap would have waited (Total Blocking Time's definition).
 */
export function blocking(tasks: readonly (readonly [start: number, duration: number])[], from: number, to: number): number {
  let sum = 0;
  for (const [start, duration] of tasks) if (start >= from && start <= to) sum += Math.max(0, duration - 50);
  return sum;
}

/** The longest wait between animation frames in [from, to], counting from `from` to the first. */
export function longestGap(frames: readonly number[], from: number, to: number): number {
  let gap = 0,
    last = from;
  for (const t of frames) {
    if (t < from) continue;
    if (t > to) break;
    gap = Math.max(gap, t - last);
    last = t;
  }
  return gap;
}

/**
 * Which build goes first in repetition `rep`: base, head, then head, base, and so on, so
 * whatever drifts through a run (another job on the machine, a warming cache) lands on both.
 */
export const order = (rep: number): readonly ['base', 'head'] | readonly ['head', 'base'] =>
  rep % 2 ? (['head', 'base'] as const) : (['base', 'head'] as const);

/** How much slower is a regression: more than `rel` of BASE's median and more than `floor` ms. */
export type Rule = { rel: number; floor: number };

/** The share of interleaved pairs in which HEAD must be the slower one before a gap counts. */
export const PAIRS = 0.7;
/** Fewer pairs than this are shown but not judged: one disturbed pair would be a third of three. */
export const MIN_PAIRS = 5;

export type Comparison = {
  base: number;
  head: number;
  delta: number;
  /** Of the pairs measured back to back, the share in which HEAD took longer. */
  slower: number;
  regressed: boolean;
};

/**
 * BASE against HEAD for one metric, from samples taken in interleaved pairs (`base[i]` beside
 * `head[i]`). Regressed means HEAD's median is slower by more than the rule allows, relative
 * and absolute both, and HEAD was the slower one in at least PAIRS of at least MIN_PAIRS
 * pairs: a median moved by a few disturbed samples is not a regression, nor is a consistent 1 ms.
 */
export function compare(base: readonly number[], head: readonly number[], rule: Rule): Comparison {
  if (base.length !== head.length || !base.length) throw new Error('compare needs the same number of samples on both sides');
  const b = median(base),
    h = median(head),
    delta = h - b;
  const slower = head.filter((v, i) => v > base[i]!).length / head.length;
  const regressed = head.length >= MIN_PAIRS && delta > rule.floor && delta > rule.rel * b && slower >= PAIRS;
  return { base: b, head: h, delta, slower, regressed };
}

/**
 * A metric fails the gate only if it regressed on the first measurement and again on a second,
 * separate one (Lantern's reproduced regression): a busy minute on a shared machine can make
 * one round look slow, rarely two.
 */
export function verdict(first: Comparison, again?: Comparison): 'ok' | 'not reproduced' | 'regression' {
  if (!first.regressed) return 'ok';
  return again?.regressed ? 'regression' : 'not reproduced';
}
