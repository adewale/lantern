# Deferred video implementation

## 28 October 2026 integration and review

Source: `ed0ec2a`, incorporating main at `2243495`. The merge retains the new SVG input contracts, complete story-review inventory and browser regression owners. Conflicted Hebrew, matching and replacement-face fixtures were recaptured through the real pipeline; only their builder/payload metadata changed. All 27 page pins were refreshed in a separate commit and independently replayed without update mode.

Environment: Linux, Node 24.19.0, Chromium 154.0.8037.57, FFmpeg 7.1.5, and the pinned Python/font inputs. These are local results.

- TypeScript and consumer compilation pass.
- Expanded whole-project sweep (`FULL=1 EXPLAIN_VIDEO=1`): 892 declarations, 819 passed, 58 optional skips, and 15 setup failures in the language file because the default Playwright browser was absent. Rerunning that entire file under FULL with `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` passes all 15 affected declarations, with one optional browser skip. The enabled browser lane below covers that optional owner. No assertions or domains were removed.
- Enabled lettering/capture/browser audit: 66 passed, no skips.
- Enabled embed, SVG and story-regression browser lane: 59 passed, no failures, two explicit optional skips.
- Real video/HTTP integration: four passed, no skips, including MP4/WebM decode, subtitles, chapters, frame counts, exact byte ranges and MIME types.
- All 27 explainers and 142 cases pass production checks, including pacing. [All-case metrics](all-case-pacing.json) retain each explainer's extrema; share budgets retain their existing short-film exemption.
- All 27 HTML, byte-count, header, canonical-receipt and full-receipt pins replay successfully.
- Complete served story review passes all 142 cases and 2,074 step/width states across three shards, including actual paint, named story targets, phone/desktop layout, response headers, two embeds, 208 share-preview pages and zero console errors or external runtime requests. The merge command verifies the complete matching inventory. [Receipt summary](story-review.json) retains catalog/reviewer hashes and all shard exit codes. An earlier unsupervised attempt ended before writing receipts and supplies no pass evidence; the supervised repeat completed all three parts.
- The final retained installed archive passes consumer/API/CLI checks, both starter cases, browser reading, watched rebuilds, actual Arabic/maths capture and actual video export. Archive integrity: `sha512-8OAofnZ/OUme/+ikGNDlLEITjxnmhpwz8ejXMKgEQPKZBPA7HpXl4fR4gW3bAwNyauaDw8eWLd06UnqluFTqyA==`.

### Export pacing repair

Direct export previously returned a successful file even when its pacing receipt broke the budgets. A real FFmpeg regression with a four-second idle stretch first fails on that implementation with “Missing expected rejection”. Export now rejects failing pacing inside its temporary-output transaction, before replacing any completed output. The fixed test checks the prior MP4 and receipt remain unchanged. The valid timing fixture now moves its dot in both steps: its independent 16-frame, chapter-time, VTT and transport expectations remain. All four real-media declarations pass after the repair.

### Catalog video review

All 21 video-enabled default cases were rendered at 1280 × 720 and 30 fps: 19,902 frames, 663.37 seconds, and 142 subtitle cues. Every filmstrip was visually inspected for mid-motion collisions, stray artwork and camera clipping. Suspected send-sync edge clipping was checked in a decoded encoded frame: the completed code frame fits; overlapping heading glyphs at the next boundary are the authored transition. The sampled films retain their expected paths, code transforms, charts and state readouts. Sampling is not proof about every frame or every non-default case.

An independent pass decodes every file and checks video/subtitle/audio stream counts, dimensions, exact frame counts, chapter counts, pacing receipts, actual VTT timing, HTTP HEAD media types, exact range payloads and served VTT content. [Catalog results and hashes](catalog-review.json) identify these exact outputs. Encoder hashes can change with encoder versions.

Reproduce the actual media and audit with:

```sh
node docs/evidence/video-0.3/render-catalog.mjs
node docs/evidence/video-0.3/audit-media.mjs
```

Use the installed Chromium and the Python/font paths described above when they are outside the default discovery paths. Output stays in `out/video-review/`. [Current fork filmstrip](catalog-fork-filmstrip.png) samples every second; the older half-second visual below remains historical evidence.

**Open readability finding:** 138 of the 142 actual default-case cues exceed a generous review heuristic of 240 words/minute. The worst, `2password` / `suggest`, is approximately 1,639 words/minute; `cert-renewal` / `other-rule` reaches 1,611. The heuristic is not a claimed universal reading-speed standard. These magnitudes show that full page captions cannot be read in the current motion-paced chapters. A release needs a decision between concise video-specific subtitles with full transcripts and longer caption-readable timing. The review does not claim this finding is fixed.

### Hosted Linux and Mac execution

The compatibility matrix now installs FFmpeg and runs actual MP4/WebM/HTTP tests and installed-package video on Ubuntu, Apple Silicon Mac and Intel Mac at the Node 24 floor and current 24. The Linux check lane also runs actual video integration.

Dispatch is blocked: GitHub returns HTTP 422, “Actions has been disabled for this repository”. Reading Actions permissions returns HTTP 403, “Resource not accessible by integration”. No connected browser-control tool is available in this session. An owner must enable repository Actions before this integration can obtain hosted Linux/Mac results. The matrix is configuration, not Mac pass evidence. PR #36 remains a draft while hosted results and the subtitle readability finding are outstanding.


## Whole-label reader integration

Latest runtime source: `1aa2e3746b209723e9ae8427d823b9a09fec8bd0`, incorporating the 0.1 page release through `6e3e411`. The pin-only follow-up refreshes all 27 actual video-branch pages separately. The README now sets the author project's module type explicitly, and every compatibility checkout retains the fork-base oracle's history.

The inherited close-up repair keeps the existing opening, zoom and emphasis ordering while adding a centred view when a readable label fits but every grid view splits it. The independent forward-projection property includes the 320 × 180 seam regression, headed/unheaded layouts, viewport aspects and generated zoom caps. Its original implementation fails in an isolated control; production bytes stayed untouched during that control.

Latest verification on Node 24.22.1/Linux:

- TypeScript check passes.
- Entire close-up property suite with `FULL=1 FC_SEED=20261027`: 19 passed, no skips (12.23 s).
- Real PKCE mobile browser route: 1 passed, no skips, covering both attacker settings and complete labels through keyboard-operated view navigation (28.24 s).
- The packing boundary passes exact outline-table uniqueness, UTF-8 byte accounting, contact-sheet/footer-run pruning and this video fixture's retained tenfold byte budget.
- All 27 page/header/canonical-receipt/full-receipt pins pass after the deliberate refresh (75.76 s).
- The fresh installed archive passes with browser and video enabled, including both starter cases, watch rebuild, consumer/API/lettering checks and actual video export.

The shared source/description/validator tests, enabled lettering/capture proof and real FFmpeg/media suite recorded below cover unchanged owners and were not needlessly repeated. No whole-project 0.3 suite, complete pacing campaign or hosted Mac result is claimed.

## Shared release e8 reconciliation

Final runtime source: `cd45c2a849810fb6b7dda00bd4c6b73e2516f97d`, including the page release through `e8f2209`. The following pin-only commit, `e60dd0f`, refreshes the video branch's 27 actual pages separately. Version remains `0.3.0-dev.0`.

The merge preserves video exports, filmstrip, media serving, restored contracts and historical screenshots while inheriting own-key family/namer/cardinality/plural/palette guards, safe mark aggregation, snapshot label/family validation, the Mac 15 matrix and HTTP-based language-browser coverage. No generator domain was narrowed. The first inherited fast-check regression examples had an overly narrow generic type; the final explicit mutation type fixes compilation without changing runtime samples.

Latest verification on Node 24.22.1/Linux:

- `npm run check` passes.
- Browser-enabled description/keys, helpers, emphasis and language checks: 59 passed, no skips (27.03 s). An initial attempt before the HTTP test repair passed 58 and failed the language browser case because this environment blocks `file:` navigation; final coverage uses the production localhost server and passes.
- Expanded validator properties with original failure seed `2009828571`: 2 passed, no skips (26.17 s), including drawing and describing every accepted snapshot.
- Real FFmpeg/video/HTTP delivery suite: 4 passed, no skips (9.53 s).
- Installed archive with `EXPLAIN_BROWSER=1 EXPLAIN_VIDEO=1` passes initialization, capture, check/build, both reader cases, watch rebuild, installed consumer/API/lettering checks and actual video export.
- All 27 HTML/header/canonical-receipt/full-receipt pins pass after the final deliberate refresh (66.29 s).
- Final authored Hebrew/combining-text HarfBuzz comparison passes. The preceding enabled RTL lane also passed all 11 declarations, including actual deterministic Hebrew/matching capture; its font, shaping and scene inputs did not change in the final family-validation merge. Existing video caption-compatibility snapshots remain fresh.

The earlier FULL film/VTT, phone browser and media-mutation evidence below remains applicable to those unchanged owners. No full 0.3 suite, all-case pacing campaign or hosted Mac result is claimed.

## Initial migration evidence

Source: `a1f1655d8d9601ffe477cc8c6dd4aea512360c04`, on top of the 0.1 page release at `577aac0`. Package version: `0.3.0-dev.0`. This branch is for PR #36; video is absent from the 0.1 CLI and archive.

## Preservation

The video branch keeps the 0.1 Node 24 runtime, regular diagram and PNG authoring dependencies, preview without automatic PNG generation, installed-starter watch checks, macOS matrix and phone-heading row fix. Rasterisation has one shared implementation; video adds an optional camera view. The renderer, film plan, filmstrip command, gallery video exports, media types and video documentation live on this branch.

The 18 deferred video declarations are restored: four VTT/FFmpeg declarations, ten caption-layout properties, two subtitle/transcript-language declarations, one every-case footer-fit declaration and one missing-RTL-run declaration. Mixed page/video assertions are restored alongside the page keepers. The corrected VTT oracle, heading-line collision properties, independent motion coordinates/fades and other main audit repairs remain.

Seven outline fixtures were recaptured through the actual pipeline. Only Hebrew, matching and replacement-face style change, because footer compatibility capture adds off-page runs there. Greek subsets were actually recut. Fork, glyph and Lantern diagrams were recaptured from their video-aware scenes. The exact incoming 0.1 page pins were retained before an explicit separate 27-page rebuild and pin commit.

## Verification

Environment: Linux, Node 24.22.1, Chromium 154.0.8037.57, FFmpeg on PATH.

- TypeScript and installed consumer check pass on final source.
- Focused tools, seeded gates, shared raster, stage and video run: 77 passed and one receipt lookup failure. Restoring the receipt's module import fixes it; the subsequent four-test video run passes, including real MP4/WebM export, decode, chapters, subtitles, receipts, failed-output preservation and case filenames.
- Expanded `FULL=1 FC_SEED=20261027` film-plan, push-in, pacing and VTT tests: 6 passed, no skips.
- Language, RTL and journey tests: 34 passed, 4 explicit optional browser/HarfBuzz/capture skips.
- All 27 page/header/canonical-receipt/full-receipt pins pass after the deliberate refresh.
- The inherited phone-heading row browser regression passes at both widths for its three scenes (33.99 s).
- Actual installed archive passes starter initialization, capture, check/build, browser reading of both cases, watch rebuild, installed API/TypeScript/lettering checks and video export.
- An added assertion at the real FFmpeg/HTTP boundary rejects the incomplete MIME restoration specifically as `application/octet-stream` instead of `video/mp4`. Restored media types pass all four video declarations, including MP4/WebM HEAD types, exact byte-range payloads and VTT type/content. This is transport proof in addition to the encoder checks.

The ordinary and expanded whole-project suites, all-case pacing campaign and actual macOS execution were not repeated for this future video branch. The Mac matrix is inherited configuration, not a claim of a passing hosted Mac run. Repository Actions remains a separate release prerequisite. These focused results do not establish 0.3 release readiness.

## Generated visual evidence

Base: `577aac0` has no filmstrip command; running `node tools/explain.ts filmstrip scenes/explainers/fork` exits 1 with `rayner: Unknown command: filmstrip`. There is no fabricated before picture.

Head: `a1f1655d8d9601ffe477cc8c6dd4aea512360c04`. Run:

```sh
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tools/explain.ts filmstrip scenes/explainers/fork --out out/video-review/fork-filmstrip.png --every 0.5
```

[fork-filmstrip.png](fork-filmstrip.png) is the actual 1920 × 5400 output, inspected without editing or compositing. Reviewer cue: its labels name motion/rest, time and step, and the sampled frames include mid-motion drawing as well as completed pictures. This demonstrates production filmstrip output for one default case; it does not prove every case is visually correct or replace video review.

SHA-256: `cc79f174335352351fcacc659aecb6af7f71e06eb0c61dbd232e41df661dc348`.
