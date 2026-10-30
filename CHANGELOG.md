# Changelog

## Unreleased

- Add dials: a setting with `dial: true` varies one value inside a step, with a stepper under the picture, no extra cases or transcript, and `check` running every dial value. Keep a helper for one step with `until: 'next'`; place labels and callouts clear of lines, other labels and the stage edge with `s.label` and `callout`. `Create` lowers its stagger so no row draws in under a quarter of a second, so axes with number labels no longer pop in.
- Record each explainer's pivotal claim in `scene.review.json` as a pivot (state asserted by `check`, witness painted for `review`); `tools/explain-pivots.ts --write` records a first pivot for every catalog explainer. Report label and caption density per step. A passing `check` prints a summary (`--json` for the report). Build `--stills` (every resting picture, no engine) and `--artifact` (the page without its document skeleton). Declare Node 22.22 as the minimum, which is what runs.
- Add the Manhattanhenge explainer: a solar model checked against published instants, with cycle and horizon settings. Record a three-way comparison of the same explanation built with Rayner, Lantern and by hand, and the lessons it draws for Rayner, in `docs/evidence/manhattanhenge-three-ways-2026-10-30.md`.
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
