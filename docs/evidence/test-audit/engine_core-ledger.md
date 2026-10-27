# Engine core discovery ledger

Pinned tree: `a4a80d03963a86d804e2b3465ee8a7e9eb68ba6d`. Read-only audit; no suites run and no production/test edits. Baseline is the tree-identical evidence in baseline.md, not a new measurement.

R retain; F fix assertion, generator, organization or oracle; C consolidate; D delete. All 128 declarations accounted for: {'R': 113, 'F': 15}. No deletion is proven. Generated verify table has four runtime cases under its one inventoried declaration.

Assigned tests: 14 files, 2,460 LOC. Whole project shared test support: 1,520 LOC (not exclusively charged to this lane). This lane directly owns use of test/lib/scenes.ts (authored Fixture and scene loader), test/lib/random-scene.ts (seeded scene generator), and frozen Manim data/oracle support; other lanes also rely on scene support. Preserve shared support until all callers are assessed.

## test/api.test.ts

- **R** `test/api.test.ts:37` — 'the public API is exactly this set of names'. Exact public export compatibility inventory is a release contract (src/index.ts); consumer installation belongs to package tests.

## test/core.test.ts

- **R** `test/core.test.ts:12` — 'SVG output: a fixed 16 x 9 frame at 1000 units per scene unit, sized to the width asked for, text drawn as outlines'. Pins independent SVG dimensions, outline encoding and path count.
- **R** `test/core.test.ts:22` — 'y is up in the model and flipped once, in path data; angles turn counterclockwise'. Independent coordinate anchors pin y flip, orientation and rotation.
- **R** `test/core.test.ts:33` — 'ArcBetweenPoints hits both endpoints and bulges to the signed side'. Analytic endpoints and signed bulge pin ArcBetweenPoints.
- **R** `test/core.test.ts:43` — 'DecimalNumber blends its value through Transform'. Intermediate and final numeric states pin DecimalNumber transform integration.
- **R** `test/core.test.ts:54` — 'a copied Arrow owns its line and tip (no reference back to the original)'. Mutating copied Arrow children must leave original geometry unchanged.
- **R** `test/core.test.ts:63` — 'a nested AnimationGroup adds every leaf mobject to the scene'. Nested group registration must include each animation leaf.
- **R** `test/core.test.ts:71` — 'Transform adds and removes optional SVG paint at exact endpoints, there-and-back included'. Exact optional paint endpoints and there-and-back restoration pin serialization.
- **R** `test/core.test.ts:84` — 'alignData pads a path at its centre as the points stand, whether or not its box was cached'. Independent padding coordinates catch stale cached box use in alignData.

## test/camera.test.ts

- **R** `test/camera.test.ts:42` — 'seeking through a camera move renders the frame a full run produces'. Played versus sought frames cover camera timeline composition.
- **R** `test/camera.test.ts:59` — 'a pure camera move keeps every element record; only the viewBox changes'. Public camera optimization preserves element record identity in both coordinate modes.
- **R** `test/camera.test.ts:103` — 'fit() is the smallest 16:9 box around the target plus margin; reset() and zoom'. Analytic 16:9 bounds, margin, zoom/reset and empty rejection own Frame geometry.
- **R** `test/camera.test.ts:133` — 'the camera is never drawn and never joins scene.mobjects; it plays like any mobject'. Camera remains absent from drawn family while animating alongside artwork.
- **R** `test/camera.test.ts:147` — 'an updater on the frame follows a moving mobject'. Updater order follows moved artwork while preserving frame zoom.
- **R** `test/camera.test.ts:162` — 'motion verifier: a smooth camera move is quiet, a camera jump teleports everything'. Camera-space verifier distinguishes smooth movement from cuts for both leaves.
- **R** `test/camera.test.ts:186` — 'renderText shows the frame: zoomed content reads larger'. ASCII screen output grows under zoom, a separate sink adapter.
- **R** `test/camera.test.ts:195` — 'DomSink writes the viewBox only when the camera moved'. DOM fake observes actual viewBox writes; documented work budget is one write only on change.
- **R** `test/camera.test.ts:217` — 'cull: true leaves out what the camera cannot show; off by default'. Default-off culling, boundary inclusion, record identity and reset are distinct obligations.
- **R** `test/camera.test.ts:238` — 'cull: a stroke reaching into the view is kept; a sliver under 2 output pixels is not'. Stroke support and sub-two-pixel sliver exercise opposite inclusion boundaries.
- **R** `test/camera.test.ts:252` — 'cull: 2 pixels of the output width, so a wider output keeps a thinner strip'. 1280 versus 3840 output widths pin pixel-dependent threshold.

## test/explain-camera.test.ts

- **R** `test/explain-camera.test.ts:65` — 'focus with camera moves the camera, not the diagram; notes, marks, dims and walks work while zoomed'. Helper composition covers camera focus plus notes, marks, dim, walk and reset.
- **R** `test/explain-camera.test.ts:108` — 'a camera focus is described only while the camera stays on it; an artwork focus does not depend on the camera'. Description lifecycle invalidates camera focus after manual movement, independently of artwork focus.
- **R** `test/explain-camera.test.ts:133` — 'by default focus moves the diagram inside its own box and the camera stays home'. Default artwork focus leaves camera home; also option rejects unsupported mode.
- **R** `test/explain-camera.test.ts:153` — 'close-ups are worked out in the camera view: boxes in its units, label sizes times its zoom'. Step-layout coordinates and reader zoom compose with camera zoom.
- **R** `test/explain-camera.test.ts:180` — 'the camera box keeps 16:9, honours zoom and margin, and stays on the stage'. Analytic cameraBox aspect, margin, zoom and stage clamp differ from unrestricted Frame.fit.
- **R** `test/explain-camera.test.ts:195` — 'a scene that focuses twice seeks to the same SVG and moves without teleports'. Two focus transitions preserve seek identity and verifier smoothness.
- **R** `test/explain-camera.test.ts:228` — 'labels are measured on screen: world size times the camera zoom'. Screen label sizing includes non-16:9 letterboxing, a separate view adapter.
- **R** `test/explain-camera.test.ts:249` — 'resting text is judged in the camera view: cut by its edge fails, wholly outside is off screen'. Resting-text checks distinguish fully outside from edge-clipped content.

## test/explain-clip.test.ts

- **R** `test/explain-clip.test.ts:28` — 'nested viewport clips affect paint, not geometry, and survive translated path output'. Real resvg pixel oracle proves nested clips affect paint, not geometry; invalid box rejected.
- **R** `test/explain-clip.test.ts:54` — 'seeking through a fixed viewport is byte-identical to playing it'. Played/seek equality plus independent red pixel pins animated clip state.
- **R** `test/explain-clip.test.ts:73` — 'a translucent leaf wholly outside its clip is not written, and the frame still rasterizes'. Translucent excluded leaf still produces a rasterizable paper frame.

## test/explain-raster.test.ts

- **R** `test/explain-raster.test.ts:41` — 'explain shots draws a zoomed frame with a translucent label outside the view'. Real CLI child process exits successfully with valid PNG/SVG for zoomed off-view translucent label.
- **R** `test/explain-raster.test.ts:52` — 'the film leaves out what the camera cannot show'. Film exporter enables culling while ordinary SVG retains off-view unique color.
- **R** `test/explain-raster.test.ts:63` — 'a contact sheet --out with no extension writes NAME.png and NAME.svg beside it'. Filesystem output names pin extensionless path and dotted parent behavior.

## test/fonts.test.ts

- **R** `test/fonts.test.ts:22` — 'the fallback faces are the three Noto subsets, in order'. Default licensed fallback names/order are public configuration; behavior below does not prove overlapping-face priority.
- **R** `test/fonts.test.ts:29` — 'numerals outside Latin draw as outlines from a fallback face, in both families'. Supported Arabic/Devanagari/Han numerals have real outlines and Noto scale in both families.
- **R** `test/fonts.test.ts:44` — 'Inter draws the number forms it has; mono falls back to it'. Inter number forms and mono fallback pin actual glyph source and scale.
- **F** `test/fonts.test.ts:56` — 'a run its own face draws whole is shaped once, untouched'. Assertions prove own-face selection/no fallback scales; rename shaped-once claim or supply behavioral memo evidence.
- **R** `test/fonts.test.ts:72` — 'pieces in different faces join at their advances, with clusters indexing the whole string'. Metamorphic kerning-safe run concatenation independently pins advances, clusters and own-face metrics.
- **R** `test/fonts.test.ts:94` — 'a combining mark stays in the piece of the character before it'. Combining mark stays attached across fallback-piece boundary; missing report exact.
- **R** `test/fonts.test.ts:103` — 'characters no face has are still reported, by the string that held them'. Unsupported glyph reports preserve exact source-string keys; mono sibling rejection deserves coverage.
- **R** `test/fonts.test.ts:119` — 'Text lays out a mixed run on its advances'. Text adapter uses mixed-face advances and visible-child order.

## test/graphing.test.ts

- **R** `test/graphing.test.ts:20` — 'NumberLine: n2p and p2n round-trip, and follow the line after shift and rotate'. Conversion inverse is paired with endpoint anchors, ticks, labels, transforms and deep-copy ownership.
- **R** `test/graphing.test.ts:38` — 'Axes: c2p and p2c round-trip; c2p(0, 0) is the origin point where the axes cross'. Inverse pair is anchored by origin/axis intersection and transformed bounds.
- **R** `test/graphing.test.ts:63` — 'Axes: when zero is outside a range, the axes cross at the range end'. Zero-excluding domains cross at nearest range endpoint.
- **R** `test/graphing.test.ts:70` — 'Axes drop a crossing label only where the other axis runs through it'. Crossing-label suppression differs from corner zero labels.
- **R** `test/graphing.test.ts:80` — 'plot passes through c2p(x, fn(x)) at every sample, and draws left to right'. Sample anchors and midpoint values bind plot to analytic function; conversion independently anchored above.
- **R** `test/graphing.test.ts:95` — 'plot never overshoots a clamped function between samples (monotone cubic, not Catmull-Rom)'. Clamped daylight samples test non-overshoot interpolation, beyond endpoint equality.
- **F** `test/graphing.test.ts:112` — 'plot splits at non-finite values; lineGraph is a polyline through its points'. Separate plot non-finite breaks from lineGraph; assert every supplied polyline point, not only count/middle.
- **R** `test/graphing.test.ts:121` — 'bar heights are value × scale, standing on y = 0; negatives hang below the axis'. Independent baseline, sign, height, width, color cycling and label placement pin bars.
- **R** `test/graphing.test.ts:166` — 'Create(axes), Create(plot) and bar Transforms produce no motion events'. Composite chart animation stays quiet at motion verifier boundary.
- **R** `test/graphing.test.ts:172` — 'Create(axes) paces itself: default run time without labels, 2 s or lagRatio 0.1 with them'. Explicit default durations/lag with labels pin Create pacing.
- **R** `test/graphing.test.ts:188` — 'seeking renders the identical frame a full run produces, mid-animation too'. Full chart seek equals played frame during composite animation.

## test/lineage.test.ts

- **R** `test/lineage.test.ts:51` — 'rate: points follow a rate function past its ends, as easeOutBack and wiggle need (manim #1140, ManimCommunity #158)'. Linear point expectation pins overshooting alpha rather than clamping.
- **F** `test/lineage.test.ts:63` — 'rate: style blended at any alpha, overshoot included, keeps opacities in [0, 1] and colours parseable (manim #2524)'. Validity alone permits wrong constant colors; pin expected channels/opacities and endpoint restoration.
- **F** `test/lineage.test.ts:75` — 'rate: every exported rate function is exact at its ends and finite in between (manim-web #50, #58)'. Separate endpoint/finite laws from wiggle antisymmetry for clear failures; keep frozen Manim oracle.
- **R** `test/lineage.test.ts:91` — 'group: an AnimationGroup of one animation plays exactly like that animation (ManimCommunity #769, #844)'. Singleton grouping must preserve film across rates and durations.
- **R** `test/lineage.test.ts:102` — 'group: a rate function given to play() for a group decides where the members land (ManimCommunity #3542)'. Documented composition predicts member landing under play-level group rate.
- **R** `test/lineage.test.ts:113` — 'group: a lagRatio given to play() staggers a group the way one given to its constructor does (ManimCommunity #2563, #2913)'. Constructor and play lag options must generate equivalent frames and duration.
- **R** `test/lineage.test.ts:126` — 'group: inside a LaggedStart, a later FadeIn stays invisible until its own start (ManimCommunity #709, #888; manim-web #861)'. Delayed FadeIn is invisible before own start and opaque at end.
- **R** `test/lineage.test.ts:142` — 'group: finishing a nested group finishes every member, so Create leaves no temporary border (ManimCommunity #3951)'. Nested finish removes temporary borders and restores original style.
- **F** `test/lineage.test.ts:150` — 'group: an instant member (runTime 0) of a group lands on its end, and an explicit group runTime survives a lagRatio (ManimCommunity #4017, #2563)'. Split instant-member landing and explicit group-duration preservation into separate laws.
- **F** `test/lineage.test.ts:167` — 'play: a runTime of 0 shows the end state, never a collapsed or NaN frame (ManimCommunity #4004, #4017)'. Require emitted finished frame: frames.slice(1) can be empty; independently assert target geometry.
- **R** `test/lineage.test.ts:178` — 'play: the last frame of a play shows the finished animation, whatever runTime × fps is (ManimCommunity #183, #698)'. Last emitted SVG equals finished scene across fractional timing; endpoint owners elsewhere anchor correct state.
- **R** `test/lineage.test.ts:192` — 'play: a play emits round(runTime·fps) frames and the first already moves (ManimCommunity #4912, #3005)'. Analytic rounded frame count and first-frame movement pin sampling.
- **R** `test/lineage.test.ts:205` — 'updaters: the dt an updater receives adds up to the scene clock across plays and waits (ManimCommunity #4611, manim #2481)'. Updater dt sum equals clock; call count equals noninitial frames across play/wait.
- **R** `test/lineage.test.ts:222` — 'time: seeking to k/fps lands on frame k in a 40-minute scene (manim #1000, #1189)'. Forty-minute indexed seek probes guard accumulated-time drift; short random scenes do not subsume scale.
- **R** `test/lineage.test.ts:235` — 'run: an exception in an updater or a sink rejects run(), it never hangs or is swallowed (ManimCommunity #4904; manim-web #715)'. Both updater and sink exceptions propagate their original identity.
- **R** `test/lineage.test.ts:251` — 'transform: Text(a) morphed into Text(b) draws exactly what Text(b) draws (manim-web #280, #102; ManimCommunity #1468)'. Authored target is independent of internally aligned transform target.
- **R** `test/lineage.test.ts:271` — 'transform: a morph between paths with different contour counts lands on one end with no zero-length subpath (manim-web #102)'. Different contours land without degenerate zero-length subpath.
- **R** `test/lineage.test.ts:282` — 'transform: a path paired with something that draws nothing (a group, a Text) leaves no stray dot (manim-web #102)'. Non-drawing group/Text target leaves no stroked stray dot.
- **R** `test/lineage.test.ts:296` — 'transform: from an empty path into a circle and back out stays finite and lands each time (ManimCommunity #4020, #4320)'. Empty-path round trip stays finite and reaches both endpoints.
- **R** `test/lineage.test.ts:309` — 'transform: replace=true with the target already on screen leaves one copy of it (ManimCommunity #4238, #4242, #4372)'. Existing replacement target appears once across replacement chain.
- **F** `test/lineage.test.ts:322` — 'transform: replace=true on a mobject inside an on-screen group leaves no ghost behind (ManimCommunity #2507)'. Count two is insufficient: require replacement target present and original absent inside group.
- **R** `test/lineage.test.ts:330` — 'play: animating a new Group of mobjects already on screen draws each once, in its place (manim #2500, #2352)'. Wrapping already visible children preserves unique IDs and order.
- **R** `test/lineage.test.ts:339` — 'play: every .animate builder given to play() animates, the last one too (ManimCommunity #4865, #1129; manim #1618)'. Every builder executes including final argument with default timing.
- **R** `test/lineage.test.ts:352` — 'play: playing never reorders what is already on screen; what it brings in is drawn on top (ManimCommunity #843, #3110, #1001)'. Operation tape preserves old order and appends newly introduced objects.
- **R** `test/lineage.test.ts:373` — 'play: two animations of one family in one play() are refused rather than one silently winning (ManimCommunity #4865, #1129)'. Overlapping family animations reject instead of silently overriding.
- **R** `test/lineage.test.ts:380` — 'animate: chained .animate calls accumulate and the target is built when played (manim-web #299; ManimCommunity #3502)'. Chained builder actions accumulate and target is lazily built at play time.
- **R** `test/lineage.test.ts:394` — 'fade: FadeOut with a shift or scale, then FadeIn, shows the mobject where and as it was (ManimCommunity #1526; manim-web #107)'. Fade round trip restores authored geometry and opacity after shift/scale.
- **R** `test/lineage.test.ts:407` — 'fade: FadeIn and FadeOut keep each family member\'s own opacity, 0 included (manim-web #467, #502)'. Each family member preserves its own opacity including zero; removed FadeOut family checked.
- **R** `test/lineage.test.ts:427` — 'create: Create and Write leave every member\'s style and points as they were (manim-web #501, #502; ManimCommunity #4439)'. Create/Write leave original points and styles unchanged.
- **F** `test/lineage.test.ts:440` — 'create: Create\'s stagger does not depend on how the drawn shapes are grouped (manim-web #544)'. Keep generated grouping geometry property; extract fixed Write(Text(lag)) comparison from 20 repeated runs.
- **R** `test/lineage.test.ts:456` — 'create: the temporary outline Write draws on text scales with the text (ManimCommunity #4220, #4222)'. Constructor size and transformed size yield matching temporary Write border; relative Float32 tolerance justified.
- **R** `test/lineage.test.ts:468` — 'indicate: Indicate on a group of differently coloured children returns each child to its own colour (manim-web #856)'. Each differently colored child restores own color after Indicate.
- **R** `test/lineage.test.ts:513` — 'seek: a seeked frame equals the played frame across nested groups, Indicate on groups and re-shown FadeOuts (manim-web #854, #856, #861, #866)'. Played/seek agreement spans nested animation, group indication and reappearing fades.
- **R** `test/lineage.test.ts:529` — 'seek: a dry-run index puts every step on the frame the full run puts it on (ManimCommunity #2152, #2236, #2449)'. Dry index shares full-run step frame positions without expensive lifecycle rendering.
- **R** `test/lineage.test.ts:546` — 'path: pointFromProportion(u) is u of the way along the path by length (ManimCommunity #1274, #1314)'. Polyline length proportion has independent u times total-length oracle.
- **R** `test/lineage.test.ts:560` — 'path: inside one curve, pointFromProportion follows length too, so it meets the tip Create reveals (ManimCommunity #1274)'. Unevenly parameterized straight cubic pins arc length within documented approximation budget.
- **R** `test/lineage.test.ts:571` — 'path: MoveAlongPath keeps a token on the tip of the stroke Create is drawing (ManimCommunity #1274)'. MoveAlongPath agrees with revealed tip plus independent straight-length position.
- **R** `test/lineage.test.ts:585` — 'path: pointFromProportion stays finite and exact at its ends on degenerate paths (ManimCommunity #4847, #5019, #4629)'. Empty, singleton and multisubpath degeneracies stay finite with exact raw endpoints.
- **F** `test/lineage.test.ts:601` — 'box: no transform leaves a bounding box inside out, negative stretches included (manim #2496)'. Include zero and tiny stretches: noninvertibility does not invalidate ordered-box contract.
- **R** `test/lineage.test.ts:613` — 'box: a path\'s box contains every point it draws (ManimCommunity #3265, #3619, #4943)'. Arc samples must lie inside conservative path bounds, no tight-box assumption.
- **R** `test/lineage.test.ts:633` — 'text: a monospace line is exactly one advance per character, spaces included (manim #1036; ManimCommunity #4289)'. Mono advance per character includes spaces.
- **R** `test/lineage.test.ts:641` — 'code: consecutive Code lines sit one pitch apart whatever their ascenders and descenders (ManimCommunity #4692, #4626)'. Code baseline pitch remains independent of ascenders/descenders.
- **R** `test/lineage.test.ts:650` — 'code: a tab advances to the next tab stop, as source editors draw it (manim #1316, #1036)'. Independent tab-stop column fold plus source-text preservation.
- **F** `test/lineage.test.ts:665` — 'code: a Code line re-set to its own text keeps its tab stops; bad tab widths are refused (manim #1316)'. Reset retains tabs; invalid widths reject; add positive/negative Infinity to rejection boundary.
- **R** `test/lineage.test.ts:681` — 'text: empty, blank and unsupported-script strings shape, Write and morph without NaN or throwing (ManimCommunity #2976, #3378, #3230, #2754)'. Low-level blank/unsupported shaping survives Write/morph; build-layer script rejection remains separate.
- **F** `test/lineage.test.ts:697` — 'text: each glyph\'s cluster indexes the visible character it draws, so string ranges map to glyphs (ManimCommunity #4864)'. BMP-only generator cannot prove UTF-16 cluster offsets; include astral prefix before visible glyph.
- **R** `test/lineage.test.ts:711` — 'text: layout is scale-free, so letter spacing does not drift with font size (ManimCommunity #2844; manim #1813)'. Scaling font size scales glyph geometry and advance together.
- **R** `test/lineage.test.ts:720` — 'decimal: a DecimalNumber never shows a negative zero (manim-web #869, #870)'. Independent rounding precision excludes displayed negative zero.
- **R** `test/lineage.test.ts:730` — 'decimal: setValue keeps a rotated, scaled number\'s angle and size (ManimCommunity #4843, #4830)'. Fresh expected number anchors setValue preservation of angle, size and position.
- **R** `test/lineage.test.ts:745` — 'text: setText with the same string changes no glyph, whatever the text has been turned, mirrored, stretched or sheared by (ManimCommunity #4843)'. Same-text reset preserves nonsingular affine transformed glyphs including shear/mirror.
- **R** `test/lineage.test.ts:760` — 'fonts: the shaping memo stays bounded however many distinct strings are shaped (ManimCommunity #1959; manim-web #82)'. Public shaping-result identity demonstrates bounded idle eviction and retained hot entries beyond 20k strings.
- **R** `test/lineage.test.ts:800` — 'svg: a dashed stroke keeps its dashes while Create draws it, and shows nothing past the drawn tip (ManimCommunity #3989, #4606; manim #2147)'. Independent painted interval samples pin SVG dash clipping during Create.
- **R** `test/lineage.test.ts:818` — 'svg: dash lists with stray separators, commas, odd lengths or "none" serialise as valid patterns (SVG 1.1 §11.4; explain/diagrams.ts scaleStyle)'. Exact valid dash formatting and invalid-pattern fallback pin wire output.

## test/manim.test.ts

- **R** `test/manim.test.ts:48` — 'the frozen answers are what manim answers now'. Optional live Python check establishes provenance of frozen independent fixture.
- **R** `test/manim.test.ts:57` — "rate functions equal manim's to 1e-12". Five rate functions equal independent frozen Manim values to 1e-12.
- **R** `test/manim.test.ts:64` — 'extra curves are distributed across a path the way manim distributes them'. Independent allocation fixtures include ties compared by objective, not arbitrary tie order.
- **R** `test/manim.test.ts:96` — "splitting a cubic matches manim's partial_bezier_points piece by piece". Independent Manim partial-Bezier control points pin split geometry.
- **R** `test/manim.test.ts:111` — "shapeKey() groups shapes as manim's TransformMatchingShapes does (Mobject.has_same_shape_as)". Full independent 12x12 same-shape matrix and point fixtures pin shape equivalence.

## test/property.test.ts

- **F** `test/property.test.ts:42` — 'random scenes: deterministic, finite, cache-exact in both output modes, box-exact, seek-exact, skip-exact'. Six laws bundled with expensive repeated tapes obscure failures; separate named laws without sixfold replay and inventory missing camera/clip/code generators.
- **R** `test/property.test.ts:77` — 'Transform ends drawing exactly what its target, as authored, draws'. Independent authored target guards against alignment padding self-oracle.
- **F** `test/property.test.ts:99` — 'subdividing any cubic path preserves its geometry (random paths, random n)'. Replace 4001-point nearest search using subject evaluator with independent de Casteljau/Bernstein single-cubic parameter oracle; retain Manim multicurve allocation proof.
- **R** `test/property.test.ts:125` — 'copy() is deep: mutating a copy never touches the original'. Copy mutation and no shared family nodes prove deep ownership.
- **R** `test/property.test.ts:138` — 'a one-curve path morphing into a Text heads for the text’s centre, not onto its advance box'. Random path-to-Text interpolation heads to independent text center rather than advance box.

## test/verify.test.ts

- **R** `test/verify.test.ts:14` — 'quiet on smooth motion: shifts, fades, morphs, draw-ins, fast linear moves'. Quiet smooth motion is essential false-positive negative control.
- **R** `test/verify.test.ts:26` — 'flags a teleport between plays'. Seeded between-play jump pins teleport kind.
- **R** `test/verify.test.ts:35` — 'MoveAlongPath from off the path: snapping is a teleport, the default blends in'. Off-path snap must teleport; default blended path must remain quiet.
- **R** `test/verify.test.ts:44` — 'flags hard cuts: a mobject added or removed while opaque'. Opaque add/remove pins cut-in/out order and kinds.
- **R** `test/verify.test.ts:53` — 'a ReplacementTransform onto a matching target is a seamless handoff'. Matching replacement is a quiet seamless handoff.
- **R** `test/verify.test.ts:62` — 'thin shapes hand off cleanly (zero-height boxes)'. Zero-height shape handoff guards detector degeneracy.
- **R** `test/verify.test.ts:71` — 'a left-anchored counter changing digit count is not a resize'. Anchored digit-count change must not report resize.
- **R** `test/verify.test.ts:92` — `flags it: ${name}`. Four table rows separately pin opacity-pop, resize, flicker/cut-in and wrong handoff detector behavior.

## test/perf.test.ts

- **R** `test/perf.test.ts:24` — 'render caches are never stale: every explainer, both output modes, each sampled frame equals a cache-free render'. All 26 authored scenes in both modes exercise cache correctness including camera/code/clips absent random generator; retain full release proof.
- **F** `test/perf.test.ts:44` — 'tracer: spans nest and self time excludes children'. Replace wall-clock busy waits with scoped external fake clock and exact nested/self arithmetic; restore clock in finally.
- **F** `test/perf.test.ts:53` — 'DOM output merges same-styled glyph lines into one element, and splits during Write'. Incidental >500 records is weak: assert explicit same-style merge before Write, per-glyph split during Write and restored equivalent visible geometry.

## test/leak.test.ts

- **R** `test/leak.test.ts:15` — '50 seeks and traces leave the heap where 10 did (no per-run growth)'. Actual heap settling after 10 versus 50 seek/trace cycles with double GC and 8MB bound owns retained-memory behavior; pure operation-count PBT cannot replace it.
