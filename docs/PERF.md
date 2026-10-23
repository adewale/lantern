# Performance

## Tools

```
npm run bench [-- --update]                                    every scene: ms/frame, seek, trace; gate against bench/baseline.json
npm run trace -- pyex-limits [--sink=string|null] [--chrome]   span table + counters; --chrome writes a Perfetto trace
npm run profile -- pyex-limits [--sink=string|dom|null]        V8 CPU profile, summarized by self time
npm run seek -- pyex-limits                                    trace and seek cost, cold and warm
npm run ab -- a=out/a.html b=out/b.html [--cpu=4,1] [--reps=3] Chromium A/B: late frames, long tasks, main-thread ms/s
npm run hitch -- pyex-limits [--cpu=4]                         attribute each late frame to JS/style/layout/paint/GC
open the player with ?perf=1                                   startup phases in the browser console
```

Spans (`perf.span`, `perf.begin`) are for phases: the frame loop, sinks, animation
begin. Counters (`perf.count`) are for hot paths, where timing would distort what it
measures: span overhead is ~0.8 µs, which made one early reading 30% wrong. Anything
inside a frame is a job for the sampling profiler (`npm run profile`).

## Where it stands

pyex-limits (25 s, ~420 glyph paths), 2-vCPU VM:

| | first slice | now |
|---|---|---|
| offline render (StringSink) | 20.8 ms/frame | 1.4 ms/frame |
| browser playback, main thread | 419 ms/s | 100 ms/s |
| browser playback at 4× CPU throttle | 0.54× realtime | 1.0× realtime, 1.3% late frames |
| seek to a step, Node, warm | ~180 ms | 35 ms |
| seek to a step, Chromium, cold page load | 1218 ms | 468 ms |

Today's offline profile: element records 34% (`render.elements`), the sink's own work
36%, serialization 9%, interpolation 7%. Cache counters per run: 289k element hits vs
31k misses, 286k path hits vs 27k moves and 9k reshapes.

## The gate

`npm run bench` measures every scene (SVG strings per frame, DOM records per frame,
index + seek to the middle, trace) as the minimum of 7 in-process runs after a
warm-up, and compares with `bench/baseline.json`. A regression is more than 25% and
more than a GC pause in absolute terms (0.15 ms/frame, 15 ms), and it must reproduce
on a second measurement of that scene: on a shared 2-vCPU VM, single minima moved
±30% from steal time alone. It is a local gate, not CI. `--update` rewrites the baseline;
do that in the same commit as the change that moved it, with the reason.

## What changed, in the order the traces pointed

1. **Path strings memoized** per path (95% of time was re-serializing unchanged paths).
   The cache key is a points version bumped by `touchPoints()` plus array identity.
   `VMobject.validateCaches` re-checks every hit against freshly computed output, and
   the tests run every scene with it on.
2. **Element records memoized**, attributes and serialized strings both; escaping is
   skipped when nothing needs it.
3. **Integer coordinates** in milli-units with the viewBox scaled to match
   (`-8000 -4500 16000 9000`): integer-to-string skips float formatting's
   shortest-digits search.
4. **Skipped frames before a seek target** (manim's `skip_animations`). Interpolation is
   pure over endpoints fixed at `begin()`, so the state is exact. Plays with updaters are
   never skipped. Tests assert that skipped traces equal full ones and that seeks equal
   full-run frames byte for byte.
5. **Shaping memoized**, glyph outlines flattened once, `shift/scale/rotate` as
   allocation-free affine maps.
6. **No code ligatures.** Their contextual lookups cost 97% of shaping (171 → 5 ms), and
   they change what the reader sees (`->` drawn as `→`). The embedded mono face is now
   subset without them (`tools/fonts.sh`), so code reads like the diff.
7. **UI web fonts load after the player starts**, not as a render-blocking stylesheet
   (~190 ms).
8. **Path form chosen per sink.** Strings use shape-relative `d` plus `translate`
   (1.1 vs 1.55 ms/frame); the DOM uses absolute `d` (97 vs 129 ms/s in Chromium). This
   was measured, not assumed: the translate form was expected to help the DOM and made
   it slower.
9. **Fewer copies at begin.** An animation that builds its own target (FadeIn, FadeOut,
   Indicate, `.animate`) hands it over instead of copying it again, and skips alignment
   when the structure is known equal. `family()` appends to one array instead of
   spreading. Seek and trace 12-55% faster; `anim.begin` is still the whole cost of a
   trace (every play's begin/finish runs even when all its frames are skipped).
10. **Merged lines in the DOM.** A same-styled run of glyphs (a `Text`, `mergeLeaves`)
   is drawn as one `<path>`. A code block fading in went from 740 attribute writes per
   frame to 28. It falls back to per-glyph elements when styles differ, as in
   letter-by-letter Write or a morph padding with faded glyphs.

## Tried, and not kept

- **Recording every frame's records** for instant scrubbing: 37 MB for this scene, and a
  slower first seek than re-running with skipping.
- **Streaming frames ahead** into a 15-frame queue in 5 ms slices, presented on vsync.
  The queue never ran dry and it removed JS long tasks, but on one thread the work still
  lands on some vsync, because one frame's production is indivisible. A web worker was
  ruled out.

| pyex-limits at 4× (median of 3) | late frames | JS long tasks | main thread at 1× |
|---|---|---|---|
| direct DOM sink | 2.89% | 13 | 126 ms/s |
| + streaming | 2.43% | 1 | 139 ms/s |
| + streaming + merging | 1.57–2.13% | 0 | 117 ms/s |
| **merging only (shipped)** | **1.28%** | 5 | **105 ms/s** |

## Next levers

- **`render.elements` on fade and merged-line frames.** A fade changes one opacity, yet
  the merged record is rebuilt for every glyph run it touches. Splitting opacity out of
  the record key (applied as a group attribute) would make a fade O(runs), not O(glyphs).
  That is the bulk of the remaining 4× late frames, together with:
- **`anim.begin` on large glyph groups** (16–36 ms): Transform snapshots and aligns the
  whole family up front. Aligning lazily per child would spread that over the first frames.
