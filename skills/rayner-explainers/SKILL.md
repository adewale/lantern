---
name: rayner-explainers
description: Author, check and publish Rayner explainers as reader-paced HTML embeds and optional silent captioned video. Use for step-through diagrams, code-change explanations, protocol walkthroughs and program-driven animation.
---

# Rayner explainers

An explainer is one Rayner `Scene`. The CLI builds it into a step-through HTML page and, optionally, a video. It needs no server or MCP. Read the [reference](https://github.com/adewale/rayner/blob/main/docs/REFERENCE.md) for the helper API and the checks, and [publishing](https://github.com/adewale/rayner/blob/main/docs/PUBLISHING.md) before you host a page or export a video.

## Loop

Commands are `explain <command>`, or `npm run explain -- <command>` in a checkout; `explain --help` prints the install lines for capture and video.

1. `explain init <directory>` writes a working `scene.ts`. Keep one default-exported `Scene` subclass with static `meta` (id, title, sources, and `lang` if not English) and, if a second case teaches something, static `settings`.
2. Derive every value on screen from a small model of the system. Test the model against its cited source; the checks cannot tell whether a caption is true.
3. Give each idea a step with a stable name, a title the picture can prove and a short caption naming what is on screen.
4. Call `stage(this, { style })` once. Put diagrams (`s.show`), cards (`s.card`) and code (`s.code`) in named regions (`main`, `side`, `top`, `bottom`) so nothing overlaps. Native Rayner objects mix freely; bring several in together with `s.enter(...)`, and pass `{ describe: '…' }` to `s.enter` or `s.keep` so readers who cannot see the drawing get it in words.
5. Design each step's resting picture, what the step leaves on screen, because the reader looks at it while reading the caption. Leave the idea there with `walk(..., { trail: true })`, `mark`, `dim`, `note`, `card.set`, `card.mark` and `code.focus`; give marks an `as` word ("rejected") when they mean something. A token that walks and vanishes leaves nothing.
6. `explain preview scene.ts --watch` and `explain shots scene.ts --case id=value`: look at every step of every case. A passing build is not a visual review.
7. `explain check scene.ts`. Fix failures at their cause; `out/checks/<id>/report.json` draws each resting picture roughly in text. Its `legibility.labelsUnder12PxAt390` counts labels a phone reader sees under 12 px in the step's close-up; get it to 0 in every case (a heading at `stage(this, { headingSize: 0.54 })` reads at 12 px).
8. `explain build scene.ts --out public/<id>.html`; optionally `explain render scene.ts --out public/<id>.mp4 --footer`, which also writes `<id>.transcript.html`.

## Rules

- Walks use real links; a missing link is a bug in the diagram or the model, never a reason to draw a shortcut.
- Morphs with `ops` must reproduce the next diagram through Agentic Mermaid's mutation replay. Without `ops`, call it a visual transition.
- One scene, one clock: never call `Scene.play()` concurrently. Use `{ parallel: true }` or one `play`.
- No awaited animation inside `try`/`catch` or `.catch()` in `construct()`; handle model errors in plain code first.
- Finish every change before a step's last `play()` ends: the picture must not move during the caption hold.
- A setting may change diagrams, captions, numbers and which steps exist; keep the palette fixed. Keep cases few; the limit is 64.
- Do not weaken a check, bless a corrupt snapshot or skip a case to get a pass. Add a regression test that fails before the fix.
- Lettering is embedded Inter or JetBrains Mono, plus Arabic-Indic, Devanagari and Chinese numerals. For Latin Extended, Greek or Cyrillic letters, ask with `static meta.lettering = { scripts: [...] }` and commit the `scene.lettering.json` the build writes; any other script fails every command. Picture descriptions are generated in English or French.
- Leave out panel titles and asides that repeat the heading, caption or values. Write titles and captions with [anti-slop-writing](https://github.com/adewale/anti-slop-writing): name the value or mechanism on screen, and state contrasts with because, although or so.

## Reporting

Report the commands you ran, the artifact paths and what the checks found. Do not claim:

- that a local build was deployed, released or tried by an outside author;
- that a model is a complete implementation, or that a caption proves a security or scientific claim;
- support for styles, scripts or SVG features the collection does not test;
- identical video bytes across FFmpeg builds.

The engine is a fork of Lantern by Ivar Vong (MIT). Keep the MIT and font notices, and do not imply endorsement by Lantern or Agentic Mermaid.
