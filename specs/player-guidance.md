# Player guidance: what changed, where to go next, and how to drive it

Status: requirements, ready to implement. Builds on [`specs/player-redesign.md`](player-redesign.md) (PR #59) and [`specs/player-tile.md`](player-tile.md) (PR #65). The decisions in §3 are settled; where this document leaves a choice to you, it says so.

This document is written for an implementing agent. It assumes you have read `specs/player-redesign.md` §1 and `specs/player-tile.md` §1 (the player's anatomy and the functions in `app/embed.ts`), `app/embed.ts`, `app/embed.css`, `app/embed-strings.ts`, `app/embed-protocol.ts`, `app/loader.ts`, `explain/settings.ts` (the `meta` type), `explain/describe.ts` (how `changed` is computed), `explain/trace.ts` (`stepWords`, `wordsHtml`), `tools/lib/explain-build.ts` (the static transcript), `tools/lib/bench-measure.ts`, `docs/REFERENCE.md` §Player and §Embedding, `docs/PUBLISHING.md`, `specs/rayner.md` §Authoring and embedding, and `docs/TESTING.md`.

## 1. Why

In October 2026 the player was compared with Lantern, thirteen other step-through players (reveal.js, Motion Canvas, Manim Slides, Python Tutor, VisuAlgo, Red Blob Games, Seeing Theory, Ciechanowski's essays, Scrollama, Intro.js, Shepherd, the Svelte tutorial, the Rust Book's Aquascope) and the Stories/Reels players (Instagram, Snapchat, YouTube Shorts, TikTok, Web Stories). Rayner was ahead on resting pictures, step-based progress, nothing over the picture, per-step sharing and embedding, phone close-ups and text alternatives. It was behind in five places, which this change addresses:

| Gap | Who does it well |
| --- | --- |
| A step never says what changed in the model | Lantern's per-step state diff; Python Tutor and Aquascope redraw memory and mark the executed line |
| The last step is a dead end: Next is disabled | Seeing Theory's "Next" card; the Svelte tutorial's next lesson; Stories roll on |
| No shortcut or gesture is taught | reveal.js's controls tutorial; Lantern and Motion Canvas show keys in tooltips |
| A host page can neither hear nor drive steps | Scrollama's step callbacks; reveal.js's postMessage API; Lantern's `lantern:step` event |
| The steps list has no pictures | reveal.js's overview grid; Motion Canvas's slide panel |

## 2. Constraints that do not move

- The page makes no runtime network requests and uses no storage or cookies (`specs/rayner.md`). A "show once" hint is therefore impossible; G3 uses a permanent, quiet hint instead.
- The CSP stays strict: every inline script and style hashed, `img-src data:` only.
- Nothing is drawn over the stage.
- The reader sets the pace: no autoplay, no timer, no tap zones or swipes on the picture (they clash with pan and zoom and have no screen-reader equivalent).
- No Replay button: Previous then Next replays a step (`specs/player-redesign.md` §3).
- The layout must not move between steps (`reserve()` and the test "the transcript does not move between steps").
- `app/embed.css` may grow by at most 1.5 KiB gzip over `feature/player-tile`.

## 3. Decisions (settled)

1. "What changed" shows only the state an author names for readers, through `meta.watch`. Raw state is developer data (walk records, hashes, internal counters) and is never shown wholesale. A scene without `meta.watch` shows nothing new.
2. At the last step, Next becomes **Start again**, and a scene with settings also offers **Try another case**.
3. Shortcuts are taught by tooltips and `aria-keyshortcuts`, and by one permanent, muted line in the footer. No new global keys.
4. The host-page API is two `postMessage` types, sent and accepted only under the same origin and window rules as the resize message, plus a DOM event and a `goTo` method from the loader.
5. Thumbnails are drawn in the reader's browser from the snapshots the page already carries. They add no bytes to the page. They appear only in the wide rail, only after the player is ready, only in idle time, and are dropped if they cost too much (G5).

## 4. Requirements

### G1. What changed

**Authoring.** Add an optional `watch` to `meta` in `explain/settings.ts`: a record from a state key to its reader-facing label, `watch?: Readonly<Record<string, string>>`. The label is in the scene's language. Validate at collection time (where other `meta` is validated): keys are non-empty strings, labels non-empty after trimming, at most 8 entries; a key never present in any step's state in any case is an error naming the key.

**What counts as a change.** For step *i*, a watched key changed when its JSON differs between `trace.steps[i].before` and `.after` (as `explain/describe.ts` decides `changed`). Show at most four changes, in `watch` declaration order.

**Formatting.** One function, shared by the player, the static transcript and `describeExplainer`, in `explain/trace.ts` (e.g. `watchedChanges(step, watch, lang) → {label, before?, after}[]`):
- number: `Intl.NumberFormat(lang, { maximumFractionDigits: 2 })`;
- string: as is, cut to 24 characters with an ellipsis;
- boolean: the chrome's `yes`/`no` (new strings);
- array of numbers, strings or booleans: its items formatted as above, joined with ", ", at most 4 items then "+n";
- `null`, `undefined` or absent: no value (a key that appears reads "Tokens: 5"; one that changes reads "Tokens: 5 → 0"; one that disappears reads "Tokens: removed", a new string);
- any other value (objects, arrays of objects): the key is skipped for that step, and `check` reports it (see below).

**Player.** Under the caption, inside `.words`, a `p.changes` row: a visually quiet label `t.changed` ("What changed" / "Ce qui a changé") followed by the changes as `<span class="change">` items, each "Label: before → after". It is plain text in the DOM (not a live region; the caption already announces the step). `reserve()` measures the row for every step with a ruler, as it does the caption, so the row's height never moves what follows. A step with no watched change shows no row but keeps the reserved room. Use `--line`/`--muted` and the 8 px inner radius from the tile; no new colours.

**Transcript.** Each step's transcript item gains a paragraph "What changed: Label: before → after; …" after its caption, built in `tools/lib/explain-build.ts` with the same function, so a page without JavaScript and an agent reading the HTML see it.

**describeExplainer.** Each step gains `watched: {label, before?, after?}[]` (formatted strings) when the scene declares `watch`; `schema` stays 1 (an added field).

**check.** Add `watch` to `report.json` per case: for each step, the formatted changes, and `unformatted`: watched keys skipped because their value is not formattable. Reported, not gated.

**Catalog.** Declare `watch` on these scenes, choosing keys a reader would recognise from the caption:
- `token-bucket`: `tokens`, `allowed`, `rejected`;
- `mr-cache`: `databaseReads`, `request`, `reads`;
- `quotient-familial` (French labels): `rni`, `parts`, `quotient`, `impot`.

Read each scene's captions first and pick labels that match their wording. If a listed key does not exist or does not read well, choose a better one from the same scene and say so in the report.

Acceptance:
- token-bucket's "burst" step shows "Tokens: 5 → 0", "Allowed: 0 → 5" and "Rejected: R6" (or the labels you chose), in the player, in the transcript and in `describe.json`.
- A scene without `watch` (e.g. exgit) has no `.changes` row and no "What changed" in its transcript.
- The transcript-does-not-move test still passes on token-bucket at 1180 and 390 px.
- Collection fails with a clear message on an unknown watched key.

### G2. Where to go after the last step

At rest on the last step:
- Next keeps its place and its primary style; its visible text becomes `t.startAgain` ("Start again" / "Recommencer"), its accessible name `t.startAgainLabel` ("Start again from step 1" / "Recommencer à l’étape 1"), its icon a return arrow (add `restart` to `app/embed-icons.ts`: `M4 12a8 8 0 1 0 2.34-5.66`, `M4 4v4h4`). Pressing it calls `show(0)` (pushing history, as a step click does). It is enabled.
- If the scene has settings, a secondary `button.button` `t.tryCase(label)` ("Try ‘Cache miss’" / "Essayer « Cache miss »") appears in the stepper row immediately after Next. It switches to the next option of the first setting, wrapping, keeping other settings, at step 0 (`load(..., first step, true)`). Its accessible name is the same text. It is removed when the reader leaves the last step.
- Pressing Next while the last step plays rests it, as today; the change of label happens only at rest.
- ArrowRight at the last step does nothing (no wrap). Home/End in the step bar are unchanged.
- The step bar, rail and lede are unchanged.
- In a frame, the footer's "Open the explainer" stays where it is; it is not duplicated.

Acceptance: at mr-cache's last step, Next reads "Start again", is enabled, and returns to step 1; "Try ‘Cache miss’" appears and loads the miss case at step 1; leaving the last step restores Next and removes the case button; exgit (one case) shows Start again and no case button. Update the reader model so `nextDisabled` becomes "Next is Start again" at the last step, and add `StartAgain` and `TryCase` commands.

### G3. Teach the controls

- Every control with a key gets the key in its tooltip and an `aria-keyshortcuts` attribute: Previous "Previous step (←)" / `ArrowLeft`; Next "Next step (→)" / `ArrowRight`; Zoom in "(+)" / `+`; Zoom out "(−)" / `-`; Whole picture "(0)" / `0`. Accessible names (`aria-label`) do not change; tooltips are `title`. Mirror the arrows on a right-to-left page's tooltip only if the root handler mirrors them (it does not today, so it does not).
- The footer gains one muted, permanent line between the mark and the way out: on a fine pointer `t.hintKeys` ("← → to step · click a segment to jump"); on a coarse pointer `t.hintTouch` ("Tap a segment to jump; tap the current one to finish it"). Choose with `matchMedia('(pointer: coarse)')` at mount and on change. It wraps on a narrow card and never pushes the mark or the way out off the row; at ≤ 360 px wide it may be hidden.
- `t.hintKeys` and `t.hintTouch` exist in English and French.

Acceptance: tooltips and `aria-keyshortcuts` on all five controls in both languages; the footer hint present on every catalog page, the touch text under `hasTouch` + coarse pointer emulation; the crop test (T12) still passes.

### G4. Host-page API

**Page → host.** When framed with a valid `parentOrigin` (exactly the condition `reportHeight` uses), the page posts on every settled step (where it dispatches `rayner:step` today):
`{ type: 'rayner:step', version: 1, step: string, index: number, total: number, settings: Record<string,string> }` to `parentOrigin`. No captions or other content.

**Host → page.** The page listens for `message` and accepts only events whose `origin` equals `parentOrigin` and whose `source` is `window.parent`, with data `{ type: 'rayner:goto', version: 1, step?: string, settings?: Record<string,string> }`. It validates the step and settings exactly as URL parameters are validated (unknown values fall back with the same notice). Host-driven navigation replaces the iframe's history entry rather than pushing one. Any other message is ignored. Put the parsing and validation in `app/embed-protocol.ts` beside `resizeHeight`, as pure functions with unit tests.

**Loader.** `mountExplainer`:
- accepts `rayner:step` messages under the same origin-and-window rule as resize, and dispatches `new CustomEvent('rayner:step', { bubbles: true, detail })` on the iframe element, and calls `options.onStep?.(detail)`;
- returns the dispose function with a `goTo(step?: string, settings?: Record<string,string>)` method attached, which posts `rayner:goto` to the artifact's origin. The return type is `(() => void) & { goTo(...): void }`, so existing callers keep working.
- The script-tag form (`data-src`) also dispatches the event on the iframe.

**Docs.** `docs/PUBLISHING.md` gains "Drive an explainer from the host page" with a short example (a host button calling `goTo('request', { request: 'miss' })`, and a listener logging `rayner:step`). `docs/REFERENCE.md` §Embedding documents both message types. Update the bullet in `specs/rayner.md` that says the resize message carries only a height: it still does; the step message carries only the step and settings.

Acceptance:
- In the two-embed host test, clicking a host button that calls `goTo` on embed A moves only A, and A's `rayner:step` reaches the host once per settled step with the right `index` and `total`; B is unaffected.
- A `rayner:goto` posted from another origin, or from a window that is not the parent, does nothing (test both).
- A raw iframe without `parentOrigin` neither posts nor accepts messages.
- `dispose()` removes the listener; `goTo` after dispose does nothing.

### G5. Pictures in the steps list

**Where.** Only in the wide rail (`aside.rail`, ≥ 1100 px). Each `.steps` item gains a 16:9 thumbnail, 80 px wide, at the inline end, top-aligned, with the tile's 8 px radius and a 1 px `--line` ring. The narrow "All n steps" disclosure gets none, to spare phones the work.

**How.** After `#content[data-ready]` and the first step has settled, render each step's resting picture of the current case to an SVG string with the engine already in the bundle (`renderAt` into a `SnapshotSink`, or the cheapest equivalent the player already uses for close-ups), and set it as an `<img alt="" decoding="async" src="data:image/svg+xml;utf8,…">` (CSP allows `img-src data:`). One step per `requestIdleCallback` (fall back to `setTimeout(…, 50)` where it is missing), starting with the steps nearest the current one, never while a step is playing, and only while the rail is visible. Cache per case; discard on case change. The image is decorative (`alt=""`); the item's text already names the step.

**Budget, measured, with a stop rule.** Measure with `tools/lib/bench-measure.ts`'s CPU throttling at 4× on mr-cache (4 steps), token-bucket and quotient-familial (10 steps), at 1280 × 800:
- `data-ready` and the first Next must be no slower than without thumbnails (compare medians of 5 runs; within 5 %);
- no single thumbnail task may exceed 50 ms of main-thread time at 4×;
- all thumbnails of one case within 3 s of idle time at 4×.
If any page fails these after a reasonable attempt (e.g. reusing work already done for close-ups, downscaling the SVG by stripping hidden elements), remove G5 entirely, leave the rail as it is, and report the measurements. Do not put it behind a setting.

Acceptance: thumbnails appear in the wide rail on all three pages and match each step's resting picture (compare against the stage after `show(i)`); none appear at 390 px; the budget numbers are in the report.

### G6. Strings

Add to `Chrome` in both languages: `changed`, `yes`, `no`, `removed`, `startAgain`, `startAgainLabel`, `tryCase(label)`, `hintKeys`, `hintTouch`. French uses the narrow no-break space before `:` and inside « ». `explain-lang` asserts both languages.

### G7. Accessibility, keyboard, motion, RTL

- The changes row is plain text, read with the words; the Start again and Try buttons are real buttons in the Tab order after Next; the hint is text, not a tooltip.
- Reduced motion: no new motion. Thumbnails do not animate.
- RTL: the changes row, the hint and the thumbnails use logical properties; check with `dir="rtl"` forced on mr-cache, as before.

### G8. Docs, evidence, tests

- `docs/REFERENCE.md`: `meta.watch`, the changes row, the transcript line, `watched` in describe, `watch` in the check report; the end state; the tooltips and hint; the host API; the thumbnails.
- `skills/rayner-explainers/SKILL.md`: one bullet under "Lessons from the player" on `meta.watch` (name what a reader should track; keep it to a few keys).
- `CHANGELOG.md`: one entry.
- `docs/evidence/player-guidance/`: captures of token-bucket's burst step (changes row), mr-cache's last step (Start again and Try), the footer hint at 1280 and 390, the wide rail with thumbnails, and the bench numbers for G5.
- Tests named in each G section, in `test/explain-embed.test.ts`, `test/explain-lang.test.ts`, the protocol unit tests, a unit test for the formatting function covering every value kind, and a `collectProject` test for `meta.watch` validation.

## 5. Order of work and reporting

Work on a branch `feature/player-guidance` cut from `feature/player-tile` **after** it has been updated with `main` (the parent session will tell you the commit; if `origin/feature/player-tile` already contains a merge of `main` with the commit "Remove whole-page output pins", start from it). The whole-page output pin test no longer exists on `main`; do not regenerate any pin.

Commit in this order, each commit green on `npm run check` and `npm test`:
1. G1 (watch: type, validation, formatting, player row, transcript, describe, check, catalog).
2. G2 and the G6 strings it needs.
3. G3.
4. G4.
5. G5, or its removal with measurements.
6. G8 docs and evidence.

Push the branch. Do not open a pull request.

Report: what was built against each G-number; the keys and labels chosen for each catalog scene; whether G5 shipped, with its measurements; the gzip delta of `app/embed.css` against `feature/player-tile`; the summary lines of `npm run check`, `npm test`, `npm run test:embeds`, `npm run demos:check`, `npm run check:budgets` and `npm run pack:smoke`; what could not run here (WebKit, Safari); tests rewritten rather than added; anything left out and why.

## 6. Not in this change

A Play control; free exploration of inputs beyond the declared cases; thumbnails on phones; a scroll-driven host integration library (the API makes one possible; building it is separate).
