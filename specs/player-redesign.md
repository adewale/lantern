# Player redesign: the stepper shows where the reader is

Status: requirements, ready to implement. Mock: [`specs/player-redesign.mock.html`](player-redesign.mock.html) (open it in a browser; the tags R1 to R7 in it refer to the sections below). The reasoning behind the design is in §2; the decisions in §3 are settled and are not to be reopened during implementation.

This document is written for an implementing agent. It assumes you have read `app/embed.ts`, `app/embed.css`, `app/embed-strings.ts`, `app/embed-closeup.ts`, `docs/REFERENCE.md` §Player (the paragraphs that begin "**Next** plays the step" and "The stage takes focus"), `docs/TESTING.md`, and the section "Reader settings" of `specs/rayner.md`. The sentence that governs everything here is from that spec: *the author decides the order of ideas and the reader decides the pace.* The player stops after every step. This redesign does not change that.

## 1. Context

### 1.1 What the player is

A built explainer is one HTML page. `tools/lib/explain-build.ts` writes a static shell: `<main id="content">` with an `<h1>`, a `.stage.poster` holding the first step's SVG, a `.caption`, and `<details class="transcript" open>` with every case's steps as links, and inlines `app/embed.css` and the player script. On load, `mountEmbed()` in `app/embed.ts` replaces the shell's children with the live player: `head` (title and case selector), `player` (stage, transport row, words, controls; line 11 describes today's code), `steps` (the list), the `transcript`, and a `standalone` link when framed. Without JavaScript the transcript stays readable.

Everything the player shows about a step comes from the trace (`traceScene`, `src/trace.ts`). Each `trace.steps[i]` has `step` (its name), `t0`, `t1`, `hold` (when the caption-reading hold began; the player stops there), `frame0`/`frame1`, `meta` (`title`, `line`, `caption`), `before` and `after` (the scene's `state`). `stepWords(step)` in `explain/trace.ts` gives `{ title, line, caption }`. `describeExplainer` in `explain/describe.ts` already computes `changed` per step from `before`/`after`. No engine change is needed for anything below.

### 1.2 How the current player is put together

Read `app/embed.ts` top to bottom once. The functions that matter here:

| Function | Role |
| --- | --- |
| `mountEmbed` | Builds the DOM once; everything below is a closure inside it |
| `chrome()` | Writes the current step into the DOM: caption, lede, disabled states of Prev/Next, `aria-current` on the list, stage label, description, replay icon |
| `show(index, push)` | Jump to a step's resting picture (no animation) |
| `advance()` | Next: plays the step from its first frame to its `hold`, then rests |
| `animate(force)` | Runs a prepared `Run`, or Replay |
| `prepare(at, first)` | The `Run`: a scene run parked at a step's first frame; its `frame(scene, dt)` sink is where scene time is visible while a step plays |
| `primeNext()` | Pre-runs the scene to the next step so Next starts at once |
| `load(request, step, push)` | Switch case; rebuilds the `steps` list; calls `reserve()` and `show()` |
| `reserve()` | Measures every step's caption and lede with hidden rulers and sets `min-height` so the layout below does not move between steps |
| `drawOverview()` / `refreshTour()` / `framing()` | Narrow-stage close-ups, the view count, Next view, the corner map |
| `link()` / `urlFor()` | Address bar follows the step (`?step=`, settings) |

DOM order today (`player.append(...)` then `root.replaceChildren(...)`):

```
header.head        h1, fieldset.case × settings
section.player     div.step-transport (Prev, "Next step")   ← added in PR #54 because Next was 850 px down
                   div.frame > div.stage
                   div.view-controls (narrow only; inserted after .controls at runtime, see controls.after(views))
                   p.lede (narrow only), p.caption, nav.controls (Prev, "Next", div.tools), details.described, p.notice, …rulers
ol.steps           one button per step, data-step, aria-current
details.transcript
a.standalone       when framed
```

### 1.3 Selectors that tests and tools depend on

Change these deliberately and update every user in the same commit. Found with `grep -rn` over `test/` and `tools/`:

| Selector or name | Where it is used | Decision |
| --- | --- | --- |
| `.step-transport` + button named `Next step` (exact) | `tools/explain-package-smoke.ts:77`, `test/reader-cross-browser.test.ts:55` | Rename the one remaining row to `.stepper`, and update both call sites to `page.getByRole('button', { name: 'Next step', exact: true })` with no container; after R2 that matches exactly one element |
| `[aria-current=step]` with `data-step` | `tools/explain-package-smoke.ts:78`, `test/reader-cross-browser.test.ts:56,117` | Keep. Both the step bar's segment and the rail item carry `aria-current="step"` and `data-step`; `querySelector` returns the first (the segment), which has the same `data-step` |
| `.controls .primary` | `test/reader-cross-browser.test.ts:118`, `tools/lib/bench-measure.ts:61` | Rename: `.stepper .primary`; update both |
| `.steps button` with `dataset.step` | `tools/lib/bench-measure.ts:58,64` | Keep `.steps button` and `data-step` on the rail. `bench-measure` runs at 390 px where the rail is inside a closed `<details>` (R5), so change its clicks (line 64) to `.step-bar button` and keep line 58's name read from `.steps button` |
| `.caption` | smoke `:79,82,93,219,225`, cross-browser `:123`, `tools/lib/explain-build.ts` RTL rule | Keep one `.caption` on the page |
| `.described`, `.view-help`, button `Next view` | cross-browser `:53,54,127,129` | Keep |
| `[data-ready=true]`, `rayner:step` event | cross-browser `:87,134`; `tools/lib/bench-measure.ts:31` | Keep, unchanged |
| Buttons named `Fit stage` | `test/explain-embed.test.ts:127,411,450-459,726`, and the model-based commands at `:1005-1014` (`ZoomButton`) | Rename to `Whole picture` everywhere; the `fitHidden` observation at `:726` reads the Whole picture button |
| Button named `Replay step` | `test/explain-embed.test.ts:1032-1033` (`Replay` command) and the comment at `:592` | Delete the `Replay` command and its model effects; the comment describes Next only |
| RTL rule in `tools/lib/explain-build.ts:23` lists `h1,.caption,.ruler,.transcript h2,.transcript a,.transcript p,.steps button span` | right-to-left pages | Add `.lede,.lede *,.steps .line` (any new text element) |

### 1.4 Checks you must keep green

```sh
npm run check          # tsc -b, vendor copy, consumer types
npm test               # unit and property tests
npm run test:embeds    # real Chromium reader tests (needs Chromium; set CHROMIUM_EXECUTABLE_PATH if outside Playwright's cache)
npm run demos:check    # builds and checks the catalog
npm run check:budgets  # after demos:check: 1.5 MiB raw / 450 KiB gzip per page, plus timing samples
```

`test/reader-cross-browser.test.ts` is a macOS Safari lane; update its selectors but you cannot run it here. Say so in the report.

## 2. The problems, and why Lantern's timeline reads better

Evidence: `docs/evidence/explainer-step-navigation/*.jpg` (current player at 1280×800 and 390×568) and `docs/evidence/reader-story/after-mr-cache.png` (current player at 1180 wide, step 3). Lantern's player, which this repository forked from and then deleted, is `app/player.ts` and `app/player.css` in [ivarvong/lantern](https://github.com/ivarvong/lantern).

- **P1. Position and extent are invisible while reading.** On desktop the only step number is the one the author draws inside the picture, and nothing says how many steps there are. The steps list is below the caption and the "What the picture shows" disclosure; at 1280×800 it is below the fold. Lantern shows ticks for every step on a bar beside Prev and Next, and "Step 03 / 07" above the current step's details, so position and extent are visible at the moment of reading.
- **P2. Two Next buttons** with two labels ("Next step" above the stage, "Next" below). PR #54 added the upper one because the lower one was 850 px down. The duplication treats the symptom.
- **P3. The controls do not belong to the stage.** The upper transport floats under the title; the lower row mixes step navigation with zoom, replay, copy and enlarge. Lantern draws stage, caption and transport as one card.
- **P4. The steps list is a table of contents, not a timeline.** Titles only; no sign of what each step changes or how it relates to the picture, although `meta.line` and `before`/`after` exist for every step.
- **P5. The layout fights itself.** `reserve()`, the rulers and the hidden bold copy exist because a variable-height caption and a list sit in the flow between the stage and the transcript, and bolding the current title changes its width.

### 2.1 The metaphor, and the vestiges to remove

The player is a **narrated slide build**: the author orders the steps, the reader sets the pace, and every step ends on a resting picture with its caption. Motion is the transition between two resting pictures and explains the change; it is not content with a clock. For position and extent the design borrows the **stories pattern** (Instagram, Snapchat): one segment per step, the current one filling as it plays, a tap on a segment to jump, an optional auto-advance later (§6). Stories fit because they too are author-ordered, reader-paced and made of pieces that rest on a frame, and their segments count without a clock.

Lantern was a video player, and the fork kept its vocabulary after removing its clock. These vestiges go in this change:

| Vestige | Why it goes | Replacement |
| --- | --- | --- |
| **Replay step** button, and its **Stop animation** state | A video control. Redundant: Prev then Next plays a step again. Its stop role moves to the step bar | Removed. Tapping the current segment while its step plays rests the picture at once (R3) |
| **Fit stage** | "Stage" is theatre vocabulary and the same action already has a reader's name on phones, **Whole picture** | One button, named Whole picture, in the tools (R6); the second Whole picture button in the view row goes (R7) |
| `transport`, `.step-transport`, `nav.controls` | Tape-deck names for the row of controls | `div.stepper` (R1) |
| `Chrome.fit`, `Chrome.replay`, `Chrome.stop` | Strings for the removed controls | Deleted (R8) |

What stays, deliberately: **Enlarge** (a picture enlarges; not a video word), **Copy link** (stories share too), the zoom buttons (a map affordance for small labels, with keyboard equivalents), and the internal names `.player` and `.stage`, which readers never see and which tests, tools and the fullscreen rules use throughout. Renaming those is churn without reader value and is out of scope.

What **not** to take from Lantern: its scrubber is a time seek bar because Lantern plays continuously. Rayner stops at every step on purpose, and step durations are animation lengths, not importance. A seek bar would promise video playback the player does not offer. Its monospace step identifiers and raw `key: value` chips are developer readouts; Rayner's readers get titles and sentences.

## 3. Decisions (settled)

1. No time-based scrubber. The timeline is a **step bar**: one equal-width segment per step.
2. No autoplay in this change. "Play through, pausing at each hold" is Phase 2 (§6) and is not to be built now.
3. The rail (the steps list) goes **beside** the card at wide widths and **under the card, inside a closed `<details>`**, at narrow widths. The step bar carries position on phones.
4. The visible word on Next stays **"Next"**; its accessible name stays **"Next step"**. Prev stays icon-only, named "Previous step".
5. Content width grows from 1080 px to **1240 px** so the card and the rail fit side by side; the stage is capped by viewport height (R2) so it does not simply get wider.
6. The author-drawn heading inside the picture (`stage()`'s `numbered` option) is untouched. The text heading under the picture (R4) is in addition to it, as it already is on phones.
7. The rail marks the current step by colour and a filled number, **not by bold**, so metrics do not change and the hidden bold copy goes.
8. The caption rulers (`reserve()`) stay: the caption and the lede still vary in height between steps and the transcript below must not move.
9. The metaphor is the narrated slide build of §2.1; the step bar is the stories pattern. Replay, Stop and "Fit stage" are removed, not renamed and kept.
10. The reader replays a step with Prev then Next. No control is added to replace Replay.

## 4. Requirements

Each requirement has acceptance criteria. "Stepper row" means `div.stepper`, the row of Prev, Next, the step bar and the tools. "Viewports" below means the set {320×568, 390×568, 390×844, 768×1024, 1280×800, 1440×900} unless narrowed. "Mock" means `specs/player-redesign.mock.html`.

### R1. One player card

The picture, the stepper row, the view row (narrow only) and the words are one bordered surface.

DOM, in order, inside `section.player`:

```
div.frame > div.stage[role=img]          the picture (unchanged inside)
div.stepper[role=group][aria-label=t.controls]
    button.button.icon  Prev            aria-label t.previous
    button.button.primary  Next          aria-label t.nextLabel, visible text t.next; Prev and Next stay adjacent at the inline start, where the current player has them
    ol.step-bar                          R3, fills the room between Next and the tools
    div.tools[role=group][aria-label=t.viewTools]   zoomOut, zoomIn, wholePicture (hidden until zoomed), closer (narrow), copy, enlarge   R6
div.view-controls                        narrow only, unchanged behaviour (R7); moved here from after .controls
div.words
    p.lede                               R4
    p.caption[aria-live=polite]
    details.described
p.notice[role=status]
p#picture-summary (hidden), rulers       unchanged
```

Styling: `.player { border-radius: 12px; background: var(--surface); box-shadow: 0 0 0 1px var(--line) }`; the stage keeps its paper background and gets the top radius; `.stepper` has `border-top: 1px solid var(--line)`; `.words` has padding 14px 16px 16px. See the mock's `.player`, `.stepper`, `.words` rules.

Delete `transport`/`earlyPrev`/`earlyNext` (the upper row) and `nav.controls`; the one `div.stepper` takes their handlers. Delete `replay`, its `onclick` and the `setIcon(replay, …)` line in `chrome()`. Rename `zoomFit` to `wholePicture` and name it `t.wholePicture`; delete the separate `wholePicture` button of the view row. `chrome()` disables one Prev and one Next.

Acceptance:
- `document.querySelectorAll('button[aria-label="Next step"]').length === 1` and likewise for "Previous step" in every built page (English pages; use `t.nextLabel` for French).
- `.player` contains `.stage`, `.stepper`, `.words` in that order.
- No button named `Replay step`, `Stop animation` or `Fit stage` exists on any page; exactly one is named `Whole picture`.
- `npm run check:budgets` passes; `app/embed.css` grows by at most 3 KiB gzip over `main` (measure with `gzip -c app/embed.css | wc -c` before and after).

### R2. The stage fits the viewport, so one stepper row is enough

Outside fullscreen the stage is never taller than the viewport less the room the stepper row and the first line of the words need:

```css
.player { --player-reserve: 300px }           /* head ≈ 100 + stepper row 60 + lede/caption first lines ≈ 90 + paddings */
.frame  { width: min(100%, calc((100dvh - var(--player-reserve)) * 16 / 9)); margin: 0 }
```

Tune `--player-reserve` so the acceptance below holds; document the final value in a CSS comment. The frame is left-aligned in the card (logical start); the card's words and stepper row span the full card width regardless. When `.frame` is narrower than the card, the strip beside the stage is the card's surface, not paper. If that looks wrong in practice, cap the whole card instead (`.player { width: min(100%, …) }`) and let the rail take the remaining width; either is acceptable, pick one and say which in the report.

The fullscreen rules in `embed.css` (`.player:fullscreen …`) now size the card's children rather than each piece separately; keep the stage within `100dvh - 180px` there as today. The `.lede` is visible in fullscreen too.

Acceptance:
- At every viewport, for `out/explainers/mr-cache.html?step=before&request=hit` and `out/explainers/oauth-pkce.html?attacker=yes` opened fresh (scrollY = 0, after `[data-ready=true]`), the Next button's `getBoundingClientRect()` is entirely inside the viewport.
- At 1280×800 and 1440×900 the same holds for the whole `.lede` (the step heading).
- At 390×844 the same holds for the stage, the stepper row and the first line of the caption (`caption.getBoundingClientRect().top + 24 <= innerHeight`).
- `document.documentElement.scrollWidth <= innerWidth` at every viewport (no horizontal scroll).
- `reportHeight` (`app/embed-protocol.ts`) still posts changed heights; `test/embed-report-height.property.test.ts` passes.

### R3. The step bar

One segment per step of the current case, after the Prev/Next pair, filling the width between Next and the tools. Next keeps a fixed place at the start of the row, so the reader's hand returns to the same spot at every width. It is a stepper's timeline: it shows extent, position and the motion of the current step, and it never pretends to be a seek bar.

Markup, rebuilt in `load()` beside the rail:

```html
<ol class="step-bar" aria-label="{t.stepBar}">
  <li><button type="button" data-step="before" data-state="done" tabindex="-1"
              title="{title}" aria-label="{t.stepOf(1, 4, title)}"></button></li>
  <li><button type="button" data-step="after" data-state="current" aria-current="step"
              title="{title}" aria-label="{t.stepOf(3, 4, title)}" style="--progress:1"><span class="fill"></span></button></li>
  …
</ol>
```

Behaviour:
- `data-state` is `done` for steps before the current, `current` for the current, `todo` after. `chrome()` sets it, and `aria-current`, on every change of `selected`.
- Click or tap a segment: `show(i)` (same as the rail). Hover shows the title via `title`.
- **Fill.** The current segment has `--progress` from 0 to 1. While a step plays (`prepare()`'s `frame` sink, after `attach`), set `--progress = clamp((scene.time - aim.start) / (aim.end - aim.start), 0, 1)` on the current segment, no more often than once per animation frame (write it from the same `requestAnimationFrame` cadence the `ReaderSink` paints on, or throttle with a flag). When the run rests, or on `show()`, or with reduced motion, `--progress` is 1. When Next is pressed mid-motion and the run follows to the next step, the segment that was current becomes `done` and the new one starts at 0.
- **Tap to rest (the stories skip).** Pressing the current segment while its step plays rests the picture at once. This is the path `animate()` already has for the old Stop (`if (playing && !force) return show(selected, false)`); call it from the segment's click when `data-state === 'current'` and `playing`. When the step is at rest, pressing the current segment does nothing.
- **Keyboard.** Roving tabindex: only the current segment is in the tab order (`tabindex="0"`), the others `tabindex="-1"`. With focus inside the bar, ArrowLeft/ArrowRight go to the previous/next step (reuse `show`/`advance`) and move focus to the new current segment; Home/End go to the first/last step. The root keydown handler already returns early for `BUTTON`, so handle these on the bar itself. The existing root arrows (Left/Right change step unless on a control) are unchanged.
- **Geometry.** Each segment's hit area is the full row height (minimum 40px, 44px on coarse pointers); the visible mark is a 6px bar centred vertically, 8px for the current one, radius 3px, 3px gaps. With ten steps in a 390px row each segment is about 24px wide; that is the smallest case in the catalog (quotient-familial has 10 steps, traffic-policy 9; `grep -c "await this.step(" scenes/explainers/*/scene.ts`). Never show text inside a segment.
- **Colour.** `done`: `var(--accent)`. `current`: track `color-mix(in srgb, var(--accent) 28%, var(--surface))`, fill `var(--accent)`. `todo`: `color-mix(in srgb, var(--muted) 55%, var(--surface))`, which must contrast at least 3:1 with `var(--surface)` in both themes (check with a contrast tool; adjust the mix, not the tokens).
- **Direction.** Use logical properties (`inset-inline-start`, `inline-size`) so the fill grows from the reading start on right-to-left pages (the `layout-direction` explainer builds one).
- **Reduced motion.** No `transition` on the fill; `--progress` jumps to 1.

Acceptance:
- For every case of every catalog explainer, `.step-bar button` count equals `trace.steps.length` for that case; switching the case rebuilds it.
- Clicking segment *i* makes `[aria-current=step]` carry step *i*'s `data-step` and the caption show step *i*'s caption (test with mr-cache, which has distinct captions).
- After `show(k)`, segments `< k` have `data-state="done"`, `k` `current`, `> k` `todo`; the current segment's `--progress` computed value is `1`.
- During `advance()` from step 1 to 2 on mr-cache (no reduced motion), `--progress` on step 2's segment takes at least one value strictly between 0 and 1 before the `rayner:step` event fires, and is 1 after it. (Read it with `getComputedStyle(el).getPropertyValue('--progress')` from a `MutationObserver` on `style`.)
- With `prefers-reduced-motion: reduce` emulated, `--progress` is 1 immediately after Next.
- Keyboard: focus the current segment, press ArrowRight, and `document.activeElement` is the new current segment with the step advanced.
- Press Next, then click the current segment while `--progress` is below 1: the picture rests (the `rayner:step` event fires, `--progress` is 1) without waiting for the animation to end.
- No horizontal overflow at 320px with the ten-step quotient-familial page.

### R4. The step heading on every width

Today `p.lede` shows "1. Title" and the line only when the stage is narrow. Now it is always shown, as the first child of `.words`:

```html
<p class="lede">
  <span class="kicker">{t.stepOf(3, 4)}</span>      <!-- "Step 3 of 4" -->
  <strong>{title}</strong>
  <span class="line" hidden?>{line}</span>
</p>
```

`fillLede()` writes all three; the kicker uses `t.stepOf(i, n)` (two-argument form, see R8). Drop the `.player.narrow .lede { display: block }` gate. `reserve()` keeps measuring the lede's title and line heights per step (it does already) and the caption; the kicker is one line and needs no reservation.

Acceptance:
- At 1280×800 the `.lede` is visible (`offsetParent !== null`) and reads "Step 1 of 4" followed by the title on mr-cache's first step; in French (`quotient-familial`, the one scene with `lang: 'fr'`) it reads "Étape 1 sur 10".
- Moving between steps of one case does not change `document.querySelector('.transcript').getBoundingClientRect().top` by more than 1px (the existing promise of `reserve()`, now including the kicker).

### R5. The rail beside the card

The steps list (`ol.steps`) becomes a rail that sits to the inline-end of the card when the page is wide and under it, inside a `<details>`, when it is not.

Layout:

```css
#content { max-width: 1240px }
.layout  { display: grid; gap: 24px; align-items: start }        /* wraps .player and .rail; new wrapper element */
@media (min-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr) 300px } }
.rail    { position: sticky; top: 16px; max-height: calc(100dvh - 32px); overflow: auto }   /* wide only */
```

Wide (≥ 1100px viewport): `aside.rail` with `h2` "Steps" (`t.stepList` as the `ol`'s `aria-label` as today; the visible `h2` is a new string `t.steps`, uppercase, small) and the `ol.steps`. Narrow: `details.rail` with `summary` `t.allSteps(n)` ("All 4 steps"), closed by default, holding the same `ol.steps`. Build the list once; move the `ol` between the two containers on resize (listen on the existing `ResizeObserver`), or render both containers and show one with `hidden`; either is fine. The `ol` must stay in the DOM at every width (tools read `.steps button`).

Items:

```html
<li><button type="button" data-step="…" data-state="done|current|todo" aria-current="step"?>
  <span class="title">{title}</span>
  <span class="line">{line}</span>        <!-- omitted when the step has no line -->
</button></li>
```

Current item: background `color-mix(in srgb, var(--accent) 10%, transparent)`, number circle filled with the accent. `done` items: circle outlined in the accent. No bold anywhere in the rail; remove the hidden `.bold` copy and its CSS. Rail text: title `.9375rem`, line `.8125rem` muted. Keep the CSS counter numbering.

When the current step changes and the rail scrolls on its own (wide), scroll the current item into view **within the rail only**, never the page (copy Lantern's approach: compare `offsetTop` against `scrollTop`, set `scrollTop`; do not call `scrollIntoView`).

Acceptance:
- At 1280×800 and 1440×900: `rail.getBoundingClientRect().left >= player.getBoundingClientRect().right` and the rail's top is within 2px of the card's top.
- At 390×844 and 768×1024: the rail is below the card and `details.rail.open === false` on load; `.steps button` exist in the DOM; opening the details and clicking a step changes the step.
- Changing step changes neither `window.scrollY` (wide) nor the card's position.
- Every rail item whose step has a `line` shows it; mr-cache's four do.

### R6. View tools, apart from step navigation

The tools (`zoomOut`, `zoomIn`, `wholePicture`, `closer`, `copy`, `enlarge`) sit at the inline end of the stepper row behind a 1px rule (`border-inline-start: 1px solid var(--line); padding-inline-start: 10px; margin-inline-start: auto`). When the row is narrower than 640px (use the stage width the player already measures in `narrow()` or a media query at 640px), `.tools` wraps to its own row (`flex-basis: 100%`), right-aligned, without the rule. `wholePicture` keeps the `visibility: hidden` trick (unseen until zoomed, its place reserved) so the row does not reflow when zoom changes. Give the group `role="group"` and `aria-label="{t.viewTools}"` ("View tools").

Acceptance:
- At 1280×800 the tools' bounding box is on the same row as Next (vertical overlap) and to its inline end.
- At 390×844 the tools' bounding box is below Next and no control is narrower than 44px.
- Zoom in, zoom out, Whole picture, copy link and enlarge behave as before; the existing `test/explain-embed.test.ts` cases pass with `Fit stage` renamed and the `Replay` command removed (§1.3).

### R7. Narrow behaviour is preserved

Close-ups (`follow`, `closer`), the view count, **Next view**, the corner map (`overview`) and `viewHelp` keep their behaviour and strings. The view row's own **Whole picture** button goes; the one in the tools (R6) does its job, and on a narrow stage it keeps the whole picture for later steps as Fit did (`whole()` sets `follow = false`). Their row (`div.view-controls`) moves inside the card, directly under the stepper row and above `.words`; today it is inserted after `.controls` at runtime (`controls.after(views)`), so change that call to insert after `.stepper`. Keep the `visibility: hidden` reservation logic in `drawOverview()` so the words do not move when a step has one view.

Acceptance: the existing narrow-stage tests (`test/embed-closeup.property.test.ts`, the close-up and Next view cases in `test/explain-embed.test.ts`, `tools/explain-review.ts` at 390px) pass; a `rayner review` run of oauth-pkce at 390px shows the view row under the stepper row in its screenshots.

### R8. Strings

Add to `Chrome` in `app/embed-strings.ts`, with both tables:

| Key | English | French |
| --- | --- | --- |
| `stepBar` | `Step progress` | `Progression des étapes` |
| `stepOf(i, n, title?)` | `Step 3 of 4`, and with a title `Step 3 of 4: Title` | `Étape 3 sur 4`, `Étape 3 sur 4 : Titre` (narrow no-break space before the colon, U+202F, as the file's other French strings do) |
| `steps` | `Steps` | `Étapes` |
| `allSteps(n)` | `All 4 steps` | `Les 4 étapes` |
| `viewTools` | `View tools` | `Outils d’affichage` |

Delete `fit`, `replay` and `stop` from `Chrome` and both tables; `wholePicture` names the one button. `controls` ("Steps"/"Étapes") remains the stepper row's group name. `test/explain-lang.test.ts` asserts a few chrome strings (`chromeFor('fr').transcript`, `.next`); add assertions for `stepOf` in both forms and `allSteps` in both languages.

### R9. Accessibility and motion

- Every control at least 40×40px, 44×44px under `(pointer: coarse)`, including segments (hit area, not the mark).
- `:focus-visible` outlines on segments (inset, since they are flush) and on everything else as today.
- `aria-current="step"` on the current segment and the current rail item; `aria-live="polite"` stays on the caption only (the kicker is not live; the caption already announces the change).
- `prefers-reduced-motion: reduce` disables the fill transition and the rail's background transition. With reduced motion a step never plays, so the current segment is never tappable-to-rest; nothing else changes.
- Colour contrast: `todo` segments ≥ 3:1 against the card surface in both themes; kicker and rail lines (muted on surface) ≥ 4.5:1, which the existing tokens give.

### R10. Right-to-left pages

Use logical properties throughout the new CSS. The stepper row order (Prev, Next, bar, tools) follows the document direction automatically with flex. Extend the RTL rule in `tools/lib/explain-build.ts` (§1.3). Build `layout-direction` and confirm by screenshot that the fill grows from the right and the rail sits on the left at 1280px.

### R11. Static shell, budgets and pins

- `tools/lib/explain-build.ts` keeps producing `h1`, `.stage.poster`, `.caption`, `.transcript`; the mounted player still replaces them. No change to the transcript's content.
- Budgets (`npm run check:budgets`) pass for every catalog page.
- The lettering baselines (`test/lettering-baseline*.json`) are not affected by chrome; if any pin fails, stop and report rather than regenerating, because `UPDATE_GOLDEN=1` is reserved for a separate reviewed commit (see `docs/evidence/reader-story/README.md` and the `Pin …` commits in `git log`).

### R12. Documentation and evidence

- `docs/REFERENCE.md` §Player: rewrite the two paragraphs that describe the controls ("**Next** plays the step…" and "The stage takes focus…") to describe the card, the step bar, the heading, the rail and the keyboard model in R3; remove "replay" and "fit (only while zoomed)" from the icon-button list and "**Whole picture** (or Fit)" becomes "**Whole picture**". Keep every statement there true of the code.
- `README.md`: the line "Phones use close-ups and a **Next view** tour" stays true; add nothing unless a claim became false.
- `CHANGELOG.md`: an entry under the unreleased heading.
- `docs/evidence/player-redesign/README.md` with before/after captures, in the format of `docs/evidence/explainer-step-navigation/README.md`: mr-cache `?step=before&request=hit` and `?step=after&request=hit`, oauth-pkce `?attacker=yes&step=attack`, quotient-familial at its sixth step, each at 390×844 and 1280×800, plus layout-direction at 1280×800. "Before" is a build of `main`; "after" is this branch. Record the Next button's top offset for each, as that README does.
- `specs/rayner.md` "Reader settings": add one sentence after "Previous, Next, the steps list and the keyboard all work on steps": "A step bar under the picture shows every step and fills as the current one plays; it is a stepper, not a seek bar."

### R13. Tests to add

Put browser tests in `test/explain-embed.test.ts` (the `EXPLAIN_BROWSER=1` lane) unless noted. Each criterion in R2 to R7 that names a viewport or a DOM state is a test; the list below names the ones that must exist, by name:

1. `one stepper row: exactly one Next step and one Previous step button`.
2. `the step bar has one segment per step of the current case and rebuilds on a case change` (mr-cache hit→miss; oauth-pkce attacker no→yes, where the step count changes).
3. `a segment jumps to its step` (aria-current, caption).
4. `segment states follow the selected step` (done/current/todo and `--progress` 1 at rest).
5. `the current segment fills while a step plays and is full when it rests`.
6. `reduced motion fills the segment at once`.
7. `arrow keys inside the step bar move the step and the focus`.
8. `Next is on screen at load` across the viewport set and both pages in R2.
9. `no horizontal overflow` at 320, 390, 768, 1280 for mr-cache and quotient-familial.
10. `the rail is beside the card when wide and under a closed details when narrow`.
11. `the step heading shows on every width with the total` (English and French).
12. `the transcript does not move between steps` (extends the existing reservation test if there is one; otherwise new).
13. `view tools share Next's row when wide and wrap below it when narrow`.
15. `no Replay, Stop or Fit stage button; one Whole picture button` on every catalog page.
16. `pressing the current segment while a step plays rests the picture`.
14. Update `tools/explain-package-smoke.ts`, `test/reader-cross-browser.test.ts` and `tools/lib/bench-measure.ts` per §1.3, and run the smoke with `npm run pack:smoke`.

A property test is not required for this change; the DOM is built from the trace one-to-one.

## 5. Order of work and reporting

Branch from `main`: `feature/player-step-bar`. Commit in this order so each commit builds and tests pass:

1. CSS and DOM restructure: R1, R2, R6, R7 (one stepper row, the card, the tools group, view row moved, Replay and Fit removed, strings deleted). Update the selectors in §1.3. Run `npm run check && npm test && npm run test:embeds`.
2. R4 heading, R8 strings.
3. R3 step bar, with its tests.
4. R5 rail and layout, with its tests. R10 RTL check.
5. R12 docs and evidence screenshots; R11 budgets.
6. Any pin that changed: stop, do not regenerate, report.

Report, at the end, in this shape: what was built against each R-number; the final `--player-reserve` value and the card-vs-frame choice in R2; the gzip delta of `app/embed.css`; the full output of the five checks in §1.4; which lanes could not run here (Safari) and what was changed in them untested; anything left out and why. Do not describe the design as improved; show the before/after captures and the measured offsets.

## 6. Phase 2, not in this change

**Play.** Replay step becomes Play: advance through the remaining steps, playing each and pausing for its caption-reading hold (`step.hold` to `step.t1`, which the engine records so a player can stop when the picture stops), then on to the next; any tap or key stops it. Lantern's "step mode" is the same idea inverted. Needs its own strings, a stop affordance, and a decision about whether the hold scales with caption length (the engine already holds by word count). Design it after the step bar has shipped and been looked at on real explainers.

**What changed, in the rail.** Each rail item could show the step's state changes in reader language from `changed` (`explain/describe.ts`). The state keys are author-chosen and are not consistently reader-facing (see the token-bucket renaming in `docs/evidence/reader-story/README.md`), so this needs an authoring convention first.
