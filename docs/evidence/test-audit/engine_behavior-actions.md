# Engine behavior implementation actions

Implemented only six assigned test files; production and shared libraries unchanged. No commits or live mutants. Focused command:

`node --expose-gc --test test/emphasis.test.ts test/view.test.ts test/scene-hooks.property.test.ts test/anim-utils.test.ts test/explain-emphasis.test.ts test/matching-motion.test.ts`

Actual result: 73 tests passed, zero failures/skips, 2710.255093 ms reported total. No epsilon or generator-domain weakening. Existing gentle-motion lag bound is retained and named honestly; new replay property separately samples lag from zero through one, 100 configured cases. No broader arbitrary-lag support is inferred.

- Circumscribe now distinguishes partial path/full opacity from full path/partial opacity in the final third, using public outline style. Existing continuity, keep and seek proofs remain.
- Lazy View sync observes the public render callback at construction and both Succession turns, with a minimal fixture. The prototype monkeypatch is removed.
- Six pure timing laws use skipped execution through helper default Infinity. The playback keeper explicitly calls run(p,0) versus run(p,Infinity), preventing skipped-versus-skipped vacuity.
- Stage heading:false is exercised against a titled step and the public picture contains no title text.
- Cut-in test title now describes its actual brighter/faint and far-away assertions.
- Broader lag replay is a separate property; genuine fast movement need not pass the gentle-motion heuristic.

## Blind properties 20–25

| ID | Mapping and remaining work |
| --- | --- |
| 20 | Existing caption/hold/timeline laws remain and skipped-versus-played clocks are preserved. Fractional fps, first dt and quantized short durations belong to engine_core's Scene runner contracts; root should reconcile its independent coverage. No unsupported invalid-fps rejection assertion added. |
| 21 | Existing anim-utils Succession updater seek, view no-updater/seek and matching replay remain. New broad-lag replay extends its independent input dimension. Camera/object updater ordering belongs to sibling core. Returning-rate View interaction exposes the confirmed ID23 bug below. |
| 22 | New public callback test directly proves begin-time building. Existing View identity/parent/child/no-op runtime and matching variants remain. Non-mobject/parented fresh-result rejection are prospective missing siblings, not covered by the same-object rejection alone. Root may add these independently; no claim that all invalid cases are covered. |
| 23 | Existing left/right/scaled/false placement examples remain. A bounded returning-rate then rebuild probe confirmed scale corruption; minimized public reproduction below. Reported to root for source repair and red/green regression, rather than narrowing the rate function domain or adding a permanently failing test here. |
| 24 | scene-hooks properties retain duplicate independent registration/removal and dispatch mutation semantics. timeline retains post-stop play/wait/step rejection. StopScene sink-entry permutations and emitFrame belong to core; no unverified completeness claim. |
| 25 | perf contracts and rejecting-sink span cleanup belong to sibling core/perf owner. Root informed; no concurrent production mutation or duplicate edits. |

## Confirmed returning-rate View scale counterexample

Run from repository root:

```js
import { view, Rectangle } from './src/index.ts';
let side = 1;
const v = view(() => new Rectangle({ width: side, height: side }));
v.scale(2);
const original = v.current;
side = 3;
const back = v.sync({ rateFunc: () => 0 });
back.begin(); back.interpolate(0); back.finish();
console.log(v.current === original, v.current.width(), v.current.height());
side = 4;
v.rebuild();
console.log(v.current.width(), v.current.height());
```

Observed: `true 2 2`, then `2.6666667461395264 2.6666667461395264`. Documented inherited scale requires `8 8` after the final 4x4 build. The returning sync correctly retains its original child, but fit records the discarded 3x3 build size; the next fit measures the wrong inherited scale. This uses no private field or test helper. Root owns the production repair and final red/green regression. A second sync instead of rebuild is also worth retaining as a sibling path once repaired.

## Serial preservation controls proposed for root

After other lanes finish, independently mutate one at a time: ignore fadeOut (new Circumscribe test must fail), eagerly build View targets (public callback test must fail), ignore heading:false (new row must fail), and omit caption hold (timing laws must fail). Restore and verify exact source tree after each. Confirm by inspection or a controlled helper mutation that the parity keeper still invokes actual playback at zero. These controls have not been executed; concurrent live production mutants are prohibited during lane work.

## Pre-fix regression proof

Added `a returning sync preserves inherited scale for the next rebuild or sync` to test/view.test.ts. It retains the original child after the returning rate, checks its exact 2x2 size, and requires inherited scale two on the next 4x4 builder result, through rebuild and sync sibling paths. Pre-fix first rebuild assertion fails at actual `2.6666667461395264`, expected `8`; sync sibling is reached after repair.

Exact focused command:

`node --expose-gc --test --test-name-pattern='a returning sync preserves inherited scale' test/view.test.ts`

Red output saved in `engine-view-prefixed-red.log`; producer SHA256 before repair saved in `engine-view-prefixed-source.sha256`. Source remained unedited by this lane. Expected failure is a preserved product counterexample, not a formerly green lane pass. Root owns the source repair and post-fix proof.
