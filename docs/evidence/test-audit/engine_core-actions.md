# Engine core implementation actions

Only lane-owned tests changed; no shared support, production edits, commits or live production mutations. Full source/export/raster/corpus/heap/40-minute/frozen-Manim proofs retained. No case-count reductions or tolerance increases. New cubic geometry check tightens the former nearest-sample 3e-3 resolution to 1e-5 Float32 control-storage budget and retains 200 generated multicurve cases plus independent allocation fixtures.

Implemented: zero-runtime emitted-frame and independent target check; grouped replacement target/source identities; UTF-16 astral-prefix regression and generated astral symbols; zero/subnormal stretch inclusion; one fixed Write wrapping check outside the 20-case grouping loop; own-face font test name corrected; Code Infinity/-Infinity rejection; interpolation expected RGB/opacity values; separate wiggle law; all-input ordered lineGraph anchors; deterministic external-clock tracer return/throw/self/count/reset/disabled/depth/begin contracts. Added independent eight-sample length, direct split neighbor/parameter geometry, affine coordinate inverse, area baseline/rejection, bar sign interpolation and bounded plot sample-count/shape properties.

## Blind property disposition

- **8** Existing lineage degenerate-path keeper pins first/last drawable-curve anchors; direct split property pins stored control anchors and untouched neighbors, plus original insert property pins path endpoints. Negative-zero bit preservation and singleton-subpath versus drawable-curve endpoint precedence are not specified clearly enough to introduce stricter failing assertions. No generator was narrowed after failure.
- **9** Confirmed ambiguity, not adjudicated product bug. Source JSDoc says zero-length path answers first point; adjacent inline comment says endpoints are exact first/last. Existing degenerate keeper asserts last drawable-curve endpoint. Standalone repro below has zero length and returns different final endpoint. Preserve current endpoint keeper and request a contract decision; no contradictory red test or production edit.
- **10** Added independent Bernstein eight-segment length property for disconnected cubic subpaths (0–5), comparing each curve and whole length, including no jump contribution. Analytic arc length is not used as oracle. Zero/loop/straight fixtures remain in existing path/Manim properties.
- **11** Added direct split property for parts 1–12, first/middle/last of three source curves, exact stored boundaries and unchanged neighbors; independent Bernstein parameter oracle. 200 cases. Existing frozen Manim controls remain.
- **12** Replaced dense self-evaluator reference with independently evaluated source parameter spans for all output curves in original 200 multicurve cases. Original count, first/last geometry and complete source-anchor retention remain. Manim fixture owns allocation/ties. Lone/degenerate paths and alignData padding stay in core/lineage keepers. Broader closure/untouched-subpath insertion generation is deferred: not needed to validate this safe oracle substitution, and no coverage removed.
- **13** Reader-owned clampZoom; reader lane owns implementation/decision. No engine_core production caller bypasses that owner; camera Frame/cameraBox keep their distinct native geometry and bounded-stage proofs.
- **17** Added generated NumberLine transformed endpoint/extrapolation inverse and Axes nonsingular shear with an independent affine coordinate anchor. Existing translated/rotated/scaled fixed anchors remain. Tiny determinant conditioning has no documented numerical error bound; no arbitrary epsilon or domain expansion was invented.
- **18** Added generated integer-valued sample sequences (2–24), including plateaus/extrema/sign changes, exact independent anchors, exact neighboring range bounds and callback count. Existing nonfinite-run split and daylight analytic examples remain. Uses unit y scale to remove Float32 representation ambiguity in inequalities; generic geometry rounding covered by existing plot/affine owners. Nonfinite configuration rejection is not promised and not invented.
- **19** Added same-index bar interpolation baseline/top check through zero on rotated/shifted axes. Existing sign/color/label/default geometry owner retained; empty sets remain a coverage gap. Added areaUnder closed/baseline endpoints and NaN/±Infinity rejection. Separated lineGraph and assert every input point, including repeats and nonmonotone order.
- **25** Replaced busy waits with node:test scoped external performance.now mock, restored automatically; finally disables/resets singleton. Added exact return identity, throw identity, postthrow clean measurement, disabled callbacks/no aggregation, counts/report, reset, depth0/1/2 public trace retention, all-row aggregation, sequential begin/end. Repeated end idempotence is not promised. Scene rejecting-sink span lifecycle belongs to behavior lane/root investigation; no production mutation performed.

## Standalone clarification repro

Run from repository with ordinary Node TypeScript support; no test imports:

```js
import { VMobject } from './src/index.ts';
const p = new VMobject();
p.startNewPath([1, 2]).addCubic([1, 2], [1, 2], [1, 2]);
p.startNewPath([3, 4]).addCubic([3, 4], [3, 4], [3, 4]);
console.log(p.arcLength(), p.pointFromProportion(0), p.pointFromProportion(.5), p.pointFromProportion(1));
// 0 [1,2] [1,2] [3,4]
```

## Verification and exact failures

- `/tmp/engine-focused.log`: 9 focused tests, 8 pass/1 fail; sole failure was an incorrect new expected ordering of equal-self-time perf rows. Actual stable order was inner then outer; corrected expected order. No subject defect, threshold change or input exclusion.
- `/tmp/engine-focused-final.log`: 9/9 pass, 508ms wall. Cubic geometry test 57.6ms versus reused baseline dense check ~4479ms (different surrounding run/load; not a controlled benchmark). Tracer exact arithmetic 3.1ms; source baseline used real waits.
- `/tmp/engine-new-properties.log`: 8/8 focused pass, 1075ms wall (font own-face, ordered lineGraph, affine inverse, area, bar, tab invalid, direct split, length).
- `/tmp/engine-plot.log`: 1/1 pass, 384ms wall, plot property 52.5ms.
- `/tmp/engine-style.log`: style/rate/wiggle focused pass; exact full summary in log.

Remaining F items: bundled random-scene test still intentionally shares costly tape replay; no count/name-only consolidation without a careful replay ownership design. Instant-member/group-duration separation is organizational, retained unchanged. Large authored Fixture merge-count check remains as corroboration; explicit replacement should coordinate same-style/per-color/per-glyph owners with code-spans lane before removal. These are not represented as completed fixes.

## Serialized mutations for root

Omit zero-duration emit or landing; leave original grouped replacement and omit target; expose codepoint cluster instead of UTF-16; drop absolute bounds on negative stretch; shift split parameter spans or omit retained source anchor; corrupt inserted multicurve count; bridge a nonfinite plot gap; overshoot monotone handles; move bar baseline; omit area baseline closure/rejection; clamp style to constant white; fail to balance perf stack after exception; retain trace events at all depths; lose counts/reset. Each expected killing owner is named above. No kill is claimed without an actual root-serialized run.

Final combined focused verification: `/tmp/engine-final-touched.log`, all 21 selected touched/new contracts pass in 1744ms, zero skips/failures. Diff whitespace check passes for all five touched files. Root should run the coordinated TypeScript/full-suite gate after all lanes stop editing.
