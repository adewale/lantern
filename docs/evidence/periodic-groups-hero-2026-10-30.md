# Periodic-table groups as the gallery entry — 30 October 2026

This note records the editorial brief, model trail and checks behind `scenes/explainers/periodic-groups`, which replaces `mr-cache` as the gallery's introductory entry. Its scores are the author's own reading against the [rubric](../EXPLAINER-RUBRIC.md), not an independent assessment, a reader study or a subject-expert review.

## Editorial gate

- **Who, what, whom.** A chemistry teacher explains to a secondary-school student why an element lands in its column. The observed result: sodium (11) shares a column with 1, 3, 19, 37, 55 and 87, whose atomic numbers jump by 2, 8, 8, 18, 18 and 32.
- **The reader's question.** What puts an element in its group?
- **The answer the model supports.** Read the table in order and each cell adds one electron in filling order. Count the s, d and p electrons past the preceding noble gas: that count is the group for sodium, iron and copper. Wikipedia's Group article says the 1 to 18 numbering "is based on each atom's s, p and d electrons beyond those in atoms of the preceding noble gas".
- **Conditions.** Before period 4 no d subshell has filled, so chlorine's count of 7 sits 10 columns over. Helium's count of 2 disagrees with its column; the table places it by its full shell. f electrons are not counted, and the 14 f columns have no group number. Positions follow the 18-column table with Sc, Y, Lu and Lr in group 3.
- **Why not a still.** A still of the table shows where elements sit, not why. The scene's leverage is that one model computes each case's lit cells, count badges, configurations, family rows and captions, and a reader changes one input (the element) to see where the rule holds, shifts by 10, survives a different configuration or fails.

### Pivotal inference

| question | before | model operation | after | same entity | resting witness | source |
| --- | --- | --- | --- | --- | --- | --- |
| Why is sodium in group 1? | Na at cell 11; configuration unknown | Fill subshells in Madelung order (cells 1–11), split off neon's core | `[Ne] 3s¹`: 1 electron past the core | The Na cell, outlined in every step; the group 1 column outline | Lit cells by subshell, dimmed core, count badge `1` under column header `1`, note `1 counted = group 1` | Wikipedia Group article (`oldid=1381612279`); NIST ASD 5.12 ground shells |

### Countercases

| baseline | changed input | fixed assumptions | predicted outcome | pictured comparison | conditional caption |
| --- | --- | --- | --- | --- | --- |
| Sodium: count 1, group 1 | Chlorine | Same filling rule, same table | Count 7, column 17: aluminium counts 3 under column 13, and every count after it is 10 short | Badges 1–7 across row 3 under headers 1, 2, 13–17; `7 counted ≠ group 17`; blocks step shows the 10 d columns | "The count gives chlorine 7, not 17"; resolved by bromine's 2 + 10 + 5 = 17 |
| Iron: filling rule and NIST agree, count 8 | Copper | Same rule; NIST as the listed configuration | Filling rule `4s² 3d⁹`, NIST `3d¹⁰ 4s¹`, both 11 | Both configurations in the note with `11 counted either way = group 11` | "Both arrangements hold 11 electrons beyond argon's core" |
| Neon: count 8, group 18 by the +10 | Helium | Same rule; no core before it | Count 2 would put helium over beryllium; the table puts it over neon | Dashed `He?` cell in column 2, `2 counted ≠ group 18` | "for helium the count and the column disagree" |
| Iron's `d⁶ s²` ending | Ruthenium (iron's family step) | NIST configurations | `4d⁷ 5s¹`, still 8 | Family rows aligned by ending, each with a count badge | "The column follows the count of 8 rather than one exact ending" |

Each case ends at a boundary the Group article names: hydrogen is not an alkali metal; the "iron group" can mean iron, cobalt and nickel; authors differ on roentgenium as a coinage metal; there is dissent about elements 1 and 2. For chlorine the ending is the model's own boundary: NIST lists nothing past hassium (108), so tennessine's place comes from the filling rule alone.

## Model and oracles

- `scenes/explainers/lib/periodic-groups.ts` predicts every configuration by the filling rule and stores the 20 elements where NIST's ground configuration differs. It derives each position from the prediction: block from the last subshell, period from noble gases passed, group from the count with the two visible adjustments above.
- `test/fixtures/periodic-groups/nist-ground.json` freezes NIST ASD 5.12's ground shells for elements 1–108, fetched on 30 October 2026 from the query recorded in the file. NIST lists nothing heavier and does not say which entries are measured and which are computed, so captions say "NIST lists", never "measured".
- `test/explain-periodic-groups.test.ts` checks all 108 NIST configurations, that the exceptions are exactly the 20 differences, and all 118 positions against an 18-column table typed row by row in the test. Every d-block exception keeps its count. Each jump down a group equals one period's length. Every case's step state equals the model's answers (`test/lib/fidelity/periodic-groups.ts`, also run from `test/explain-fidelity.test.ts`). Both the table and the notes are views whose resting pictures follow the recorded state.
- Deliberate defects turned the tests red before the fix: dropping copper's exception (3 failures), reversing the filling-order tiebreak (7 failures), recording a count off by one (fidelity failure) and skipping one redraw (view failure).
- The typed table and the model share an author, so the layout check is independent of the model's rules, not of the author. Group names and CAS/old IUPAC letters come from the Group article; its main table and its names table disagree on groups 8–10's old IUPAC label, and the scene uses the names table's `VIII`.

## Checks run

| Command | Result |
| --- | --- |
| `npm run rayner -- check scenes/explainers/periodic-groups/scene.ts` | Passes all five cases; smallest label 16 px at 1280, 0 labels under 12 px in phone close-ups, no cards at rest |
| `npm run rayner -- review scenes/explainers/periodic-groups/scene.ts` | 5 cases, 70 step-widths, no console errors or runtime connections; caption subjects declared in `scene.review.json` |
| `node --test test/explain-periodic-groups.test.ts` | 10 tests pass |
| `npm run check` | Passes |
| `npm test` (Linux) | 990 tests: 913 pass, 76 skip; the one failure was the page-output pins, refreshed in `test/lettering-baseline-linux.json` (11/11 then pass) |
| `npm run test:embeds` (Linux, Chromium) | 66 pass, 4 skip, 0 fail, before and after the step rail |
| `npm run demos:build`, `npm run check:budgets` | 33 explainers, 169 cases built; budgets pass (this page 947 KiB raw, 282 KiB gzip) |

About 580 labels per case sit outside the phone close-ups: a 118-cell table cannot fit a 358 px stage. Readers reach them with **Next view** or **Whole picture**; every caption subject is in the opening or the tour.

## Rubric reading (author's own)

| Q | P | V | B | G | E | /24 |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 4 | 3 | 3 | 4 | 3 | 3 | **20** |

- **Q 4.** The default case opens on sodium's uneven jumps and answers the gallery title by step 3.
- **P 3.** Column → fill → count → blocks → family is causal. The names step is reference material the topic needs, placed after the payoff, but it does not advance the inference.
- **V 3.** Counts, configurations and the column stay in each resting picture and on direct entry. On a phone the whole table is only reachable through the tour.
- **B 4.** Chlorine, copper and helium each change the outcome or expose an invariant against the same rule and table.
- **G 3.** Pinned Wikipedia revision, frozen NIST fixture and fidelity tests. No chemist has reviewed the scene, and the layout oracle shares the model's author.
- **E 3.** Notation such as `3d¹⁰ 4s¹` is dense for a newcomer, and seven steps with five cases is a long read.

**Hero prompts, J/R/C 4/4/4.** J: a teacher explaining a reproducible observation (uneven jumps, one column) to a named audience. R: one model drives cells, badges, notes, family rows, captions and recorded state, with an external oracle for the configurations. C: chlorine, copper and helium each change the conclusion against the same assumptions. These are selection judgments, not measured demand; the portfolio review's caution about testing author adaptation and reader prediction before promotion applies here too.

## Player: a step rail beside Next

The step transport above the stage now carries one numbered mark per step, joined by a line that fills as the reader moves on. Each mark jumps to its step on click. It sits beside the existing **Next step**, so the reader sees position and remaining length without scrolling to the list under the caption. The rail repeats that list, which keyboard and screen-reader users already have, so it is `aria-hidden` and its buttons are out of the tab order. On narrow screens the marks shrink and wrap under Next. No existing control moved.

## Second pass: prose and posture

An [anti-slop-writing](https://github.com/adewale/anti-slop-writing) review of all 35 captions, titles and lines found these, each fixed in the scene:

- **False gimmick:** "Neither 26 nor the jumps contain an 8", although the jump 18 does. Now: "Nothing in those numbers says 8; counting iron's electrons does."
- **Factual slip:** helium's family caption said counts of 8 and 18 both reach column 18 "with the 10 d columns"; krypton's 18 already includes its d electrons. Now neon and argon shift 10 columns and krypton onward counts 18.
- **Inaccurate metaphor:** "The numbered columns are subshells laid side by side"; it is the blocks that are subshells.
- **Negative-parallel titles:** "Hydrogen shares the ending, not the metal" and "Helium sits by its full shell, not by its count" are now plain claims.
- **Redundant ending:** "not a metal … also needs a metal" now ends on what transfers: the count picks a column, and a name needs more.
- **Length:** captions now run 28–47 words, down from up to 69; the group 3 layout note moved to the names step, where membership is the subject.

wikiHow's [posture guide](https://www.wikihow.com/Improve-Your-Posture) is about bodies, so two of its principles were applied as layout rules, and only where they produce a checkable change:

- **Screen at eye level.** At base, the caption ended below the fold at 1280×720, 1280×800, 1366×768, 1440×900 and 1536×864: readers looked down past the picture to read about it. On a page in its own tab the column now narrows with the window's height, never below 912 px (the stage's smallest label stays at 12 px). Measured at the count step, the caption is now fully in view at 1280×800, 1440×900, 1536×864, 1920×1080 and 390×844. At 1366×768 and 1280×720 its last line is still 19 and 67 px below the fold; going narrower would shrink labels below 12 px. Framed pages keep the old width, because the loader sizes the frame to the page.
- **Neck, back and heels aligned.** The notes above the d block now start on column 3's cell edge, the f-block label on column 1's, and the block labels read in parallel (`s: 2 columns`, `d: 10 columns`, `p: 6 columns`). Title, rail, stage and caption share one left edge.

## Not done

- The macOS output pins in `test/lettering-baseline.json` must be regenerated on a Mac (`UPDATE_GOLDEN=1 node --test test/lettering.test.ts`): snapshot compression uses the host's zlib, and this change touches every page through the player.
- Deployment: `npm run site:export -- --only …` requires the entry, so the public selection must now include `periodic-groups`. Nothing here was deployed.
- The README's hero image and live-site link still show `mr-cache`; they should change once the page is published.
