# Changelog

## Unreleased

### Lantern Explainers downstream product layer

#### Third pass: review findings and a design pass

- Engine hooks `Scene.onStep` and `Scene.addDescriber` replace the helpers' per-instance wrapping of
  `step` and `describe`. Steps record `hold`, so the player stops when the picture stops.
- Snapshots are stored one file per diagram in `scene.snapshots/`; the 52 existing diagrams were
  migrated byte for byte.
- `CodeBlock.morph` pairs lines by text, so a diff moves surviving lines and marks added ones;
  `findingsOf`/`d.findings()` tie verifier warnings to diagram parts exactly.
- `check` reports label sizes on a 390 px phone and each step's resting frame as text;
  `preview --watch` rebuilds on save; captions are checked against the video footer in every case.
- The player was redesigned: Next is the one primary action, the other tools are icon buttons,
  cases are a segmented choice under the title, and the stage zooms and pans. The gallery leads
  with reader topics and moves toolchain explainers below them. Taglines, helper text and
  secondary labels were cut from the pages and from the scenes' frames.
- The spec reads as a spec again, with a list of the decisions a release still needs.

#### Second pass: what the reader sees

- Every step's last frame now carries its idea. Diagrams gain `mark`, `dim`, `note` and walk
  trails that stay until removed; `s.card()` values update with `set()` and rows light with
  `mark()`; `s.code()` keeps a focus bar on the lines under discussion; content goes into named
  stage regions; the stage heading follows step titles. Emphasis is orange where a style's
  accent is grey or near-black.
- `explain check` fails a step whose last frame matches the previous step's, native text that
  collides or is cut off, labels under 14 px at a 1280 px stage (was 9 px), and captions that
  overflow the video footer, for every case. It, the contact sheets and the paused player now
  sample a step's true last frame instead of the frame before it.
- Next plays the step's animation before stopping; Replay step and Enlarge (full screen) added.
- All fourteen explainers rewritten against those checks; titles, captions and on-stage text
  edited with anti-slop-writing, which also corrected three factual errors in captions.
- Fixed: embeds below the fold stopped resizing because height reports waited on throttled
  `requestAnimationFrame`; inline-script escaping broke bundles containing `/</g`; Chromium
  discovery missed the macOS Playwright cache and incomplete installs.

- Native explanation helpers, finite per-instance reader cases, captured real-link walks,
  replayed typed diagram morphs, focus views, cards and chips.
- Pinned, optional build-time Agentic Mermaid 0.4.1 capture and loss-detecting SVG lowering;
  compact browser-safe geometry/text snapshots, including SVG baseline alignment measured
  from the embedded font. No runtime diagram renderer or layout service.
- External scene CLI (`init`, `preview`, `snapshots`, `check`, `build`, `render`, `shots`),
  including a compiled JavaScript npm executable and one-engine compiled-scene reuse.
- Portable, paused stepper pages with URL/history cases, poster/transcript/no-JS fallback,
  generated CSP recipes, license notices and optional source/origin-checked auto-height loader.
- Silent H.264/VP9 video, outline caption footer, subtitles, WebVTT, chapters and receipts.
  System-font scanning is disabled; unchanged frame rasters are reused without skipping simulation.
- Fourteen authored explanations, 31 cases, 52 diagrams, eight families and twelve styles;
  model/trace fidelity, motion/seek/runtime/legibility, browser, video and fresh-archive gates.
  Imported labels require readable completed-step views; reports retain full state traces.
  Served-collection review checks every case on desktop/mobile and saves screenshots.
- Engine fixes: recursive AnimationGroup membership, FadeOut opacity restoration, optional
  SVG paint/cache semantics and exact optional-style interpolation. Fixed rectangular paint
  viewports keep zoomed diagrams inside their own stage region; nested clips intersect.
  Existing runtime export names retained.
- Package requires Node 26+; public exports now resolve under `dist/src/`, with helpers at
  `manim-js/explain`. Public naming, production deployment and outside-author release acceptance remain pending.

### Inherited work

- TypeScript: the library, scenes, player, Worker, tools and tests are strict TypeScript.
  The package ships `dist/` (ESM, `.d.ts`, declaration maps) compiled by `tsc`; option,
  document and trace types (`Doc`, `TextOpts`, `StepRecord`, ...) are exported from the
  package root. Rendered output (SVG, text, traces) is byte-identical.

## 0.1.0

First release. A zero-dependency port of manim's core model to JavaScript, rendering
to SVG: a live DOM in the browser, strings in Cloudflare Workers or Node.

- Model: Mobject trees of typed point buffers; VMobject cubic Bézier paths; Text as
  glyph outlines (Inter, JetBrains Mono embedded); Transform with manim's alignment
  and curve distribution; FadeIn/Out, Create, Write, Indicate, Flash, MoveAlongPath,
  LaggedStart; `.animate` builder. Coordinates are manim's (y up).
- Scenes: async `construct()`, named steps with meta and captions, `this.state` traced
  at step boundaries, seeking by re-running with frames skipped (byte-identical to a
  full run), a JSON document format (`sceneFromDoc`).
- Output: SVG strings, a DOM sink paced on rAF timestamps, a text renderer for agents,
  structured traces.
- Verified: determinism, seek equality, cache validation, 400-seed property tests,
  fidelity oracles (reference programs, the real git CLI, manim's own functions),
  motion and playback gates, bare-runtime and leak tests, a pinned API surface.
