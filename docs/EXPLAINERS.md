# Authoring explainers

An explanation is an ordinary Lantern `Scene`, exported as the default from a TypeScript or compiled ESM file. Prefer default exports; a module with exactly one exported Scene subclass is also accepted. CLI bundling resolves the author, helpers and player to one engine instance, including compiled-scene reuse.

## The workflow

```sh
explain init lesson
explain preview lesson/scene.ts
explain snapshots lesson/scene.ts --refresh
explain check lesson/scene.ts
explain build lesson/scene.ts --out public/lesson.html
explain render lesson/scene.ts --out public/lesson.mp4 --footer
```

In a repository checkout, prefix these with `npm run explain --`. `preview` prints a PNG contact sheet of every default-case step and serves the built page at `http://127.0.0.1:5174/`. Rerun after changes. `shots` writes the sheet without starting a server. The original Lantern development player remains available with `npm run dev`.

The first fresh diagram build needs Chromium (`npx playwright-core install chromium`, or `CHROMIUM_EXECUTABLE_PATH`). The scene is trusted executable code: do not offer these tools as an unauthenticated service for other people's uploads.

## Steps, captions and state

```ts
await this.step('stable-name', {
  title: 'A reader-facing title',
  caption: 'One idea, stated plainly and checked against the program.',
});
this.state.tokens = bucket.tokens;
await this.play(new Transform(gauge, nextGauge));
```

Names are stable URL identifiers. Captions also determine video reading holds at Lantern's inherited 160 words/minute. The web reader waits for the reader instead of auto-advancing. Keep captions short enough for three footer lines; the video exporter measures embedded glyph advances and rejects overflow.

**Ask the program.** Compute the model's result, then animate that result. Test the model independently and compare step states with its results. `test/lib/explainer-state.ts` provides the repository's small `assertStepState` pattern; `test/explain-fidelity.test.ts` applies it to every authored case. The demo models explicitly describe their scope; they do not claim to execute an entire external interpreter or protocol.

**Do not catch around awaited animations.** `Scene.run()` handles the internal `StopScene` used for seeking. A broad catch inside `construct()` can swallow it. Handle a known model exception in a pure helper *before* animating, rethrow unknown exceptions, and return a discriminated result. `check` lints catches around awaited construct code.

## Stage helpers

```ts
const s = stage(this);                              // palette from the first diagram
// Or choose an explicit override: stage(this, { palette: palette('nord'), title: 'A title' })
await s.title('The next idea');
const card = await s.card([['Balance', 3], ['Rate', '2 / second']], { at: [0, -2] });
const chip = await s.chip('Checking the cache');
await s.clearOverlays();
```

Cards and chips return native `Group`s. Move, transform or remove them with Lantern. The stage is useful without diagrams: the ring-buffer explainer is entirely native drawing. Coordinates are 16 × 9, origin at the centre, y up; `at` is a scene-space position.

## Diagrams

```ts
const d = await s.show({ source: MERMAID, style: 'nord', spacing: 48 }, {
  box: [-7.3, -3.45, 7.3, 2.95],  // minX, minY, maxX, maxY
  build: 'frame',                 // axes, lanes, actors/lifelines; defer the story
});
await d.reveal(2);
await d.reveal(['API', 'DB']);
await d.reveal('rest');
await d.walk([['API', 'DB']]);
await d.walk([['Clock', 'Browser'], ['Clock', 'Trace']], { parallel: true });
await d.highlight(['DB']);
await d.focus(['API', 'DB']);
await d.focus('all');
await d.hide();
```

- Marks use semantic ids, not positions in an array. `d.get(id)` returns a native Group. Graph nodes accept their Mermaid id; class nodes also accept `class:Name`. Inspect `d.parts` or the snapshot for family-owned ids such as `bar:0:Jan`, `task:build`, or `message:A->B#0`.
- `reveal(n)` takes the next n unrevealed top-level parts in family reading order. Graphs read nodes and outgoing links; messages retain source order and carry a route-following token; commits read left to right; chart bars grow from the baseline and tasks from their start. Axes and scaffolding build first. Owned labels travel with their marks and are not animated twice.
- `walk` prevalidates every directed hop, requires the link to be revealed, follows its captured route and records `{step, from, to, edge}` in `state.walks`. `walks` is a reserved helper trace field; its evidence survives replacement of the program-state object. It never substitutes a straight line for a missing link. Parallel walks use one native `play`, not concurrent calls to the scene clock.
- Focus is a native geometry transform, including invisible route geometry. Hidden parts stay hidden. Returning to `all` restores the authored frame. A tall diagram needs focused, readable views, not just a tiny overview.
- Helper groups use linear group time so nested easing does not compound. Individual animations retain their easing. Do not call `Scene.play()` concurrently with `Promise.all`; one scene owns one clock.

```ts
await d.morph({ source: NEXT, style: 'blueprint' }, {
  ops: [{ kind: 'set_label', target: 'A->B#0', label: 'yes' }],
});
```

Same-id marks transform; arrivals fade in and removals fade out. At build time `ops` are replayed through Agentic Mermaid's real `mutate`, and canonical serialized output must equal `NEXT`. Mutation edge ids use Agentic Mermaid's authored/parallel-edge vocabulary; verifier warning indexes are not necessarily mutation ids. Without `ops`, morphing is visual continuity only, not a claim that an edit was replayed.

## Finite reader settings

```ts
static settings = [{
  id: 'request', label: 'Follow a request', default: 'hit',
  options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }],
}];
// Inside construct:
const which = settingsOf(this).request;
```

Every cartesian combination runs ahead of time, with a safety limit of 64 combinations. Defaults must exist, option values must be unique, and ids must be distinct URL-safe identifiers. `scene`, `step`, `t`, `perf`, `embed`, `theme` and `parentOrigin` are reserved. A bound scene uses per-instance settings; concurrent readers cannot overwrite one another.

A setting changes the lesson, not its palette. It may change diagrams, captions, numbers or which steps exist. The player preserves a step by name when possible and announces a first-step fallback otherwise. `theme=light|dark|auto` is separate host chrome configuration.

## Snapshots and checks

`scene.snapshots.json` is an author-side cache, not a new lesson format. The scene requests diagrams naturally while running. The cache retains original SVG, per-mark SVG, palette, ids, roles, routes, data channels, verifier findings, resolved geometry and compact text placements. Missing diagrams are captured; unused ones are pruned. Commit the cache beside the scene. Use `--refresh` after importer changes.

Capture delegates to the real default/rough/hybrid backend and asserts byte equality with `renderMermaidSVG`. Chromium resolves the complete document's CSS, transforms and markers **at build time**, with external requests blocked. The browser artifact only needs resolved geometry and text runs; raw SVG is stripped from its runtime payload. Embedded fonts supply outlines in both environments.

Unsupported imported paint/clipping resources, masks, filters and unread drawing elements fail the build rather than silently disappear. Native diagram focus uses a fixed rectangular `Mobject.clipBox` viewport, so enlarged artwork cannot paint over the heading or neighbouring native content. This clips paint, not geometry; nested viewports intersect. The tested release portfolio covers flowchart, state, sequence, class, mind map, xy chart, git graph and Gantt. Other families are not a compatibility promise. Style-specific lettering remains a known difference.

`check` runs every case and writes `report.json` under `out/checks/`, including each case's full step-boundary trace (captions, timings, before/after program state and real-link walk evidence):
- played versus seeked SVG at two frames per step;
- full versus skipped state traces;
- every-frame motion analysis (pops, cuts, jumps and flicker);
- execution in a bare ECMAScript context with no Node, DOM, timers or console;
- label legibility: native labels need a substantially visible 9 px view at 1280 px; imported semantic labels need such a view at a completed step, wholly inside their inherited viewport—not just a readable instant during a camera sweep;
- the construct catch lint.

These gates establish deterministic behaviour and observable animation quality, not the truth of every caption. Cite sources and test the underlying programs independently. Phone controls and transcripts have browser tests; this does not make every overview diagram legible at phone width.
