# Upstream

This repository is a fork of [ivarvong/lantern](https://github.com/ivarvong/lantern) at `2c7bad533be25fbd56d26a9a2b6c5651743f011e`. Lantern's README and its engine notes (verification, performance, flowcharts, the JSON document format) are at that commit: [README](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/README.md), [docs](https://github.com/ivarvong/lantern/tree/2c7bad533be25fbd56d26a9a2b6c5651743f011e/docs). Some of what they describe was deleted here: the development player, the Worker site, the nine original scenes, `DocScene` and the JSON format, Lantern's own Mermaid parser and layout, and the tools that served them. The explainers in `scenes/explainers/` rebuild Lantern's examples.

The fork's own code is `explain/` (helpers), `integrations/agentic-mermaid/` (snapshots; `build/` is build-time only), `app/embed*` and `app/loader.ts` (the page and loader), `tools/` (the CLI and demo tools) and `scenes/explainers/`. `src/` is Lantern's engine with the changes below. The MIT notice in `LICENSE` is Lantern's.

## Merging

```sh
git remote add upstream https://github.com/ivarvong/lantern   # once per clone
git fetch upstream
git merge upstream/main
```

After a merge, run `npm run check`, `npm run test:full`, `npm run test:embeds` and `npm run demos:check`. On 25 October 2026 upstream's `main` was still the fork base.

## Engine changes

Each change is general (it is not about explainers) and has a test that failed before it. None has been offered upstream; whether to offer them is an open decision in [the spec](../specs/kyle.md#decisions).

| Change | Why | Test |
| --- | --- | --- |
| Nested `AnimationGroup` members are added to the scene | Inner groups animated objects that were never added | `test/explain.test.ts` |
| `FadeOut` restores the authored opacity | Re-shown artwork at 0.14 opacity came back fully opaque | `test/explain.test.ts` |
| SVG paint fields: line caps and joins, dashes, fill rule, miter limit, paint order, with cache invalidation | Agentic Mermaid styles use them | `test/explain-capture.test.ts` |
| Optional style fields interpolate exactly at both ends, including under `thereAndBack` | A native-to-styled transform dropped fields it introduced | `test/explain.test.ts` |
| `Scene.onStep(listener)` and `Scene.addDescriber(fn)`; removers remove only their own registration | Helpers had to wrap `step` and `describe` per instance | `test/scene-hooks.property.test.ts` |
| `Step.hold`: when a step's caption-reading hold begins; holds wait whole frames; a caption of no words holds for no time | The player stops at the hold; a rounded hold could end short of the reading time | `test/scene-hooks.property.test.ts` |
| `describe()` copies describer keys as own keys and refuses a describer that returns no object | A `"__proto__"` key became the result's prototype | `test/scene-hooks.property.test.ts` |
| `Mobject.clipBox`: rectangular paint viewports that intersect when nested | Zoomed diagrams painted over the heading | `test/explain-clip.test.ts` |
| `Mobject.pointKind()`: point arrays blend only with the same kind | A line morphing into a `Text` landed on its advance box | `test/property.test.ts` |
| `parseColor` reads `#rgba` and `#rrggbbaa` and returns `null` for anything else | Interpolation produced `#NaNNaNNaN` | `test/explain-helpers.test.ts` |
| Fixes from Manim's and manim-web's issue history: `runTime: 0` shows the end state, the clock comes from the frame count, `replace()` leaves no ghost, groups do not ease twice, dashed strokes keep their dashes while drawn, `Code` expands tabs, the shaping memo is bounded, and others | Each test names the upstream issue it comes from | `test/lineage.test.ts` |
| `takeMissingGlyphs()` reports characters the embedded fonts drew as nothing; `shaperFor` and `StopScene` are exported | Text outside the fonts was blank with no error | `test/explain-cli.test.ts`, `test/api.test.ts` |

## Agentic Mermaid

The build pins Agentic Mermaid 0.4.1, an optional dependency; pages never load it. `integrations/agentic-mermaid/build/capture.ts` is the only code that depends on its internals: it registers a capture backend through `registerBackend`, renders through `createMermaidRenderer`, and keeps each mark's `drawNode` output, which is not a documented API. Capture must equal `renderMermaidSVG` byte for byte.

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

The frontmatter spacing fix on Agentic Mermaid's main branch (commit `bfb2c807`) is also unreleased as of 0.4.1, so explainers pass spacing as an option.
