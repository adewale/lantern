# Changelog

## Unreleased: 0.2.0-explainers.0

### Cleanup

**Deleted.** Lantern's development player, Worker site and nine original scenes (the explainers rebuild all nine); `DocScene` and the JSON document format; `src/panels.ts`; Lantern's Mermaid parser, graph layout and `flowchart()`; the fifteen tools and the tests that only served them. Public exports removed: `title`, `CodePanel`, `StateReadout`, `Flowchart`, `flowchart`, `FLOWCHART_THEME`, `parseMermaid`, `layoutGraph`, `DocScene`, `sceneFromDoc`, `summarizeMotion` and their types. Helpers removed: `d.highlight`, `s.chip`, `s.title` and the stage's `title` option, `Card.fade`, `CodeBlock.fade`, the `aside` and `wide` regions. Documents went from fifteen to eight; the status page, demo tour, inherited README and engine notes are gone, and Lantern's own are linked at the fork base from [upstream](docs/UPSTREAM.md).

**Fixed.**
- 2password is a port of [kitlangton/2password](https://github.com/kitlangton/2password) at `e011177` (`src/discover.ts`, `op.ts`): every query word must be in the title, and a miss suggests up to three titles with Levenshtein closeness of 0.6 or more. The earlier scene invented its scoring and called a public source unavailable.
- Personal Agent Protocol follows draft 0.3: six areas, the issuer check as a two-way link through `protected_resources`, sessions named by key thumbprint.
- OAuth with PKCE says PKCE is for public clients and shows how another app intercepts the redirect; the made-up token-lifetime chart is gone.
- Seasons uses mid-month declination; the toolchain group in the gallery holds only toolchain explainers.
- Text the embedded fonts cannot draw fails every command, and video footers, instead of drawing blank.
- WebVTT escapes `<` and `>` instead of deleting them.

**Changed for authors.**
- `stage(this, { style })` sets the palette and every diagram's default style. `s.enter(...)` and `{ enter: false }` bring panels and native objects in together. `s.good`, `s.bad` and `regionBox(region, { top, bottom })` are new.
- Each step records a description of its resting frame, shown under the caption ("What the picture shows") and in the transcript. Marks also thicken outlines, and code marks add a gutter edge, so emphasis does not rely on colour alone.
- Zoom keys act only when the stage has focus; arrows pan when zoomed; a click recentres; reduced motion crossfades; `meta.lang` sets the page and subtitle language.
- Video shows each caption over the previous picture, then the motion, then a 0.4 s settle. The footer is 1280 × 960, holds only the caption, up to four lines at 27 px, in the page's colours. Footer fit and still-hold checks moved from `check` to `render`, so `check` and `build` need neither resvg nor FFmpeg. Still time did not drop (about two thirds of the running time before and after); reading time is the floor.
- Capture (`agentic-mermaid`, `playwright-core`, `svgpath`) and video (`@resvg/resvg-js`) are optional dependencies; `esbuild` and `typescript` remain. The package ships no `tools/` sources or docs. Reserved setting ids are now `step`, `t`, `theme` and `parentOrigin`. `demos:serve` moved to port 5175, so it runs beside `preview`. npm scripts went from 35 to 16.
- New exports: `StopScene`, `shaperFor`, `takeMissingGlyphs`.

### Earlier passes, 24–25 October 2026

- **Lineage and properties** (`55c1d95`): fast-check property tests with `FC_SEED` replay; engine fixes from Manim's and manim-web's issue history in `test/lineage.test.ts`; a capture-code hash invalidates stale snapshots; `site:export`.
- **Review and redesign** (`b172c2a`): `Scene.onStep` and `addDescriber` replace per-instance wrapping; one snapshot file per diagram; `CodeBlock.morph` pairs lines by text; `check` writes resting frames as text and phone label sizes; `preview --watch`. The player got one primary action, icon buttons and cases under the title. The package's player file list became a glob after the archive shipped without the zoom module, and a second embed now also measures on step and load, after an offscreen frame kept a stale height in about one run in four.
- **Holds and Node 26** (`36c782f`, `0a0c0dd`): steps record `hold`, so the player stops when the picture stops; `playwright-core` 1.64.1, because 1.56.1's Chromium install hung on Node 26.
- **Resting frames** (`8c46754`, `6676f4e`): `mark`, `dim`, `note`, walk trails, card values and code focus that stay on screen; named regions; `findingsOf` ties verifier warnings to diagram parts; `check` fails unchanged steps, colliding text and labels under 14 px (was 9 px); Next plays the step; the stage zooms. Fixed: height reports waited on throttled `requestAnimationFrame`; script escaping broke bundles containing `/</g`; Chromium discovery missed the macOS cache.
- **First build** (`72362c5`): the helpers, Agentic Mermaid capture, the CLI, portable pages with a loader and header recipes, captioned video, and fourteen explainers.

## Lantern

Lantern's history up to the fork base, including its 0.1.0 release and the TypeScript conversion, is in [its changelog at `2c7bad5`](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/CHANGELOG.md).
