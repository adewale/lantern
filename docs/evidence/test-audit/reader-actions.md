# Reader implementation actions

Phase 5 scope: reader tests and the approved obsolete path in `app/embed-zoom.ts`. No other production files, commits, or broad test runs. Historical pre-edit accounting remains in `reader-ledger.md` (71 declarations). This change retires one declaration and adds four: final reader lane **74 declarations**, including **20 zoom + 9 close-up** declarations exercised in Node. Other lane files remain retained.

## Changes and contract keepers

- Removed 26 production lines and added 2 (net **24 fewer production LOC**): obsolete `zoomTransform`, `cssPainter`, default constructor Painter, and unused `zoomOfView`. Caller search before removal found only `app/embed.ts` constructing StageZoom in production, always passing `reader.paint`; no production consumer of the inverse. Current whole-tree TypeScript search shows no remaining references to removed names. These are internal application helpers, outside package export entries.
- Retired the CSS string parser property, plus CSS-specific assertions inside retained arithmetic tests. Their serializer contract has no remaining product surface. Coverage/finite state laws remain. A recording Painter now checks actual controller paint targets, glide flags, callback state and zoomed class. The fixture's fake SVG/style support was removed with its final consumer.
- Added independent screen-space projection properties for `readerViewBox`, with arbitrary positive stage/camera aspect ratios, positive/negative author origins, noncentral pans and border pans, camera sizes from 1 to 100000, stage sides from 1 to 4000, and zoom 1 to 6. The oracle projects world points through the author's fitted camera and stage zoom rather than inverting the production function. Numeric allowance is derived before execution from serialization's 0.0005-unit component rounding plus IEEE operations. Identity remains exact and author spelling includes commas, tabs and whitespace. Nonpositive stage sizes preserve the author string.
- Added controlled-RAF ReaderView lifecycle proof: first capture, initially absent SVG, changing author camera while gliding, exact 220ms endpoint, no extra endpoint frame, cancellation on Fit, reduced motion and missing camera/home fallback. It asserts public SVG attributes. The real-browser camera-glide/Fit test remains the keeper for actual ReaderSink integration and browser rendering.
- Repaired the reset declaration: the former clamp-only check now says what it tests; a new StageZoom.reset property exercises generated prior gestures and verifies the exact painted identity/glide flag.
- Repaired resize coverage: noncentral zoom plus pan, independent width/height factors, and a magnitude-based 16-epsilon normalized-coordinate budget replace centered uniform scaling with 1e-6 slack.
- Close-up legibility now selects relevant labels independently using the documented 0.2-unit padding and all-label fallback, explicitly checking the production selector against that result. Full changed-region coverage checks rectangle-union cells and boundaries rather than a fixed 5×5 sample; the previous 1e-6 geometric allowance is unchanged. Change ownership is exactly one part and reading order is explicitly asserted.
- Browser caption-layout check now waits for a produced `rayner:step`, then an animation frame, before measuring positions. The former aria-current wait could resolve before rendering/framing. PKCE tour proof now requires full referenced-label containment, with the existing serialization-derived 1e-6 scene-unit allowance. Quiet lifecycle waits have a 30-second outer deadline while preserving the 300ms quiet interval and existing burst/race generation.
- Browser zoom readback is now test-owned geometry, with production inverse removed. It is diagnostic measurement rather than a camera oracle; independent screen projection is the primary numeric keeper. Actual browser camera/transport/offline/security proofs remain intact.

## Blind property mapping

| Blind ID | Disposition and owner |
| --- | --- |
| 14 | Retained separate exact factor-one, cap saturation, zero-pan, NaN-axis and hostile-point properties; retained independent fixed-point/inverse gesture laws with existing IEEE error budgets. No consolidation or domain narrowing. |
| 15 | New `readerViewBox` projection and exact-author spelling/zero-area properties cover the actual production camera path. Removed `zoomOfView` has no product callers; the independent geometry property replaces dependence on that inverse. Browser readback remains test-owned measurement. Malformed cameras have no documented acceptance contract, so no invented validation requirement. |
| 16 | New controlled-RAF ReaderView/cameraOf lifecycle keeper plus retained real browser ReaderSink camera-glide/Fit proof. Repaired noncentral anisotropic StageZoom resize and actual reset. The existing browser responsive checks remain. Generated repeated resize / `to()`-before-resize / zero-hidden-visible sequences are still a possible extension; this change does not claim exhaustive coverage of those cases. |

## Serialized negative controls for root

Do not run concurrently with other agents' production mutations. Suggested isolated mutations and expected owners:

1. In readerViewBox, use width fit rather than `min(width,height)`; projection must fail on a letterboxed author.
2. Shift serialized x or y by one author-space unit; projection must fail.
3. Identity returns HOME_VIEW rather than the supplied author; spelling/identity property must fail.
4. Omit StageZoom.set's painter call or invert its glide flag; recording-Painter/reset owners must fail.
5. Make StageZoom.reset a no-op; generated-reset property must fail.
6. Remove the x or y resize scaling; noncentral anisotropic-resize owner must fail.
7. Ignore cancellation before starting a new reader paint; controlled RAF Fit test must fail with a remaining callback / overwritten Fit.
8. Use stale camera in ReaderView.show or ReaderSink.apply; controlled lifecycle / retained browser camera-glide owner must fail.
9. Reverse partsOf final order; explicit order property must fail. Drop smallest nearby label; independent relevance/legibility property must fail. Remove an interior tour view; union coverage should fail if it opens an uncovered cell.

No mutation controls were executed by this lane; root owns serialized validation and independent preservation review.

## Verification and failures

- `node --test test/embed-zoom.property.test.ts test/embed-closeup.property.test.ts`: **29/29 pass, 765.060ms** final saved-tree run. Earlier version including lifecycle keeper: 29/29, 1113.856ms.
- Browser focus `stepping moves nothing|reader zoom composes|PKCE`: initial run 60.351s, 2 pass / 1 fail. The new layout listener was incorrectly attached to window although the application dispatches a nonbubbling event on document; corrected the test listener without product changes. Camera composition passed 8.101s and full-label PKCE passed 14.138s in this run.
- Corrected browser focus `stepping moves nothing|reader zoom composes`: **2/2 pass, 22.460s total**, including fixture setup. Layout 11.734s; real camera composition 7.797s. PKCE was already passing with full containment in the preceding run; its source did not change afterward.
- No product counterexample was found in these focused runs. No error allowance was widened after a failure. Full browser suite, mutation controls and generated-page baseline repins are left to root.

## Cost and remaining recommendations

This lane saves a dead production path and replaces its proof with cheap actual camera properties; it does not claim a broad browser-time reduction. PR #11's timing benchmarks remain distinct from layout, real-frame, and initialization correctness owners, but deterministic prepared-next DOM birth checks already prove key precomputation behavior cheaply. Keep real transport, offline behavior, camera animation and genuine races in browser. Large locale recapture restructuring and browser model refactoring were deliberately deferred because their boundaries require separate bounded work, not blanket deletion. Public API exports and core scene/view/path tests belong to sibling lanes.

## Preservation review follow-up

Independent review correctly found that replacing aria-current with an arbitrary settle counter lost the clicked-target assertion: a wrong first-step render could keep positions constant and satisfy the counter. Repaired the wait to require a fresh produced event with `detail.step` equal to the clicked button's `data-step`, and that same button's `aria-current` equal to `step`, before RAF/layout measurement. This preserves both requested target and produced state.

ReaderView's midpoint now independently projects the painted view corners through the latest author's camera and known half-time cubic ease-out (7/8 progress), rather than accepting any nonidentity frame until the endpoint. Serialization and IEEE error budgets are derived unchanged from the geometry contract.

Focused post-review runs: Node **29/29, 875.269ms** (`reader-node-review-run.log`); corrected target-aware browser layout **1/1, 12.898s total including fixtures** (`reader-layout-review-run.log`). No production mutations were performed. `git diff --check` passed for the changed test files.

## Serialized mutation follow-up

Root subsequently authorized isolated reader mutations. Seven intended mutants were killed; one initially surviving dropped-callback mutant exposed and led to repair of a real test omission. Production bytes were restored in finally blocks. Full evidence is in `reader-mutations.md`; final focused Node run passes 29/29 in 766.414ms. This supersedes the earlier statement that no reader controls had yet run.
