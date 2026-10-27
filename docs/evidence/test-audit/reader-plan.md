# Reader lane layer plan

Pinned main: `a4a80d03963a86d804e2b3465ee8a7e9eb68ba6d`. Complete read-only ledger: `reader-ledger.md` — **71 declarations, 7 files; 60 retain, 9 repair, 1 conditional consolidation, 1 conditional deletion**. No source/test edits or broad test runs performed. Baseline is the exact-tree-equal reused main proof, with skips preserved.

## Ownership and size

Assigned test LOC: 3,240 (250 close-up + 217 protocol + 395 zoom + 1,742 embed + 107 capture + 467 language + 62 lettering-browser). Collection QA: 138 LOC in `tools/explain-review.ts`. Test support is mostly inline: fake browser globals in protocol tests; fake stage and generated gestures in zoom tests; player model/commands and browser counters in embed tests. Shared `test/lib/pbt.ts` is owned centrally; do not change its global multiplier merely to make browser tests faster. No separate reader support file is currently retired by this plan.

Production owners: `app/embed.ts` 609, `app/embed-closeup.ts` 332, `app/embed-zoom.ts` 297, `app/embed-protocol.ts` 55, `app/loader.ts` 57, `app/embed-strings.ts` 177, `app/embed-share.ts` 9 = 1,536 LOC, excluding generic icons and CSS. Preserve src public API/engine ownership under the other lanes.

History inspected: camera/viewBox conversion `4d3c492`; parent-origin/resize test history; `a4a80d0` mobile view navigation; `69387f5` share-link copy behavior; `b99df30` measuring-caption fix; `1a4c716` lettering initialization. Source contracts read in `docs/REFERENCE.md` controls/resize/language sections and each production owner. Existing comments document reduced numerical and player lifecycle regressions; keep those controls rather than trusting random rediscovery.

## Exact dead-caller evidence

Command used:

`rg -n 'zoomTransform|cssPainter|zoomOfView|new StageZoom' --glob '*.ts' --glob '!test/**' --glob '!out/**' --glob '!dist/**' .`

Non-test result at the pinned tree:

- `app/embed.ts:233`: the sole `new StageZoom(...)`, with the third argument **always `reader.paint`** (`ReaderView`).
- `app/embed-zoom.ts:52`: declaration of `zoomTransform`.
- `app/embed-zoom.ts:88`: declaration of `zoomOfView`.
- `app/embed-zoom.ts:105`: declaration of `cssPainter`.
- `app/embed-zoom.ts:112`: `cssPainter` calls `zoomTransform`.
- `app/embed-zoom.ts:184`: constructor's default parameter `paint: Painter = cssPainter(stage)`.

No production consumer calls `zoomOfView`. Neither these helpers nor StageZoom are exported by `src/index.ts` or package `exports`; they are internal app implementation, despite module-level exports. Docs explicitly promise an SVG viewBox rather than CSS scaling. This is a genuine obsolete production fallback maintained by tests, rather than a slow test being declared obsolete.

## Proposed cutover, in priority order

### A. Retire obsolete CSS proof, retain actual reader painting

Keeper boundaries:

1. `embed-zoom.property.test.ts`: controller numeric and gesture laws; inject a recording `Painter` into StageZoom. The fixture records external paint calls and does not compute the asserted behavior. Check paint target, changed callback and zoomed class against exposed controller state.
2. New properties in the same zoom file for **production `readerViewBox`**: identity preserves the exact author string; nonidentity means expected visible author-space rectangle; independent coordinate oracle covers letterboxing and arbitrary author origins/aspect ratios; nonpositive stage dimensions preserve the author frame. Keep agreement/readback only if readback is a test-owned independent oracle, not a second production helper supplied solely to bless the first.
3. `explain-embed.test.ts:396`: strongest retained actual SVG/browser owner. It proves a moving author's camera and reader zoom compose, including phone framing and Fit. Do not replace it with Node PBT.

After keepers exist, remove `cssPainter`, `zoomTransform` and the StageZoom default argument. Retire the CSS serialization declaration at `embed-zoom.property.test.ts:230` and remove CSS-output-only assertions from retained invariants. Update constructors in the fake-stage tests to pass the recording Painter. Consider moving `zoomOfView` into test support or replacing its browser use with direct test-owned coordinate math; copying it verbatim without independent expected geometry would preserve the shared-oracle flaw. This can reduce production LOC and real bundle bytes. The root owner must coordinate deliberate generated-page hash updates in their separate baseline commit.

Mutations to catch before deleting CSS proof:

- Shift only ReaderView x or y by a fixed author-space unit: geometry keeper must fail.
- Use width scale instead of min(width,height) for a letterboxed author frame: a nonmatching aspect-ratio property must fail.
- Return HOME instead of the supplied author at identity: exact-author property must fail.
- Drop `this.paint(...)` from StageZoom.set: recording-Painter property must fail.
- Reuse reader HOME for every ReaderSink camera update: browser camera-glide owner must fail.

### B. Repair named contracts with weak assertions

- **Parts ownership/read order (`embed-closeup:158`)**: assert exactly one holding part, pair separation, and the documented row/top/left ordering. Current `holding.length >= 1` does not prove the name's uniqueness and no ordering is checked. Keep changed-letter count and earliest tie law. Mutation: reverse final parts order, or return a duplicated unlettered part; repaired keeper must fail.
- **Near-label selection (`embed-closeup:74`)**: add independently constructed label-relevance cases, including no overlap => all labels fallback and a tiny nearby label alongside a larger one. Existing scale tests and browser checks both call `labelsToRead` for expected selection and can miss the same omission. Mutation: drop the smallest relevant label; new property must fail even if scale arithmetic remains correct.
- **Full region coverage (`embed-closeup:108`)**: fixed 5x5 samples cannot prove all points. An independent rectangle-union sweep over part/view boundaries can prove no uncovered strip. Keep the reduced padding/rounding regression. Do not silently relabel sampled coverage as exhaustive.
- **Reset (`embed-zoom:144`)**: current body only calls clampZoom on IDENTITY. Rename that retained helper law and exercise actual StageZoom.reset after generated prior gestures. Mutation: make reset no-op; controller keeper must fail.
- **Resize centre (`embed-zoom:376`)**: generate noncentral pans and independent width/height changes. Current centered/one-ratio inputs let forced recentering or width-ratio-for-y bugs survive. Independently compare normalized drawing point under stage center with an error bound grounded in the arithmetic. Keep broad finite/coverage properties. Mutation: set x/y to new centered values, or scale y by width ratio.
- **Stable browser layout (`explain-embed:221`)**: aria-current changes inside chrome(), before show awaits framing/renderAt. Record a `rayner:step` counter before action and measure after the intended settle event. The test must fail if caption reserve or stable view-controls layout is removed. No additional production hook is needed.
- **PKCE evidence (`explain-embed:1678`)**: center containment permits half-cropped short labels. Require whole referenced short-label box to fit one visited view, using documented viewBox quantization allowance. Keep the real Enter interaction, 44px target and unchanged step URL. Mutation: crop a view to retain the label center but hide its edge.
- **Origin browser wait (`explain-embed:1639`)**: replace the fixed 100ms delay with readiness/recorded-post evidence and actual resize/settle delivery. Keep a representative real-browser origin matrix; the broad arbitrary-text accept/reject owner remains the pure protocol properties.

### C. Cost changes without dropping browser contracts

`quiet()` at embed:1181 has a real 300ms dwell and an unbounded outer loop. Do not globally delete that wait: unawaited browser history/case bursts need a stable lifecycle witness. Split ordinary step-completion waits from genuinely racing quiet checks. Use already produced `rayner:step` counters for ordinary Next/link checks, preserve targeted race stabilization, and add a finite failure deadline with URL/count diagnostics so a perpetually settling regression cannot hang until the job timeout. No new production seams.

The Next/link picture contract is repeated at embed:1200 (phone all sampled steps), :1261 (random desktop/oauth/cache/exgit), and :1367 (racing final state). The race proof is distinct. :1261 can consolidate into :1200 only after desktop and oauth coverage are carried across; otherwise keep it. A tiny valid user-authored scene that mutates after its last play can preserve the P5 terminal-frame regression without replaying seconds of authored story animation in every random case. Keep at least one captured-diagram/native-code integration and the author-camera browser owner; do not claim an all-synthetic page validates real capture wiring.

The player model calls the Chromium AX tree on every gesture, including zooms that do not change the semantic step. Consider checking computed AX at actual semantic transitions while retaining cheap DOM summary checks after every command. First measure this cost; no existing AX assertion should be deleted merely on suspicion.

`explain-lang` global before hook captures the rich diagram even for pure subtitle-tag and vocabulary tests. Isolate pure locale/grammar declarations into a fast owner with a minimal real Scene/settings fixture where needed. Preserve artifact/transcript/browser locale tests and rich independent golden strings. Replaying committed rich capture snapshots can remove default Chromium startup from language tests; keep fresh capture at `explain-capture` and add a French-label case there if needed. Do not replace fixed meaningful translations with validity-only generated text assertions.

`tools/explain-review.ts` is the release-style collection delivery owner: retains 140 catalog cases, actual parse, mobile/desktop overflow, artwork, captions, external-network refusal, headers, host embed and link cards. It visits the catalog-selected step, not all steps. Its screenshots are not compared as test oracles. Keep its distinction from algorithm PBT; source model properties do not establish browser parsing or header delivery.

## Public/sibling surface checklist

- `exactHttpOrigin`: accept, reject and unchanged canonical output covered; `resizeHeight`: origin/source/schema/range covered; `reportHeight`: numeric sequence, framed admission, dispose covered in Node plus real observer/window transport in browser. No missing sibling requires a new production export.
- `clampZoom`, `zoomAt`, `panBy`: independent legality, endpoints, no-ops, reject-direction and composition laws retained. Actual production cap is 6; the synthetic configurable-cap generator stops at 1e12 while its comment says any finite cap. Resolve that mismatch explicitly rather than silently trimming a failing domain.
- `StageZoom.apply/zoomAt/pan/to/reset`: controller gesture fixture covers numeric safety. Add explicit reset and anisotropic noncentral resize meaning. Pointer handler generation omits single-click recenter; Ctrl-false wheel currently has only legality checks, so unwanted zooming could survive. Add targeted reject/no-op wheel and click/travel-threshold properties at the existing fake-stage boundary, without exported test flags.
- `readerViewBox`: primary cheap geometric keeper currently missing. `ReaderView.paint/view` and `ReaderSink.apply` retain real browser camera/zoom wiring; deterministic clock-driven glide endpoint/cancellation properties are valuable but should not introduce a test-only production clock seam. `cameraOf` exact first-author retention can be asserted through ReaderView rather than as a copied private getter inventory.
- `mountEmbed`: case/step/history/model, keyboard, copy, no-JS, preparation/cache, race, early initialization, actual descriptions, mobile controls and independent layout owner retained. Rejected clipboard writes, keyboard focus on form/summary controls and fullscreen/orientation are coverage gaps, not implied by root/stage-only model keys. Add bounded real-flow cases where needed; orientation/device claims need an actual platform, not a fake flag.
- `mountExplainer`: actual two-origin iframe source check and loading covered. Host `lang`/data-lang override and returned unmount disposal are not covered by the standalone French player; retain as stated gaps or add a tiny real-loader fixture. Do not export hostLang to test it.
- `chromeFor`, `caseNameIn`, settingsProblem and language wrappers: fixed meaning, fallback and hostile prototype tags retained. `SHARE_META/shareable` binding has browser default/other-case/path-unsafe controls and authoring owner tests; no duplicated private regex test needed here.
- Capture: real backend SVG delegation, copied palette contract, fresh lowering and independent raster comparison retained. Greek live/font-first initialization is a distinct Node/browser agreement; do not delete it because snapshots pass in Node.

## PR #11 comparison

PBT can cheaply own benchmark arithmetic and recorded-event decisions: monotonic/translation-invariant windows; complete wait intervals including no frames/trailing stall; accept/reject invalid/nonfinite sample counts; pair ordering; margin boundaries; two-round matching semantics; and result consistency. Those laws should have independent event/interval oracles, not copy the reducer under test.

Actual main-thread busy-wait latency, browser frame delivery/compositing, and CSS layout shifts cannot be proven by arithmetic PBT. Existing embed:221 is a more direct zero-layout-shift regression owner than running 7 pairs over four authored scenes; extend it over focused caption/view-control changes rather than require a long performance run for that contract. Existing embed:1299 proves pre-tap work and cached clone ordering deterministically, cheaply catching an O(prefix) replay reintroduced into Next. It still cannot detect an unrelated 150ms busy wait, so keep a small optional real-browser responsiveness probe.

#11's default always waits 1 second twice and plays real authored motion in every fresh context; retrying whole scene rounds compounds that cost. It also calls the first DOM mutation first motion, which need not be a painted change. A narrow browser fixture + deterministic work/ordering keeper + pure event/statistics PBT can preserve much of the intended regression signal at lower cost, but not eliminate the need to measure actual browser timing.

## Cutover validation and preservation review

Before editing, parent should choose a bounded subset (A plus the high-confidence assertion repairs) and preserve every marked contract. Run touched Node files with measured wall time and narrow selected browser names; use existing baseline/valid broad proof for unchanged owners. Prove stated mutations and restore production byte-for-byte. A separate implementation-only adversarial reviewer must derive reader geometry contracts without these tests, and a preservation reviewer must compare each retired CSS assertion or consolidated browser row with the new keeper. No blanket reducing case counts, enlarging tolerances, or skipping browser flags to get green. Full-domain scale probes belong to cheap pure owners; no need to open 100,000 browser contexts.
