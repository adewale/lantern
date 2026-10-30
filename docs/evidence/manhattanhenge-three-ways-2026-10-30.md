# One question, three explainers: Manhattanhenge, 30 October 2026

The prompt was [henge.nyc](https://henge.nyc/), a Manhattanhenge page that computes the right numbers and still fails as an explainer: it answers *when* with a countdown and five canyon cards, shows the one variable that does not decide anything (the sunset bearing from above) in a twelve-second autoplaying sweep that cannot be paused or stepped, and reconciles its seconds to the planetarium's minutes with a paragraph instead of a test. This record builds the explainer it should have been three times, with the same model, the same five steps and the same captions, and compares what each toolchain added and cost.

| | Rayner | Lantern (upstream, `d65fd1d`) | By hand |
| --- | --- | --- | --- |
| Artifact | [claude.ai/artifact/WczG6w1wPuysru2geUBjuL](https://claude.ai/artifact/WczG6w1wPuysru2geUBjuL) | [claude.ai/artifact/2mYtGXyaxWFx95VNfXbBc1](https://claude.ai/artifact/2mYtGXyaxWFx95VNfXbBc1) | [claude.ai/artifact/T78qG4mYgfA9RtimZNgK3k](https://claude.ai/artifact/T78qG4mYgfA9RtimZNgK3k) |
| Source | [`scenes/explainers/manhattanhenge/scene.ts`](../../scenes/explainers/manhattanhenge/scene.ts) | [`manhattanhenge-three-ways/lantern-scene.ts`](manhattanhenge-three-ways/lantern-scene.ts) | [`manhattanhenge-three-ways/by-hand.html`](manhattanhenge-three-ways/by-hand.html) |
| Scene or page code | 326 lines | 244 lines | 409 lines of HTML, CSS and JS |
| Cases | 4 (cycle × horizon) | 1 | 4, plus a six-evening dial inside step 4 |
| Page | 653 KiB, 252 KiB gzip | 675 KiB, 245 KiB gzip | 39 KiB, 12 KiB gzip |
| Animation per case | 150 s | 151 s | none |
| Checks run | `check`, `review` at 390 and 1180 px, fidelity test, model test | `verify:motion` | one screenshot pass at two widths |
| Reader controls | Next stops on each resting picture; cases; zoom; transcript | Autoplays; step mode is a toggle; Prev/Next replay from a step's start | Prev/Next, step list, arrow keys, settings, evening dial |

All three artifacts are private until shared.

## The explainer, from first principles

A reader arrives with a question. An explainer answers it by showing the mechanism, one idea at a time, in pictures that stay still while the reader reads, with every number taken from a model the author tested and every assumption named. Anything else is subtraction material.

The question is **why these evenings**. The mechanism has one deciding variable, which henge.nyc never draws: the altitude of the Sun's centre at the instant its compass bearing is 299.1°. So the five steps are:

1. **Grid.** The cross-streets point 29.1° north of due west. The Sun sets due west only at the equinoxes.
2. **Year.** The sunset bearing swings 63° over the year and is north of 299.1° only from 25 May to 17 July. On those evenings the Sun passes the street bearing while still up.
3. **Evening.** Looking west on one evening: the Sun slides down and to the right, 1° lower per 1° north. Its centre crosses 299.1° at one instant, at one altitude.
4. **Ladder.** The same crossing on six consecutive evenings: 0.19° to 0.20° higher each evening in May, lower in July. The disc goes from hidden to clear of the horizon in about three evenings.
5. **Names.** Half Sun is the evening whose crossing puts the centre nearest the horizon; Full Sun puts the lower edge there. Beside them, what the Hayden Planetarium published.

Everything henge.nyc shows that is not on that list was left out: the countdown, the five canyons, today's sunrise and noon, the AMNH residual paragraph, VSOP87, DE440 and Saemundsson in the running text. Sources go in `meta.sources` and a footer.

### The model, and the one thing it found

[`scenes/explainers/lib/manhattanhenge.ts`](../../scenes/explainers/lib/manhattanhenge.ts) is 211 lines: Meeus chapter 25 solar coordinates, altitude and azimuth, Saemundsson refraction, a bisection for the instant the bearing passes 299.1°, and the naming rule. [`validate-model.ts`](manhattanhenge-three-ways/validate-model.ts) checks it against two holdouts it was not fitted to:

| Check | Model | Published |
| --- | --- | --- |
| 30 Oct 2026 sunrise, noon, sunset (henge.nyc, VSOP87) | 7:24:05 AM, 12:39:34 PM, 5:54:32 PM | 7:24 AM, 12:39 PM, 5:54 PM |
| Crossing instants, 28 and 29 May, 11 and 12 Jul (henge.nyc, to the second) | 8:13:17, 8:12:45, 8:19:47, 8:20:32 PM | 8:13:16, 8:12:44, 8:19:46, 8:20:30 PM |
| Hayden Planetarium minutes (via CBS News, space.com, NYC Tourism) | same | 8:14, 8:13, 8:20, 8:21 PM |

The times are right to two seconds. The dates are the finding. The named evening depends on how high the visible western horizon is, and [`scan-horizons.ts`](manhattanhenge-three-ways/scan-horizons.ts) shows that no single horizon height reproduces all four published evenings under either a nearest-altitude rule or a threshold rule: the May pair needs a horizon about 0.4° high, the July pair about 0.7°. henge.nyc handles this with a sentence about "a small convention difference". The three explainers handle it by making the horizon a setting (flat or 0.5°) and saying in the last caption that the planetarium's minutes agree but its choice of evening cannot be derived from any one horizon. That caption is true in all four cases because the scene computes it; `test/lib/fidelity/manhattanhenge.ts` asserts every step's recorded state against the model, and `test/explain-models.test.ts` asserts the model against the holdouts.

## What each build was like

### Rayner

The checks earned their place. The first `check` run failed on 30 collisions I had not seen in the code: bearing labels off the bottom of the stage, the horizon line running through altitude labels, the chart's range dimension through its line labels, and a callout from step 3 persisting into steps 4 and 5 where it overlapped the new labels. `review` then confirmed every step of every case at phone and desktop width with no label under 12 px. The fidelity test made me record state at each step, which is what let the final caption be computed instead of typed.

Three things cost more than they should have:

- **Motion is the unit, but the resting picture is the product.** About forty lines of the scene are `FadeIn`, `FadeOut` and `Create` choreography that no reader asked for, and the page carries 150 seconds of it per case. The hand-built version has no animation at all and nothing is lost; the check's own vocabulary (`restingFrames`, `cardsAtRest`, "the picture must not move during the hold") already says the still frame is what matters.
- **Step-scoped annotations are an idiom you learn from failures.** A callout or dimension that belongs to one step must be removed at the start of the next, not the end of its own, or the check fails either the hold rule or the text rule. Nothing in the API says so; I found it by failing both.
- **Labels are checked, not placed.** Every collision was fixed by hand-nudging coordinates, and the Lantern and hand-built versions needed the same `clear()` function to keep date labels off the horizon line. The check knows where every label and connector is; it could move the label.

Smaller: the build is a full document, and publishing it as an artifact meant stripping the skeleton by hand (Lantern's `build --only` writes an `.artifact.html` beside the page). Everything ran on Node 22.22 although the README says 24. A passing `check` prints the whole report to the terminal. The chart's `Create(axes)` pops its number labels unless you know to pass `lagRatio`, and so does Lantern's.

### Lantern

The same author's engine has the same failure as the same author's site. The player calls `setPaused(false)` on load and on every Prev and Next, so the scene plays through unless the reader finds the step-mode toggle. The step heading is the step's *name* (`ladder`) and under it the state diff as JSON (`half: undefined → {"date":"26 May",…}`), which is an author's view, not a reader's; titles had to be drawn into the picture by hand and crossfaded between steps. There are no settings, so the countercase is gone and the horizon assumption is fixed in the caption.

Its verifier is good and stricter in places than Rayner's: it flagged the horizon line piercing callout text that Rayner's helpers protect with a backing plate, a connector touching the compass arc, and a 0.01 unit gap between "W" and its label. Its `shot` tool could not find this machine's Chromium (it expects `chrome-linux/`, the install has `chrome-linux64/`), so the contact sheet came from `renderAt` plus a Playwright rasterisation instead. The page loads Geist from Google Fonts at runtime; Rayner's page makes no requests.

### By hand

Fastest to build and to change, seventeen times smaller, and the only one with the interaction the explanation most wants: in step 4 the reader steps through the six evenings and watches the number and the disc move. Each step is a pure function from state to SVG, so there is no motion to verify and no snapshot to go stale; the model runs in the page, so the numbers cannot drift from it.

What it lacks is any judge but me. The two clipped labels were found by looking at one screenshot. Nothing measured label sizes at phone width, nothing checked that text stays off lines, there is no transcript and the figure is empty without JavaScript, and there is no receipt. The check pass that found 30 collisions in the Rayner scene would have found some in this page too, and did not run.

## Scores, with the warning they deserve

By the [editorial rubric](../EXPLAINER-RUBRIC.md), scored by the person who wrote all three, so this is a triage order and not evidence:

| | Q | P | V | B | G | E | Total | Why not 4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| By hand | 4 | 4 | 4 | 4 | 3 | 4 | 23 | G: no fidelity test or receipt; the model runs live but nothing asserts the drawing follows it |
| Rayner | 4 | 4 | 4 | 4 | 4 | 3 | 23 | E: 150 s of motion and a `line` under every title that mostly restates it |
| Lantern | 4 | 2 | 3 | 1 | 3 | 2 | 15 | P: autoplay, step names as headings; V: JSON diffs; B: one case; E: developer chrome |

The uncomfortable row is the first. A page with no engine, no checks and no animation ties the Rayner build on this rubric in a third of the build time. That is not an argument against Rayner; it is an argument about where Rayner's value is and is not.

## What this says we should change about Rayner

Eleven of the changes below were made and applied across the catalog the same day; [that record](rayner-changes-2026-10-30.md) measures what they changed and assesses it with the rubric.


The three essays the prompt named frame it. Rieseberg: use the instruments experts use, set an unreasonable goal, and never let the model judge itself. Luu, *ambitious*: the cost of building a bespoke thing has collapsed, so build it, but the gap between what can be built and what can be verified is the thing that is widening. Luu, *benchpocalypse*: once the target is a score, you get the score. henge.nyc got AMNH's minutes. Rayner's `check` is a score too; I could have passed it by hiding labels, and the skill says so.

1. **Make the resting picture the authoring unit, and motion the option.** Let a step be a drawing of `scene.state` (`view` already exists) with transitions supplied by the engine or omitted. Most of the choreography in this scene would go; `check` would keep every rule it has, because it already judges resting frames. Subtraction: the `line` field, which I kept rewriting to avoid repeating the title, could be optional and discouraged.
2. **Add a dial inside a step.** The evening stepper is the best thing in any of the three, and only the hand-built page has it. Settings keep the step by name, so a six-option `evening` setting is already a dial at the cost of 6× the build; measure that cost, then either make it cheap or add a declared `dial` that varies a step without rebuilding the scene.
3. **Scope annotations to their step.** `s.callout(…, { until: 'next' })`, or remove a step's annotations automatically when the next begins, with the removal counted as that step's change. The fade-out-at-the-start-of-the-next-step idiom should not have to be discovered.
4. **Place labels, do not only check them.** `explain/annotate.ts` knows the connectors; nudge a label off a line and inside the stage before reporting a collision, and report only what it could not resolve. All three builds hand-wrote the same nudge.
5. **Write the artifact form of the page.** `build --artifact` (title, generator, style, body) beside the full document, as Lantern's `--only` build does, because claude.ai is a real destination and the hand-strip is a trap.
6. **Make grounding by construction available.** The hand-built page cannot drift from its model because the model runs in it. Rayner's prebuilt cases buy determinism, receipts and no-JavaScript transcripts, and that trade is right for most explainers; it should still be a documented choice. Ship the model in the page where the author asks for it, and keep the fidelity test for the drawing.
7. **Keep the outside judge, and widen it.** The holdouts in `test/explain-models.test.ts` are the only part of this work that is not my own opinion, and they are what turned the horizon from a tuning knob into a finding. The rubric scores above are not that. The collection needs reader tests or a blind second grader before any stack rank is called evidence.
8. **Loosen and quiet the toolchain.** Node 22.18 or later suffices, Chromium should be found under either Playwright directory layout, and a passing `check` should print a summary and write the report. None of these change what a reader sees, and all of them stop an author before the first picture.

## Limits

One subject, one author, one afternoon. The rubric scores are mine. The planetarium's own page refused automated readers, so its 2026 evenings come from three press reports that agree with each other and with henge.nyc's listing. The Lantern contact sheet was rendered with Lantern's own `renderAt` because its screenshot tool did not find this machine's browser; its player was read in source, not driven. The hand-built page had one screenshot pass at 1180 and 390 px and no other check. The macOS lettering pin file was not regenerated here and needs a run on a Mac.
