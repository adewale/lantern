> Historical cutover inventory. Subsequent captures, pin refreshes and Node 24 verification are complete; see [final release validation](validation.md).

# Video test cutover for the 0.1 page release

Source before cutover: main 9091f5a2a6909cd787da659d59916184b87e5f91. These are deferred feature contracts, not low-value tests. PR36 should restore/adapt them with the video owner, after merging the page-release branch. Exact original test files are available in that git tree and copied locally under /tmp/rayner-video-test-migration/.

## Retired declarations (18)

- test/explain-video.test.ts: entire file (4 declarations). Millisecond VTT carries; VTT language/markup escaping; seeded caption-payload roundtrip including blank captions/newline cues; actual FFmpeg MP4/WebM, chapters, subtitles, receipt, transactional failed export, invalid fps/width/case and output-collision gates. The VTT property includes the corrected independent oracle and explicit empty-before/after/allblank examples from PR32: preserve that repair when bringing the feature back.
- test/explain-tools.property.test.ts: wrapCaption section (10 declarations), including independent guaranteed-fit positive witnesses, advances-based line fit, word identity/order, greedy maximal wrapping, explicit four-line/oversize refusals, no-break-space preservation, width monotonicity, bounded-work scale probe. Keep their full generators and refusal semantics with the future footer helper; no reimplementation is retained for 0.1.
- test/explain-lang.test.ts: MP4 ISO639-2/WebM BCP47 tagging; video transcript's description-language marker (2 declarations). Page words, description and transcript language assertions remain unchanged.
- test/explain-gnome-files.test.ts: all authored captions fit the video footer (1 declaration). Model and per-case state fidelity proof remains in explain-fidelity.test.ts.
- test/lettering-rtl.test.ts: reject missing RLM footer run before FFmpeg (1 declaration). Generic first-strong/bidi-mark direction assertions from a second mixed footer test remain as their own page/runtime declaration; footer wrapping, line visual order and aligned outline box assertions are deferred.

## Removed video blocks from mixed declarations

- test/explain-stage-tools.test.ts: remove videoTranscript import/call only; keep exact escaped step line and absent-line paragraph assertions against built page transcript. Rename test to describe remaining proof.
- test/lettering.test.ts: remove valid Greek video footer and unrequested Greek/Cyrillic footer rejections. Keep real requested-face/embedded-face missing-glyph record assertions under explicit useProjectLettering setup, with a name describing that independent engine contract.
- test/lettering-rtl.test.ts: page/offPage packing/pruning no longer demands footer RLM run presence. Instead it requires independently named contact-sheet-only keys ('1. ניקוד', '2. כיוונים'), still proves stage runs survive and every offPage key is omitted, and retains packed outline validation. The preexisting 10x packed-size assertion remains; evaluate after real page-only fixture capture, rather than widening it to hide a failure.
- test/explain-fidelity.test.ts: fork timeline remains an independent authored trace oracle, renamed from step/state video to timing to match the page-timing scene rewrite. Historical upstream 'Lantern encodes no video' fact assertion remains because it has no retired feature dependency.

## Shared page/image contracts retained

- rasterize/band imports in explain-raster, explain-palette and explain-share point to extracted explain-raster.ts. All image dimensions, palettes/pixels, color error budget, clipping/culling, no-extension output, and actual resvg crash controls remain. Film-specific test names/comments now describe raster bands.
- All restingTextProblems, lintConstruct, snapshots, scriptEscape PBT in explain-tools.property remain untouched.
- All page RTL CSS, first-strong marks, UAX9 visual-order, whole-cluster transform matching, packed-outline pruning, corruption rejection and optional HarfBuzz/capture proof remain.
- Unrelated WCAG source-title/video terms and historical camera bug provenance are not deleted.

## Validation

Node26 focused shared surface: 43 passed, 0 fail, 0 skip, 12.04s. Command: node --test test/explain-tools.property.test.ts test/explain-raster.test.ts test/explain-palette.test.ts test/explain-share.test.ts test/explain-stage-tools.test.ts. Log /tmp/rayner-video-test-cutover.log. This precedes final Node24 validation, which is owned by the parent task.

A second focused Node26 run of lang/RTL/lettering/gnome tests was started before final setup/capture. It is not green release evidence: language fixture setup lacked CHROMIUM_EXECUTABLE_PATH; Greek subset replay deliberately forbids fonttools and now needs a real recut after footer capture removal; immutable page contracts need deliberate refresh. RTL pure/page/packing contracts passed before recapture. Parent owns final captures and Node24 runs.
