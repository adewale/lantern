# Explainer copy and layout

This pass edits the actual teaching paths in all 38 explainers in PR #69. The comparison is with `6bce495`, the preceding revision of that PR. It applies [anti-slop-writing](https://github.com/adewale/anti-slop-writing/tree/main/skills/anti-slop-writing) and Robin Williams’s contrast, repetition, alignment and proximity principles.

Seventy-seven default-path captions changed, covering all 38 explainers. Captions name the mechanism and the selected case’s consequence. Prediction steps ask about the picture without telling readers to advance. Repeated navigation advice and statements about what “this picture” teaches have been cut. The captions retain conditions that change the answer: cache freshness, the Monty Hall host rule, independent uniform birthdays, single-character parsing, calendar exceptions and the scope of each model. The French tax example remains in French.

The layout changes have specific purposes:

- **Contrast:** question headings share one scale, bringing the smaller headings up to the teaching pictures’ hierarchy. Table headers use bold ink and a separating rule, so a header can be distinguished from a result.
- **Repetition:** the teaching paths share question-heading, table and bar conventions. Peer flow boxes have equal heights even when a label wraps.
- **Alignment:** table text shares a left edge; numeric columns share a right edge with their headers. Bar labels align with the zero point, and values share a right edge. Git object headings sit over their respective columns.
- **Proximity:** each token-bucket request sits below its starting token and contains its own response code. Font names, phrases and advance measurements stay in their respective rows. The font-metrics comparison aligns both measurement labels with the phrases’ starting point.

Larger headings initially crowded the periodic table’s column numbers, the seasons pole labels and several teaching labels. The existing full-scene collision check rejected those layouts. Their drawings now leave room below the subtitle; the text-size target and collision checks are unchanged.

CI also exposed a navigation defect in the preceding revision: Left at the first teaching step attached the same picture again and emitted another step event. The reader now leaves that endpoint alone. A fixed browser example exercises repeated Left presses at a 200-pixel viewport alongside the generated reader-action sequences.

## Evidence

Fresh captures cover every default teaching step at 390×844 and 1280×900. The screenshots below compare the same settings and named steps before and after this pass. These are local Chromium captures.

- [All 38 revised openings](editorial-crap/overview.webp)
- [Token bucket: pair tokens, requests and results](editorial-crap/token-bucket.webp)
- [Latest search: align the publication-rule comparison](editorial-crap/latest-search.webp)
- [GTFS: equal peer boxes and aligned decisions](editorial-crap/gtfs.webp)
- [Glyph: keep measurements with their font](editorial-crap/glyph.webp)
- [Font metrics: align measurement labels and phrase starts](editorial-crap/font-metrics.webp)

The [validation record](editorial-review-2026-10-31.json) binds the final pages to their source, engine, artifact and reviewer fingerprints. It checks the browser results against the complete built case/step inventory. The earlier [tier reassessment](lesson-improvements-2026-10-31.md) remains an editorial judgement; this pass does not assign another tier increase.

To reproduce a phone comparison at either revision, run `npm ci`, then `npm run rayner -- preview scenes/explainers/token-bucket`. Open `?rate=2&step=reader-burst` at 390×844 with reduced motion enabled. The [screenshot receipt](editorial-crap/screenshots.json) records settings, source and engine fingerprints, and comparison-image hashes. The other pairs use the scene and step named in that receipt. `npm run demos:check` and `npm run demos:review` run the collection’s existing scene and browser gates.

- All 38 full-scene checks pass, including retained source steps. All 196 settings cases pass the served-reader review at 390×844 and 1180×980: 3,316 step/width observations and no page errors. The record rejects missing, duplicate or stale case receipts.
- All 538 declared teaching comparisons fit the opening at 320 pixels. The visual review inspected 121 default teaching steps at each capture width: 242 fresh captures in total.
- The full suite and targeted reruns account for 955 passed tests and 87 explicit optional skips. The first full run had thirteen failures because its command omitted the installed Chromium path, plus an export assertion expecting the old ring-buffer caption. Setting the path and updating that exact expected sentence resolves all fourteen; both affected files pass their rerun. The separate model, fidelity and drawing run passes all 71 tests.
- The browser language/export run passes 17 tests. The fixed first-step example and generated reader-action sequences both pass. Isolated copies reject the old shared layouts, centred table cells with the new bold headers retained, and the old first-step redraw. Production files were not modified for these controls.
- TypeScript and the installed-package browser gate pass. Every page remains below the existing 1.5 MiB raw and 450 KiB gzip limits; the largest is 951,685 bytes raw and 338,099 bytes gzip.
- [Startup budget measurements](editorial-startup-2026-10-31.json), taken after the other checks finished, pass the unchanged eight-second median limit at 4× CPU slowdown: cache 2.68 s, token bucket 3.11 s and gamut 4.89 s. Each uses three fresh Chromium contexts on localhost. Host and timing differ from earlier runs, so these measurements establish the budget for this revision.

## Limits

The copy pass concentrates on the teaching paths. Detailed source walkthroughs retain their specialist wording and remain in the full-scene and served-reader checks. Default screenshots support the visual review; automated review additionally visits every settings case and retained reference step. Chromium checks do not establish physical-phone or native Safari behavior. No reader study, audio listening assessment, deployment or merge is included.
