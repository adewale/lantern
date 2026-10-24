# Changelog

## Unreleased

### Lantern Explainers downstream product layer

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
- Fourteen authored explanations, 31 cases, 43 diagrams, eight families and twelve styles;
  model/trace fidelity, motion/seek/runtime/legibility, browser, video and fresh-archive gates.
  Imported labels require readable completed-step views; reports retain full state traces.
  Served-collection review checks every case on desktop/mobile and saves screenshots.
- Engine fixes: recursive AnimationGroup membership, FadeOut opacity restoration, optional
  SVG paint/cache semantics and exact optional-style interpolation. Fixed rectangular paint
  viewports keep zoomed diagrams inside their own stage region; nested clips intersect.
  Existing runtime export names retained.
- Package requires Node 24+; public exports now resolve under `dist/src/`, with helpers at
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
