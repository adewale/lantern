# Reference

[The tutorial](TUTORIAL.md) walks through a first explainer; [publishing](PUBLISHING.md) covers hosting a page and exporting a video.

Words used throughout: a **setting** is a choice a scene declares (an id, a label and options); a **case** is one value for every setting. A **step** is a named section of the scene, and its **resting picture** is what the step leaves on screen: the picture a reader looks at while reading the caption. The **stage** is the 16 × 9 drawing area. Code and JSON spell case as `variant` (`variantsOf`, `variants` in reports) and resting picture as `restingFrame`.

## Scene

An explainer is a Lantern `Scene` exported from a TypeScript or ESM file, preferably as the default export. A module with exactly one exported `Scene` subclass also works.

```ts
static meta = { id: 'cache', title: 'Why a cache changes the request path', lang: 'en', sources: ['https://example.com/spec'] };

await this.step('stable-name', { title: 'A claim the picture can prove', caption: 'The value, part or mechanism on screen.' });
this.state.reads = reads;   // program state, recorded at each step boundary
```

- `meta.id` names the output files, `meta.title` is the page title, and `meta.sources` are listed under the transcript.
- `meta.lang` (BCP 47, default `en`) is the language of the page, the transcripts and the subtitles. The player's own words (`app/embed-strings.ts`) and the generated picture descriptions (`explain/words.ts`, whose `families` name each diagram family and its parts) exist in English and French. On a page in any other language both are English, and the descriptions are marked `lang="en"`; `Picture.lang` in the trace records a description's language when it is not English.
- Step names are URL identifiers. They must be unique and non-empty in every case.
- `this.state` is recorded before and after each step. Compute values with a model, show its result, and test that each step's state equals the model's (`assertStepState` in `test/lib/explainer-state.ts`).
- A captioned step holds until its caption could be read at 160 words a minute (`Scene.captionWpm`), counting the step's motion as reading time. The page stops when the picture stops; the [video](#video-files) holds the caption. The picture must not change once the hold begins.
- Do not put awaited animations inside `try`/`catch` or `.catch()` in `construct()`. Seeking stops a scene by throwing `StopScene`, and a broad catch swallows it, so a jump to a step would show a different picture from playing to it. Handle a known model error in plain code before animating. The engine limits the damage: a `StopScene` from a sink sets `this.stopped`, and from then on `play()`, `wait()`, `step()` and every frame rethrow it before doing anything, so a swallowed stop emits no further frame. Plain code between the catch and the next scene call (a `shift()`, a write to `this.state`) still runs, which is why `check` keeps the lint.
- `this.frame` is the camera: the box of the stage on screen. `this.play(this.frame.animate.fit(target, { margin }))` zooms onto a mobject or a box, `this.frame.animate.reset()` returns to the whole stage, and `this.frame.zoom` is the magnification. Moving it moves no point; [the camera guide](CAMERA.md) has the rest, and [`d.focus`](#diagrams) moves the same camera with `camera: true`.
- `this.record(kind, data)` adds `{ kind, ...data }` (copied as JSON) to the step's evidence. Step evidence records what an animation did, where `state` is what the program is; it has nothing to do with the build's `evidence.json`. Steps in the trace carry it as `evidence`, only when they recorded something; seeks record the same evidence as full runs; `this.evidence` holds every record so far. Matching transforms and `TransformDiff` record themselves ([evidence](MATCHING.md#evidence)), so counts on screen can be read from what the transform did; a View's internal morph (`view.sync()`) does not record evidence.
- By default, lettering uses the embedded fonts, drawn as outlines. JetBrains Mono falls back to Inter, and both fall back to Noto Sans Arabic, Devanagari and SC subsets that hold numerals only (Arabic-Indic and Devanagari digits, Chinese numerals, fullwidth digits). Default diagram labels are Inter stretched to each label's width, so styles with their own fonts differ in letterforms. Every command rejects characters outside the default fonts and requested lettering, naming the case, step and code point. An explainer can request additional scripts, registered faces or maths with `meta.lettering`, below.

### Lettering on request

Requests for Arabic (`Arab`), Devanagari (`Deva`), Hebrew (`Hebr`), Chinese (`Hani`), replacement `faces` or `math: true` use the [outline snapshot workflow](LETTERING.md). That guide covers setup, the font registry, shaping and bidi limits, maths, and refreshing snapshots.

Plain Latin Extended (`Latn`), Greek (`Grek`) and Cyrillic (`Cyrl`) requests use the subset workflow below; only the requesting page carries the additional lettering:

```ts
import type { LetteringRequest } from 'rayner/lettering';

static meta = { id: 'alphabet', title: 'Αλφάβητο', lettering: { scripts: ['Grek'] } satisfies LetteringRequest };
```

- `scripts` takes ISO 15924 codes: `Latn` (Latin Extended-A, -B and Additional, U+0100–024F and U+1E00–1EFF), `Grek` (U+0370–03FF and U+1F00–1FFF) and `Cyrl` (U+0400–052F). These scripts need no shaping beyond what the shaper already does for Latin. Adding a registered script outside this group, `faces` or `math` selects the outline workflow instead. Unknown codes and keys fail validation.
- The build runs every case once with Inter's and JetBrains Mono's own letters in those scripts (`vendor/lettering/`, the same releases as the embedded faces, made by `npm run fonts:lettering`). It records which letters each face drew, on stage and in the step titles and captions the video footer draws. It keeps only the letters of the requested scripts, and cuts each face to them with fonttools' subsetter. The page embeds the cuts as WOFF2 in its script, and puts them in place (`useLettering`) before the player draws.
- A requested face joins its family's chain after the embedded face and before the Noto fallbacks, so everything the embedded faces draw looks as it did. Code tries JetBrains Mono's cut, then Inter's: JetBrains Mono has no ῶ, so code draws it in Inter.
- The cuts are pinned beside the scene in `scene.lettering.json`, keyed by the source face's hash and the letters. A build reuses them. When the letters change it cuts again, which needs `pip install fonttools brotli` (or `PYFTSUBSET` set to the path of `pyftsubset`). Commit the file with the scene.
- A letter outside the request still fails every command, as before. So does a combining mark after a letter the embedded faces draw: write the precomposed letter.
- A lettered page's receipt and its `check` report have a `lettering` entry: the scripts and, for each cut, its source, letter count, WOFF2 bytes and SHA-256, plus `pageBytes`, the base64 the page carries. The Greek test fixture's two cuts hold 24 letters in 6,740 bytes of base64.
- An explainer that asks for nothing builds the same page, header recipe and receipt as before lettering on request existed, engine hash included: `src/lettering.ts` counts toward the engine hash only of an explainer that asks. `test/lettering.test.ts` holds the explainers to pins taken before the feature.
- The subset workflow does not replace faces or shape complex scripts. For those requests and typeset maths, use the [outline workflow](LETTERING.md#supported-requests). Neither workflow implicitly selects a diagram style's font or provides real bold and italic.

## Stage

```ts
import { stage } from 'rayner/explain';
const s = stage(this, { style: 'nord' });
```

`stage(scene, options)` adds the paper and a heading that follows each step's `title`.

| Option | Effect |
| --- | --- |
| `style` | An Agentic Mermaid style: the stage's palette, and the style of every diagram that names none |
| `palette` | Colours for the stage, for example `palette('dusk')` in a scene with no diagrams |
| `heading` | `'step'` (default), a fixed string, or `false` for no heading |
| `headingSize` | The heading's font size, 0.36 by default; at 0.54 it reads at 12 px on a 390 px page without a close-up |

With neither `style` nor `palette`, the stage adopts the first diagram's palette.

| Member | What it does |
| --- | --- |
| `s.show(spec, { box, build, runTime })` | Draw a diagram and build it in; returns a `Diagram` |
| `s.card(rows, { at, align, width, title, fontSize, enter })` | Labelled values; returns a `Card` |
| `s.code(lines, { at, align, fontSize, title, diff, enter })` | Code on a panel; returns a `CodeBlock`. With `diff`, lines starting `+ ` or `- ` are marked added or removed |
| `s.note(text, { at, size })` | One line of secondary text, default at `[0, -3.9]` |
| `s.enter(...mobs, { describe, ...fadeOptions })` | Keep native objects and fade them in together, in one play |
| `s.keep(...mobs, { describe })` | Keep native objects without animating them; returns the first |
| `s.clearOverlays()` | Fade out cards, code, notes (the stage's and the diagrams') and kept objects |
| `s.clear({ runTime })` | Fade out everything except paper and heading, and bring the camera home, in one play |
| `s.emphasis`, `s.soft`, `s.good`, `s.bad` | Colours that read on this paper: emphasis, secondary text, accepted, rejected |
| `s.palette`, `s.paper`, `s.heading` | The current palette, paper rectangle and heading text |

`{ enter: false }` creates a card or code panel without playing it, so `s.enter(card, code)` can bring several in together.

`describe` says in words what kept objects show together: a sentence, or a function for a drawing that changes. Without it, the description lists their visible text, and `check` fails a kept drawing that has no text.

Emphasis is the style's accent, or orange for styles whose accent is grey or near-black (hand-drawn, pen-and-ink, blueprint). `s.soft` keeps at least 4.5:1 contrast with the paper.

### Card and CodeBlock

| Method | What it does |
| --- | --- |
| `card.set({ Label: value })` | Crossfade changed values; unchanged rows stay still. A card sizes to its first values, so pass `width` if later ones are longer |
| `card.mark(label \| null, { as })` | A bar on one row that stays until moved |
| `code.focus(i \| [a, b] \| null, { as })` | A bar on zero-based line `i`, or lines `a` to `b` inclusive |
| `code.morph(next, { markAdded })` | Pair lines by text: survivors move, removed lines fade, added lines arrive, marked if `markAdded` |
| `code.clearMarks()` | Fade out the added and removed bars |

`as` is the word the description gives the mark, such as `'rejected'`. Both are native `Group`s.

### Regions

Stage coordinates are 16 × 9 with the origin at the centre and y up. The heading sits at y = 3.8; content belongs below y = 3.25. `at` and `box` accept a region name, a point `[x, y]`, or a box `[minX, minY, maxX, maxY]`.

| Region | Box |
| --- | --- |
| `full` | `[-7.55, -4.25, 7.55, 3.25]` |
| `left`, `right` | the halves of `full` |
| `main`, `side` | about two thirds left and one third right: a diagram beside a card or code |
| `top` | `[-7.55, -0.35, 7.55, 3.25]` |
| `bottom` | `[-7.55, -4.25, 7.55, -0.65]` |

`regionBox(region, { left, right, top, bottom })` returns a copy with those edges moved: `regionBox('top', { bottom: 1 })` is a shorter top, `regionBox('full', { left: -2.75 })` a column on the right. `REGIONS` holds the boxes.

## Diagrams

```ts
const d = await s.show({ source: 'graph LR\nA --> B', style: 'nord' }, { box: 'main', build: 'frame' });
```

`build: 'frame'` draws only the scaffolding (axes, lanes, lifelines) so the story can arrive with `reveal`.

| Method | What it does |
| --- | --- |
| `d.reveal(n \| ids \| 'rest')` | Bring in the next `n` parts in reading order, named parts, or the rest |
| `d.walk(hops, { trail, parallel, color })` | A token travels real links; `trail` leaves them marked; `parallel` runs several journeys in one play |
| `d.mark(ids, { color, as })`, `d.unmark(ids?)` | Colour parts and thicken their outlines until unmarked; labels keep their ink; `as` names the mark in the description |
| `d.dim(keep \| null)` | Fade everything but `keep`, links between kept parts and scaffolding; `null` restores. Dimmed parts keep 3:1 contrast with the paper |
| `d.note(id, text, { side })` | A short label beside a part at a fixed readable size; `side` is `above`, `below`, `left` or `right` |
| `d.clearNotes()` | Remove notes |
| `d.focus(ids \| 'all', { zoom, camera, margin, also })` | Enlarge parts and their notes inside the diagram's own box (`zoom` above 1 goes closer). With `camera: true`, move the camera (`this.frame`) onto them and the native objects in `also` instead, with `margin` units around them (default 0.5); `also` needs `camera`. `'all'` puts the artwork back and brings the camera home. Parts in focus are described as focused |
| `d.morph(next, { ops })` | Same-id parts move, arrivals fade in, departures fade out; marks, dimming and notes reset |
| `d.hide()` | Fade the diagram out; `reveal` can bring parts back |
| `d.get(id)` | A part as a native `Group` |
| `d.findings()` | The verifier's warnings, each with the `part` it names |

- Parts have semantic ids. Graph nodes use their Mermaid id. A bare name also finds a sequence participant (`actor:A`), a class (`class:Name`), an ER entity (`entity:Name`), or an architecture service, junction or group. Other ids look like `edge:A->B#0`, `bar:0:Jan` or `message:A->B#0`; read `d.parts` or the snapshot to find them.
- Reading order: graphs read nodes with their outgoing links, sequence messages keep source order and carry a token, git commits read left to right, bars grow from the baseline. Scaffolding builds first. Labels travel with their owners.
- `walk` throws on a hop the diagram does not have, requires the link to be revealed, follows its captured route, and records `{ step, from, to, edge }` in `state.walks`.
- With `ops`, `morph` replays the edits through Agentic Mermaid's `mutate` at build time and fails unless the result serializes to `next`. Without `ops` it is a visual transition only.
- A camera focus moves no point, so marks, dimming, notes and walks work the same while zoomed, and a label keeps its world size while the camera enlarges it on screen. The view stays 16:9 and inside the stage. The camera shows less of the stage, not only less of the diagram: the heading, cards and code are world objects too, so a focus that leaves them out of its box takes them out of view. Put what the resting picture needs inside the box (`also`), or end the step with `focus('all')`. The default, artwork focus, is for a diagram that shares the stage with text beside it (send-sync, gtfs, fork).
- One scene owns one clock: never call `Scene.play()` concurrently. Use `{ parallel: true }` or one native `play` for simultaneous tokens.
- Descriptions name a link by the labels at its ends ("Attacker → Load balancer"), and a class or ER entity by its name.
- The collection uses all 15 families. Captured diagrams use the 8 styles listed in `out/explainers/evidence.json` (the build's per-explainer list of families and styles, not step evidence); ring-buffer (dusk), seasons (tokyo-night) and token-bucket (github-dark) use a style only as the stage palette. Other styles are untested.

## Engine features

These are plain Lantern, imported from `rayner` and used beside the helpers. Each guide explains one feature and ends with "In the explainers", what the scenes named here do with it; [the engine map](ENGINE.md) lists the guides by module. What you draw with them is a native drawing: keep it with `s.keep` or `s.enter`, with `describe` when it has no text of its own ([stage](#stage)).

| Feature | What a scene uses | Guide | Used by |
| --- | --- | --- | --- |
| Matching transforms | `TransformMatchingText`, `TransformMatchingShapes` (`shapeKey()`), `TransformMatching` with your own key; `summary()`, `pairs`, `removed`, `added` | [Matching](MATCHING.md) | `glyph`, `exgit`; no explainer yet: `TransformMatching` with your own key |
| Diff-driven code morph | `new TransformDiff(before, after, { hunks })` and its `plan`; `diffLines`, `parseUnifiedDiff` for hunks | [Diff-driven](MATCHING.md#diff-driven) | `mr-cache`; no explainer yet: the `hunks` option, `diffLines`, `diffTokens`, `parseUnifiedDiff`, `hunkHeader` |
| Camera | `this.frame.animate.fit(...)`, `.reset()`; `d.focus(…, { camera: true })` | [Camera](CAMERA.md) | `seasons`; `lantern`'s diagram focus with `also` |
| Emphasis that stays | `SurroundingRectangle`, `Underline`, `Cross`, `Brace`, `BraceLabel`, `Circumscribe({ keep: true })` | [Emphasis](EMPHASIS.md) | `glyph`, `mr-cache`, `state-machine`, `ring-buffer`, `exgit` (`Underline`: `glyph` only); no explainer yet: a bare `Brace`, `tip()`, `putAtTip()` |
| Charts of the model's numbers | `NumberLine`, `Axes` with `plot`, `lineGraph`, `bar`, `dot`, guide lines, `areaUnder` | [Graphing](GRAPHING.md) | `seasons` (`plot`), `token-bucket` (`lineGraph`); no explainer yet: `bar`, `areaUnder`, a standalone `NumberLine` |
| Pictures rebuilt from state | `view`, `stateView`, `view.sync()`; `viewMismatch`, and `assertViewFollowsState` in `test/lib/view-fidelity.ts` | [Views](VIEWS.md) | `state-machine`, `ring-buffer` (`view`), `token-bucket` (`stateView`); no explainer yet: `viewMismatch`, which the tests call through `assertViewFollowsState` |
| Parts of a line of code | `code.span`, `code.token`, `code.lineSpan`; `new Code(lines, { spans })` with spans from `tools/tokens.ts` | [Code](CODE.md) | `mr-cache` (`spans`), `state-machine` (`code.span`, `code.token`); no explainer yet: `code.lineSpan` |
| Restore, copies, sequencing | `saveState()` and `Restore`, `TransformFromCopy`, `Succession` | [Animations](ANIMATIONS.md) | `state-machine` (`saveState`, `Restore`, `Succession`), `ring-buffer` and `exgit` (`TransformFromCopy`), `ring-buffer` and `token-bucket` (`Succession`); no explainer yet: `restore()` |

Patterns these scenes write by hand, candidates for `explain/` once two explainers use one and its shape settles: a `Succession` member that writes `scene.state` when its turn comes, so the syncs after it show that operation; card and code-focus changes returned as animations rather than played, so they can join a `Succession`; a `Card` whose values are a view; a `stateView` in the stage's palette; a camera box that keeps the heading out; reading recorded evidence for counts on screen; lines between a matching transform's pairs; a code panel that leaves its `Code` loose for `TransformDiff`, which replaces it.

## Settings

```ts
static settings = [{
  id: 'request', label: 'Follow a request', default: 'hit',
  options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }],
}];
const which = settingsOf(this).request;
```

Every case is built and checked ahead of time; a scene may have at most 64. Ids are URL-safe (`[A-Za-z][A-Za-z0-9_-]*`) and distinct; `step`, `theme` and `parentOrigin` are reserved. Option values are unique and include the default. A setting may change diagrams, captions, numbers and which steps exist; keep the palette fixed.

Other exports: `withSettings(Scene, values)` binds a case without mutating the class; `resolveSettings` validates; `variantsOf(Scene)` lists every case; `caseName(Scene, values)` gives "Label: option · Label: option"; `bindSnapshots(Scene, store)` binds a snapshot store.

## Describe

`describeExplainer(Scene, { snapshots?, drawings? })`, from `rayner/explain`, returns the explainer as one JSON-safe object for agents and tools: `schema` (1), `id`, `title`, `lang`, `sources`, `settings`, and `cases`. Each case has its setting `values`, its `name` ("Label: option"), its `duration` and its `steps`. Each step has its `step` name, `title`, `caption`, `start`, `end` and `hold` in seconds, the `state` the scene recorded (`scene.state` when the step ends), `changed` (each value the step changed, as `{ before, after }`, with a side left out when the value was not set), the resting `picture` in words, and its `drawing` as text unless `drawings: false`.

It runs the scene once per case, in Node or a browser, with no Chromium. A scene with diagrams needs its pinned snapshots (`snapshots`, as `explain` reads them from `scene.snapshots/`) or it throws. `explain describe <scene>` prints the same object; `--out file.json` writes it. Diagram labels are outlines, so the text drawing shows them as strokes; their words are in `picture`.

In a script, load the snapshots from `scene.snapshots/` (`index.json` names each diagram's file) and walk the cases and steps. This prints each step's caption and the state keys it changed:

```ts
import { readFile } from 'node:fs/promises';
import { describeExplainer } from 'rayner/explain';
import type { SnapshotStore } from 'rayner/explain';
import Scene from './my-explainer/scene.ts';

const folder = new URL('./my-explainer/scene.snapshots/', import.meta.url);
const index = JSON.parse(await readFile(new URL('index.json', folder), 'utf8'));
const snapshots: SnapshotStore = {};
for (const [key, file] of Object.entries<string>(index.diagrams))
  snapshots[key] = JSON.parse(await readFile(new URL(file, folder), 'utf8'));

const d = await describeExplainer(Scene, { snapshots });
for (const c of d.cases)
  for (const s of c.steps)
    console.log(`${c.name || d.title} · ${s.step}: ${s.caption}\n  changed: ${Object.keys(s.changed).join(', ') || 'nothing'}`);
```

`npm run pack:smoke` runs this block against the packed package. `explain see <scene> [step]` prints one step of the same description for a person at a terminal. `npm run site:export` publishes the description beside each page as `<id>.json`, and lists every explainer in `llms.txt` at the site root.

## Snapshots

Every command except `init` runs every case, captures any diagram missing from `scene.snapshots/` beside the scene, and deletes unused ones; `explain snapshots` stops there. Commit the folder; `index.json` maps each diagram's key to its own file. A change to the capture code invalidates the whole cache; `--refresh` recaptures everything. Capture needs Chromium and the optional packages in [the README](../README.md#requirements).

Capture asserts that its output equals Agentic Mermaid's `renderMermaidSVG` byte for byte, and fails on SVG it cannot convert (unsupported paint, masks, filters). Chromium resolves CSS, transforms and markers at build time with network requests blocked. The page receives resolved geometry and text runs; it never runs Agentic Mermaid.

## Checks

`explain check` runs every case and fails on:

| Check | Rule |
| --- | --- |
| Catch lint | A `try`/`catch` or `.catch()` around awaited code in `construct()` |
| Motion | Any pop (opacity changes by 0.5 or more in a frame), cut-in or cut-out, teleport or resize spike, flicker, or misplaced handoff |
| Hold | The picture changes after a step's caption hold begins, where the player stops |
| Seek | A seeked frame differs from the played frame, at two frames per step |
| Trace | The trace with frames skipped differs from the played trace |
| Step change | A step's resting picture, ignoring the heading, equals the previous step's. The camera's view is part of the picture, so a camera move alone is a change |
| Text | Native text in a resting picture overlaps other text, or is cut by the stage edge or the edge of the camera's view; text wholly outside the view is off screen and not judged |
| Legibility | A native label never reaches 14 px at a 1280 px stage in a frame where it is drawn (opacity and draw fraction at least 0.95) and inside the camera's view; an imported label never reaches 14 px in a resting picture inside its diagram's viewport. Sizes are on screen: world size × the camera's zoom, min(16 ÷ view width, 9 ÷ view height). A native label counts at that zoomed size only in a step's completed frame; in other frames it counts at no more than its size with the camera home, so a camera gliding past does not make it read |
| Words | A kept drawing with no text and no `describe` |
| Bare runtime | The scene, bundled, gives different steps or state in a context with no DOM, Node, timers or console |
| Glyphs | Any text the embedded fonts, and the lettering the explainer asked for, cannot draw (every command checks this) |

The report goes to `out/checks/<id>/report.json`. For each case it holds the full step trace, each step's resting picture as a rough text drawing (`restingFrames`: boxes and lines, with diagram labels as bars), and label sizes (`legibility`):

| Field | Measure |
| --- | --- |
| `minLabelPx1280` | Smallest label on a 1280 px stage |
| `minLabelPx390`, `labelsUnder12PxAt390` | Smallest label, and labels under 12 px, in each step's phone close-up (see [controls](#controls-and-accessibility)) on a 390 px page, whose stage is 358 px wide |
| `labelsOutsideCloseUpsAt390` | Labels no close-up shows whole, which a reader reaches by panning |
| `minLabelPx390WholeStage` | Smallest label on that phone without close-ups |

The phone sizes are reported, not gated; every demo case reports no label under 12 px. A close-up zooms on top of the author's camera, so its sizes multiply the camera zoom by the close-up's.

Motion is measured on screen, after the camera: a smooth camera move reports nothing, and moving `this.frame` without `.animate` (a cut) reports a teleport for everything in view. A shape that appears over a shape that stays and is no less opaque is not a cut-in when it is a `TransformFromCopy` copy of that shape, or when every shown part of it has the same outline (`shapeKey()`) and the same fill and stroke presence as a part of the staying one. A brighter shape over a faint one, a filled shape popping inside an outline, a hand-made `Transform(t.copy(), other)` that changes glyph shapes on its first frame, and a shape appearing elsewhere are cut-ins.

These checks establish deterministic behaviour and readable pictures. They do not establish that a caption is true: test each model against its source.

## Command line

`explain <command> <scene.ts | directory> [options]`. In a checkout, run `npm run explain -- <command> ...`. `explain --help` prints the commands and the install lines for the optional packages.

| Command | What it does |
| --- | --- |
| `init <directory>` | Write `scene.ts`, a working scene with one setting |
| `preview <scene>` | Build, write a contact sheet of every step, serve the page |
| `snapshots <scene>` | Capture and verify diagrams; replay morph edits |
| `check <scene>` | The checks above |
| `build <scene>` | The page, its receipt, its header recipe and `loader.js` |
| `render <scene>` | A video with subtitles, chapters, transcript and receipt |
| `shots <scene>` | A contact sheet of every step, as SVG and PNG |
| `describe <scene>` | [`describeExplainer`](#describe) as JSON: every case and step, with words, state, what changed and the picture in words and as text |
| `see <scene> [step]` | One step of [`describeExplainer`](#describe)'s description: its resting picture drawn as text, then its title, caption, the picture in words and what it changed in `scene.state` (`key: before → after`). The last step by default; needs no browser, so an agent can read a scene from a terminal |

| Option | Applies to | Effect |
| --- | --- | --- |
| `--out <path>` | all but `init` and `snapshots` | The output file; for `check`, the report's directory; for `see`, the resting picture as SVG (nothing is written without it). Defaults under `out/` in the current directory |
| `--refresh` | all but `init` | Recapture every diagram |
| `--case id=value` | `render`, `shots`, `see` | One case; repeat for several settings |
| `--all` | `render` | Every case, each file suffixed `-id=value` |
| `--footer` | `render` | The 1280 × 960 caption-footer preset |
| `--width <even>` | `render` | Stage-only width, default 1280 |
| `--fps <1–120>` | `render` | Frame rate, default 30 |
| `--port <n>` | `preview` | Default 5174 |
| `--watch` | `preview` | Rebuild the page and contact sheet when a source file changes; reload the browser to see it |

`CHROMIUM_EXECUTABLE_PATH` selects a Chromium for capture; otherwise it is looked up in `PLAYWRIGHT_BROWSERS_PATH` and Playwright's cache. If an optional package is missing, the command prints the line that installs it.

`node tools/tokens.ts <file | -> [--lang ts|js|python|bash|elixir] [--theme dark|light] [--engine auto|shiki|fallback]` prints syntax colours as `ColorSpan`s for `new Code(lines, { spans })`, to check in beside the scene. It runs from a checkout and is not part of the package; [the code guide](CODE.md#the-tool) describes its engines.

## Page

`build` writes one self-contained HTML file: one explainer, all its cases, a poster, a transcript, sources and licence notices. It makes no network requests and uses no storage.

The transcript lists, for every case, each step as a link to it, its caption, and what its resting picture shows. Without JavaScript every case shows. The player shows the current case's section, and its links move the player.

### URL parameters

| Parameter | Effect |
| --- | --- |
| `step=<name>` | Open at that step's resting picture |
| `<setting id>=<value>` | Choose a case; missing settings use defaults |
| `theme=light\|dark\|auto` | Player chrome only; default `auto` |
| `parentOrigin=<origin>` | Set by the loader; the exact HTTP(S) origin that receives resize messages |

An unknown setting or value resets every setting to its default, and a notice names what was wrong. A step the case lacks opens the first step, with a notice. Switching cases keeps the step by name. Back and forward restore case and step. Copy link keeps case and step and drops `parentOrigin`. On a page `site:export --origin` published, which carries `<meta name="rayner:share">`, Copy link on a step of the default case gives that step's share page, `<origin><path>/<id>/<step>`, whose link preview is the step; another case, or a step whose name is not letters, digits, `-` and `_`, keeps `?step=`. A share link drops `theme`.

### Controls and accessibility

**Next** plays the step and stops on its resting picture. Icon buttons: previous, zoom out, zoom in, fit (only while zoomed), replay, copy link, and enlarge (full screen, when the iframe allows it). Cases are a segmented choice under the title; steps are a list under the controls.

The stage's accessible description is a one-sentence summary of the picture. "What the picture shows", under the caption, opens the full description: each diagram, card, code panel and described drawing, with what is marked, dimmed or changed in this step.

The stage takes focus from Tab or a click. With the stage focused, `+`, `-` and `0` zoom and reset, and arrow keys pan when zoomed. Otherwise left and right arrows change step, except on a button, link or field. Pinch, Ctrl-scroll and double-click zoom; when zoomed, drag pans and a click recentres on the point clicked. Zoom goes up to 6×, keeps its place across steps, and resets when the case changes. It narrows the stage's SVG `viewBox` inside the author's camera (`ReaderSink` in `app/embed-zoom.ts`) rather than scaling the element, so the drawing stays sharp, the page does not move, an author's camera move keeps playing under it, and Fit shows the author's frame. On a stage under 600 px wide, each step opens on a close-up of what it changed, zoomed whenever a label near the change is under 12 px so that it reads at 12 px; a small map in the corner shows the whole frame and steps through the step's other close-ups, Fit keeps the whole picture for later steps, and the crosshair button brings close-ups back. A vertical swipe scrolls the page; a sideways drag or a pinch moves the view. With reduced motion, the previous picture crossfades into the step's resting picture instead of playing.

Inside an iframe without `parentOrigin` (a raw iframe), the page adds its own "Open in a new tab" link.

### Resize protocol v1

```ts
{ type: 'rayner:resize', version: 1, height: 742 }
```

- The page measures its content root, rounds up, and posts only changed heights, only while framed, and only to the exact `parentOrigin`. It measures on load, on each `ResizeObserver` callback, and whenever the player settles on a step, because browsers can stop rendering an offscreen cross-origin iframe.
- The parent accepts a message only when `event.origin` equals the artifact's origin and `event.source` is that iframe's window. Origin alone cannot tell two embeds from the same host apart.
- Only that type and version, with an integer height from 1 to 100,000, is accepted. The message carries nothing else.

### Headers

`<page>.html.headers.json` is the response-header recipe: a CSP that pins the inline script and style by SHA-256, `connect-src 'none'`, no fonts, base or objects, and `frame-ancestors *`, plus `Cache-Control: public, max-age=0, must-revalidate`. `<page>.html.receipt.json` records source, engine and snapshot hashes, the artifact hash and each case's steps, and, for a page that asked for lettering, what its lettering weighs ([lettering on request](#lettering-on-request)).

## Video files

`explain render` runs the scene at a fixed frame rate, rasterises each frame with resvg and the embedded fonts, and pipes it to FFmpeg. Each frame is written with `toSvgString(scene, { cull: true })`, which leaves out what the camera cannot show (`shots`, `preview`'s contact sheet and the gallery tiles render culled too), because resvg 2.6.2 aborts on an element with `opacity` whose visible box is empty, such as a fading label outside a zoomed view ([camera](CAMERA.md#rendering-off-screen-content)).

Each step plays its motion with the step's title in the footer, then holds its resting picture under the full caption for the caption's reading time at 160 words a minute. Chapters start at each step's motion; subtitle cues cover the caption holds. Reading time sets the length, so most of a video is a still picture: over the 20 demo videos, 82% of frames repeat the stage picture before them (1 − `rasterizedFrames` / `frames` in the receipts); on the earlier collection, the order that put each caption before its motion gave 69%.

| File | Contents |
| --- | --- |
| `.mp4` | Silent H.264, `yuv420p`; one `mov_text` subtitle stream tagged with the ISO 639-2 code for `meta.lang`; chapters |
| `.webm` | Silent VP9; WebVTT subtitle stream tagged with `meta.lang` |
| `.vtt` | One cue per captioned step, with a `Language:` header |
| `.transcript.html` | The video's text alternative: title and case, then each step's title, caption and what its picture shows |
| `.chapters.ffmeta` | One chapter per step, titled by the step title |
| `.receipt.json` | Hashes, settings, versions of resvg and FFmpeg, size, fps, `frames`, `rasterizedFrames`, preset, `chapters` (each step with its `captionHold` in seconds), `transcript` |

| Preset | Size |
| --- | --- |
| Caption footer (`--footer`) | 1280 × 960: a 1280 × 720 stage over a 240 px footer that shows the title, then the caption, each up to four lines at 27 px, in the page's light or dark colours |
| Stage only | 16:9 at any even width; height rounds to an even number; no title or caption on screen |

With `--footer`, `render` fails before FFmpeg starts on a title or caption that needs more than four lines or has a character the fonts cannot draw; `npm run videos` runs this footer check on every case of every explainer with video; `demos:check` does not, since pages have no footer. Like `check`, `render` fails if the picture changes during a caption hold. An MP4 needs an ISO 639-2 code for `meta.lang`: three-letter tags pass, `en` and `fr` and their regional tags become `eng` and `fra`, and other tags fail. Video bytes may differ between FFmpeg and resvg builds.

## Repository scripts

| Script | What it does |
| --- | --- |
| `npm run check` | TypeScript over every project, then a consumer compile against `dist/` |
| `npm test` | The test suite; browser, video and live tests skip unless enabled |
| `npm run test:full` | `FULL=1`: every frame and ten times as many property cases |
| `npm run test:embeds` | Real Chromium: capture fidelity, cross-origin embeds, history, phone layout, offline, no JavaScript, a lettered page drawing its requested letters |
| `npm run test:video` | Real FFmpeg: H.264 and VP9 exports, subtitles, chapters, decode, receipts |
| `npm run demos:build` | Build every explainer, the gallery, `evidence.json` and a two-embed page into `out/explainers/` |
| `npm run demos:check` | `demos:build` plus `check` and the footer check on every case |
| `npm run demos:render` | `demos:build` plus a caption-footer video of each default case in `out/videos/`, verified with ffprobe, after checking that every case's captions fit the footer; unchanged videos are skipped unless `-- --force`; a catalog entry with `video: false` ships as a page only |
| `npm run videos` | Everything video, kept out of CI: `demos:render`, `test:video` and the package smoke test's installed render. Needs FFmpeg |
| `npm run demos:serve` | Serve `out/` on port 5175 with each page's headers and byte ranges; `-- --port n` |
| `npm run demos:review` | Open every served case at 390 px and 1180 px in Chromium and check captions, artwork, errors, outside requests and headers, and video byte ranges when `out/videos/` has videos; screenshots in `out/review/` |
| `npm run site:export -- <site-root>` | Copy the built pages, posters, videos and loader under `<site-root>/projects/rayner` (`--path` changes it), with every step's preview picture of the default case as `<id>/<step>.png` (the 960 × 540 still centred on a 1080 × 540 canvas of the stage's paper, since X shows these cards at 2:1; a palette PNG of at most 256 colours taken from the picture, each channel within a few levels of the render), and write their `_headers` block to `out/site-headers.txt`. `--origin https://example.org` also writes a share page per step, `<id>/<step>.html`, which sends a reader to the player at `<id>?step=<step>`, and adds the same link-preview tags to each explainer page, for its gallery tile's step: `description`, Open Graph (`og:type`, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`) and Twitter card (`twitter:card` = `summary_large_image`, `twitter:title`, cut at a word to the 70 characters X shows, `twitter:description`, `twitter:image`, `twitter:image:alt`), with absolute URLs, and `<meta name="rayner:share" content="<origin><path>/<id>/">`, which the player's Copy link reads; then it checks every page has each tag once and each picture exists at the declared size. Link previews come from the HTML a crawler fetches, and a static host sends the same HTML for every `?step=`, so a step needs its own URL to preview |
| `npm run pack:smoke` | Pack, install into a fresh project without the optional packages, build an outside scene; `EXPLAIN_BROWSER=1` adds capture, `EXPLAIN_VIDEO=1` a render |
| `npm run build:lib` | Compile `dist/` (runs on `npm pack`) |
| `npm run fonts` | Regenerate `src/font-data.ts` from Inter, JetBrains Mono and the Noto numeral subsets, reproducibly (needs `fonttools` and `brotli`) |
| `npm run fonts:lettering` | Regenerate `vendor/lettering/`, the Latin Extended, Greek and Cyrillic of the same Inter and JetBrains Mono that [lettering on request](#lettering-on-request) cuts from; leaves `src/font-data.ts` alone (needs `fonttools` and `brotli`) |

Test environment: `FC_RUNS=n` sets the property cases, and `FC_SEED` with `FC_PATH` replays a fast-check failure. `UPDATE_GOLDEN=1` rewrites `test/golden-traces.json` and `test/lettering-baseline.json` after a deliberate change; re-pin the second in a commit that changes no lettering code. `EXPLAIN_BROWSER=1` and `EXPLAIN_VIDEO=1` enable the browser and video tests. `test/explain-gates.test.ts` gives each check one seeded defect.

Tests that hold a model to an outside tool compare against frozen answers, and also run the tool when it is present:

| Tool | Runs when | Test |
| --- | --- | --- |
| rustc | `rustc` is on `PATH`, or `RUSTC` names one | `test/explain-send-sync.test.ts` |
| Python's `unicodedata` at Unicode 17.0.0 | `python3` on `PATH`, or `PYTHON`, has it | `test/explain-isdigit.test.ts` |
| sabre/vobject 4.5.7 in Docker | `SABRE_DOCKER=1` | `test/explain-ical-recurrence.test.ts` |
| A checkout of w3c/wcag | `WCAG_REPO=<checkout>` | `test/explain-wcag-map.test.ts` |
| Manim | `MANIM_DIR=<checkout of 3b1b/manim>` at the commit `test/manim-oracle.json` names, with `python3` and numpy 1.26.4 (so Python 3.12 or earlier); `UPDATE_ORACLE=1` rewrites `test/manim-oracle.json` | `test/manim.test.ts` |

The Manim answers for `distribute` depend on numpy's version. In cases 1 and 3 several pieces have the same length at the cut, and manim chooses among them with `np.argpartition`, whose order for ties is not fixed: numpy 1.26.4 reproduces the frozen answers, and numpy 2.0.2, 2.3.5 and 2.5.3 give other counts for those two cases. Refresh the oracle only with numpy 1.26.4.
