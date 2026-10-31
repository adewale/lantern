# Six learning scenes

These scenes are for programmers and educators explaining a specific surprising result. Each has seven resting pictures, an alternate case and a model kept outside its drawing code. The linked pages inspired the topics; the drawings and teaching implementations here are new.

| Scene | Reader’s question and visible witness | Countercase and limits |
| --- | --- | --- |
| `python-dict` | Why does deletion need a marker? The eight index slots, three ordered entries and visited-slot sequence show a lookup surviving deletion. | Incorrectly clear slot 0, then restore the deleted marker. Switch the sought key from 8 to 16. This is CPython 3.12.14’s fixed-capacity combined table with small integer keys; it omits resizing and split tables. |
| `bloom-filter` | How can a filter prove absence? An unset queried bit rejects a word; a constructed absent word passes all three bits and needs the exact store. | Compare 16 and 32 bits. Both retain a false positive. This insert-only lesson uses three seeded FNV-1a hashes, rather than reproducing Jason Davies’s double hashing. The fixed sample is not a general false-positive rate. |
| `git-branches` | Why does a merge sometimes create a commit? The graph, branch labels, HEAD and checked-out files show both edits reaching M. | Remove the independent main commit to permit a fast-forward. Both histories allow fast-forwarding and use nonconflicting files; they omit conflict resolution and rebase. |
| `monty-hall` | Why does switching win more often? Complete prize/host rows separate an informed host’s two-thirds result from a random host’s conditioned one-half result. | Change host, first door and strategy. Expand the same rule to 100 doors within the story. The opening is one repeatable example with prize C, not a simulation or proof of the odds. Random-host odds exclude car reveals. |
| `birthday-paradox` | Why do 23 people approach a half chance? Pair counts, conditional no-match factors and the complement lead to 50.7%. | Ask for a match with one marked person instead: 5.9% at 23. Compare rooms of 10, 23 and 50. The model assumes independent uniform 365-day birthdays; the seeded 1,000-room sample illustrates the formula. |
| `melody-rhythm` | How does timing affect a fixed pitch sequence? Two piano rolls and their locally synthesized sound preserve pitches while changing two starts and two durations. | Keep B’s timing identical to A, change tempo, or hear a step with every pitch flattened to C. The lesson uses one triangle-wave instrument and two four-beat bars; it does not model expressive performance. |

Sources appear on each page and in `Scene.meta.sources`. The Python source is pinned at v3.12.14, Git manuals at 2.52.0, FNV vectors at commit `4001d0d4f6d81b29a02bda592c7712c68434525a`, and Web Audio at the 2021 Recommendation. CPython 3.12.14 and Git 2.52.0 were run locally. Probability expectations also come from exhaustive small worlds and Python exact fractions.

Validation owners:

- `test/learning-models.test.ts`: native storage and Git, known UTF-8 hashes, exhaustive probabilities, every displayed Monty Hall prize/opening/outcome row, seeded properties and malformed audio metadata.
- `test/lib/fidelity/learning.ts`: every completed step in every setting case agrees with the separately tested model.
- `test/learning-pictures.test.ts`: all 448 note rectangles across the music lesson’s 28 pictures have the expected pitch labels, positions and durations. Independent expectations also check Monty Hall’s 48 strategy readouts and 12 final comparison tables across all 12 cases.
- `tools/lib/explain-story-review.ts`: explicit caption subjects require the whole relevant comparison in the opening. The six scenes have 28 cases, 196 resting pictures and 392 step/width rows at 390 and 1180 px.
- `tools/explain-package-smoke.ts`: a fresh archive install builds and plays a typed score clip; ordinary installed pages omit the module.
- `test/explain-audio.test.ts`: actual Chromium oscillator scheduling, audio-clock/playhead agreement, both tempos, the unchanged control, flattened pitches, Pulse, Stop, pending-resume cancellation and unsupported audio. It also checks visible button names, native offline rendering of overlapping notes, and the score’s screen position during playback.
- `test/reader-cross-browser.test.ts`: the Mac lane checks the music journey with WebKit and native Safari. This Linux authoring session cannot establish physical iPhone behavior or speaker output.

The project gates caught crowded labels, heading collisions and repeated pictures during development. Served review caught a clipped dictionary opening and an unnecessary Git close-up. Contact-sheet review caught a collision step describing key 16 while highlighting key 8; it now consistently follows key 16. Shared branch labels also received a wider box. No reading threshold was lowered.

Deliberate defects were rejected before restoring the original source bytes: a wrong FNV multiplier, shortened note rectangles and a removed post-resume cancellation guard. Logs, browser screenshots and the 392-row receipt live under the ignored `out/six-*` paths during authoring. Normal catalog/story CI regenerates its own complete receipt and screenshots; local output is not a deployment record.

Initial implementation verification used Node 24.22.1, plus Node 24.0.0 for complete catalog builds. The standard run passed 908 checks and skipped 77 optional checks; its 13 language checks initially failed because that command omitted the system Chromium path. All 13 passed when rerun with `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. The separate enabled reader suite passed all 24 checks. `npm run check`, the original three enabled audio checks and the installed-package smoke also passed. GitHub owns the full-property and Mac runs; a queued run is not pass evidence.

The complete catalog passed `npm run demos:check`: 38 explainers, 192 cases, 162 diagrams, nine styles and 15 diagram families. After the unavailable-audio fix, `demos:build` regenerated the complete collection and the three enabled audio checks passed again. The fallback disables Pulse as well as Play, so it cannot invite an unavailable action.

Before this audit, [CI run 41109199700](https://github.com/adewale/rayner/actions/runs/41109199700) passed the Mac compatibility lanes, including WebKit, native Safari and installed-package checks on both Mac architectures. These results do not establish physical iPhone behavior or speaker output. The audit adds explicit score-visibility assertions to both browser journeys; their latest results belong to the new commit’s CI run.

Catalog checks assert actual page bytes, explicit lettering requests and separation of optional code. Model, state, geometry, browser, package and artifact-integrity checks retain their own boundaries.

## Adversarial audit

Five independent reviewers examined the models, reader pages, audio implementation, test boundaries and prose. The writing reviewer used [anti-slop-writing](https://github.com/adewale/anti-slop-writing/blob/main/skills/anti-slop-writing/SKILL.md) and its full doctrine. The audit kept the branch’s existing base; it did not merge or rebase `main`.

| Finding | Repair and proof |
| --- | --- |
| Playing music could scroll the score off screen. An auto-height iframe also defeated a fix based on the child window’s viewport. | Put Play/Stop immediately after the picture. Native scrolling reveals the controls and score through the host frame. Served checks exercise click and Enter at 320×568, 390×667 and 1180×800, with both score lanes, controls and painted cursor visible. |
| A custom audio label could omit the visible “Play A” voice target. | Keep the visible label in the accessible name; test labels unlike the gallery’s own labels. |
| A valid 256-note chord mixed at full per-note gain and clipped. | Share the monophonic gain among the maximum simultaneous voices. A native `OfflineAudioContext` checks actual output for one note, 256 concurrent notes and notes meeting at an endpoint. |
| Correct model state and visible groups did not prove correct displayed Monty Hall values. | Independently check every host-opening row and rendered strategy percentage. Mutants that let the informed host open the car or paint the wrong Switch percentage now fail. |
| Audio tests depended on Hello World, which newer `main` removes. | Give the opt-out check its own temporary plain scene. |
| Captions misnamed pitch position, treated every birthday outline as a match, introduced unpictured alternate-case figures, and invited unavailable audio. | Correct the visual legends, keep the birthday ending on the selected room size, and make playback optional in the opening. The changelog now distinguishes comparisons within a story from settings that change the result. |

The viewport regression failed all six click/keyboard variants before the fix. Restoring either the old accessible name or the unbounded note gain also failed its new assertion. These controls supplement the earlier hashing, note-width and cancellation defects; they do not replace the existing proof owners. The original CI story failure was an artifact-download error before any story assertion ran.

Final audit verification passed `npm run check`, 11 model/picture checks, six new-scene fidelity checks, and all 14 enabled audio checks. Every new scene passed its project gates; the served review passed all 28 cases and 392 phone/desktop step rows again. A fresh installed-package smoke passed, including playback from the shipped module. An independent run on minimum Node 24.0.0 also passed the model, picture, audio and cross-origin embed checks. Fullscreen playback was checked separately at four phone/desktop sizes. The new WebKit and native Safari visibility assertions are explicitly skipped on this Linux host and await hosted Mac CI. The refreshed `out/six-lessons.zip` contains the reviewed six pages, matching SHA-256 receipts and response-header recipes; it has not been deployed.
