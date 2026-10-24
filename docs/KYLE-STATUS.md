# Kyle delivery status

**Local implementation and demo collection complete; public release is not claimed.**

Lantern turns one native TypeScript scene into a reader-paced, portable website embed and a silent captioned video. Authors keep native objects and code; readers get named steps and meaningful, finite alternative cases. Agentic Mermaid 0.4.1 supplies styled artwork at build time, not a browser runtime.

This implements the first-release scope of [the proposal](../specs/kyle.md). Historical prototype numbers in that proposal are not evidence for this checkout.

## Delivered

- [x] Native `Scene` authoring, inherited examples/player and existing runtime export names preserved.
- [x] Stage/diagram helpers, finite per-instance settings, focus/reveal/highlight, cards/chips and traced real-link walks, including route-following sequence tokens.
- [x] Pinned build-time capture, loss-detecting SVG lowering, compact geometry/text snapshots, SVG baseline semantics and replay-verified typed morphs.
- [x] External-scene CLI: `init`, `preview`, `snapshots`, `check`, `build`, `render`, `shots`; installed executable is compiled JavaScript, with one shared compiled engine.
- [x] Paused, portable stepper pages: URL/history cases, themes, reduced motion, keyboard controls, poster, all-case transcript and no-JavaScript fallback.
- [x] Optional independent auto-height embeds, checking origin **and** source window; growth/shrinkage, strict payload bounds and generated CSP/header recipes.
- [x] **14 explanations, 31 cases, 43 captured diagrams, eight families and twelve authored diagram styles.** Eight inherited explanation topics rebuilt with the helpers; the ring buffer remains native geometry.
- [x] Silent H.264/VP9 export, outline caption footer, subtitles, WebVTT, chapters and provenance receipts. Failed exports preserve previously completed files.
- [x] Model/step-boundary fidelity, exact sampled seeking, skipped/full traces, motion, bare-runtime and legibility gates for every case. Check reports retain full program-state traces.
- [x] Imported semantic labels need readable **completed-step** views, inside their inherited viewport—not just a readable instant during a camera sweep. Native rectangular clipping prevents enlarged diagrams painting over the heading.
- [x] Gallery, contact sheets, served-collection desktop/mobile review, authoring/embed/export documentation, agent skill, fresh-archive smoke and CI browser/portfolio/video gates.

## Evidence from this checkout

| Gate | Latest result | Local evidence |
| --- | --- | --- |
| TypeScript, declarations and consumer compilation | `npm run check` passed | Command output |
| Expanded suite, Node 26.12.1 | **104 tests: 100 passed, four inherited external-oracle skips, zero failures**; browser/video/FULL flags enabled | `out/validation/full-tests.log` |
| Supported Node 24.10.0 | **99 passed, five skips, zero failures**; its test worker did not expose GC. The GC test passed separately with `node --expose-gc test/leak.test.ts` | `out/validation/node24-tests.log`, `node24-leak.log` |
| Authored portfolio | All **31 cases** passed motion, exact sampled SVG seeking, skipped/full state traces, bare runtime and label checks | `out/checks/*/report.json`, `out/explainers/evidence.json` |
| Model fidelity | Every case checked at step boundaries; independent RFC/Node-crypto, real-Git and scoped-model oracles | `test/explain-models.test.ts`, `test/explain-fidelity.test.ts` |
| Styled artwork | Twelve real styles passed non-text raster comparisons below 1/255 mean channel error; typography is explicitly excluded | `test/explain-capture.test.ts` |
| Browser behaviour | Cross-origin source/origin isolation, independent resizing, shrinking, history/fallback, real theme colours, keyboard focus, reduced motion, offline/storage-disabled and no-JS reading passed | `test/explain-embed.test.ts`, expanded-suite logs |
| Served collection | All **31 cases** checked on desktop/mobile; no console errors or external connections. Actual CSP headers, video byte ranges and two live embeds passed | `out/validation/browser-review.json`, `out/review/` |
| Default films | All **14** current-source MP4s rebuilt and decoded; silent H.264, 1280 × 880, footer/captions/chapters/VTT/receipts. VP9 and arbitrary even-width encoding covered by real integration tests | `out/videos/`, `out/validation/demos.log` |
| Fresh distribution | Node 24 archive installation, executable bin, external authoring/settings/check/build, notices, shared engine, **installed capture and installed video export** passed | `out/validation/package-smoke.log` |
| Inherited application | `npm run build` passed | `out/validation/inherited-build.log` |

The four unavailable inherited oracles require an external Manim checkout or Mermaid browser bundle. They are not described as passing. Generated artifacts/logs are local outputs, not committed release artifacts.

### Open the demos

```sh
npm run demos:serve
# http://127.0.0.1:5174/explainers/
```

Start with **Seasons**, **OAuth/PKCE**, **KV-cache review** and **Personal Agent Protocol**. Then open **Two real embeds** and a **Captioned MP4**. [The three-minute demo tour](DEMO-TOUR.md) gives a clean narrative without overstating the evidence.

To regenerate and review: `npm run demos:check`, `npm run demos:render`, `npm run demos:review`. Fresh captures/browser gates require installed Chromium or `CHROMIUM_EXECUTABLE_PATH`; movies require FFmpeg/ffprobe. Individual portable pages are approximately 0.4–0.7 MiB uncompressed in this build, including engine/fonts and their own cases—not the whole catalogue.

## Testing handoff

- **Tests changed:** helper/settings/snapshot/model/fidelity/protocol/CLI/browser/video regressions, plus real nested-clip raster and SVG-baseline tests.
- **Behaviour covered:** native author → capture → checked cases → standalone/embed → silent film → installed-package workflow.
- **Commands run:** `check`, expanded `test:full`, Node 24 suite and direct GC test, `demos:check`/`demos:render`, `demos:review`, full optional `pack:smoke`, inherited `build`.
- **Results:** gates above passed; skip prerequisites and font/model scope are explicit.
- **Gaps/risks:** the limits below and external release acceptance—not an unfinished local pipeline.
- **Follow-ups:** owner-led release decisions and outside-author/deployment acceptance.

## Honest limits and external gates

- Diagram lettering uses embedded **Inter**, not every style's own font. Native text also supports JetBrains Mono. Non-text fidelity is not a typography/pixel-identity claim.
- Evidence covers eight diagram families and twelve styles, not arbitrary Mermaid or SVG. Unsupported imported drawing resources fail rather than disappear. Broader-family work remains future scope.
- A 9 px label at a 1280 px stage is not a promise of phone-scale overview legibility; focus views, captions and the transcript remain important.
- Models are scoped and cited, not full external products. Seasons is an explicit astronomical approximation. **2password is an offline fixture, not a verified port of private/unavailable source or a live vault audit.** Obtaining that source is required for an exact port.
- Choose the public product/package name and accountable maintainer. The inherited npm name remains `manim-js`; no new npm release has been made.
- An independent outside author must accept the documentation/workflow on a clean machine. Automated archive smoke is distribution evidence, not that independent acceptance.
- Production hosting/deployment and validation of the bytes/headers actually served remain owner gates. No production deployment, upstream acceptance or endorsement is claimed.

Foundation: [ivarvong/lantern](https://github.com/ivarvong/lantern) at `2c7bad533be25fbd56d26a9a2b6c5651743f011e`. Preserve MIT and font notices; see [upstream boundaries](UPSTREAM.md).
