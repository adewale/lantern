# Eleven changes to Rayner, applied across the catalog, 30 October 2026

The [three-way build](manhattanhenge-three-ways-2026-10-30.md) ended with a list of changes it suggested for Rayner. This record implements eleven of them, applies them to the thirty-three catalog explainers, measures what they changed, and assesses the result with the [editorial rubric](../EXPLAINER-RUBRIC.md). The twelfth suggestion, a second grader and a recorded reader session, is not something a build can do and remains open.

## What changed, and where it applies

| # | Change | Where | Applies to |
| ---: | --- | --- | --- |
| 1 | `until: 'next'` on every stage helper that keeps something: the stage fades it out as the next step begins, in the heading's own play. `view` + `sync` documented as the way to draw a picture of state. | `explain/stage.ts` | Every scene that opts in; `manhattanhenge` does |
| 2 | Dials: a setting with `dial: true` varies one value inside a step, with a stepper under the picture, no extra case or transcript; `check` runs every dial value (`sweepsOf`). | `explain/settings.ts`, `app/embed.ts`, `tools/lib/explain-project.ts`, `explain-check.ts` | Every scene that declares one; `manhattanhenge` has a six-evening dial |
| 4 | Labels and callouts placed clear of lines, other labels and the stage edge (`s.label`, `callout`); labels placed in the same step see one another. | `explain/stage.ts` | Every callout in the catalog gets the placement; `s.label` where adopted |
| 5 | `build --artifact`: the page without its document skeleton, for a host that supplies one. | `tools/explain.ts`, `explain-build.ts` | Any build |
| 6 | Node floor 22.22, which is what ran here; CI minimum lane moved to it. | `package.json`, README, docs, `.github/workflows/ci.yml` | The package |
| 7 | `Create` lowers its stagger so no row draws in under a quarter of a second; `Axes` with number labels no longer pop at normal run times. | `src/animation.ts` | Every `Create` in every scene with more than one drawn row |
| 8 | `build --stills`: every step's resting picture as SVG with its words and a stepper, no engine, repeated path data shared through one `<defs>`. | `tools/lib/explain-stills.ts` | Built for all 33 (table below) |
| 9 | Density per step in the check report (labels at rest, caption words and numerals), reported not gated. | `explain-check.ts` | All 33 (table below) |
| 10 | Pivots in `scene.review.json`: the pivotal claim as state `check` asserts and a witness `review` must see painted. `tools/explain-pivots.ts --write` records a first pivot from the catalog step. | `tools/lib/explain-pivots.ts`, `explain-review-scene.ts`, `explain-check.ts` | 29 explainers have a recorded pivot; `manhattanhenge` three curated ones with witnesses; the four toolchain scenes that record no state have none |
| 11 | Chromium discovery: Rayner's already accepts both Playwright layouts; the help names `PLAYWRIGHT_BROWSERS_PATH`. | `tools/explain.ts` | Authoring |
| 12 | A passing `check` prints a summary; `--json` prints the report. | `tools/explain.ts` | Authoring |

Each has a test in `test/explain-dials-scope-labels.test.ts`: dials against cases and sweeps, the stagger cap against the motion verifier, path sharing, density counts, the summary's text, scoped keeping across two steps, label placement on and off a line, a pivot that holds and one that fails, and the stills page's figures and receipt.

## How the catalog was changed

Three of the changes alter what every reader sees without any scene being edited: the stagger cap (7), callout placement (4), and the density and pivot records that `check` now writes (9, 10). The rest are opt-in, and only `manhattanhenge` opts in, because it is the scene the three-way build found wanting: its evening dial, its scoped track and readings, and its placed date labels replace the hand-written fade-outs and nudges of the first version. Converting an existing scene's settings into dials, or its hand-placed labels into `s.label`, would change its pictures and its transcript, so that is left to each scene's author with the pattern documented in the reference and the skill.

The sweeps found what cases alone did not. The first version of the dialled scene passed every case and failed five of the twenty new sweeps: a time label on the horizon line when the Sun crosses below it, a callout leader through a date label, a dimension through the horizon's name, two callouts that could not both fit beside discs 0.2° apart. Each fix was a placement change the sweep forced; two were absorbed into the placement helper itself (labels placed in one step now see one another, and the search reaches 1.2 units), and one was a subtraction: the ladder's reading became a fixed line at the top of the view instead of a callout that had to find room among six discs.

## Measurements across the catalog

From `npm run demos:check` and `node tools/explain-impact.ts` on this checkout (Linux, Node 22.22): the full page and the stills page for every explainer, the densest resting picture and caption, and the pivots recorded. All 33 explainers, 168 cases and the 20 extra Manhattanhenge sweeps pass `check`; the catalog run took 16 minutes.

| Explainer | Cases | Steps | Page KiB (gzip) | Stills KiB (gzip) | Most labels at rest (step) | Most numerals in a caption | Pivots |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| `seasons` | 4 | 8 | 621 (250) | 1067 (147) | 27 (year) | 6 | 1 |
| `manhattanhenge` | 4 (24 checked) | 5 | 659 (254) | 816 (115) | 27 (year) | 9 | 3 |
| `oauth-pkce` | 2 | 6 | 741 (275) | 973 (212) | 11 (exchange) | 4 | 1 |
| `exgit` | 2 | 6 | 677 (265) | 1397 (278) | 29 (hashes) | 4 | 1 |
| `token-bucket` | 3 | 5 | 742 (261) | 833 (100) | 49 (refill) | 16 | 1 |
| `mr-cache` | 2 | 4 | 636 (258) | 491 (81) | 16 (after) | 3 | 1 |
| `latest-search` | 4 | 4 | 683 (256) | 622 (68) | 16 (compare) | 0 | 1 |
| `state-machine` | 2 | 5 | 751 (267) | 631 (85) | 23 (machine) | 0 | 1 |
| `ring-buffer` | 2 | 4 | 706 (256) | 479 (73) | 30 (result) | 7 | 1 |
| `2password` | 2 | 6 | 685 (271) | 824 (143) | 10 (fetch) | 7 | 1 |
| `just-bash` | 2 | 7 | 664 (260) | 1004 (177) | 14 (redirect) | 4 | 1 |
| `cert-renewal` | 8 | 9 | 891 (364) | 4946 (544) | 20 (new-rule) | 10 | 1 |
| `quotient-familial` | 12 | 10 | 982 (314) | 7788 (619) | 30 (bareme) | 16 | 1 |
| `send-sync` | 9 | 8 | 758 (267) | 2800 (291) | 15 (threads) | 4 | 1 |
| `gtfs` | 6 | 9 | 770 (268) | 4835 (658) | 40 (route-trip) | 10 | 1 |
| `pg-page` | 6 | 7 | 674 (263) | 3276 (474) | 23 (fillfactor) | 13 | 1 |
| `traffic-policy` | 6 | 7 | 793 (291) | 2976 (444) | 21 (compare) | 12 | 1 |
| `isdigit` | 15 | 8 | 700 (249) | 3225 (306) | 16 (lineup) | 8 | 1 |
| `ical-recurrence` | 6 | 6 | 764 (270) | 2284 (248) | 24 (change) | 5 | 1 |
| `ext4-space` | 9 | 7 | 766 (280) | 3737 (575) | 21 (journal) | 13 | 1 |
| `trust-proxy` | 12 | 8 | 906 (285) | 6417 (533) | 23 (code) | 9 | 1 |
| `tailwind-gamut` | 6 | 6 | 1203 (391) | 4045 (394) | 39 (srgb-screen) | 9 | 1 |
| `gnome-files` | 6 | 5 | 805 (282) | 1700 (236) | 28 (give-ups) | 10 | 1 |
| `wcag-map` | 12 | 6 | 1036 (384) | 7621 (1238) | 20 (totals) | 12 | 1 |
| `hello-world` | 1 | 1 | 444 (203) | 37 (10) | 1 (hello) | 0 | 0 |
| `feature-tour` | 15 | 2 | 637 (250) | 720 (129) | 8 (recipe) | 0 | 1 |
| `lantern` | 1 | 7 | 754 (266) | 804 (169) | 22 (inspect) | 1 | 0 |
| `fork` | 1 | 8 | 726 (273) | 850 (196) | 13 (lantern) | 4 | 0 |
| `agentic-mermaid` | 2 | 6 | 673 (271) | 878 (164) | 25 (evidence) | 1 | 1 |
| `glyph` | 2 | 6 | 687 (258) | 860 (169) | 17 (pipeline) | 1 | 1 |
| `font-metrics` | 1 | 3 | 831 (309) | 333 (91) | 7 (cuts) | 5 | 1 |
| `layout-direction` | 1 | 2 | 567 (234) | 100 (24) | 4 (columns) | 2 | 0 |
| `pen-and-pencil` | 2 | 6 | 707 (265) | 1508 (289) | 14 (layout) | 4 | 1 |

Two things the table says. The stills page is the smaller download for 20 of the 33 explainers, all of them with four cases or fewer (and the 15-case feature tour, whose steps are small), and the larger one for the 13 scenes with many cases of diagram-heavy pictures: `wcag-map` at 1.2 MiB compressed against 384 KiB, `quotient-familial` at 619 KiB against 314 KiB. Sharing path data between stills pays within a case and across cases of the same drawing, but every case of a six-diagram scene still carries its own diagrams, and the engine page carries each diagram once. So the stills page is the subtraction the three-way build hoped for only where the explanation is a few cases of a native drawing, which is the Manhattanhenge shape and the hand-built page's shape, and not for the catalog as a whole. Second, label counts vary widely among scenes the rubric scores the same: `token-bucket` rests on 49 labels and scores E 4, `send-sync` on 15 and scores E 2.

## Assessment with the rubric

The rubric scores lessons, and most of these changes do not touch a lesson's words or pictures. That is the first finding: of eleven changes, two can move a reader-facing score (the dial and the stills page), one changes motion the rubric explicitly does not score (the stagger cap), and eight change what an author pays and what a reviewer can verify. The catalog's thirty-two other totals in the [stack rank](explainer-stack-rank-2026-10-30.md) therefore stand; nothing in this change set makes any of those lessons better or worse as lessons, and claiming otherwise would be scoring the tool rather than the explanation.

**Manhattanhenge, before and after.** The first version scored Q 4, P 4, V 4, B 4, G 4, E 3. With the dial the reader can push the crossing altitude through the horizon one evening at a time, which the rubric's B asks for ("the changed input, fixed assumptions and resulting difference") and which the first version only pictured as six static outlines. B was already 4; the change is to the hero prompts: **R**, Rayner leverage, rises from 2 to 3, because the dial is a model-driven change that re-renders state, picture and caption together and a still page cannot do it, and **C** stays 4. E stays 3: the density report says why, with 27 labels at rest in the chart step and a 128-word caption in the names step, both of which are the honest cost of the horizon finding and neither of which the dial reduces. Total 23, unchanged; hero fit J 3, R 3, C 4.

**The density diagnostic against the E column.** Across the 29 scenes the stack rank scored, the diagnostic's three counts correlate with the E score (Spearman's rho, higher count against lower score) as follows.

| Count | rho against E | Mean of the maximum, E = 2 | E = 3 | E = 4 |
| --- | ---: | ---: | ---: | ---: |
| Words in a caption | −0.61 | 67 | 63 | 44 |
| Numerals in a caption | −0.42 | 10.4 | 6.0 | 5.3 |
| Labels at rest | −0.22 | 26.4 | 20.2 | 20.4 |

Caption length is the count that tracks the editor's judgment; the label count barely does, because a chart's axis numbers or a code panel's lines are labels a reader scans rather than reads. The check's summary line therefore leads with the caption counts. This is a correlation over 29 scenes scored by one person, so it says the diagnostic agrees with that person more than it says anything about readers; its use is to point an editor at the heaviest caption before they open the scene.

**The stills page as a reader form.** On the rubric's V, a stills page is the resting picture and nothing else, which is what V scores; on E it drops the animation the rubric says earns nothing by existing. What it loses is the phone close-up, so a label that reads at 12 px only in a close-up is small there, and the receipt per case. For the catalog it is a second published form, not a replacement, and the table above says what each would cost to download.

**Pivots and G.** A recorded pivot does not raise a G score, because G is about whether the claim traces to a source and the pivot only pins what the scene currently says; the fidelity tests already derive those values from the models. What it changes is the failure mode: a model or scene edit that moves a pivotal number now fails `check` with the claim's own words until someone re-reads it, and `review` fails when the witness is not painted where the reader lands. Twenty-nine of the pivots were recorded from the scene's output and have not been read by an author; `manhattanhenge`'s three were written by hand with witnesses. Until the others are read, they are regression pins, not reviewed statements.

## Costs

`check` on the dialled scene runs 24 sweeps instead of 4 cases and takes about six minutes here instead of one. The stills page of a four-case scene is heavier raw than the engine page and about half its size compressed. Every page's bytes changed, so the Linux output pins were regenerated; the macOS pins still need a Mac. The stagger cap changes the timing of every `Create` with many rows, which the motion verifier accepts in all thirty-three scenes.

## Limits

One author made, applied and scored these changes. The density figures are counts, not reader measurements, and the comparison with the E column is correlation across twenty-nine scenes scored by the same person who wrote the diagnostic. No reader has used the dial or the stills page. The pivots other than Manhattanhenge's were generated, not reviewed. The second grader the earlier record asked for has not happened, and nothing here substitutes for it.
