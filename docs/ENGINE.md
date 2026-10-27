# Engine docs: a map

The engine is `src/` (zero dependencies, exported through `src/index.ts`). Each guide below
answers one question about it. The explainer layer built on top is documented in
[the reference](REFERENCE.md), which also [names the explainers](REFERENCE.md#engine-features)
that use each feature. Lantern's own engine notes are at the fork base, `2c7bad5`; links to
them below say so.

| Module | Doc | The question it answers |
| --- | --- | --- |
| `mobject.ts`, `vmobject.ts`, `shapes.ts`, `scene.ts` | [Lantern's README, "Model"](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/README.md#model) (at `2c7bad5`) | What is a scene made of, and why are points the truth? |
| `animation.ts`: `Restore`, `TransformFromCopy`, `Succession` (`saveState` in `mobject.ts`) | [ANIMATIONS.md](ANIMATIONS.md) | How do I come back to a saved look, derive one thing from another, or run animations one after another in one play? |
| `animation.ts`: `TransformMatching`, `TransformMatchingShapes`, `TransformMatchingText` (`shapeKey()` in `vmobject.ts`) | [MATCHING.md](MATCHING.md) | How do I morph by what the parts are instead of where they sit in the family? |
| `animation.ts`: `Circumscribe`; `shapes.ts`: `SurroundingRectangle`, `Underline`, `Cross`, `Brace`, `BraceLabel` | [EMPHASIS.md](EMPHASIS.md) | How do I point at part of the picture so the step's resting picture still shows it? |
| `frame.ts` (`scene.frame`); `svg.ts`: `cull` | [CAMERA.md](CAMERA.md) | How do I zoom and pan without moving anything I drew? |
| `graphing.ts`: `NumberLine`, `Axes` | [GRAPHING.md](GRAPHING.md) | How do I chart the program's own numbers? |
| `view.ts`: `view`, `stateView`, `viewMismatch`; `panels.ts`: `StateReadout` | [VIEWS.md](VIEWS.md) | How do I make a picture a function of `scene.state`, and check it at every step? |
| `text.ts`: `Code` spans and token colours; `svg.ts`: run merging; `tools/tokens.ts` | [CODE.md](CODE.md) | How do I address, colour and box part of a line of code, and what does colour cost? |
| `diff.ts`, `animation.ts`: `TransformDiff`; `scene.ts`: `record()` | [MATCHING.md, "Diff-driven"](MATCHING.md#diff-driven) and [the reference, "Scene"](REFERENCE.md#scene) | How does a code morph follow the diff, and how does the trace prove it did? |
| `verify.ts`, `trace.ts`, `timeline.ts` | [The reference, "Checks"](REFERENCE.md#checks); Lantern's [VERIFY.md](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/docs/VERIFY.md) (at `2c7bad5`) | Is the animation true, correct and smooth, and how is each checked? |
| `perf.ts`, `svg.ts` | Lantern's [PERF.md](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/docs/PERF.md) (at `2c7bad5`); run merging in [CODE.md](CODE.md#cost-elements-per-line) | Where does a frame's time go, and what made it faster? |
| `fonts.ts`, `font-data.ts` | [The reference, "Scene"](REFERENCE.md#scene) (the fallback chain) and [upstream](UPSTREAM.md#engine-changes) | Which face draws a character, and what fails? |
| `lettering.ts` | [The reference, "Lettering on request"](REFERENCE.md#lettering-on-request) | How does an explainer draw Greek or Cyrillic, and what does that cost the explainers that do not? |
| `lettering-outlines.ts`, `italic.ts`, `math.ts` | [LETTERING.md](LETTERING.md) | How does an explainer draw another face, real bold and italic, Arabic, Devanagari, Hebrew or maths from runs shaped at build time, and why does no other page carry that code? |

Lantern's Mermaid flowchart layout and its JSON document format were deleted in this fork
([upstream](UPSTREAM.md) lists what went); diagrams come from Agentic Mermaid capture instead.

Every guide keeps the same guarantees: a frame is a pure function of alpha over endpoints
fixed when its animation begins, so a seek renders the byte-identical frame a full run
renders; nothing in `src/` imports a dependency or shells out; inputs computed outside the
scene (token colours, git hunks, diagram snapshots) are produced at build time and checked in.

## Out of scope

Each for a reason:

- **3D.** The model is 2D point buffers drawn as SVG paths; depth sorting and a 3D camera would be a second engine.
- **Boolean path operations** (union, intersection, difference). Robust curve clipping is a geometry library in itself; an approximate one would break exact points, and a dependency would break zero runtime dependencies.
- **Runtime LaTeX.** A TeX engine and its fonts are a large runtime dependency. The only acceptable route is a build-time Typst-to-outlines snapshot, checked in like the diagram snapshots.
- **`transform` matrices on the model.** Every move rewrites points, because points are the truth that traces, the verifiers and matching transforms read. The string serializer already writes shape-relative path data plus a `translate`, so a pure move keeps its `d` without a matrix in the model.
- **Raster images.** A bitmap has no points to morph, would be fetched or embedded as bytes, and would make frames depend on a decoder; everything on stage is paths and glyph outlines.
- **Narration.** Videos are silent, with a caption footer, subtitles and WebVTT. A voice track would need its own timing and a speech dependency, and [the design record](../specs/rayner.md#risks-and-scope) leaves it out of the first release.

Lantern listed matching morphs as out of scope at the fork base; [MATCHING.md](MATCHING.md) adds them.
Which of these changes are offered to the original project: [upstream](UPSTREAM.md#offered-upstream-draft-pr-description).
