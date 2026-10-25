# Reference

The helper API, the checks, the command line, the page's URL and resize contract, and the video files. [The tutorial](TUTORIAL.md) walks through a first explainer; [publishing](PUBLISHING.md) covers hosting a page and exporting a video.

Words used throughout: a **setting** is a choice a scene declares (an id, a label and options); a **case** is one value for every setting. A **step** is a named section of the scene, and its **resting frame** is the last frame it draws: the picture a reader looks at while reading the caption. The **stage** is the 16 × 9 drawing area. A *frame* is a moment in time. Code and JSON spell case as `variant` (`variantsOf`, `variants` in reports).

## Scene

An explainer is a Lantern `Scene` exported from a TypeScript or ESM file, preferably as the default export. A module with exactly one exported `Scene` subclass also works.

```ts
static meta = { id: 'cache', title: 'Why a cache changes the request path', lang: 'en', sources: ['https://example.com/spec'] };

await this.step('stable-name', { title: 'A claim the frame can prove', caption: 'The value, part or mechanism on screen.' });
this.state.reads = reads;   // program state, recorded at each step boundary
```

- `meta.id` names the output files; `meta.title` is the page title; `meta.lang` (BCP 47, default `en`) sets the page language and the subtitle language; `meta.sources` are listed under the transcript.
- Step names are URL identifiers. They must be unique and non-empty in every case.
- `this.state` is recorded before and after each step. Compute values with a model, show the model's result, and test that each step's state equals the model's: `assertStepState` in `test/lib/explainer-state.ts` does this for the collection in `test/explain-fidelity.test.ts`.
- A captioned step holds until its caption could be read at 160 words a minute. The page ignores the hold and stops when the picture stops; video replaces it (see [Video files](#video-files)).
- Do not put awaited animations inside `try`/`catch` or `.catch()` in `construct()`. Seeking stops a scene by throwing `StopScene`, and a broad catch swallows it, so a jump to a step would show a different picture from playing to it. Handle a known model error in plain code before animating. `check` fails both forms.
- Text must be drawable by the embedded fonts (Inter and JetBrains Mono). Every command fails on any other character and names the case, the step and the code point.

## Stage

```ts
import { stage } from 'manim-js/explain';
const s = stage(this, { style: 'nord' });
```

`stage(scene, options)` adds the paper and a heading that follows each step's `title`.

| Option | Effect |
| --- | --- |
| `style` | An Agentic Mermaid style: the stage's palette, and the style of every diagram that names none |
| `palette` | Colours for the stage, for example `palette('dusk')` in a scene with no diagrams |
| `heading` | `'step'` (default), a fixed string, or `false` for no heading |

With neither `style` nor `palette`, the stage adopts the first diagram's palette.

| Member | What it does |
| --- | --- |
| `s.show(spec, { box, build, runTime })` | Draw a diagram and build it in; returns a `Diagram` |
| `s.card(rows, { at, align, width, title, fontSize, enter })` | Labelled values; returns a `Card` |
| `s.code(lines, { at, align, fontSize, title, diff, enter })` | Code on a panel; returns a `CodeBlock`. With `diff`, lines starting `+ ` or `- ` are marked added or removed |
| `s.note(text, { at, size })` | One line of secondary text, default at `[0, -3.9]` |
| `s.enter(...mobs, fadeOptions?)` | Fade native objects in together, in one play, and track them |
| `s.keep(mob)` | Track a native object without animating it |
| `s.clearOverlays()` | Fade out cards, code, notes and tracked objects |
| `s.clear({ runTime })` | Fade out everything except paper and heading, in one play |
| `s.emphasis`, `s.soft`, `s.good`, `s.bad` | Colours that read on this paper: emphasis, secondary text, accepted, rejected |
| `s.palette`, `s.paper`, `s.heading` | The current palette, paper rectangle and heading text |

`{ enter: false }` creates a card or code panel without playing it, so `s.enter(card, code)` can bring several in together.

Emphasis is the style's accent when it has a hue. Styles whose accent is grey or near-black (hand-drawn, pen-and-ink, blueprint) get orange.

### Card and CodeBlock

| Method | What it does |
| --- | --- |
| `card.set({ Label: value })` | Crossfade changed values; unchanged rows stay still. A card sizes to its first values, so pass `width` if later ones are longer |
| `card.mark(label \| null)` | A bar on one row that stays until moved |
| `code.focus(i \| [a, b] \| null)` | A bar on zero-based line `i`, or lines `a` to `b` inclusive |
| `code.morph(next, { markAdded })` | Pair lines by text: survivors move, removed lines fade, added lines arrive, marked if `markAdded` |
| `code.clearMarks()` | Fade out the added and removed bars |

Both are native `Group`s; move or transform them with Lantern.

### Regions

Stage coordinates are 16 × 9 with the origin at the centre and y up. The heading sits at y = 3.8; content belongs below y = 3.25. `at` and `box` accept a region name, a point `[x, y]`, or a box `[minX, minY, maxX, maxY]`.

| Region | Box |
| --- | --- |
| `full` | `[-7.55, -4.25, 7.55, 3.25]` |
| `left`, `right` | the halves of `full` |
| `main`, `side` | about two thirds left and one third right: a diagram beside a card or code |
| `top` | `[-7.55, -0.35, 7.55, 3.25]` |
| `bottom` | `[-7.55, -4.25, 7.55, -0.65]` |

`regionBox('top', { bottom: 1 })` returns a copy with a moved lower (or, with `top`, upper) edge. `REGIONS` holds the boxes.

## Diagrams

```ts
const d = await s.show({ source: 'graph LR\nA --> B', style: 'nord', spacing: 48 }, { box: 'main', build: 'frame' });
```

`build: 'frame'` draws only the scaffolding (axes, lanes, lifelines) so the story can arrive with `reveal`.

| Method | What it does |
| --- | --- |
| `d.reveal(n \| ids \| 'rest')` | Bring in the next `n` parts in reading order, named parts, or the rest |
| `d.walk(hops, { trail, parallel, color })` | A token travels real links; `trail` leaves them marked; `parallel` runs several journeys in one play |
| `d.mark(ids, { color })`, `d.unmark(ids?)` | Colour parts and thicken their outlines until unmarked; labels keep their ink |
| `d.dim(keep \| null)` | Fade everything but `keep`, links between kept parts and scaffolding; `null` restores |
| `d.note(id, text, { side })` | A short label beside a part at a fixed readable size; `side` is `above`, `below`, `left` or `right` |
| `d.clearNotes()` | Remove notes |
| `d.focus(ids \| 'all', { zoom })` | Move the camera onto parts; notes follow; `'all'` restores the authored view |
| `d.morph(next, { ops })` | Same-id parts move, arrivals fade in, departures fade out; marks, dimming and notes reset |
| `d.hide()` | Fade the diagram out; `reveal` can bring parts back |
| `d.get(id)` | A part as a native `Group` |
| `d.findings()` | The verifier's warnings, each with the `part` it names |

- Parts have semantic ids. Graph nodes use their Mermaid id; class nodes also accept `class:Name`. Other ids look like `edge:A->B#0`, `bar:0:Jan` or `message:A->B#0`; read `d.parts` or the snapshot to find them.
- Reading order: graphs read nodes with their outgoing links, sequence messages keep source order and carry a token, git commits read left to right, bars grow from the baseline. Scaffolding builds first. Labels travel with their owners.
- `walk` throws on a hop the diagram does not have, requires the link to be revealed, follows its captured route, and records `{ step, from, to, edge }` in `state.walks`.
- With `ops`, `morph` replays the edits through Agentic Mermaid's `mutate` at build time and fails unless the result serializes to `next`. Without `ops` it is a visual transition only.
- One scene owns one clock: never call `Scene.play()` concurrently. Use `{ parallel: true }` or one native `play` for simultaneous tokens.
- Capture fails on SVG features the reader cannot convert (unsupported paint, masks, filters) rather than dropping them. Lettering is embedded Inter stretched to each label's width, so styles with their own fonts differ in letterforms.
- The collection exercises the families and styles listed in `out/explainers/evidence.json`; other families are untested.

## Settings

```ts
static settings = [{
  id: 'request', label: 'Follow a request', default: 'hit',
  options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }],
}];
const which = settingsOf(this).request;
```

Every case is built and checked ahead of time; a scene may have at most 64. Ids are URL-safe (`[a-z][a-z0-9_-]*`) and distinct; `step`, `t`, `theme` and `parentOrigin` are reserved. Option values are unique and include the default. A setting may change diagrams, captions, numbers and which steps exist; keep the palette fixed.

Other exports: `withSettings(Scene, values)` binds a case without mutating the class; `resolveSettings` validates; `variantsOf(Scene)` lists every case; `caseName(Scene, values)` gives "Label: option · Label: option"; `bindSnapshots(Scene, store)` binds a snapshot store.

## Snapshots

`explain snapshots` runs every case, captures each diagram the scene asks for, and writes `scene.snapshots/` beside the scene: `index.json` maps each diagram's key to its own file. Commit the folder. Missing diagrams are captured and unused ones are deleted. A change to the capture code invalidates the whole cache; `--refresh` recaptures everything. Capture needs Chromium and the optional packages `agentic-mermaid`, `playwright-core` and `svgpath`; building from committed snapshots needs none of them.

Capture asserts that its output equals Agentic Mermaid's `renderMermaidSVG` byte for byte. Chromium resolves CSS, transforms and markers at build time with network requests blocked. The page receives resolved geometry and text runs; it never runs Agentic Mermaid.

## Checks

`explain check` runs every case and fails on:

| Check | Rule |
| --- | --- |
| Catch lint | A `try`/`catch` or `.catch()` around awaited code in `construct()` |
| Motion | Any pop (opacity changes by 0.5 or more in a frame), cut-in or cut-out, teleport or resize spike, flicker, or misplaced handoff |
| Seek | A seeked frame differs from the played frame, at two frames per step |
| Trace | The trace with frames skipped differs from the played trace |
| Bare runtime | The scene, bundled, gives different steps or state in a context with no DOM, Node, timers or console |
| Step change | A step's resting frame, ignoring the heading, equals the previous step's |
| Text | Native text in a resting frame overlaps other text or crosses the stage edge |
| Legibility | A native label never reaches 14 px at a 1280 px stage while substantially visible; an imported label never reaches 14 px in a resting frame inside its diagram's viewport |
| Glyphs | Any text the embedded fonts cannot draw (every command checks this) |

14 px at a 1280 px stage is about 4 px on a 390 px phone; readers there zoom the stage.

The report goes to `out/checks/<id>/report.json`. For each case it holds the full step trace, each step's resting frame as text (`restingFrames`), and the smallest label size at 1280 px and at 390 px before zooming (`legibility`).

These checks establish deterministic behaviour and readable frames. They do not establish that a caption is true: test each model against its source.

## Command line

`explain <command> <scene.ts | directory> [options]`. In a checkout, run `npm run explain -- <command> ...`. `explain --help` prints the same list.

| Command | What it does |
| --- | --- |
| `init <directory>` | Write a working scene with one setting |
| `preview <scene>` | Build, write a contact sheet of every step, serve the page |
| `snapshots <scene>` | Capture and verify diagrams; replay morph edits |
| `check <scene>` | The checks above |
| `build <scene>` | The page, its receipt, its header recipe and `loader.js` |
| `render <scene>` | A video with subtitles, chapters and receipt |
| `shots <scene>` | A contact sheet of every step, as SVG and PNG |

| Option | Applies to | Effect |
| --- | --- | --- |
| `--out <path>` | all but `init` | Where to write; defaults under `out/` in the current directory |
| `--refresh` | all but `init` | Recapture every diagram |
| `--case id=value` | `render`, `shots` | One case; repeat for several settings |
| `--all` | `render` | Every case, each file suffixed `-id=value` |
| `--footer` | `render` | The 1280 × 960 caption-footer preset |
| `--width <even>` | `render` | Stage-only width, default 1280 |
| `--fps <1–120>` | `render` | Frame rate, default 30 |
| `--port <n>` | `preview` | Default 5174 |
| `--watch` | `preview` | Rebuild the page and contact sheet when a source file changes; reload the browser to see it |

`CHROMIUM_EXECUTABLE_PATH` selects a Chromium for capture. If an optional package is missing, the command names it.

## Page

`build` writes one self-contained HTML file: one explainer, all its cases, a poster, a transcript of every case (titles, captions and a description of each resting frame), sources and licence notices. It makes no network requests and uses no storage.

### URL parameters

| Parameter | Effect |
| --- | --- |
| `step=<name>` | Open at that step's resting frame |
| `<setting id>=<value>` | Choose a case; missing settings use defaults |
| `theme=light\|dark\|auto` | Player chrome only; default `auto` |
| `parentOrigin=<origin>` | Set by the loader; the exact HTTP(S) origin that receives resize messages |

An unknown value or a step the case lacks falls back with a visible notice. Switching cases keeps the step by name. Back and forward restore case and step. Copy link keeps case and step and drops `parentOrigin`.

### Controls

**Next** plays the step and stops on its resting frame. Icon buttons: previous, zoom out, zoom in, fit (only while zoomed), replay, copy link, and enlarge (full screen, when the frame allows it). Cases are a segmented choice under the title; steps are a list under the controls. "What the picture shows" under the caption describes the resting frame in words.

With the stage focused: `+`, `-` and `0` zoom and reset, and arrow keys pan when zoomed. Elsewhere in the player, left and right arrows change step. Pinch, Ctrl-scroll and double-click zoom; drag or click pans when zoomed. Zoom goes up to 6×, keeps its place across steps, and resets when the case changes. With reduced motion, steps crossfade instead of playing.

Inside a frame without `parentOrigin` (a raw iframe), the page adds its own "Open in a new tab" link.

### Resize protocol v1

```ts
{ type: 'lantern:resize', version: 1, height: 742 }
```

- The page measures its content root, rounds up, and posts only changed heights, only while framed, and only to the exact `parentOrigin`. It measures on load, on each `ResizeObserver` callback, and whenever the player settles on a step, because browsers can stop rendering an offscreen cross-origin frame.
- The parent accepts a message only when `event.origin` equals the artifact's origin and `event.source` is that iframe's window. Origin alone cannot tell two embeds from the same host apart.
- Only that type and version, with an integer height from 1 to 100,000, is accepted. The message carries nothing else.

### Headers

`<page>.html.headers.json` is the response-header recipe: a CSP that pins the inline script and style by SHA-256, `connect-src 'none'`, no fonts, base or objects, and `frame-ancestors *`, plus `Cache-Control: public, max-age=0, must-revalidate`. `<page>.html.receipt.json` records source, engine and snapshot hashes, the artifact hash and each case's steps.

## Video files

`explain render` runs the same scene at a fixed frame rate, rasterises each frame's SVG with resvg using only the embedded fonts, and pipes it to FFmpeg.

| File | Contents |
| --- | --- |
| `.mp4` | Silent H.264, `yuv420p`; one `mov_text` subtitle stream tagged with the ISO 639-2 code for `meta.lang` |
| `.webm` | Silent VP9; WebVTT subtitle stream tagged with `meta.lang` |
| `.vtt` | One cue per captioned step, with a `Language:` header |
| `.chapters.ffmeta` | One chapter per step, titled by the step title |
| `.receipt.json` | Hashes, settings, versions of resvg and FFmpeg, size, fps, `frames`, `rasterizedFrames`, preset, chapter ids |

Each step in the video shows its caption over the previous resting frame for the reading time at 238 words a minute, then plays its motion, then holds 0.4 s. The first step plays first and holds afterwards.

| Preset | Size |
| --- | --- |
| Caption footer (`--footer`) | 1280 × 960: a 1280 × 720 stage over a 240 px footer with up to four caption lines at 27 px, in the page's light or dark colours |
| Stage only | 16:9 at any even width; height rounds to an even number |

`render` fails, before FFmpeg starts, on a caption that needs more than four footer lines or has a character the fonts cannot draw, and fails if the picture changes after a step's caption hold begins. Seeked SVG is deterministic; video bytes may differ between FFmpeg and resvg builds.

## Repository scripts

| Script | What it does |
| --- | --- |
| `npm run check` | TypeScript over every project, then a consumer compile against `dist/` |
| `npm test` | The test suite; browser, video and Manim tests skip unless enabled |
| `npm run test:full` | `FULL=1`: every frame and ten times as many property cases |
| `npm run test:embeds` | Real Chromium: capture fidelity, cross-origin embeds, history, phone layout, offline, no JavaScript |
| `npm run test:video` | Real FFmpeg: H.264 and VP9 exports, subtitles, chapters, decode, receipts |
| `npm run demos:build` | Build every explainer, the gallery, `evidence.json` and a two-embed page into `out/explainers/` |
| `npm run demos:check` | `demos:build` plus `check` on every case |
| `npm run demos:render` | `demos:build` plus a caption-footer video of each default case in `out/videos/`, verified with ffprobe; unchanged videos are skipped unless `-- --force` |
| `npm run demos:serve` | Serve `out/` on port 5175 with each page's headers and byte ranges; `-- --port n` |
| `npm run demos:review` | Open every case at 390 px and 1180 px in Chromium; screenshots and header checks in `out/review/` |
| `npm run site:export -- <site-root>` | Copy the built pages, posters, videos and loader under `<site-root>/projects/lantern-explainers` (`--path` changes it) and write their `_headers` block to `out/site-headers.txt` |
| `npm run pack:smoke` | Pack, install into a fresh project, build an outside scene with the installed CLI |
| `npm run build:lib` | Compile `dist/` (runs on `npm pack`) |
| `npm run fonts` | Regenerate `src/font-data.ts` from Inter and JetBrains Mono (needs `fonttools` and `brotli`) |

Test environment: `FULL=1` for the long runs; `FC_SEED` and `FC_PATH` replay a fast-check failure; `MANIM_DIR` points at a Manim checkout for the oracle tests; `UPDATE_GOLDEN=1` rewrites the golden trace after a deliberate change; `EXPLAIN_BROWSER=1` and `EXPLAIN_VIDEO=1` enable the browser and video tests.
