---
name: lantern-explainers
description: Author, inspect, check and publish native Lantern explanations as reader-paced HTML embeds and silent captioned video. Use for step-through diagrams, code-change explanations, protocol walkthroughs and program-driven animation.
---

# Native Lantern explanations

Read [authoring](../../docs/EXPLAINERS.md), [embedding](../../docs/EMBEDDING.md) and [export](../../docs/EXPORT.md) before implementing. Paths are relative to this skill directory. This is a CLI workflow; it needs no MCP server or hosted service.

## Authoring loop

1. Run `explain init <directory>` (or `npm run explain -- init <directory>` in a checkout).
2. Keep one default-exported `Scene` subclass. Use static `meta` for title/id/sources and optional static `settings` for finite cases.
3. Give every idea a stable step name, reader-facing title and short caption. Derive answers from a small executable model; state its scope and cite sources.
4. Call `stage(this)` once. Use `show`, `reveal`, `walk`, `morph`, `focus`, `highlight`, `card` and `chip` only where they help. Native Lantern code, geometry and text remain first-class. Do not invent a second scene format or require a diagram for native geometry.
5. Run `explain snapshots scene.ts`; inspect the real verifier findings and generated cache. Use `--refresh` after importer changes.
6. Run `explain preview scene.ts` or `explain shots scene.ts`. Inspect **every** step, including non-default cases; a build success is not a visual review.
7. Run `explain check scene.ts`. Fix motion, exact seeking, runtime, legibility and construct lint failures at their cause.
8. Build portable HTML and render video. Inspect the HTML without external network access and the video's footer/subtitles/chapters. Preserve receipts.

## Invariants

- A setting changes the lesson, not its palette. Every combination is built before reading. Keep combinations few; the tool refuses more than 64.
- Walks use real directed links and captured routes. Never draw an unrelated token shortcut to conceal a missing edge.
- Morphs with typed `ops` must reproduce their next diagram through real mutation replay. Without ops, call it a visual transition, not a checked edit.
- One scene owns one clock. For simultaneous tokens, use a single helper walk with `{parallel:true}` or one native `play`; never concurrent `Scene.play()` calls.
- Never put awaited animations/steps inside a broad catch. Handle known model errors in pure code before animating; let Lantern's internal seeking signal propagate.
- Do not weaken verifiers, bless corrupt snapshots or skip a failing case to get a green report. Add a focused regression test for an observed bug and run it red before the fix when feasible.
- Preserve imported style geometry and paint. Unsupported SVG must fail explicitly; lettering uses embedded Inter, a documented limitation.
- Use readable focus views for large diagrams. The label check is at a 1280-pixel stage, not a promise of phone-scale diagram readability.

## Publishing

- `explain build scene.ts --out public/explanation.html` creates one explanation's artifact, generated header recipe, receipt and optional self-hostable loader.
- A raw iframe is the baseline. A loader is optional. No runtime network, font service, storage, account or live diagram renderer should be introduced.
- Resize messages need exact origin **and** source-window checks, finite bounded height validation and lifecycle cleanup. Apply `frame-ancestors` as a response header; CORS is unrelated.
- `explain render scene.ts --out public/explanation.mp4 --footer` produces a silent 1280 × 880 film. Check with ffprobe and a full FFmpeg decode. Use `--case id=value`, `--all`, `.webm`, or stage-only `--width` deliberately.
- Captions must fit three real measured footer lines. Shorten the writing instead of truncating it.
- Do not claim a local build was deployed or publicly released. Report the commands run, artifact paths, exact evidence and remaining limitations.

The underlying engine is Lantern by Ivar Vong (MIT). Keep the MIT and embedded-font notices. Do not imply endorsement by Lantern or Agentic Mermaid.
