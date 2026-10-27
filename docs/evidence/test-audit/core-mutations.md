# Engine core serialized mutation evidence

Authorized files only: src/perf.ts and src/vmobject.ts. One defect was installed at a time, saved original bytes restored in Python finally after each subprocess, then byte equality asserted. No commits or broad suites. The following six final mutant runs exited 1 with AssertionError, not loader/syntax failures.

| Defect | Assertion owner | Log |
| --- | --- | --- |
| perf-self-counts-child | exact outer self excludes child | /tmp/perf-self-counts-child.log |
| perf-drops-return | returned object identity | /tmp/perf-drops-return.log |
| perf-unbounded-trace-depth | depth0/1/2 retained event names | /tmp/perf-unbounded-trace-depth.log |
| perf-counter-overwrites | counter report accumulated 3 | /tmp/perf-counter-overwrites.log |
| cubic-wrong-parameter-span | independent equal-parameter cubic geometry | /tmp/cubic-wrong-parameter-span.log |
| cubic-corrupt-retained-anchor | exact retained anchors / neighbor data | /tmp/cubic-corrupt-retained-anchor.log |

Exact commands (shell-quoted patterns):
```sh
FC_SEED=20261027 node --test --test-name-pattern='tracer: spans preserve' test/perf.test.ts
FC_SEED=20261027 node --test --test-name-pattern='tracer: spans preserve' test/perf.test.ts
FC_SEED=20261027 node --test --test-name-pattern='tracer: depth caps' test/perf.test.ts
FC_SEED=20261027 node --test --test-name-pattern='tracer: depth caps' test/perf.test.ts
FC_SEED=20261027 node --test --test-name-pattern='subdividing|splitCurve preserves' test/property.test.ts
FC_SEED=20261027 node --test --test-name-pattern='subdividing|splitCurve preserves' test/property.test.ts
```

Installed changes: child subtraction omitted from self; callback return dropped; all depths retained; counter accumulation overwritten; split denominator increased by one; stored curve start x shifted by0.125. Every mutant was rejected by its intended public contract. Full shrunk counterexamples remain in logs.

Restoration SHA256:
- `src/perf.ts`: `25d937d762aeeee96f73b73daab6bb7f31bddbb3fbd424ea47dddecff8f4050f` (saved bytes == restored bytes).
- `src/vmobject.ts`: `c0ad4b0921475c3629f44e87fd2beb5ccb088e8511aec32a85f9d962c75d2896` (saved bytes == restored bytes).

## Oracle repair found during control inspection

The first multicurve implementation greedily treated the first equal source endpoint as its split boundary. Mutation shrinking exposed coincident/degenerate anchors where that choice was ambiguous even without the defect. Fixed the oracle, rather than excluding valid geometry: a memoized search now accepts any complete ordered partition whose pieces independently match equal Bernstein parameter spans of every source curve. Manim fixtures continue to own allocation choice. Added two deterministic constant tapes (all0 and all0.5), keeping all200 generated cases and existing1e-5 Float32 budget. All six mutation runs above were repeated against this repaired oracle.

Also expanded independent eight-segment arc length property from one curve/subpath to generated0–4curves per subpath and0–5subpaths, retaining200cases and1e-12 arithmetic comparison. No domain narrowing.

Final restored focused command:
```sh
FC_SEED=20261027 node --test --test-name-pattern='arcLength uses|subdividing|splitCurve preserves|tracer:' test/property.test.ts test/perf.test.ts
```
Result:5/5 pass, zero skips,648.376ms total; log `/tmp/core-final-restored-green.log`. Diff whitespace checks clean.

## Controlled old/new timing

Same saved production source, same Node/container, same FC_SEED=20261027 and200generated cases. Original origin/main property was materialized at test/.engine-original-property.test.ts solely to preserve relative imports, removed in finally. Ran three alternating order pairs (old/new, new/old, old/new). Both commands filter the one subdivision test. Current new test additionally checks two constant tapes. All six timing runs pass.

| Pair | Old process wall ms | New process wall ms |
| --- | ---: | ---: |
| 1 | 3612.543 | 364.152 |
| 2 | 3542.763 | 455.616 |
| 3 | 3765.322 | 309.87 |

Median process wall: 3612.543ms old versus 364.152ms new (9.9× faster). Within-test medians from Node reporter:3233.005ms old versus43.773ms new (~73.9×); process totals include module/font/test startup. These are one-host focused measurements, not an end-to-end suite speed claim. Logs `/tmp/cubic-timing-0-old.log` through `/tmp/cubic-timing-2-new.log`.

Commands:
```sh
FC_SEED=20261027 node --test --test-name-pattern='subdividing any cubic path' test/.engine-original-property.test.ts
FC_SEED=20261027 node --test --test-name-pattern='subdividing any cubic path' test/property.test.ts
```

The dense nearest-point oracle was replaced by a stronger independent parameter oracle, not fewer cases/samples on the same nearest search. Existing independent Manim control/allocation fixtures remain unchanged.
