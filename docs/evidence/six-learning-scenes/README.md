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

- `test/learning-models.test.ts`: native storage and Git, known UTF-8 hashes, exhaustive probabilities, seeded properties and malformed audio metadata.
- `test/lib/fidelity/learning.ts`: every completed step in every setting case agrees with the separately tested model.
- `test/learning-pictures.test.ts`: all 448 note rectangles across the music lesson’s 28 pictures have the expected pitch labels, positions and durations.
- `tools/lib/explain-story-review.ts`: explicit caption subjects require the whole relevant comparison in the opening. The six scenes have 28 cases, 196 resting pictures and 392 step/width rows at 390 and 1180 px.
- `tools/explain-package-smoke.ts`: a fresh archive install builds and plays a typed score clip; ordinary installed pages omit the module.
- `test/explain-audio.test.ts`: actual Chromium oscillator scheduling, audio-clock/playhead agreement, both tempos, the unchanged control, flattened pitches, Pulse, Stop, pending-resume cancellation and unsupported audio.
- `test/reader-cross-browser.test.ts`: the Mac lane checks the music journey with WebKit and native Safari. This Linux authoring session cannot establish physical iPhone behavior or speaker output.

The project gates caught crowded labels, heading collisions and repeated pictures during development. Served review caught a clipped dictionary opening and an unnecessary Git close-up. Contact-sheet review caught a collision step describing key 16 while highlighting key 8; it now consistently follows key 16. Shared branch labels also received a wider box. No reading threshold was lowered.

Deliberate defects were rejected before restoring the original source bytes: a wrong FNV multiplier, shortened note rectangles and a removed post-resume cancellation guard. Logs, browser screenshots and the 392-row receipt live under the ignored `out/six-*` paths during authoring. Normal catalog/story CI regenerates its own complete receipt and screenshots; local output is not a deployment record.

Local verification used Node 24.22.1, plus Node 24.0.0 for complete catalog builds. The standard run passed 908 checks and skipped 77 optional checks; its 13 language checks initially failed because that command omitted the system Chromium path. All 13 passed when rerun with `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. The separate enabled reader suite passed all 24 checks. `npm run check`, the three enabled audio checks and the installed-package smoke also passed. GitHub owns the full-property and Mac runs; a queued run is not pass evidence.

The complete catalog passed `npm run demos:check`: 38 explainers, 192 cases, 162 diagrams, nine styles and 15 diagram families. After the unavailable-audio fix, `demos:build` regenerated the complete collection and the three enabled audio checks passed again. The fallback disables Pulse as well as Play, so it cannot invite an unavailable action.

[Hosted Mac run 41106616424](https://github.com/adewale/rayner/actions/runs/41106616424) completed the WebKit and native Safari checks, including music playback, and uploaded its Safari validation record. Both Mac architectures also passed installed-package checks, including the minimum Node version. These results do not establish physical iPhone behavior or speaker output.

Catalog checks assert actual page bytes, explicit lettering requests and separation of optional code. Model, state, geometry, browser, package and artifact-integrity checks retain their own boundaries.
