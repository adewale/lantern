# Authoring implementation record

Scope: seven authoring test files only. No production changes, shared support edits, commits, broad runs, count reductions or live production mutations. Package and real-video boundary tests retained.

| Planned action | Disposition |
|---|---|
| share dimension validation | Repaired: exact two page-specific diagnostics replace vacuous every(). |
| share protocol inventory | Repaired: independent literal 13-tag list drives omissions and is compared with CARD_TAGS, including og:type. |
| helper accepted-snapshot draw catch | Repaired: refusal must match documented invalid-snapshot/source error; unexpected errors fail. |
| describe missing resolver | Repaired: rejects exact No diagram snapshots prefix. |
| describe complete changes | Repaired: independent complete key set derived from adjacent trace states, excluding picture, then compared to returned changed keys. |
| positive Card acceptance | Repaired all positive layouts: independent per-sample minimum width of padding + 2.5 font-size units + EPS; only insufficient boxes widened while other box/point/title/alignment/row/value diversity remains. Direct card() construction now requires success. |
| broad Card refusal domain | Retained original arbitrary cardCase in a new accept-or-documented-refusal property; independently enough-width cases must succeed; explicit too-narrow/duplicate/unknown cases remain. |
| caption positive acceptance | Added guaranteed one-line full payload/no-break-space acceptance plus one-to-four-line forced-break acceptance. Existing full arbitrary-domain fit/word/greedy/no-break/wider and wide-word/fifth-line refusals remain. |
| Card diff colors and shape | Repaired: emitted tint and solid gutter must use actual good/bad outcome colors, and a positive-area opaque gutter must exist. Palette contrast tests remain independent keepers. |
| panels region vertical title | Corrected misleading title to finite bounds and region width. Production place() explicitly promises never above top, while an overly tall panel can extend below; did not invent stage-containment contract. Existing dedicated region/top assertions remain. |
| VTT payload | Repaired: independently decode escaped cue payloads and compare normalized original nonblank lines. Broadened alphabet with &, <, Han and astral text, retaining arrows, blank lines and accents. |
| generator branch coverage | Replaced stochastic observation with deterministic family × anchor plans containing frame, dashed styles, self/parallel links, labels, measured/rotated middle-baseline runs and chart data. All generated product properties remain. |
| Code morph oracle | Replaced two new CodeBlocks with original before/after strings; Text.text preserves source tabs. Independent LCS DP/live identity/native morph checks remain. |
| filename injectivity | Removed random universal injectivity claim after exact independent SHA-prefix property passed. Added comment explaining finite 64-bit-prefix collision limit. Real-disk arbitrary-key roundtrip/file isolation/incremental byte checks retained; no collision-handling claim was silently substituted. |
| topology-light snapshot support | Deferred with root notified. Existing support defaults/full-glyph and all callers untouched. Requires measured, separately reviewed geometric projection preserving owned-label parts and routes; no count reduction used instead. |
| raw-template through actual bundler | No change: existing :535 behavior property already executes real esbuild output through scriptEscape/VM and retains hostile fragment regression. More adversarial fragment coverage remains a follow-up suggestion, not a deleted keeper. |

## Focused verification

- `node --test test/explain-share.test.ts test/explain-describe.test.ts test/explain-video.test.ts`: 11 passed, 1 explicit optional FFmpeg skip, 0 failed; 1,235.84 ms. Log /tmp/authoring-focused-short.log.
- Initial four-property-file run: 121 passed, 1 failed; 64,843.80 ms. Failure was audit edit accidentally removing snapshotPlan import used by empty-diagram focus property. Restored import immediately. No production defect was hidden or weakened. Log /tmp/authoring-focused-properties.log.
- After that first launch, added guaranteed 1–4 caption-line property; diagrams/tools rerun below verifies final versions. Panels/helpers final versions had passed first run.

## Cost evidence

Independent small measurement, no production mutation: 200 iterations, each projecting four before/after source lines (including tab and accented text). Original oracle's 400 CodeBlock constructions: 103.10 ms. Direct source-array projection: 0.066 ms. This measures redundant oracle construction only, not claimed full-suite speedup. Both checksums 1,600, accumulated 3,200; real morphed block and LCS/identity assertions remain unchanged. Full cost is environment-dependent.

No live production mutants run; root owns serialized mutation phase. Candidate controls are listed in authoring-plan.md.

Final diagrams/tools focused rerun: `node --test test/explain-diagrams.property.test.ts test/explain-tools.property.test.ts`: 65 passed, 0 failed/skipped; 61,688.87 ms. Log /tmp/authoring-focused-rerun.log. Includes restored empty-diagram focus import, deterministic covering plans, exact SHA keeper and both guaranteed-caption acceptance properties. `git diff --check` for seven owned test files passed.


## Preservation review correction

Independent review caught a gap in the first implementation: clamping every positive Card width to2 excluded previously accepted1.2..<2 widths from stateful set/mark/fade/point/box properties. The construction-only broad property did not preserve those stateful observations. Replaced blanket2 with independent sample-specific `0.56 + 2.5 * fontSize + EPS` width requirement. Original widths above that minimum, including narrow cards with small fonts, now pass unchanged into every stateful property. Only genuinely insufficient layouts are repaired for guaranteed positive acceptance; the original unrestricted layout generator remains separately tested. No production mutation or count/domain filtering was used.

Corrected Card-domain focused verification: `node --test test/explain-panels.property.test.ts`:26 passed,0 failed/skipped;12,386.24ms. Log /tmp/authoring-panels-preservation.log.

A second preservation pass found two additional semantic branches lost by the first helper: named regions were resolved to boxes, and undefined width was replaced by3.2. Corrected the helper to preserve named-region strings, undefined width, undefined placement and points unchanged. Only an explicit Box is copied before widening if insufficient; only a defined width is lifted. The formula includes an EPS margin: samples within EPS above the exact mathematical acceptance threshold are lifted by at most EPS for guaranteed-positive stability; unrestricted construction tests retain the exact boundary band and explicit narrow-refusal tests remain. This margin is not claimed to preserve exact boundary inputs in the stateful positive mapping.

Final default/named-region preservation verification: `node --test test/explain-panels.property.test.ts`:26 passed,0 failed/skipped;14,064.09ms. Log /tmp/authoring-panels-defaults.log.

Mutation phase found a surviving source-tab-normalization mutant: added explicit tab-containing line constants to existing line generator (no prior branch removed). See authoring-mutations.md for five mutation contracts, initial survivor, repaired kill, restored source hashes and clean focused passes.
