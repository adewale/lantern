---
name: lantern-explainers
description: Author, check and publish native Lantern explainers as reader-paced HTML embeds and optional silent captioned video. Use for step-through diagrams, code-change explanations, protocol walkthroughs and program-driven animation.
---

# Lantern explainers

An explainer is one Lantern `Scene`. The CLI builds it into a step-through HTML page and, optionally, a video. It needs no server or MCP. Read the [reference](https://github.com/adewale/lantern/blob/main/docs/REFERENCE.md) for the helper API and the checks, and [publishing](https://github.com/adewale/lantern/blob/main/docs/PUBLISHING.md) before you host a page or export a video.

## Loop

Commands are `explain <command>`, or `npm run explain -- <command>` in a checkout.

1. `explain init <directory>` writes a working scene. Keep one default-exported `Scene` subclass with static `meta` (id, title, sources) and, if a second case teaches something, static `settings`.
2. Derive every value on screen from a small model of the system. Test the model against its cited source; the checks below cannot tell whether a caption is true.
3. Give each idea a step with a stable name, a title the frame can prove and a short caption naming what is on screen.
4. Call `stage(this, { style })` once. Put diagrams (`s.show`), cards (`s.card`) and code (`s.code`) in named regions (`main`, `side`, `top`, `bottom`) so nothing overlaps. Native Lantern objects mix freely; bring several in together with `s.enter(...)`.
5. Design each step's resting frame, the last frame it draws, because the reader looks at it while reading the caption. Leave the idea on screen with `walk(..., { trail: true })`, `mark`, `dim`, `note`, `card.set`, `card.mark` and `code.focus`. A token that walks and vanishes leaves nothing.
6. `explain preview scene.ts --watch` and `explain shots scene.ts --case id=value`: look at every step of every case. A passing build is not a visual review.
7. `explain check scene.ts`. Fix failures at their cause; `out/checks/<id>/report.json` has each resting frame as text.
8. `explain build scene.ts --out public/<id>.html`; optionally `explain render scene.ts --out public/<id>.mp4 --footer`.

## Rules

- Walks use real links; a missing link is a bug in the diagram or the model, never a reason to draw a shortcut.
- Morphs with `ops` must reproduce the next diagram through Agentic Mermaid's mutation replay. Without `ops`, call it a visual transition.
- One scene, one clock: never call `Scene.play()` concurrently. Use `{ parallel: true }` or one `play`.
- No awaited animation inside `try`/`catch` or `.catch()` in `construct()`; handle model errors in plain code first.
- A setting may change diagrams, captions, numbers and which steps exist; keep the palette fixed. Keep cases few; the limit is 64.
- Do not weaken a check, bless a corrupt snapshot or skip a case to get a pass. Add a regression test that fails before the fix.
- Lettering is embedded Inter or JetBrains Mono; other scripts fail every command. Labels must reach 14 px at a 1280 px stage; phone readers zoom the stage.
- Leave out panel titles and asides that repeat the heading, caption or values. Write titles and captions with [anti-slop-writing](https://github.com/adewale/anti-slop-writing): name the value or mechanism on screen, and state contrasts with because, although or so.

## Reporting

Report the commands you ran, the artifact paths and what the checks found. Do not claim:

- that a local build was deployed, released or tried by an outside author;
- that a model is a complete implementation, or that a caption proves a security or scientific claim;
- support for Mermaid families, fonts or SVG features the collection does not test;
- identical video bytes across FFmpeg builds.

The engine is Lantern by Ivar Vong (MIT). Keep the MIT and font notices, and do not imply endorsement by Lantern or Agentic Mermaid.
