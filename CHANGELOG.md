# Changelog

## Unreleased

- Give the catalog’s longer lessons a short main reading path with complete phone comparisons. Retain implementation walkthroughs under Details and sources, with direct links and full verification.
- Let authors name a comparison with `s.reading(before, after)`. Keep its subjects together when they fit at a readable scale, while retaining close-ups for smaller details.
- Add prediction steps to the dictionary, Bloom-filter, Git, Monty Hall and music lessons. Draw birthday comparisons and occupied dates, and show how a wrong font measurement changes placement.
- Rewrite main captions around causes and case results. Align comparison tables and bars, strengthen question headings, pair token-bucket requests with their responses, and keep font measurements beside their labels.

- Open the gallery with a periodic-table explainer: follow sodium, chlorine, iron, copper or helium from atomic number to group, with configurations checked against NIST's tabulated ground states for elements 1–108.
- Show one numbered mark per step beside Next, so readers see where they are and how many steps remain without scrolling to the step list.
- Size standalone players for short windows while preserving readable count labels.
- Restyle the player and gallery in the Atlas design language: paper and black, square corners, uppercase tracked labels, a black Next button and warm red step marks. The dark theme keeps those hues on a warm black. The periodic table uses Atlas's block colours as solid cells.
- Add explanations of Python dictionary deletion markers, insert-only Bloom filters, Git merges, Monty Hall host rules, the birthday paradox, and melody with rhythm. Each uses a separately tested model and compares an expected result with a case that challenges it.
- Add optional, user-triggered score audio with Play A/B, Pulse, Stop and a synchronized piano-roll playhead. Notes are synthesized locally; ordinary pages omit the audio module.

- Add opt-in natural-width diagram lettering. Capture measures the requested font before layout, so labels retain their proportions; existing diagrams keep their fitted widths.
- Upgrade build-time Agentic Mermaid to 0.5.1 for its supported font-measurement hook and recapture the catalog with that renderer.
- Add explicit LTR/RTL card fields and logical `start`/`end` stage regions. Text shaping, code, numbers and authored Mermaid flow keep their own order.
- Demonstrate measured EB Garamond diagram labels and panel direction in the public gallery. Document the separate controls for text, panels and graph flow.
- Verify a deployed collection against the reviewed export, including file hashes, reader response headers and loader caching. Refuse ambiguous release records before archiving an existing npm version.

## 0.1.1 (2026-10-29)

- Put step captions next to their pictures. Hide Next view and its instructions when a step has only one view.
- Refresh phone tour controls after a viewport resize while preserving the reader’s current zoom and step.
- Keep the cache hit/miss result and the token-bucket rate comparison together at phone widths, with readable labels and model-derived outcomes.
- Compress embedded diagram snapshots losslessly, enforce raw/gzip page budgets and record startup under 4× CPU slowdown.
- Add a public EB Garamond example with real bold and italic, captured from the requested source fonts.
- Add WebKit served-paint review and native macOS Safari reader checks. Keep installed-package checks on both Mac architectures while concentrating pure property tests in the full and minimum-Node lanes.
- Preserve tested release archives and manifests on GitHub Releases. Refuse an existing npm version or an undated changelog entry, and verify the registry’s integrity before exposing a release.
- Pin GitHub Actions and the existing vendored glyph bundle. Correct the 0.1.0 release status without changing its tag or published archive.

## 0.1.0 (2026-10-29)

First release of the `rayner` package, a fork of Ivar Vong's Lantern.

- Author technical explainers as TypeScript scenes with reader settings, named steps and captions.
- Build portable HTML pages with transcripts, picture descriptions, linkable steps, embedding support and response-header recipes. The browser runtime has no dependencies.
- Capture Agentic Mermaid diagrams at build time and animate their parts by id. Check every declared case, including imported-label collisions and visible route crossings, before publishing.
- Use native shapes, camera movement, charts, code diffs and matching transforms alongside diagrams. Text starts centred on its advance box; scene admission avoids duplicate subtree painting.
- Request additional scripts, replacement faces, real bold and italic, and typeset maths through committed lettering snapshots. See [supported requests](docs/LETTERING.md).
- Review every catalog step at phone and desktop widths, including actual painted subjects and close-up tours. The WCAG Focus Visible step opens on the criterion its caption explains.
- Use the `rayner` CLI to initialise, preview, capture, check, build and inspect scenes. PNG contact sheets are included.
- Run `rayner review` on an outside author's scene, with optional independent caption claims. Watched previews recapture requested lettering after edits.
- Export a generated catalog and deployment manifest with complete build inputs; stage and validate the collection before replacing its files and response-header rules.

- Compare reader timings with `npm run bench`: interleaved BASE/HEAD browser runs, retained traces and explicit inconclusive results for small samples. See the [measurement limits](docs/REFERENCE.md#reader-timing-measurements).

Requires Node 24 or later. Authoring targets Ubuntu and macOS; Windows is not yet supported. Diagram capture needs Chromium. Additional lettering capture needs Python and the documented source fonts; committed snapshots replay without them.

The [tutorial](docs/TUTORIAL.md) covers the first scene. [Publishing](docs/PUBLISHING.md) covers hosting and embedding. [Upstream](docs/UPSTREAM.md) records engine fixes and attribution.
