---
name: rayner-explainers
description: Author, check and publish Rayner explainers as reader-paced HTML embeds and optional silent captioned video. Use for step-through diagrams, code-change explanations, protocol walkthroughs and program-driven animation.
---

# Rayner explainers

An explainer is one Rayner `Scene`. The CLI builds it into a step-through HTML page and, optionally, a video. It needs no server or MCP. Read the [reference](https://github.com/adewale/rayner/blob/main/docs/REFERENCE.md) for the helper API and the checks, and [publishing](https://github.com/adewale/rayner/blob/main/docs/PUBLISHING.md) before you host a page or export a video.

## Loop

Commands are `explain <command>`, or `npm run explain -- <command>` in a checkout; `explain --help` prints the install lines for capture and video.

1. `explain init <directory>` writes a working `scene.ts`. Keep one default-exported `Scene` subclass with static `meta` (id, title, sources, and `lang` if not English) and, if a second case teaches something, static `settings`.
2. Derive every value on screen from a small model of the system, kept apart from the drawing code, and test it; the checks cannot tell whether a caption is true. See [Test the model](#test-the-model).
3. Give each idea a step with a stable name, a title the picture can prove and a short caption naming what is on screen.
4. Before you hand-roll motion, read the [engine map](https://github.com/adewale/rayner/blob/main/docs/ENGINE.md): it already has a camera that zooms without moving a point, code that morphs along its own diff (`TransformDiff`), morphs matched by text or shape, emphasis that stays, charts of the model's numbers (`Axes`), pictures rebuilt from `scene.state` (`view`), addressable code spans, and `Restore`, `TransformFromCopy` and `Succession`. [The reference](https://github.com/adewale/rayner/blob/main/docs/REFERENCE.md#engine-features) names an explainer that uses each.
5. Call `stage(this, { style })` once. Put diagrams (`s.show`), cards (`s.card`) and code (`s.code`) in named regions (`main`, `side`, `top`, `bottom`) so nothing overlaps. Native Rayner objects mix freely; bring several in together with `s.enter(...)`, and pass `{ describe: '…' }` to `s.enter` or `s.keep` so readers who cannot see the drawing get it in words.
6. Design each step's resting picture, what the step leaves on screen, because the reader looks at it while reading the caption. Leave the idea there with `walk(..., { trail: true })`, `mark`, `dim`, `note`, `card.set`, `card.mark` and `code.focus`; give marks an `as` word ("rejected") when they mean something. A token that walks and vanishes leaves nothing.
7. `explain preview scene.ts --watch` and `explain shots scene.ts --case id=value`: look at every step of every case. A passing build is not a visual review.
8. `explain check scene.ts`. Fix failures at their cause; `out/checks/<id>/report.json` draws each resting picture roughly in text. Its `legibility.labelsUnder12PxAt390` counts labels a phone reader sees under 12 px in the step's close-up; get it to 0 in every case (a heading at `stage(this, { headingSize: 0.54 })` reads at 12 px).
9. `explain build scene.ts --out public/<id>.html`; optionally `explain render scene.ts --out public/<id>.mp4 --footer`, which also writes `<id>.transcript.html`.

## Start from an example

Each explainer in [`scenes/explainers/`](https://github.com/adewale/rayner/blob/main/scenes/explainers) shows a technique. Copy the nearest one rather than starting blank:

| You are explaining | Start from | It shows |
| --- | --- | --- |
| A code change and what it does to a system | `mr-cache` | `TransformDiff` on the code, the same edit replayed on the diagram with `ops`, a setting for hit or miss |
| A protocol or request flow | `oauth-pkce` | A sequence diagram revealed message by message (`build: 'frame'`, `reveal`); a setting that adds the attacker's step |
| A data structure changing step by step | `ring-buffer` | No diagram: native shapes, `Succession`, a `view` of `scene.state` |
| A state machine | `state-machine` | A state diagram driven by the real reducer, code spans, `Restore` |
| A rate or a model's numbers over time | `token-bucket`, `seasons` | `token-bucket`: `Axes`, `lineGraph`, `stateView`; `seasons`: `Axes.plot`; a setting that reruns the model |
| Identity, hashing or text that changes | `exgit` | `TransformMatchingText`, `TransformMatchingShapes`, `TransformFromCopy` |
| A real tool's behaviour, checked against it | `isdigit`, `gtfs`, `traffic-policy` | A model checked against the tool's own output, with a fidelity test |
| Records, schedules or shares | `gtfs` (ER, gantt), `pg-page` (pie), `cert-renewal` (timeline) | Diagram families beyond flowcharts |
| A subject in another language | `quotient-familial` | `meta.lang: 'fr'`; descriptions in French |

## Test the model

The scene asks the model; it never states an answer it did not get from one. These steps apply when you write or change an explainer's model; a change to layout, captions or publishing needs none of them.

1. Put the model in its own module, with no drawing in it. In this repository, a model of an outside tool or format gets `scenes/explainers/lib/<id>.ts`; the small models behind `ring-buffer`, `state-machine`, `token-bucket` and `seasons` share `scenes/explainers/lib/models.ts`.
2. Check the model against its source: run the real program or library, or use its published test vectors, and pin the version you ran in the `meta.sources` links (`isdigit` links CPython at tag `v3.15.1`). If you cannot run the source, say so in your report.
3. At each step, record what the picture shows on `this.state` (`isdigit` sets `this.state.outcome = run.outcome` from the model's run).
4. Add a test that runs every case and asserts each step's state equals the model. In this repository, a model of an outside tool gets `test/lib/fidelity/<id>.ts`, using `assertStepState(trace, step, { … })`, called from `test/explain-fidelity.test.ts`; a model in `lib/models.ts` is tested in `test/explain-models.test.ts`, and a picture built with `view` adds `assertViewFollowsState`. Make the test fail first: break the model and watch it go red.

## Rules

- Walks use real links; a missing link is a bug in the diagram or the model, never a reason to draw a shortcut.
- Morphs with `ops` must reproduce the next diagram through Agentic Mermaid's mutation replay. Without `ops`, call it a visual transition.
- One scene, one clock: never call `Scene.play()` concurrently. Use `{ parallel: true }` or one `play`.
- No awaited animation inside `try`/`catch` or `.catch()` in `construct()`; handle model errors in plain code first.
- Finish every change before a step's last `play()` ends: the picture must not move during the caption hold.
- A setting may change diagrams, captions, numbers and which steps exist; keep the palette fixed. Keep cases few; the limit is 64.
- Do not weaken a check, bless a corrupt snapshot or skip a case to get a pass. Add a regression test that fails before the fix.
- Lettering is embedded Inter or JetBrains Mono, plus Arabic-Indic, Devanagari and Chinese numerals; any other script fails every command. Picture descriptions are generated in English or French.
- Leave out panel titles and asides that repeat the heading, caption or values. Write titles and captions with [anti-slop-writing](https://github.com/adewale/anti-slop-writing): name the value or mechanism on screen, and state contrasts with because, although or so.

## Reporting

Report the commands you ran, the artifact paths and what the checks found. Do not claim:

- that a local build was deployed, released or tried by an outside author;
- that a model is a complete implementation, or that a caption proves a security or scientific claim;
- support for styles, scripts or SVG features the collection does not test;
- identical video bytes across FFmpeg builds.

The engine is a fork of Lantern by Ivar Vong (MIT). Keep the MIT and font notices, and do not imply endorsement by Lantern or Agentic Mermaid.
