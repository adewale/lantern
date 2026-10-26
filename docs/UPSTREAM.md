# Upstream

This repository is a fork of [ivarvong/lantern](https://github.com/ivarvong/lantern) at `2c7bad533be25fbd56d26a9a2b6c5651743f011e`. Lantern's README and its engine notes (verification, performance, flowcharts, the JSON document format) are at that commit: [README](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/README.md), [docs](https://github.com/ivarvong/lantern/tree/2c7bad533be25fbd56d26a9a2b6c5651743f011e/docs). Some of what they describe was deleted here: the development player, the Worker site, the nine original scenes, `DocScene` and the JSON format, Lantern's own Mermaid parser and layout, the `title`, `CodePanel` and `StateReadout` panels, and the tools that served them. The explainers in `scenes/explainers/` rebuild Lantern's examples.

From Lantern, with the changes below: `src/` (the engine), `tools/fonts.sh`, `tools/vendor-glyph.ts`, `tools/oracle/` (now only `manim_math.py`) and `tools/lib/browser.ts` (now only Chromium discovery and launch). The rest is the fork's: `explain/`, `integrations/agentic-mermaid/`, `app/`, the other tools and `scenes/explainers/`. The MIT notice in `LICENSE` is Lantern's.

## Merging

```sh
git remote add upstream https://github.com/ivarvong/lantern   # once per clone
git fetch upstream
git log --oneline 2c7bad5..upstream/main                        # what is new upstream
git merge upstream/main
```

A file this fork deleted (the player, `src/doc.ts`, `src/mermaid.ts` and the rest) comes back as a modify/delete conflict when upstream changed it; keep the deletion with `git rm` unless the change belongs in the engine. After a merge, run `npm run check`, `npm run test:full`, `npm run test:embeds` and `npm run demos:check`.

## Engine changes

Each change is general (it is not about explainers) and has a regression test. None has been offered upstream; whether to offer them is an open decision in [the design record](../specs/rayner.md#decisions).

| Change | Why | Test |
| --- | --- | --- |
| Nested `AnimationGroup` members are added to the scene | Inner groups animated objects that were never added | `test/core.test.ts` |
| `FadeOut` restores the authored opacity | Re-shown artwork at 0.14 opacity came back fully opaque | `test/lineage.test.ts` |
| SVG paint fields: line caps and joins, dashes, fill rule, miter limit, paint order, with cache invalidation | Agentic Mermaid styles use them | `test/core.test.ts` |
| Optional style fields interpolate exactly at both ends, including under `thereAndBack` | A native-to-styled transform dropped fields it introduced | `test/core.test.ts` |
| `Scene.onStep(listener)` and `Scene.addDescriber(fn)`; removers remove only their own registration | Helpers had to wrap `step` and `describe` per instance | `test/scene-hooks.property.test.ts` |
| `Step.hold`: when a step's caption-reading hold begins; holds wait whole frames; a caption of no words holds for no time | The player stops at the hold; a rounded hold could end short of the reading time | `test/scene-hooks.property.test.ts` |
| `describe()` copies describer keys as own keys and refuses a describer that returns no object | A `"__proto__"` key became the result's prototype | `test/scene-hooks.property.test.ts` |
| `Mobject.clipBox`: rectangular paint viewports that intersect when nested; a leaf wholly outside its clip is not written | Zoomed diagrams painted over the heading; resvg 2.6 aborts on a translucent element its clip leaves no area | `test/explain-clip.test.ts` |
| `Mobject.pointKind()`: point arrays blend only with the same kind | A line morphing into a `Text` landed on its advance box | `test/property.test.ts` |
| A `Transform` from a container into a single path moves the path into a child of its own first (Manim's `null_point_align`) | The result drew nothing | `test/property.test.ts` |
| `parseColor` reads `#rgba` and `#rrggbbaa` and returns `null` for anything else | Interpolation produced `#NaNNaNNaN` | `test/explain-helpers.test.ts` |
| Fixes from Manim's and manim-web's issue history: `runTime: 0` shows the end state, the clock comes from the frame count, `replace()` leaves no ghost, groups do not ease twice, dashed strokes keep their dashes while drawn, `Code` expands tabs, the shaping memo is bounded, and others | Each test names the upstream issue it comes from | `test/lineage.test.ts` |
| `takeMissingGlyphs()` reports characters the embedded fonts drew as nothing; `shaperFor` and `StopScene` are exported | Text outside the fonts was blank with no error | `test/explain-gates.test.ts`, `test/api.test.ts` |
| Fallback faces in `src/fonts.ts`: each character takes the first face that has it (mono, then sans, then Noto Sans Arabic, Devanagari and SC numeral subsets that `tools/fonts.sh` adds); a fallback face that fails to load is skipped | Numerals outside Latin could not be drawn | `test/fonts.test.ts` (the chain); the skip has no test, since forcing a face to fail needs a test hook `src/` does not have |

Removed from the engine as unused: `TextSink`, the `DomSink` frame-log hooks, `VMobject.validateCaches`, `Mobject.alignWith` and `summarizeMotion`.

## Agentic Mermaid

The build pins Agentic Mermaid 0.4.1, an optional peer package; pages never load it. `integrations/agentic-mermaid/build/capture.ts` is the only code that depends on its internals: it registers a capture backend through `registerBackend`, renders through `createMermaidRenderer`, and keeps each mark's `drawNode` output, which is not a documented API. Capture must equal `renderMermaidSVG` byte for byte.

Agentic Mermaid is the same owner's project. These changes would remove the workarounds, and none is released as of 0.4.1:

1. A documented per-mark render returning stable `{ id, svg }` records, to replace the `drawNode` coupling.
2. Stable ids for labels, ticks and legend entries across typed mutations, which morphs depend on.
3. A `state` family report for state diagrams; 0.4.1 reports `flowchart` and the adapter corrects it.
4. Keep a label declared after the node's first bare use. In 0.4.1 this renders B as "B":

   ```mermaid
   graph LR
   A --> B
   B[Database]
   ```

   Until then, declare labelled nodes before their first edge. The build warns when a captured node shows its bare id although the source gives it a label.

The frontmatter spacing fix on Agentic Mermaid's main branch (commit `bfb2c807`) is also unreleased as of 0.4.1.
