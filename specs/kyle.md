# Proposal: an explainer project forked from Lantern (revised)

Oct 24, 2026 · @Ade Oshineye

**Status:** Local implementation and demo collection built in this fork; public release/deployment and outside-author acceptance pending\
**Working name:** Explainer; final repository, package and product names to be chosen\
**Foundation:** [ivarvong/lantern](https://github.com/ivarvong/lantern) at commit `2c7bad5`\
**Diagram integration:** [Agentic Mermaid](https://github.com/adewale/agentic-mermaid) 0.4.1, optional, build time only

## Decision and purpose

Create a separately maintained, openly attributed fork of Lantern for one complete workflow:

> Write an explanation once as a native Lantern scene, publish it as a step-through website embed, and export the same scene as a silent, captioned video.

Five commitments define the project:

1. **Native scenes stay the authoring model.** An explainer is a Lantern `Scene` with named steps and captions. There is no JSON format, scene language or second runtime.
2. **A helper library does the repetitive work.** Small functions for common explanation techniques: show a diagram and build it in, send a token along its links, move it to its next version, focus on a part, show a card. Scenes call them like any other Lantern code and mix them freely with native drawing.
3. **Agentic Mermaid's styles are honoured.** A diagram looks the way Agentic Mermaid draws it in the chosen style, mark for mark, and every mark is addressable by its Mermaid id.
4. **The stepper comes first.** A reader moves through the explanation one step at a time, at their own pace, and can go back or link to any step.
5. **Reader settings offer another case to step through.** A scene may declare a few named options, such as a sign-in method or a city. Each option is a complete, stepped variant, built and tested ahead of time.

A working prototype shows all five across fourteen explainers. Eight of them are every one of Lantern's own examples, rebuilt this way. Each is exported to video.

## Implementation status in this checkout

This checkout implements the workflow locally: fourteen explanations, 31 cases, 52 captured diagrams, eight diagram families and twelve styles. It is a new implementation, not an import of the prototype described under *What has been demonstrated*, whose 49-diagram and 110-test counts remain that prototype's.

Implemented: the helper library and finite settings; capture through the real style backends with SVG lowering; cached snapshots and replayed morph edits; the external-scene CLI; stepper-first portable pages with posters and transcripts; a loader that checks origin and source window; contact sheets; H.264 and VP9 export with footer, captions, chapters and receipts. [Delivery evidence and remaining gates](../docs/KYLE-STATUS.md) and the [demo tour](../docs/DEMO-TOUR.md) list the commands and artifacts.

A second pass changed what readers see. Every step's last frame is what a reader looks at while reading its caption, and in the first pass nine of the fourteen explainers had steps that ended exactly like the step before. The helpers now keep emphasis on screen (walk trails, `mark`, `dim`, notes attached to diagram parts, updatable cards, code focus bars) and lay content into named stage regions. The stage heading follows step titles, and **Next** plays a step's animation before stopping on its last frame. `explain check` now fails a case when a step ends on the previous step's picture, when text collides or is cut off, when a label stays under 14 px at a 1280 px stage, or when a caption overflows the video footer. All fourteen explainers were rewritten against those checks, and their prose was edited with [anti-slop-writing](https://github.com/adewale/anti-slop-writing).

Two implementation choices differ from the prototype. CSS and SVG lowering happens at build time, so browsers receive resolved geometry and text placements rather than a live SVG reader. The 2password example is an explicitly scoped offline fixture, because its source was unavailable. Style-specific fonts remain unsupported, as anticipated below. Public naming, a maintainer, release acceptance, an outside author and production deployment cannot be established by local tests.

## What changed from the previous draft

The fork, native authoring, the embed-first release and the video contract are unchanged. Four things change.

| Area | Previous draft | This revision |
| --- | --- | --- |
| Agentic Mermaid styles | The importer transferred geometry and selected shapes; styles were explicitly not preserved | The importer captures each mark as the style draws it. Styles are preserved and are a release requirement |
| Diagram families | Flowcharts, through Lantern's `flowchart()` or the importer | Eight families in the prototype: flowchart, state, sequence, class, mind map, xy chart, git graph, Gantt. The rest are in milestone 2 |
| Explanation techniques | "Small helpers" allowed but not specified | A specified helper library (`explain/`), used by every example |
| Reader choices | Step navigation only | Step navigation first, plus optional reader settings declared by the scene |

The examples changed too. The four in the previous draft (Cache, PDA, Keyboardia, Vaders) came from a separate prototype that this revision has not seen. This revision uses fourteen examples that were built and tested here, including all of Lantern's own.

## The problem, and why a fork

A good explanation has requirements that cross tool boundaries, and today no single project owns all of them:

- Authors need control over a sequence of ideas: what appears, in what order, and what the reader looks at.
- Readers need to move through that sequence at their own pace, go back, and share a link to a step.
- Publishers need a portable file they can host with their own site.
- The same explanation often needs a video for a talk or a channel with no embeds.
- Maintainers need one source for the web version and the video.
- Diagram-led explanations need diagrams that look right. Today that means redrawing by hand what Agentic Mermaid already draws well.

Lantern supplies the execution and rendering model. Agentic Mermaid supplies layout, styles and a typed model of every diagram. The fork owns the workflow between them: the helpers, the player, the build, the video export, and the documentation and releases.

**Why a fork, not only upstream changes.** Small, general changes still go upstream: the nested `AnimationGroup` fix, external scene registration, and MP4 export. A fork is justified only by the wider commitment: owning releases of the combined engine, helpers, player and tools, and supporting their users. That cost is real. Divergence should stay in the product and tooling layers, and the engine should change only for demonstrated needs. The project should not start without a named maintainer.

## What is inherited, and what changes

The engine is inherited as it is. Lantern already ships helpers of this kind: `title()`, `CodePanel` and `StateReadout` in `src/panels.ts`. The fork's library continues that pattern rather than starting a new one.

| Area | Inherited from Lantern | The fork's responsibility |
| --- | --- | --- |
| Scene authoring | `Scene` classes with `step()`, `play()`, captions and state | Templates, examples, documentation; static `meta` and `settings` fields as registration conventions |
| Animation engine | Mobjects, animations, deterministic frames and seeking | Preserve semantics. One fix from the prototype (nested `AnimationGroup` members) and one documented pitfall (easing compounds in nested groups, so the helpers run groups on linear time) |
| Explanation helpers | `title`, `CodePanel`, `StateReadout` | `explain/`: `stage`, `show`, `walk`, `morph`, `reveal`, `focus`, `highlight`, `mark`, `dim`, `note`, `card`, `code`, `chip` |
| Diagrams | `flowchart()`, Lantern's own Mermaid layout | Keep it. Add the Agentic Mermaid integration, which honours its styles across families |
| Player | `app/player.ts` | Stepper-first embed preset, settings row, accessibility and mobile behaviour |
| Builds | Bundled HTML | External scenes, snapshot build, portable artifacts, reproducible releases |
| Video | Frame execution, SVG sinks, `tools/video.ts` | Supported MP4 export, caption-footer and stage-only presets, receipts |
| Inspection | Traces, text views, motion verifier | Keep them; the helpers record every walk in the trace so tests can check it |

## Architecture

One scene file drives everything. At build time it runs once per setting so Agentic Mermaid can draw its diagrams; in the page and the video exporter, the same scene runs again on Lantern alone.

&#91;embedded content: architecture · build time and page, 10 parts\]

The scene snapshot is the only thing that crosses from build time to the page. It holds each mark's SVG as the style drew it, with the mark's id, role, endpoints, route and data channels, plus verify's findings. The browser never loads Agentic Mermaid, contacts a server, or recomputes a layout. Lantern's own `flowchart()` remains available for authors who want no build step.

## Honouring Agentic Mermaid's styles

The integration keeps the style by not redrawing anything. Agentic Mermaid draws each mark; Lantern reads that drawing into its own shapes, and keys it by what the mark is.

1. **Render with the real style.** At build time the integration registers a capture backend with Agentic Mermaid's public `registerBackend`. It delegates to the style's real backend (default, rough or hybrid) and renders through `createMermaidRenderer`. The build asserts that the output equals a plain `renderMermaidSVG`, so capture cannot change the picture.
2. **Keep each mark's own SVG.** For every top-level part of the scene description, the backend's `drawNode` output is kept, with the part's id, role, endpoints, route and data channels. The final render's `<style>` and `<defs>` are kept once per diagram, so class rules, CSS variables, `color-mix()` and markers resolve exactly as in the browser.
3. **Read it into Lantern shapes.** In the page, each mark becomes a group of Lantern paths and glyph-outline text in the style's own colours, strokes and fills. Rough strokes stay rough.
4. **Key by meaning.** A part is addressed by its semantic id: node `API`, edge `edge:C->R#0`, bar `bar:0:W3`, commit, task or slice. Labels attach to their owners, so they move with them.

What this gives authors: a diagram looks as it does in Agentic Mermaid's own renderer. It is also made of ordinary Lantern objects that scene code can animate by id.

**What is checked.** Across the 49 diagrams in the prototype, in twelve styles, the reader turns every mark into shapes and skips nothing; a test fails if any SVG is left unread.

**Known limits.**

- Text is drawn in Lantern's embedded Inter and JetBrains Mono outlines, not the style's font. The hand-drawn style's lettering is the visible difference. Embedding style fonts as outlines is a later option.
- Some families come out narrow or tall in a 16:9 frame, and their text gets small. Authors choose a direction (`LR` or `TB`) per diagram and use `focus()` to move the camera; a lint for labels under 9 px is planned.
- The capture relies on `drawNode` and the shape of the final render's styles. They are reachable through public entry points but are not a documented contract. The fork should ask Agentic Mermaid for a supported per-mark render, such as `renderParts(scene)` returning `{id, svg}`, and pin tested versions until then.

## The helper library

The helpers are plain functions in `explain/`. A scene calls `stage(this, { palette })` once, then uses what it needs; everything else stays native Lantern.

| Helper | What the reader sees |
| --- | --- |
| `s.show(diagram, { box, build })` | The diagram builds itself in, the way its family reads: graph nodes layer by layer with edges drawn from their source; sequence messages in order with a token; git commits left to right; bars growing up; Gantt tasks growing from their start; pie slices largest first. `build: 'frame'` shows only axes, lanes or lifelines |
| `d.reveal(n \| ids \| 'rest')` | The next parts in reading order arrive |
| `d.walk([[a, b], ...])` | Tokens travel the diagram's own links. A hop that is not a real link throws, and every hop is recorded in the trace |
| `d.morph(next, { ops })` | Marks with the same id glide to their new place; new ones arrive; gone ones leave. With `ops`, the build checks Agentic Mermaid's `mutate(ops)` really produces `next` |
| `d.focus(ids \| 'all', { zoom })` | The camera glides onto those parts |
| `d.highlight(ids)` | Those parts pulse in a colour |
| `d.mark(ids)`, `d.dim(ids)`, `d.note(id, text)` | Those parts stay coloured, everything else fades, or a short label sits beside a part; all three remain in the step's last frame |
| `d.walk(hops, { trail: true })` | As `walk`, and the travelled links stay coloured |
| `s.card(rows)`, `s.chip(text)` | Labelled values in a stage region, which `card.set()` updates and `card.mark()` lights; a status line in the corner |
| `s.code(lines)` | Code on a panel whose focus bar stays on the lines just discussed |
| `settingsOf(this)` | The reader's chosen setting values, or the defaults |

This is the KV-cache merge request from Lantern's examples, rebuilt; excerpted, but otherwise as it runs. The diagram helpers and Lantern's native `Code` and `Transform` sit side by side:

```ts
export class CacheMRExplainer extends Scene {
  static settings = [{ id: 'request', label: 'Follow a request', default: 'hit',
    options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }] }];

  override async construct() {
    const which = settingsOf(this).request!;
    const s = stage(this, { palette: palette('hand-drawn') });

    await this.step('before', { title: 'Before: every request reads D1', caption: '...' });
    const flow = await s.show({ source: BEFORE, style: 'hand-drawn' }, { box: TOP });
    await flow.walk([['Request', 'H'], ['H', 'D1']]);

    await this.step('diff', { title: 'The diff', caption: '...' });
    const before = new Code([...]).moveTo([0, -2.3]);          // native Lantern
    await this.play(new FadeIn(before));
    await this.play(new Transform(before, after, { replace: true }));

    await this.step('after', { title: 'The same change, to the architecture', caption: '...' });
    await flow.morph({ source: AFTER, style: 'hand-drawn' }, { ops: MR_OPS });

    await this.step('request', { title: which === 'hit' ? 'A cache hit' : 'A cache miss', caption: '...' });
    await flow.walk(PATH[which]);
  }
}
```

The diagrams are plain Mermaid strings. The page never runs Agentic Mermaid: at build time every scene runs once per setting, and each diagram it asks for is rendered and stored as a snapshot. A scene therefore never declares its diagrams in advance, and a variant that fails to run fails the build.

## Reader settings

The stepper is the primary way to read an explainer. It is clearer and more educational than free exploration: the author decides the order of ideas, and the reader decides the pace. The player stops after each step by default, so the caption can be read before the next idea arrives. The previous, next and chapter controls and the keyboard all work on steps, and Lantern's player already links to a step with \`?step=\`; the shelf page in the prototype does not have step links yet.

Reader settings serve the stepper. A setting offers another *case* of the same explanation, and that case is again a full, stepped sequence. It is not a slider or a free input.

- **Declared by the scene.** `static settings = [{ id, label, options, default }]`. The scene reads the values with `settingsOf(this)` and may change its diagrams, captions, numbers and even which steps exist.
- **Finite and built ahead.** The build runs every combination. Every variant is rendered, verified, motion-checked and tested before anyone sees it.
- **Below the stepper.** The player shows settings under the chapter list, as "try another case" once a reader has seen one. Switching keeps the reader's place: it replays the same step in the new variant, matched by name.
- **Optional.** The Lantern self-explainer has none, because nothing in it has a variant worth choosing.

A good setting changes the lesson, not the look. Each example's setting is chosen that way:

| Explainer | Setting | What the reader learns from switching |
| --- | --- | --- |
| Personal Agent Protocol | Sign-in method: direct, device, mediated | How the three sign-in methods differ, message by message |
| OAuth with PKCE | Show an attacker: no, yes | Why a stolen code fails without the verifier; an extra step appears |
| How seasons work | Place: Tromsø, London, Quito, Sydney | Why Sydney's June is winter; polar day and night; the equator's flat year |
| Agentic Mermaid | The agent's first edit: leaves out the branch labels, or includes them | What verify is for: it catches the first edit, or passes it first time |
| KV-cache merge request | Follow a request: hit or miss | What one request does after the change |
| State machine | Events: connects then closes, or connection fails | The other path through the same reducer |
| Token bucket | Refill rate: 1, 2 or 4 a second | How the rate changes which requests get 429 |
| Ring buffer | Operations: push 5, pop 2, push 2; or push 7 | The tail wrapping into freed slots, or Full thrown before anything is written |
| Git from the inside | The second commit: adds world.txt, or edits hello.txt | When git shares a blob between trees, and when every hash above a change is new |
| A bash with no processes | Run cat on the new shell, or the old one | That exec returns a new value and never changes the one it was given |
| Cooperative resource limits | Step limit: 9 or 3 | Which clause of check\_step fires first, and why the order matters |
| Text as outlines | Font: Inter or JetBrains Mono | That widths are measured per font, not estimated |

2password's setting follows the same rule. Desktop approval or a service account changes the approval count shown (three, one per command, or none), the command `env run` hands to op (the service-account token is stripped from the child), and the path the authentication walk takes.

The previous version of the prototype also let readers switch a diagram's style. That is dropped: a palette change teaches nothing, and each explainer now uses one style chosen for it.

## The examples

Fourteen explainers, 31 variants in all, use eight diagram families in twelve Agentic Mermaid styles. Six explain a topic. The other eight are every one of Lantern's own examples, rebuilt with the helpers; Lantern's self-explainer is the Lantern topic. Each exercises a different teaching technique, and each is an ordinary scene of 70 to 180 lines; the seasons also use a 187-line kit of native drawing.

| Explainer | Drawn with | Style | Technique it demonstrates | Setting | Length |
| --- | --- | --- | --- | --- | --- |
| Personal Agent Protocol | Mind map, flowchart, state, sequence | nord | Four families in one story; a token walking session states | Sign-in method | 7 steps, about 105 s |
| Lantern | Class diagram, flowchart | hand-drawn | Camera moves over a large architecture; parallel tokens | none | 7 steps, 90 s |
| Agentic Mermaid | Flowchart, xy chart, git graph | blueprint | Morphs driven by real typed edits; verify's real warnings | The agent's first edit | 5 or 6 steps, 65 to 72 s |
| OAuth with PKCE | Sequence, Gantt | github-light | A protocol built message by message, with RFC values on cards | Show an attacker | 6 or 7 steps, 70 to 82 s |
| How seasons work | Native drawing, xy chart | tokyo-night | Native geometry where no diagram fits, then a computed chart | Place | 7 steps, 78 s |
| 2password | Flowcharts, sequences, native text and code | excalidraw | A security tool explained by its invariants; a port of its own search scoring | Desktop approvals or service account | 8 steps, about 143 s |
| KV-cache merge request (Lantern example) | Flowchart, native code diff | hand-drawn | The diff, then the same change applied to the architecture | Cache hit or miss | 4 steps, 37 to 42 s |
| State machine (Lantern example) | State diagram, native code panel | dracula | Diagram and reducer moving together; the scene asks the real reducer | Events | 4 or 5 steps, 40 to 49 s |
| Token bucket (Lantern example) | Native gauge and code, xy chart | github-dark | A real program's trace driving the animation, then its run as a chart | Refill rate | 5 steps, about 65 s |
| Ring buffer (Lantern example) | Native drawing only | dusk palette | A ring where the original had a row, so the wrap is visible; no diagram forced | Operations | 4 steps, 53 to 56 s |
| Git from the inside (Lantern's exgit example) | Flowchart, sequence, native code | catppuccin-mocha | An object graph that grows by morphs as objects are written; real SHA-1 ids | What the second commit does | 7 steps, about 131 s |
| A bash with no processes (Lantern's just-bash example) | Flowcharts, native code | chalkboard | A parse tree, a pipeline as a reduce, a lookup chain; the result of a model run | Which shell cat runs on | 7 steps, 92 to 101 s |
| Cooperative resource limits (Lantern's pyex example) | Flowchart, native code and counters | one-dark | A token walking a cond; the clause that fires comes from a model run | Step limit | 6 steps, about 77 s |
| Text as outlines (Lantern's glyph example) | Flowchart, native text | pen-and-ink | Letter-by-letter writing, measured widths, a diff as a morph | Font | 5 steps, about 66 s |

Three principles from Lantern carry through every example:

- **The animation shows what the program does.** The state machine asks `reduce()`, the token bucket runs `allow()`, the seasons compute the Sun's height, and the Agentic Mermaid morphs replay real `mutate()` ops. The scene never states an answer it did not get from the source.
- **Walks travel real links.** `walk()` throws on a hop the diagram does not have.
- **Native drawing where it helps.** Code panels, readouts, a gauge and an orbit are Lantern objects beside the diagrams, not something squeezed into a diagram family.

## What building the examples taught us

Rebuilding all of Lantern's examples, and adding 2password, changed the spec in nine places. The first is the most important: a test caught a real bug that review would have missed.

| What happened | Change to the spec |
| --- | --- |
| The ring buffer wrapped its animations in a `try`/`catch` for `Full`. The catch also swallowed the player's internal stop signal, so jumping to a step showed a different frame from playing to it. Lantern's existing seek test caught it | `check` runs the seek, motion and bare-runtime tests on every author scene, every variant. The docs and a lint forbid broad `catch` in `construct()`; upstream, ask Lantern for a stop signal that is easy to tell apart |
| Three scenes flashed black before their first diagram, because the stage's default paper was not the style's | The helpers take paper, ink and accent from the Agentic Mermaid style itself (its specs carry `bg`, `fg`, `accent`, `muted`); hand-written palettes become optional overrides |
| Decision chains laid out left to right became tall staircases; top to bottom became too narrow to read | Ship layout patterns in the guide (one shared exit node per outcome; direction by shape). Move the legibility lint, labels under 9 px, into milestone 1, and make `preview` print a contact sheet of every step |
| A node used in an edge before its labelled definition lost its label in Agentic Mermaid | Report upstream. Until fixed, the snapshot build warns when a rendered label equals the bare id but the source defines a label |
| Ten of fourteen explainers needed native drawing: code panels, a gauge, a ring, an orbit. The ring buffer has no diagram at all | Present the helpers as two layers: the stage (paper, cards, chips, settings), useful in any scene; and diagrams on top of it |
| Every Lantern example works by asking the program: the reducer, `allow()`, the ring buffer, a model of JustBash, `check_step`, git's hashing, 2password's own matching | Make it a named pattern with a test helper: a scene's state at each step must equal the program's |
| Rebuilt scenes are 87 to 176 lines, against 57 to 267 for the originals | Do not sell the helpers as shorter code. They buy real styles, settings, and checks: walks on real links, replayed edits |
| Caption reading holds are most of each explainer's length, and video export took 2 to 11 minutes per explainer here, three at a time | Holds are per output: the player waits for the reader; video uses holds. CI exports only the explainers whose scene or snapshots changed |
| The page with fourteen explainers is 1.27 MB, of which diagram snapshots are 830 KB | Embeds load one explainer and its snapshots, not a shelf bundle |

## Author workflow and website embedding

The command-line interface below is the target; the commands are not published yet. `snapshots` is new: it runs every scene under every setting and renders the diagrams they ask for.

```sh
explain init my-explanation          # a working native scene that uses the helpers
explain preview my-explanation/scene.ts
explain snapshots my-explanation/    # render and verify every diagram, replay every morph's ops
explain check my-explanation/scene.ts  # tests, motion check, traces, step timings
explain build my-explanation/scene.ts --out public/explanation.html
explain render my-explanation/scene.ts --out public/explanation.mp4 --footer
```

The first supported embed is an iframe of the built page. Settings would join the existing step parameter in the URL (not yet built):

```html
<iframe
  src="/explainers/pap.html?step=sign-in&signin=device"
  title="Personal Agent Protocol"
  style="width:100%;height:640px;border:0;display:block"
  loading="lazy">
</iframe>
```

The embed preset starts paused on a meaningful first view, with the stepper and caption visible and settings below. The page needs no application server, account or runtime network requests: fonts are glyph outlines, and diagram snapshots are bundled. The prototype's shelf bundles fourteen explainers with 31 variants into about 1.3 MB; a published embed must instead load only its own explanation and variants.

### Embed publishing contract

The lessons from [embed.oshineye.dev](https://embed.oshineye.dev/) and its [implementation notes](https://github.com/adewale/embed.oshineye.dev/blob/main/docs/LESSONS_LEARNED.md) become release requirements here. An embed is a portable publishing artifact with a stable interface, not merely the shelf player inside an iframe. Hosting remains optional and independent of authoring.

**Portable artifact and progressive enhancement**

- `build` emits a self-contained HTML file containing one explainer, its finite variants, snapshots, styles and runtime. It does not include other shelf scenes or Agentic Mermaid. No CDN, system font, storage, telemetry, live API or third-party cookie is required.
- The initial HTML includes a meaningful SVG poster and a semantic HTML transcript with step titles, captions and source links. The default case remains readable with JavaScript disabled or initialization failing. JavaScript enhances this content with the stepper; it does not supply the only readable explanation.
- A catalogue links to individual explanations. It is not part of the embed payload. A standalone explanation and its embedded presentation share the same scene and URL semantics.

**Two integration options**

1. A raw iframe is the baseline. It has a descriptive `title`, lazy loading and a documented initial height. Without parent-page JavaScript it remains usable through normal iframe scrolling, with a visible standalone link beside the iframe in the supplied snippet.
2. An optional tiny, self-hostable loader creates the iframe and maintains its content height. It accepts an artifact URL, target element, accessible title, optional chrome theme, initial step and declared settings. It derives the expected child origin from that configured URL, installs listeners before inserting the iframe, and supports multiple independently sized instances. The loader is a convenience, not a hosted-service dependency.

The stage remains 16:9. The entire document does not: captions, chapter controls and settings wrap differently on phones. Neither `aspect-ratio:16/13` nor a fixed height is an auto-sizing contract. The loader reserves an initial height, then measures actual content; a raw iframe uses its initial height with scrolling as the fallback.

**Stable URLs and reader state**

- `step=<name>` and each declared setting id are public, shareable inputs. Copy-link preserves the complete case and step. Switching cases keeps the named step where it exists, otherwise selects the first step and announces that fallback. Browser back/forward restores the represented case and step without a reload requirement.
- Missing setting values use scene defaults. An invalid known setting or missing step falls back with a visible, accessible notice rather than a blank frame or an uncaught exception. Canonical share links use the resolved values.
- `theme=light|dark|auto` configures player chrome, not diagram artwork or a teaching variant. The default is `auto`; the child follows its own colour-scheme preference unless the host supplies an explicit theme. The authored diagram style and its paper are preserved.
- `parentOrigin` is reserved for the resize transport and cannot be a scene setting. The loader supplies its own origin. The child accepts only an exact HTTP(S) origin, not a wildcard, path or opaque `null` origin. Without it, cross-origin auto-sizing is disabled; the page and raw iframe still work. File artifacts remain directly readable, without promising an opaque-origin messaging channel.

**Versioned cross-window resize protocol**

Version 1 carries no player commands, settings, secrets or transcript content:

```ts
{ type: 'lantern:resize', version: 1, height: 742 }
```

- The child measures a natural-height content root, independently of the iframe viewport height. It posts an initial measurement and observes layout changes with `ResizeObserver`. Measurements are rounded up to CSS pixels, coalesced to at most one per animation frame, and sent only when the height changes. Shrinking is supported as well as growing; the layout must not produce a height feedback loop.
- The child sends only to the configured exact `parentOrigin`, and only when framed. It does not broadcast to `'*'`.
- The parent accepts a message only if `event.origin` equals the configured artifact origin **and** `event.source === iframe.contentWindow`. Every instance performs both checks: origin alone cannot distinguish two embeds hosted together.
- The payload must be a non-null object with the exact supported type/version and a finite integer height from 1 through 100,000 CSS pixels. Malformed, out-of-range, wrong-window, wrong-origin and unsupported-version messages are ignored. Received data never changes the trusted origin or navigates the host.
- The loader removes its listeners when an instance is disposed. It does not steal focus or scroll the host page when the reader changes steps. No parent-side scripting is required to navigate an explanation.

**Hosting and resource policy**

- Publish artifacts on any static host. Document the headers required by that host separately from the artifact: `frame-ancestors` is a CSP response-header directive and cannot be enabled by an HTML meta tag. Use an explicit publisher allowlist where required, or deliberately permit public embedding. Do not send `X-Frame-Options: DENY` or `SAMEORIGIN` for cross-origin embeds; `ALLOWALL` is not a supported substitute. CORS does not grant framing permission.
- The generated runtime must work under a policy with no runtime connections (`connect-src 'none'`), no external scripts or fonts, and no broad CDN allowlist. Build-generated hashes can authorize the inline bootstrap and styles; do not require `unsafe-eval`. Document parent `frame-src` requirements and any loader script authorization separately.
- Artifact release URLs or content hashes identify immutable builds. Human-friendly aliases may move, but the build receipt identifies the exact artifact and engine/snapshot versions. Cache immutable releases accordingly; do not describe an unversioned alias as immutable.

**Behavioural acceptance tests**

Use real browser behaviour rather than source-string checks or the presence of CSS palette literals. The release gate covers:

1. A host page on another origin loads two explanations with different heights. Each resizes only itself, including after captions/settings cause both growth and shrinkage.
2. Wrong-origin messages, another window on the correct origin, malformed heights and unsupported protocol versions cannot resize either iframe. Navigation of the expected iframe to an unexpected origin does not bypass the origin check.
3. At 390 CSS pixels, long captions, chapters and settings remain usable without horizontal overflow, clipped controls or host-page focus/scroll jumps. Keyboard navigation, visible focus, accessible names and reduced-motion behaviour are exercised.
4. A deep-linked non-default variant opens at the requested named step; copy-link retains the case; switching variants and browser back/forward preserve the documented state/fallback behaviour.
5. External requests and storage are blocked after the artifact is supplied. The player still works. With JavaScript disabled, the poster, transcript and source links remain readable. Raw iframe and standalone use also work without the loader.
6. Host policy permits framing while the child policy blocks runtime connections. Test response headers through the serving boundary, not by searching the generated HTML for header names.

After deployment, smoke-test the **published** artifact and loader, record their release identifiers/hashes, and repeat the two-embed and origin/source checks. Repository tests alone are not evidence that a repaired loader reached production. Reuse existing validation commands and keep expensive browser checks explicit; this contract does not itself add a scheduled CI lane or claim cross-platform screenshot compatibility.

## How people will use it

It is an npm package with a command-line tool, plus an agent skill. An MCP server is optional and comes later. An explainer is code that compiles to static files, so the natural home is the author's repository and build, not a running service.

| Who | What they install or use | Why this form |
| --- | --- | --- |
| Author, by hand | `npm i -D <name>`: the engine, the helpers and the Agentic Mermaid integration, as one package with a pinned engine | Scenes are TypeScript; their editor, types, tests and git all apply |
| Author or CI | The CLI: `init`, `preview`, `snapshots`, `check`, `build`, `render` | Snapshots, checks, pages and videos are build steps, the same in CI and on a laptop |
| Coding agent | An agent skill shipped in the repository (`skills add <repo>`), which teaches the agent the helpers and the commands | Agents already have a shell and an editor; a skill costs nothing to run. 2password ships this way |
| Agent with no shell (a chat host) | An optional MCP server wrapping the same CLI: render a diagram snapshot, render a still of a step, trace a scene, run the checks | Useful only where an agent cannot run the CLI; it adds a server for what is otherwise a build step |
| Reader | A static HTML page, or an iframe of it | No account, no server, no network: fonts are outlines and snapshots are bundled |
| Viewer of a video | An MP4 with captions | For talks and channels without embeds |

Why not MCP first: MCP suits live access to a system, like a vault or a ticket queue. An explainer is source that is checked and built once, then served as files. The CLI is the contract; the skill and an MCP server are two ways for agents to reach it.

## Video

Video is a build target of the same scene, not a second implementation. The exporter runs the scene at a fixed frame rate through Lantern's deterministic loop. It rasterises each frame's SVG with resvg and pipes the pixels to FFmpeg. The interactive player pauses at step boundaries; the video plays straight through, using the holds the author wrote.

The contract:

- **Silent H.264 MP4 by default,** with no audio stream. VP9 WebM is available.
- **Captions three ways:** burned into a caption footer (preset), as an embedded `mov_text` subtitle track, and as a WebVTT file beside the video.
- **Chapters,** one per step, named by the step.
- **Two presets:** caption footer, 1280 x 880, with a 720-pixel stage and a 160-pixel footer; and stage-only, 16:9, at any even width.
- **One video per variant.** A scene with settings exports each variant on request; the default variant is the default export.
- **Fonts from Lantern's outlines,** for the stage and the footer, so no system font is involved.
- **A receipt** that records the scene, engine and Agentic Mermaid versions, snapshot hashes, frame rate, resvg and FFmpeg versions, and the frame count. Exact SVG and seek comparisons are promised; byte-identical video across FFmpeg builds is not.

The footer is drawn as a separate Lantern frame and rasterised separately from the stage, then stacked under it. It holds the step number, its title and up to three lines of caption, wrapped against the glyph outlines' real widths. The footer changes only at step boundaries, so it is rasterised once per step.

In the prototype, `tools/video.ts --footer` exported all fourteen explainers' default variants at 1280 x 880 (results under *What has been demonstrated*). Narration is out of scope for the first release.

&#91;image: Four frames from the exported videos, each with its caption footer: Personal Agent Protocol, 2password, the token bucket and the seasons\]

Frames from four of the fourteen exported videos: the stage above, the caption footer below, both drawn from the same scene that runs in the page.

## Repository layout and upstream relationships

The prototype already uses this layout, so the fork can start from it:

```text
src/                                inherited engine and public exports
app/                                inherited player, plus the stepper-first shelf and embed preset
explain/                            the helper library: stage, diagrams, cards, settings, palettes
integrations/agentic-mermaid/       read snapshots into Lantern shapes; family readings (browser-safe)
integrations/agentic-mermaid/build/ capture backend (Node, build time only)
scenes/                             Lantern's built-in demonstrations, unchanged
scenes/explainers/                  the fourteen examples and their snapshots
tools/                              snapshots, build, video, shots, motion and playback checks
test/                               inherited tests plus explainer, snapshot and fidelity tests
docs/                               authoring, helpers, settings, embedding, export
```

**Lantern.** Track it as an upstream remote, record the base commit, and merge deliberately with inherited and downstream tests. Offer general fixes upstream: the nested `AnimationGroup` fix, external scene registration, the video footer preset, and a single-animation token travel. The fork must keep working if upstream declines them.

**Agentic Mermaid.** Pin the tested version. Keep all coupling in `integrations/agentic-mermaid/build/capture.ts`, under 100 lines, and in the snapshot format. Ask upstream for three things:

- a supported per-mark render;
- stable ids for labels, ticks and legend entries across edits, which morphs depend on;
- reporting a state diagram's family as `state` (it reports `flowchart` today).

The frontmatter spacing fix on Agentic Mermaid's main branch (commit `bfb2c807`) is unreleased; until it ships, explainers pass spacing as options.

Attribution: keep Lantern's MIT notice and the font notices, and do not imply endorsement by either project.

## What has been demonstrated

The prototype is the `agentic-mermaid` branch of a Lantern checkout based on `2c7bad5`, at commit `4904cfa`. Every check below ran on that commit according to the supplied proposal. These are historical prototype results, not validation of this checkout or of the new embed publishing contract.

| Check | Result |
| --- | --- |
| Explainers and variants | 14 explainers, 31 variants: 6 topics and all 8 of Lantern's own examples |
| Diagrams | 49, in 8 families and 12 Agentic Mermaid styles; every one passes `verifyMermaid` at build time |
| Style fidelity | Every capture equals Agentic Mermaid's own `renderMermaidSVG` output; the reader leaves no SVG unread in any of the 49 |
| Edits replayed | Every morph that names ops (5) reproduces its next diagram through Agentic Mermaid's `mutate` |
| Tests | 110 run, 106 pass, 4 skipped (opt-in), 0 fail, including Lantern's own seek, cache, golden-trace and bare-runtime tests over every variant |
| Motion | No pops, cut-ins, jumps or flickers in any of the 31 variants |
| Seek | A seeked frame equals the played frame in every variant; this check found the ring buffer bug described above |
| Page | One self-contained page, 1.3 MB, all fourteen players ready in about 3 s in headless Chromium, no console errors, no horizontal scroll at 390 px |
| Video | Fourteen silent H.264 MP4s at 1280 x 880, each with a caption footer, a `mov_text` caption track, a WebVTT file and one chapter per step; all decode with no errors and none has an audio stream |

These checks establish that the integration behaves and renders consistently. They do not prove that every claim in every caption is correct, and they are not a compatibility matrix across Agentic Mermaid or Lantern versions.

## Delivery plan

Four milestones take the prototype to a first release. The first three gates are checked in CI; the last needs a clean machine and an outside author.

&#91;embedded content: delivery plan · 4 milestones, 4 gates\]

The prototype already covers much of milestones 1 and 3: the directory boundaries, the helpers, the integration, and footer video export for every example. Two items move earlier than drawn, because of what building the examples taught us: the \`check\` command (seek, motion, bare-runtime and legibility checks on every author scene) and style-derived palettes both belong in milestone 1. The critical dependency is still an accountable maintainer, then the embed preset and distribution work.

## Risks, out of scope, and the recommendation

| Risk | Response |
| --- | --- |
| Fork drift | Keep engine changes small and upstreamable; record the base; test upstream updates before merging |
| The helpers grow into a second language | Helpers stay functions a scene calls. No interpreter, no config-driven steps. A helper earns its place by being used in two examples |
| Agentic Mermaid's output changes | Pin versions; snapshot tests per release; keep coupling in one capture file; seek a supported per-mark render |
| Styles drift from the real renderer | The capture asserts byte equality with `renderMermaidSVG`; a test fails on any unread SVG |
| Small text in tall or wide diagrams | Direction per diagram, `focus()`, and a planned lint for labels under 9 px. Test real scenes on phones |
| Settings multiply variants | Keep settings few and meaningful; the build runs every combination, so cost is visible in CI time |
| An explainer that looks right but is wrong | Walks must travel real links; morph ops are replayed; scenes ask the real program; cite sources |
| Duplicate engine copies | Resolve scenes, helpers and player to one engine instance; test compiled-scene reuse |
| No maintainer | Do not promise a public release without one |

**Out of scope for the first release:** a JSON lesson format or scene language; a new engine or player rewrite; free-form reader inputs (typing a latitude or pasting a diagram), which would need Agentic Mermaid in the browser; a visual editor; a hosted service that runs other people's scenes; narration; every Mermaid family (seven remain for milestone 2); framework components before the iframe is dependable.

**Recommendation.** Proceed with the fork if someone will own it. Keep Lantern's native scenes and player as the foundation, and make the stepper the primary reading experience. Ship three things as the fork's differentiators: the helper library, the style-honouring Agentic Mermaid integration, and release-quality embed and video export. Offer reader settings where a second case teaches something. Send general fixes upstream as part of maintenance, not as a precondition.

## Sources

- [Lantern repository](https://github.com/ivarvong/lantern), and the pinned [self-explainer](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/scenes/lantern.ts), [player](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/app/player.ts), [state machine](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/scenes/state-machine.ts), [token bucket](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/scenes/token-bucket.ts) and [merge request](https://github.com/ivarvong/lantern/blob/2c7bad533be25fbd56d26a9a2b6c5651743f011e/scenes/mr-cache.ts) examples
- [Agentic Mermaid repository](https://github.com/adewale/agentic-mermaid), version 0.4.1 on npm
- [Personal Agent Protocol, draft 0.2](https://personalagentprotocol.org/docs/spec)
- [RFC 6749: OAuth 2.0](https://www.rfc-editor.org/rfc/rfc6749) and [RFC 7636: PKCE](https://www.rfc-editor.org/rfc/rfc7636)
- [NASA Space Place: What causes the seasons?](https://spaceplace.nasa.gov/seasons/en/)
- The previous draft of this proposal, *Proposal: a standalone explainer project forked from Lantern*, 24 October 2026
- The prototype: the `agentic-mermaid` branch of a Lantern checkout based on `2c7bad5`, and its published explainer page, Lantern Explainers
