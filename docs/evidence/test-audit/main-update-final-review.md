# Final reader preservation review after main merge

**Freeze confirmed. No further reader production/test edits, test executions or mutations by this lane.** This read-only review inspects the merged source and root's exact-intersection fix plus explicit examples. Only this review artifact is written. Root owns final repins and complete validation.

No blocking preservation finding remains.

## Exact intersection defect and fix

The saved counterexample was a positive-width intersection of ordinary boxes, not edge touching: part `[0.9999995,0,2,1]`, stress `[0,0,1,1]`. Root changed membership from an arbitrary 1e-6 width cutoff to positive overlap (`w > 0`, `h > 0`), permitting zero overlap only when the corresponding stress side is **exactly** zero. The existing nonnegative-overlap guards still reject disjoint boxes. This matches the documented area-versus-touch distinction and the independent interval oracle, without narrowing input domains or widening error budgets.

The direct property still compares exact expected/actual start lists at 500 cases, over the richer optional stress generator including tiny/subnormal and zero dimensions. Explicit receipts now cover positive thin overlap, ordinary edge touch, positive-thin stress touching an edge, and a genuine vertical line within a part. The latter two distinguish exact zero from merely small positive size. The independent stable-partition property still uses expected intersections rather than production stressStarts, retains its 500 cases, and compares the exact Zoom sequence, so group priority, stable relative order, first view and original view set are all protected.

Root reports the whole close-up file passes 14 declarations in approximately 1.48s after this fix; I did not execute tests during this review. Earlier failed evidence remains in `main-update-reader-focus.log` and the supplemental audit instead of being discarded.

## Merge preservation

Verified by source inspection:

- All 14 close-up declarations remain, including new helper-state and PKCE semantic regressions. The optional stress generator and new stage/helper imports remain.
- Existing audit's independent near-label selection/all-label fallback remains; expected label relevance does not call the production selector. Rectangle-union cell/boundary coverage, exact change ownership and explicit reading order remain. Lead/full-part/top-left and reduced-rounding regression remain.
- The new browser semantic helpers `cardRow`, `restingBox`, `wordsOutsideCards` and Box import are present. Actual touch/Enter one-press proof remains, as does expanded phone-opening-by-link/Next coverage. This is kept separately from the older all-referenced-label/both-attacker/reduced-motion tour owner.
- Browser readback remains test-owned and the obsolete zoomOfView import is absent. Removed CSS painter/serializer/default path remains absent; new main did not resurrect tests-only production helpers.
- Layout proof still requires a fresh produced event, matching `detail.step` to the clicked data-step, the same button's aria-current, and then RAF before positions are measured. The preservation-review target assertion is intact.
- Quiet lifecycle helper retains the outer 30-second deadline and produced-state conditions without changing the genuine burst/race generators. Older tour proof still requires full referenced-label containment with its 1e-6 serialization allowance.
- Recording Painter still independently counts one paint and one callback per observed application, preserving the mutation-discovered missing-callback repair. Geometry projection, exact author-string identity, noncentral anisotropic resize, actual reset and controlled-RAF latest-camera midpoint/cancellation keepers remain.

The new main browser one-press helper's preexisting 1e-3 semantic-box allowance was not widened or copied into the older stricter tour proof. No existing numeric budget or valid generator class was removed to obtain the fix. Previous mutation results predate this main update and remain specifically scoped evidence, not a substitute for root's final merged-tree validation.
