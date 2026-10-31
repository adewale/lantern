# Explainer improvements

This records the teaching-path revision through `6bce495`. The later [copy and layout pass](editorial-crap-2026-10-31.md) contains updated screenshots and validation fingerprints.

Baseline: the 31 October review of 37 main-branch explainers at `37bbe4d`, plus the periodic-table candidate at `bf24af0`. This branch stacks on PR #60 so it retains its paint-order, claim-freshness and periodic-table repairs.

The goal is a warranted one-tier improvement for every lesson. The three S-tier lessons need stronger prediction and visual proof, rather than a renamed tier. A new audit must judge the results; a changed file or green test is not a tier increase.

## Acceptance

- The opening shows the complete comparison named by the caption, with readable labels. Source details remain available; tiny text and hidden evidence do not count as fixes.
- Each lesson has a reader question and an observable consequence. Classification, implementation excerpts and reference inventories support that question.
- Numbers, outcomes and pictures still come from the existing models, with independent fidelity owners retained.
- Caption subjects have independent served-paint expectations. A missing, hidden or displaced subject fails the review, including in the first view.
- Capture every case/step at both widths, inspect new default journeys and meaningful countercases, and retain source and build fingerprints.

## Result of the visual reassessment

All 38 default teaching paths were inspected at phone and desktop widths. The table records an editorial reassessment against the original review, not a measured improvement in learning. S+ extends the previous ceiling: the lesson now asks for a prediction, exposes the mechanism and keeps its countercase. The other tiers retain their original meaning: S is a showcase lesson, A is a strong explanation, and B is useful but still has room for a fuller demonstration.

The changes are specific to each subject. Thirty lessons now lead with short native drawings driven by their existing models. Original source walkthroughs and technical inventories remain in **Details and sources**. Next follows the explanation; direct links to reference steps still work. The strongest lessons keep their existing narrative and gain prediction, mapping or visual derivation.

| Explainer | Before → after | Evidence for the change |
| --- | --- | --- |
| Python dictionary deletion (`python-dict`) | S → S+ | Predict the failed lookup before deletion; the proposed edit, probe slots and entries remain together. |
| Bloom filters (`bloom-filter`) | S → S+ | Show each seeded hash and its bit destination, then predict membership before the false-positive reveal. |
| Git branches and merging (`git-branches`) | S → S+ | Put the actual commands beside the graph and files; ask what a merge must preserve before revealing it. |
| Monty Hall (`monty-hall`) | A → S | Predict before switching; draw all 98 opened doors in the 100-door case and retain the random-host countercase. |
| Melody and rhythm (`melody-rhythm`) | A → S | Label beats and A/B rows; predict the effect of a timing change while preserving every note and audio event. |
| Python's numeric predicates (`isdigit`) | A → S | Predict guard and parser separately for the same character, then compare isdigit and isdecimal outcomes together. |
| Stale search results (`latest-search`) | A → S | Keep start order, finish order and latest intent visible; compare guarded and unguarded publication in one table. |
| OAuth PKCE (`oauth-pkce`) | A → S | Open on the complete code/challenge/verifier path; compare legitimate and stolen-code outcomes without panning. |
| Font measurement before layout (`font-metrics`) | A → S | Draw the gap caused by measuring the wrong face, then show actual advances, cuts and natural-width diagram labels. |
| Postgres page storage (`pg-page`) | A → S | Show the actual row-byte allocation before comparing page capacity; headers, padding and data explain the result. |
| Seasons and daylight (`seasons`) | B → A | Separate tilt from distance; compare solstice daylight and show a year with a labelled 0–24-hour scale. |
| Express trust proxy (`trust-proxy`) | B → A | Show the request path, then a nearest-first trust walk with role, address and decision on each row. |
| Kubernetes traffic policy (`traffic-policy`) | B → A | Show node endpoint counts and traffic, then compare per-pod shares with node ownership on every row. |
| Birthday paradox (`birthday-paradox`) | B → A | Draw the ten pairs among five people and all 365 possible dates; occupied days make the product concrete. |
| Glyphs, advances and morphing (`glyph`) | B → A | Compare measured advances at a shared left edge, then compare actual outlines of the same character. |
| Hand-drawn diagrams (`pen-and-pencil`) | B → A | Separate the fixed route from its simulated stroke; reserve a label box before showing the full illustrated plate. |
| Git object hashes (`exgit`) | B → A | Show short real object IDs, parent links and reused or changed blobs together before the source walkthrough. |
| KV cache before D1 (`mr-cache`) | B → A | Compare the uncached database path with the selected cache outcome and its database-read count. |
| French family tax quotient (`quotient-familial`) | B → A | Follow income through shares and the tax schedule, then show how the cap changes the final amount. |
| ext4 usable disk space (`ext4-space`) | B → A | Account for the whole disk, then compare different reserve percentages at a fixed size while metadata stays fixed. |
| Rust Send and Sync (`send-sync`) | B → A | Distinguish moving ownership from sharing a reference; compare the inner and wrapped types side by side. |
| Mermaid verification and repair (`agentic-mermaid`) | B → A | Make the missing branch labels visible, repair them and trace the resulting yes route; retain the complete-label control. |
| Rayner feature recipes (`feature-tour`) | B → A | Pair each authoring recipe with its uncluttered result and link to fuller lessons for the underlying feature. |
| Secret references for agents (`2password`) | B → A | Trace reference versus resolved value across the process boundary, then show which process receives which credential. |
| How the scene engine works (`lantern`) | B → A | Sample one animated circle at three times, then connect the same scene and fixed clock to its output sinks. |
| Token bucket (`token-bucket`) | C → B | Show six simultaneous requests spending five tokens, then show refill, admission and remaining balance together. |
| Ring buffer (`ring-buffer`) | C → B | Contrast a full ring with coincident pointers and a reused ring whose queue order differs from storage order. |
| Session state machine (`state-machine`) | C → B | Show the allowed event path, then the terminal state rejecting a late OPENED event. |
| An immutable shell model (`just-bash`) | C → B | Trace the pipeline and redirect, then compare the original and returned shell’s file contents. |
| Certificate renewal rules (`cert-renewal`) | C → B | Compare fixed and fractional renewal dates on the same lifetime, then show the remaining retry window. |
| Calendar recurrence overrides (`ical-recurrence`) | C → B | Keep the six original occurrence identities visible when one moves; compare organiser and guest copies side by side. |
| GTFS routes, trips and service dates (`gtfs`) | C → B | Follow route to trip to service date, then show actual departures and headway patterns for the selected stop and date. |
| Tailwind colour gamut (`tailwind-gamut`) | C → B | Compare chroma against each colour’s gamut edge, then show the mapped sRGB result without claiming display-gamut detection. |
| What Rayner changed from Lantern (`fork`) | C → B | Explain who performs diagram layout, then make the six prepared settings combinations visible as a cost of authoring. |
| GNOME Files usability study (`gnome-files`) | C → B | Start with an actual Undo task and its menu location; show all six source observations without turning categories into timing. |
| WCAG versions and criterion counts (`wcag-map`) | C → B | Show a concrete missing-focus problem, then explain cumulative conformance levels with the selected guideline’s contribution. |
| Stage and card direction (`layout-direction`) | C → B | Start with the author’s placement task; demonstrate RTL fields, an LTR override and stable numeric order before the live cards. |
| Periodic-table groups (`periodic-groups`) | B → A | Start with atomic number minus core and actual filling dots; retain the complete compact family and count comparisons. |

## Phone evidence

[All 38 revised openings](lesson-openings/overview.webp) show the range of teaching pictures. These phone comparisons use identical settings at 390×844. The named steps differ because the teaching paths were edited. The baseline is `37bbe4d`; the after views include the Atlas update.

| Comparison | Settings | Phone capture |
| --- | --- | --- |
| Token balance → simultaneous requests | rate 2/s | [Before / after](lesson-openings/token-bucket.webp) |
| Cache request → database-read outcome | cache hit | [Before / after](lesson-openings/mr-cache.webp) |
| Certificate year axis → renewal timing | 45-day lifetime, fixed 30-day rule | [Before / after](lesson-openings/cert-renewal.webp) |
| Calendar schema → occurrence identity | move the second meeting, organiser copy | [Before / after](lesson-openings/ical-recurrence.webp) |

## Reader behaviour and regression proof

Authors can declare the subjects that must appear together with `s.reading(...)`. The opening planner measures their painted geometry and labels, adds a complete comparison when it is readable, and retains closer detail views. It rejects a declared subject with no painted content. It also handles wordless drawings. It does not lower the 12-pixel close-up target.

`meta.detail: true` moves a step into Details and sources. The browser keeps direct URLs, case changes, keyboard navigation and a return to the explanation. A collection made entirely of detail steps retains a usable sequential path. When Next skips references, it goes directly to the next main picture; an ordinary-motion transition must not flash an unseen reference panel.

The new tests check complete comparison openings, invisible declared subjects, per-view legibility reporting, generated step navigation, actual drawn values, common bar scales and true zeroes. The existing browser state machine now models main and reference navigation independently; source-step motion and layout assertions remain. Early Previous and ArrowLeft actions have a fixed regression example as well as generated coverage. Independent source/model fidelity owners remain. Music retains every pitch, start and duration. Monty Hall retains its host-rule odds and now draws the 98 opened doors. The ext4 default must compare different reserve percentages.

An isolated-copy mutation experiment first passed its positive controls, then deliberately restored opening-only legibility accounting and reference-step transition flashes. Both regression checks failed. Production files were not mutated by that experiment. A separate isolated-copy control replaced reference-aware navigation with a linear walk; both the generated navigation check and the served-reader check rejected it.

## Validation record

Validation includes PR #60’s Atlas update at `83d3b14` and the final early-navigation guard. The [collection record](lesson-review-2026-10-31.json) lists each page’s source, engine and artifact hashes, together with the reviewer hash. The final case results were checked against the independent built inventory: missing, duplicate, stale or failed cases reject the record.

- All 38 full scene checks pass. The retained source steps remain in these checks.
- All 196 cases pass served-paint review at 390×844 and 1180×980: 3,316 step/width observations, including reference steps and their tours, with no page errors.
- The default teaching paths have 121 steps and 242 visual captures at phone and desktop widths. All 538 declared main openings fit the 320-pixel geometry check. That check covers declared comparisons; it is not a physical-device test of every UI interaction.
- The full local test run reports 1,038 tests: 952 passed, 86 explicit optional skips, zero failures. Subsequent reader and benchmark changes pass their focused checks and real-browser owners. The interaction file passes all 25 tests; the remaining browser files pass 68 tests with two explicit skips. The benchmark tests additionally exercise both plain and reference disclosures, including corrupt observer data.
- TypeScript and the installed-package browser gate pass. Earlier CI authoring and installed-package checks passed on Linux, Intel Mac and Apple Silicon Mac with Node 24.0 and current Node 24. Native Safari and WebKit passed before the final loading guard; the final CI run will verify the completed branch again.
- Every page stays below the existing 1.5 MiB raw and 450 KiB gzip budgets. The largest raw page is about 943 KB.
- [Startup measurements](lesson-startup-2026-10-31.json), taken after the other local checks finished, pass the existing eight-second median limit at 4× Chromium CPU slowdown: cache 3.07 s, token bucket 2.61 s, gamut 3.98 s. Each uses three fresh contexts at 390×844 on localhost. A preliminary run under parallel test load exceeded the limit for gamut; it was not used as a passing result.

The benchmark now opens the reference disclosure through the UI before selecting its final step. It records all three clicks and includes the disclosure’s blocking work in jump latency. Pages without reference steps retain the original two-click path. The size and startup limits are unchanged.

## Limits

The main path is deliberately shorter than the reference walkthrough. Detailed source comparisons can still require a phone tour. Some lessons, particularly the WCAG map, GNOME report and authoring examples, are focused introductions rather than complete courses. Existing domain-model boundaries still apply; captions now state them where they affect interpretation.

This review does not establish physical-phone startup performance or learning outcomes. The local visual review uses Chromium; WebKit and native Safari have separate CI gates. It does not include a reader study or an audio listening assessment. Music geometry, timing and synthesis data are checked; the review did not audition the sound. No deployment or publication is included.
