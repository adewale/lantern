# 0.1 release validation

The release is reader-paced HTML authoring on Node 24. Video commands, exporters, gallery video exports and active documentation are deferred to draft PR #36, version 0.3.0-dev.0. Historical video screenshots are preserved there.

## Tested source and results

The full sequential release run used clean source `6e3e4113e9fc04c90ba4013dec29adf131673863`, Node 24.22.1, npm 11.19.1, Chromium 154.0.8037.57 and Python 3.12.14 on Linux. Its [structured results](results.json) retain commands and elapsed times. These are local results, not hosted CI or comparative performance measurements.

- Fresh whole-project standard suite: 831 cases, 775 passed, 56 optional skips, no failures.
- The preceding expanded whole-project run passed 830 cases: 776 passed, 54 optional skips at `e8f2209811b77c15970a418b6c133c3f6494f584`. The subsequent implementation change was confined to mobile close-up generation; its full affected property suite passes all 19 declarations at the final source, including the new independent whole-label law. `src/`, `explain/`, snapshot validation and Node authoring implementation were unchanged between these runs.
- Enabled lettering: 65 passed, no skips, including actual shaping/capture and independent Unicode/HarfBuzz comparisons.
- Browser lane: 50 cases, 49 passed, one optional external upstream-checkout skip. Reader navigation, touch/keyboard, zoom, offline/no-JavaScript reading, requested maths/lettering and HTTP language checks pass.
- All 27 explainers and 142 cases pass production demo checks. Served desktop/mobile review passes every case, two embeds, response headers and no external connections. All 208 share pages pass preview-tag and image checks.
- The retained archive passes installed API/TypeScript/CLI tests, starter capture, hit/miss browser reading, watch rebuild, and new Arabic/maths capture. The same archive passes again on the declared minimum Node 24.0.0. Both runtimes use JavaScript installed entrypoints; source stripping in node_modules is not required.
- Production dependency audit reports no known vulnerabilities.

After these gates, one ten-word sentence in the fork explainer was corrected: the scene advances automatically; the page waits for the reader. Both versions have ten words. All eight steps' timing/title/line/state data are byte-identical (23,879 bytes, SHA-256 `dc540646ad8b532cd523dddd9c4817226a26562aef57e2e3b6dacca234b28536`). The production timing-step SVG is byte-identical (109,767 bytes, SHA-256 `728339300f24ee31fe3bb09dcb5cfdf02eebb0167d9183ea35ae6a83193893ef`). Fork fidelity passes 2/2; its production check passes. Only its page/header/receipt pins change. All 27 pins replay successfully, its outputs were regenerated through the production emitters, and the served review again passes all 142 cases and 208 preview pages. This editorial follow-up changes no installed package files. Final archive provenance must name the actual final commit, so `release:check` is run again after integration.

## Findings and failing controls

The first expanded run found a real inherited-property crash: snapshot family `valueOf` passed validation, then was read as an ownership rule. Seed `2009828571`, path `2170` reproduces it. Related inspection found inherited-name calls in family description, palette selection, cardinality words and plural headings; grouping authored mark words also crashed. Own-key checks and Map aggregation repair these paths without excluding valid custom words or generic families. Snapshot family/label metadata now validates its declared types before description.

Five new/extended boundary checks fail on the old implementation. Separate isolated namer, cardinality, label-validation and summary-only mutations fail their intended assertions; restored copies pass. Root source bytes stay untouched during isolated controls. Numeric mark-key ordering is preserved.

The enabled browser lane found a real pre-existing mobile seam defect after the story integration: a label fits a view but straddles every grid seam. A minimal 320 × 180 synthetic layout reproduces it without glyph metrics or Chromium. The new property forward-projects authored corners into CSS pixels independently of the production inverse. Its old-code control fails; the corrected whole suite passes all 19 properties, retaining point coverage, zoom/readability bounds, original opening, heading clearance and stable emphasis ordering. The actual PKCE browser proof passes both reader settings.

The older footer-shaped Hebrew/Greek expectations were moved or corrected to use text actually drawn on pages. Fixtures were recaptured through the production pipeline, not edited to bless stale data. The old Hebrew tenfold compression claim depended on footer duplication; the page-only fixture instead checks actual UTF-8 packed bytes are smaller and that both stored/page outline tables contain each distinct outline once. Exact packing, pruning, roundtrip and invalid-table contracts remain. [Video test migration](video-test-migration.md) names all 18 deferred declarations and their retained page/image boundaries.

An optional language browser test used file URLs blocked by this environment's Chromium policy. It now serves the actual artifact and header recipe over the production HTTP server, retaining every assertion, and runs in the browser lane. Transient test typing/setup failures were corrected before the final gates; no check was disabled to obtain a pass.

## Generated visual evidence

### Fitting note in a complete view

Input: `scenes/explainers/oauth-pkce`, `attacker=no`, `step=authorize`, 390 × 844, reduced motion. Baseline `e8f2209811b77c15970a418b6c133c3f6494f584`; repaired source `6e3e4113e9fc04c90ba4013dec29adf131673863`.

[Before](before-pkce-note.png) shows the old opening view, whose right edge cuts the note. [After](after-pkce-note.png) shows the added centred view with “verifier not sent” complete. These are actual unedited Chromium stage captures. The [receipt](pkce-view-receipt.json) checks all six old views and all seven new views using authored glyph bounds projected through the browser's SVG screen matrix: zero complete old views, one complete new view. The images show different positions in the same step's tour; the browser test independently verifies the visible Next view route without advancing the step.

Reproduce by building that explainer through `rayner build`, serving the page with its header recipe, opening the query above, and stepping Next view. The pure regression and real browser test are the primary reusable proof. One fixture cannot establish every explainer's visual quality.

### Stable line under the phone title

Input: `scenes/explainers/mr-cache`, default hit case and first step, 390 × 844, reduced motion. Before source `80adad400561f2b73c781692e20632b6a8e3e568`; after source `e8f2209811b77c15970a418b6c133c3f6494f584`.

[Before](before-phone-first-title.png) places the line immediately below a one-line title; changing to a two-line title moved it. [After](after-phone-first-title.png) reserves the title's second row so the line stays fixed. These actual served-page screenshots are unedited. The existing browser geometry owner checks every step of three explainers at desktop/phone widths, and fails on the old player. This comparison concerns the heading-row fix, not every change in the release.

## Remaining release prerequisites

Repository Actions remains disabled under issue #9. The configuration covers Ubuntu 24.04, macOS 15 Arm64 and macOS 15 Intel at Node 24.0.0 and current 24, including installed-starter/browser/watch checks. It does not establish a passing Mac run. Enable Actions and require successful PR/main runs before tagging.

The npm name still needs maintainer ownership/bootstrap, protected trusted publishing and a registry-confirmed installation. No tag or package was published by this work. A human outside-author tutorial run remains a useful usability check; automated author-project tests are not a claim that one occurred.
