# PR #11 benchmark test review

Review target: original reader-benchmark proposal on `origin/claude/reader-bench`, with arithmetic preserved in `out/test-audit/bench-original/tools/lib/bench-stats.ts`. Locations below refer to that proposal, not the current main tree. This review distinguishes a helper's stated semantics from the broader reader experience the benchmark intends to measure.

## Confirmed findings

**Invalid numeric samples can produce a green verdict.** [tools/lib/bench-stats.ts:65–72](https://github.com/adewale/rayner/blob/1f58e14fb8755316ab970717b0b676395c605ceb/tools/lib/bench-stats.ts#L65) checks equal nonempty lengths but does not reject nonfinite values. With five BASE samples of 100 and five HEAD samples of NaN, comparison returns `{ base:100, head:NaN, delta:NaN, slower:0, regressed:false }`; `verdict` returns `ok` at lines 80–82. JavaScript comparisons with NaN are false. Browser extraction at `tools/bench.ts:112–123` and comparison at line 165 have no explicit finite-sample validation, so invalid data is not distinguished from measured nonregression. This is a confirmed arithmetic fail-green path; it does not prove Chromium normally supplies NaN. Reject invalid metrics or report an inconclusive/error result before regression judgment and JSON serialization.

**Finite even-count medians can overflow.** [tools/lib/bench-stats.ts:9](https://github.com/adewale/rayner/blob/1f58e14fb8755316ab970717b0b676395c605ceb/tools/lib/bench-stats.ts#L9) computes `(left + right) / 2`. For `[Number.MAX_VALUE, Number.MAX_VALUE]` it returns Infinity although the median is the same finite value. This violates the named median contract for finite input. It is a numerical boundary defect, not a claim that realistic benchmark durations approach Number.MAX_VALUE. An overflow-safe midpoint must also account for opposite signs and subnormal rounding; simply halving both terms introduces different boundary failures.

These bounded reproductions ran with Node 24 strip-types against the preserved original module:

```js
const c = compare(Array(5).fill(100), Array(5).fill(NaN), { rel: 0.1, floor: 50 });
// c.regressed === false; verdict(c) === 'ok'
median([Number.MAX_VALUE, Number.MAX_VALUE]); // Infinity
```

**Reader-window measurement has blind spots despite contract-consistent helpers.** `blocking` explicitly counts the excess above 50ms for tasks whose **start** is in inclusive `[from,to]` (`tools/lib/bench-stats.ts:12–18`). Its original example deliberately excludes an overlapping task that started before the window (`test/bench-stats.test.ts:27–34`). That behavior does not violate its documented start-window contract. At the caller (`tools/bench.ts:122`), however, a task starting before the recorded click can still delay reader interaction while contributing zero to the reported blocking metric. Conversely a task starting before rest can contribute its whole excess beyond rest. If the intended metric is experienced waiting inside an interaction window, define that metric separately and test overlap arithmetic; do not silently change a start-window helper's oracle.

`longestGap` similarly measures the initial wait and gaps between recorded in-window frames (`tools/lib/bench-stats.ts:22–32`), with no final tail to `to`. The original test explicitly expects zero when no frame occurs inside the window (`test/bench-stats.test.ts:45`). Thus a frame-starved interval can report zero. Caller line 120 labels it a reader gap; deciding whether to include an unfinished final wait is a measurement-design issue before it is a helper defect. Chronological frame ordering is also an implicit implementation precondition because line 28 breaks at the first later timestamp; document it.

## Property-based opportunities

The original suite already includes PBT; its 12 tests are not all hand-picked examples. Its generated comparisons use integer samples 0–5000, 5–15 pairs and a fixed rule (`test/bench-stats.test.ts:9–12`). That is useful for realistic milliseconds but excludes finite numerical extremes, invalid sample handling, small pair counts and varied thresholds.

Prioritize independent properties with one contract per failure signal:

- Median identity on repeated finite values, permutation invariance, and input immutability; empty returns NaN. Exercise even/odd counts, subnormals, signed values and finite extremes separately from invalid-data policy.
- Compare's exact conjunction: at least five pairs; median delta strictly greater than both thresholds; HEAD slower in at least 70% of pairs. Generate rel/floor, ties, exact threshold boundaries, zero baseline and counts below/at five. Check returned medians, delta and slower share, not only the final boolean.
- Pair permutation preserves the entire comparison. Permute paired observations together; independently shuffling one side can correctly change the slower share. The original rotation property is valid but tests only one family of permutations.
- Invalid/empty/unequal input classes must follow an explicit policy. Empty and unequal lengths already throw; nonfinite samples should never silently become `ok`. Negative timings and invalid rule values need a documented policy before prescribing exact rejection behavior.
- Blocking obeys the documented inclusive **start** rule. Generate starts just before/on/after both edges and duration just below/on/above 50. A separate reader-delay metric needs its own overlap oracle.
- Frame-gap behavior needs explicit empty/tail semantics, chronological input, duplicate frames, edge timestamps and singleton windows. Preserve the existing defined behavior until the measurement contract changes.
- Verdict is a small truth table: first nonregressed means ok; first regressed without a regressed second round means not reproduced; two regressed rounds mean regression. Small examples are clearer than elaborate random generation here.

Do not generate expected values by copying the implementation's sort/sum/conjunction into the test. Use mathematical identities, independent rank/boundary constructions, and deliberately isolated gate conditions. Retain named regressions after shrinking exposes a defect.

## Cost and replacement limits

The review's recorded original arithmetic run was **12 tests in about 295ms**. PR #11’s author reported browser benchmark runs of about **499s and 1011s** in its description; this audit did not rerun those long benchmarks. These numbers describe different workloads, not an apples-to-apples speedup: the browser runs build/open real pages, wait through reader interactions, collect performance entries, interleave BASE/HEAD and may reproduce flagged regressions. The arithmetic tests exercise none of that. This document does not claim a new timing measurement.

PBT can cheaply replace repetitive arithmetic examples and explore configuration/boundary combinations before an expensive browser run. It can prove useful laws about decisions over supplied timestamps and shrink failures to understandable inputs. It cannot replace Chromium measurements of actual long tasks, animation-frame scheduling, CPU throttling, event timestamp behavior, layout shifts, page errors, readiness, or end-to-end metric extraction. Keep a small browser instrumentation check that establishes those observations mean what the arithmetic expects, and keep the real performance benchmark for actual regression claims. A fast suite that agrees with a flawed measurement definition is still insufficient evidence about reader experience.

## Bounded PBT prototype actually run

An out-only prototype, `out/test-audit/pr11-pbt-prototype.mjs`, imported the preserved original helpers and fast-check directly; it added no default test or production dependency. Run: `node --experimental-strip-types out/test-audit/pr11-pbt-prototype.mjs` (Node 24). All checks used seed **110027**, configured for 1000 cases. Raw result metadata is in `out/test-audit/pr11-pbt-prototype-results.json`.

| Probe | Result | Executed cases | fast-check path | Check time |
| --- | --- | ---: | --- | ---: |
| Median versus independent count-based rank selection, safe integer domain | green | 1000 | — | 16.477ms |
| Median under arbitrary full permutations, preserving input | green | 1000 | — | 9.141ms |
| Repeated finite MAX_VALUE identity boundary | red | 1 | `0` | 0.749ms |
| NaN sample batches cannot produce ok | red | 1 | `0:0` | 0.363ms |
| Reader terminal-stall measurement model | red | 1 | `0:0` | 0.209ms |

The MAX_VALUE check is deliberately a single explicit boundary regression, not a claim of broad generated coverage. The invalid-batch property varies pair count and shrinks to five pairs. The terminal-stall probe shrinks to `[0,2]` over window `[0,1]`: helper returns 0, whereas an experienced-wait model expects 1. That last red result demonstrates disagreement between measurement definitions, **not** violation of the helper's current documented contract. Its label and placement outside the default suite are intentional.

The five check bodies took about **26.94ms total**, excluding module startup/import costs. This establishes that thousands of arithmetic cases and small counterexamples are cheap here; it does not establish equivalence to 499s/1011s browser workloads or estimate how much browser coverage can safely be removed. The safe integer reference intentionally avoids overflow so its own midpoint oracle is sound; the separate finite-maximum identity case challenges overflow without copying the midpoint algorithm.

## Harness limitations to resolve before treating it as a gate

- Validate `--reps` and `--cpu`. With fewer than five pairs, the timing comparison cannot flag a regression, yet the overall output can still say no regression. Reject insufficient runs or label their result inconclusive.
- The stage mutation observer records DOM writes, not completed paint. Metric extraction needs a small real-browser control with a known task/stall and explicit observation completion. Observer flushing is currently unproved; this review did not reproduce a lost callback.
- Only the first explainer on each side receives warmup. The fixed one-second waits also exclude immediate interaction after readiness. State which reader scenario the gate covers.
- The baseline worktree uses the current checkout's node_modules, so dependency-changing comparisons do not faithfully use both lockfiles. Output should identify dependency locks, built artifact hashes, browser and Node versions. A dirty boolean does not identify tested uncommitted bytes.
- The two-round rule is a reproducibility heuristic. Its thresholds and false-positive rate need calibration before blocking merges; it supplies no confidence bound by itself.
- Skip expensive A/B work when the compared built artifacts are identical. PR #11's documentation/helper changes alone should not require an eight-minute reader benchmark. Keep actual performance measurements for changes that can affect those artifacts.

These points concern PR #11's proposed tooling. This audit does not import its helpers into main solely to create a test seam or silently change its measurement definitions.

To reproduce the arithmetic findings, check out PR head `1f58e14fb8755316ab970717b0b676395c605ceb`, install its pinned dependencies and import `median`, `compare`, `verdict` and `longestGap` from `tools/lib/bench-stats.ts` under Node's TypeScript support. The bounded calls above reproduce the two arithmetic findings. A short generated counterexample is:

```js
fc.assert(fc.property(fc.integer({ min: 5, max: 30 }), n => {
  const result = compare(Array(n).fill(100), Array(n).fill(NaN), { rel: .1, floor: 50 });
  return verdict(result) !== 'ok';
}), { seed: 110027, numRuns: 1000 });
```

This is an intentionally failing diagnostic for the original proposal, not a test to add unchanged to main. Choose and implement the invalid-sample policy in PR #11 before making its regression green.
