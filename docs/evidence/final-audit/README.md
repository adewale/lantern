# Authoring and publishing audit fixes

Source implementation: `8d344c16fab72d2fa52554f905cd97bf840c553c`, based on main `2243495a59f7fc2c4c8e81c7b290a12acafaf9dd`. Later changes in this PR add documentation and evidence; the production implementation is unchanged.

The audit found two reproducible authoring defects and a separate deployment gap:

- An Arabic scene's initial watched preview captured lettering, but its rebuild omitted capture mode. A caption edit left the old page served. The same isolated scene now rebuilds and changes the served HTML: [before](watch-before.json), [after](watch-after.json). The installed archive gate repeats the edit through the real browser.
- The old export fingerprint omitted the player and build tools. The replacement identity counts source, runtime, dependency and notice inputs, and installed commands also count their compiled JS. An independent mutation that omits `app/` fails on the CSS invalidation contract: [rejection](input-mutation.txt). A changed producer rejects an old collection before export: [stale-export refusal](stale-export.txt).
- The hosting repository maintained an old landing page and old artifacts. Its companion update consumes exported `catalog.json`, refreshes the pages and response headers, and verifies the actual Workers Static Assets behavior. Its evidence belongs to the hosting PR.

`rayner review` gives outside authors the catalog's served-reader reviewer, with independent caption expectations in `scene.review.json`. Tests cover both successful rendering and refusal of a false claim, including removal of a previous success receipt. The installed-package gate checks that review and build identify the same HTML, and that changing installed CLI JS changes the build identity.

The README now explains the audience and purpose first and shows an actual cache-hit picture. The full, tested starter lives in the tutorial. Current docs describe review before build, explicit validation, included authoring dependencies, current lettering support, and export freshness.

## Validation

Node 24.22.1 on Ubuntu; Chromium at `/usr/bin/chromium`:

- `npm run check`: passed, including the emitted API's TypeScript consumer.
- `npm test`: 813 passed, 61 explicitly skipped; 874 declarations, zero failures.
- `npm run test:embeds`: 59 passed, two optional checks skipped. The omitted external glyph checkout and reference-maths capture are separate boundaries; installed Arabic/maths capture passed with the real capture dependencies.
- `EXPLAIN_BROWSER=1 EXPLAIN_LETTERING=1 npm run pack:smoke`: passed, including outside-author review, the compiled-command mutation and Arabic watched caption edit.
- Node 24.0.0, `EXPLAIN_BROWSER=1 npm run pack:smoke`: passed, including the installed CLI and real Chromium capture/review.
- `FULL=1 FC_SEED=20261028 node --test test/build-inputs.test.ts test/site-headers.test.ts`: passed; independent producer edits and 400 generated mutations, plus repeated header replacement.
- `npm run demos:build`: 27 explainers, 142 cases, 160 diagrams, eight captured styles and 15 families.
- `site:export --origin https://oshineye.dev`: 208 link-preview pages passed. All 27 individual explainer HTML files are byte-identical to the previously reviewed release export; reader code and those rendered outputs were not changed by this PR.
- [Export transaction control](export-transaction.json): a late refusal of a host-owned `llms.txt` leaves every host file unchanged; repeated export produces identical headers and preserves unrelated host rules.

The [machine summary](validation.json) separates these results. The full standard suite and browser suite ran before the final header-comment preservation assertion; that affected helper and its test were then rerun with `FULL=1`. Engine and reader behavior did not change after the recorded suites.

## Remaining release limits

The workflow-enable API succeeds, but GitHub still rejects dispatch with HTTP 422, “Actions has been disabled for this repository.” The integration cannot change the global setting (403). A maintainer must re-enable the repository's Actions and require passing checks. Both Mac architectures remain unrun in this environment. This evidence does not establish hosted enforcement or make the npm release ready to tag.

The archive prepared before these fixes identifies the older source commit. A release must use a newly prepared, tested archive from the chosen release commit; never relabel its manifest or publish the old tarball as proof of these changes.
