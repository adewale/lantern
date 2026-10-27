# Engine core keeper plan

Discovery only, pinned main a4a80d03963a86d804e2b3465ee8a7e9eb68ba6d. All 128 assigned declarations were read with their tables and relevant owners. Ledger: 113 R, 15 F, zero C/D. Tests total 2,460 LOC across 14 files; shared project support totals 1,520 LOC. No code was changed and no new suite was run.

## Keeper boundaries

- Public compatibility: api.test.ts owns exact root export names, a deliberate release inventory. It is not a disposable reflection of private internals. Package transport/consumer import tests remain necessary elsewhere.
- Geometry and animation: analytic anchors in core, graphing and lineage own coordinates, endpoint states, ownership, animation lifecycle, timing, source clusters and SVG paint. Metamorphic comparisons alone do not substitute for their value pins.
- Independent numerical authority: frozen Manim fixtures own rate values, curve allocation, cubic control points and same-shape equivalence. The optional live check owns provenance, not ordinary CI availability.
- Output integration: resvg pixels own actual paint/clip behavior; real CLI/file output owns exporter wiring and naming. A fake DOM owns viewBox write budget. Frame cache equality owns all authored compositions in both relative and absolute modes.
- Scale: 40-minute frame selection, 20k-entry shaper eviction, and heap settling after repeated seeks each cover different retained-state/time boundaries. Do not remove because static or slow.
- Motion detector: explicit positive rows and quiet negative controls own detector behavior; build gate enforcement belongs to the authoring lane and is not equivalent.

## High-confidence first edits

1. Fix zero-runtime vacuity (lineage:167): require a finished frame and independently expected target geometry. Mutant: omit the zero-duration emit/finish.
2. Fix nested replacement count-only assertion (lineage:322): assert target present and source absent, without inventing a draw-order requirement. Mutant: leave source while omitting target.
3. Include astral-prefix UTF-16 source offsets (lineage:697); current generator contains BMP only. Mutant: expose code-point indices as UTF-16 indices.
4. Include zero/tiny signed stretches (lineage:601). Ordered bounds require no invertibility. Separately keep justified nonsingular restriction for affine text reset.
5. Replace tracer real-clock busy waits with a scoped fake of the external clock and exact parent/child/self arithmetic, restoring it in finally. No production hook, timing tolerance, or fake subject implementation.
6. Replace dense cubic closest-point search (property:99) with independent de Casteljau/Bernstein evaluation for a single cubic, parameterized by known equal subdivision intervals. Assert controls/endpoints/count as well as samples. Keep multicurve allocation fixtures from Manim: do not copy private distribution algorithm into expected values. Establish tolerances from representation/Float32 scale, not from observed failures.
7. Move the fixed Write(Text('lag')) grouping comparison out of the generated grouping property (lineage:440); retain variable geometry and topology cases.
8. Separate unrelated laws without multiplying full scene replays: split or name rate endpoint/wiggle laws, instant-group duration laws, plot-gap/lineGraph laws. For lineGraph assert every input point. Strengthen style interpolation from merely parseable to independent expected channels/opacity; preserve overshoot/endpoint contracts.
9. Rename fonts:56 to the own-face behavior actually observed, or add observable public memo evidence. Add Infinity rejection to Code tab widths (lineage:665). Replace incidental record count >500 (perf:53) with explicit merge/split/restore behavior; coordinate with code-spans keeper before consolidation.

## Cheaper PBT and scale budget

The baseline (reused, not rerun) recorded ~80.8s for authored-corpus cache equality, ~7.1s for bundled random scenes, ~4.48s for dense subdivision, and ~18.1s for heap settling. Independent parameter evaluation removes subdivision's samples-times-probes search and improves its oracle. Scoped clocks eliminate busy waiting. Extracting fixed text grouping avoids 20 identical expensive font/write runs. Generated cases should report seed, law and operation tape; do not rerun six full tapes solely to obtain six test names.

The full authored cache sweep is not currently replaceable by the random scene generator: the latter omits camera, clipping, Code, DecimalNumber and Axes compositions. Keep the full sweep as release/full evidence. A focused default representative set is only safe after an explicit composition inventory and retained full gate. Do not claim generated coverage eliminates real raster, CLI, browser, fonts or heap proofs.

## Public and sibling surface map

- Mobject/Group/VMobject, Arrow, ArcBetweenPoints, shapes, Transform/Create/Write/Fade/Indicate, builder/group/timeline and vec operations: primary lane anchors plus behavior-lane animation siblings. Vector round trips alone need independent coordinate anchors (already present for common transforms). Arc and box generators can cover more ranges without deleting regression points.
- Frame.fit/move/zoom/reset, Scene.frame, renderElements/SVG/DomSink/StringSink/SnapshotSink/ASCII: camera tests own geometry, caching and viewBox; helper cameraBox owns bounded-stage semantics, unlike Frame.fit. Explain focus, description and reader label/viewport adapters each retain distinct owners.
- NumberLine n2p/p2n, ticks/labels/copy; Axes c2p/p2c, origin, plot, lineGraph, bar: direct ownership present. Axes dot/verticalLine/horizontalLine are used by authored token-bucket/seasons scenes, but direct endpoint/default/style assertions are missing. areaUnder has no direct lane keeper: add independent baseline/closed-path anchors, sample config and nonfinite rejection before claiming full graphing coverage. Do not infer a bug merely from missing coverage.
- Fonts own family/fallback selection, real glyph source/scale, runs, combining marks, missing glyphs, UTF-16 source map and bounded memo. Both sans/mono accept paths exist; unsupported-character rejection currently needs mono sibling coverage. Registry order alone does not prove priority for overlapping glyphs.
- Perf owns enable/disable/reset/span/begin/count/rows/report/chromeTrace. Existing test covers nested timing only. Add focused exact public outcomes for disabled no-op, resets, counts, thrown callback cleanup and trace/report output where documented; generator should include nested shapes and timelineDepth, not mock private counters.
- Code tabs/spans and broader animation utility siblings also belong to engine_behavior; coordinate before deleting any overlapping regression. Lettering, reader, build/authoring gates and model semantics belong to their named lanes; their wrappers must retain integration checks even when low-level contracts pass.

## Evidence and scope limits

Read relevant production owners src/index.ts, frame.ts, perf.ts, graphing.ts, fonts.ts, timeline.ts, vec.ts, rate.ts, vmobject.ts, svg.ts, mobject.ts, text.ts, scene.ts, shapes.ts and verify.ts; read test/lib/scenes.ts, random-scene.ts, CAMERA/GRAPHING docs and ENGINE/UPSTREAM references, CI and file history. Some broad tool output was truncated; conclusions above rely on the fully read tests and narrower owner excerpts, not a claim of exhaustive production review. Prior audit commit 916b0a9 removed private seams, copied oracles and source greps; preserve that rationale. There is no proven removable shared helper or whole test file in this lane.

After implementation, rerun only changed/focused contracts first, use high-confidence implementation mutants above plus cubic endpoint/control corruption, bad cache key, clipped-leaf serialization and frame drift. A fresh implementation-only adversarial reviewer should inspect the changed public surfaces before campaign completion. Record each mutant's actual fail/pass; no speculative kill claims are made here.
