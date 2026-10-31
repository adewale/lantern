# Periodic-table gallery entry

The lesson asks why elements with uneven atomic-number gaps share a column. A reader picks sodium, chlorine, iron, copper or helium and follows seven steps from atomic number to configuration, electron count and group. It is the gallery entry.

## Model and source boundary

The model fills subshells in Madelung order (`n + l`, then `n`). It derives positions from that prediction and counts s, d and p electrons beyond the previous noble gas, excluding f. Before period 4, the p block needs a visible ten-column adjustment. Helium's count of 2 differs from its group of 18. This table uses Sc, Y, Lu and Lr in group 3; other layouts use La and Ac.

`test/fixtures/periodic-groups/nist-ground.json` records an ASD 5.12 query captured on 30 October 2026: elements 1–108, with 20 differences from the filling-rule prediction. Its rows do not distinguish measured configurations from computed ones. Beyond that fixture the scene uses a prediction. This coverage limit does not establish the limits of available scientific evidence.

An independent parser expanded every captured raw shorthand row, including nested `[Cd]` and `[Hg]` cores. The expansions, electron totals and subshell capacities matched the normalized fixture. This checks the captured data's consistency; a fresh NIST download was unavailable. No chemist has reviewed the lesson and no reader study has been conducted.

## What the scene checks

| Case | Pivotal comparison | Boundary |
| --- | --- | --- |
| Sodium | `11 - 10 = 1`, `[Ne] 3s¹`, count 1 and group 1 | Hydrogen shares the s¹ ending but is not an alkali metal. |
| Chlorine | `17 - 10 = 7`; aluminium's count 3/group 13 and chlorine's count 7/group 17 | Tennessine lies beyond the captured reference. |
| Iron | Ruthenium's d⁷ s¹ ending retains iron's count of 8 | “Iron group” can also name iron, cobalt and nickel across a row. |
| Copper | Predicted `4s² 3d⁹` and listed `3d¹⁰ 4s¹` both count 11 | “Coinage metal” is a looser name than group 11. |
| Helium | Count 2 suggests a position over Be; the table puts He over Ne in group 18 | Group placement uses the full shell, not this count alone. |

Opening and count steps put their complete comparisons above a small unlabelled 118-cell table. The detailed table returns when later steps use it. Independent tests check 108 configurations, all 118 positions, 28 family members, 23 jumps, 16 count/group rows, three core equations, copper's two configurations, helium's placements and eight boundary outlines.

## Atlas inside the picture; the player unchanged

The scene draws its picture in [Atlas's design language](https://atlas-48p.pages.dev/about/design). The player is not restyled: `app/`, the gallery generator and the player tests are exactly as on `main`, and every other explainer is unchanged.

- **Palette.** Paper `#f7f2e8`, black `#0f0f0f` and Grey Mid `#666` for secondary text. Block colours: s deep blue `#133e7c`, d warm red `#9e1c2c`, p mustard `#856912`, f black.
- **Cells.** Lit cells and the blocks step are solid block colour with paper lettering. Paper text on each reaches 4.67:1 (mustard) or better. Neon's core, in the count step's context table, stays a pale tint. Cells are square.
- **Numbers.** Atomic numbers, jumps, counts and the core equation use the monospace face. In the count rows each count takes its element's block colour. Family badges are block-coloured squares.
- **What stays as it was.** Boundary outlines stay black: a warm red outline would vanish against the d block. The step number drawn on the stage keeps the player's teal, so it matches the step bar.
- **One side effect from `main`.** `main`'s player tints its card 10% toward each explainer's paper, so this card takes a faint warm tint. On it, text, secondary text and the accent read at 16.3, 6.3 and 7.1:1 in the light theme and 10.6, 5.5 and 7.1:1 in the dark, above the 7, 4.5 and 3:1 that `test/embed-tint.test.ts` asks of the built-in palettes.

| | Before | After |
| --- | --- | --- |
| Blocks step, 1280×800 | ![Pale tinted blocks with rounded cells in the main player](periodic-groups/atlas-blocks-before.png) | ![Solid deep blue, warm red, mustard and black blocks with square cells, same player](periodic-groups/atlas-blocks-after.png) |
| Chlorine count, 1280×800 | ![Count rows in one colour](periodic-groups/atlas-chlorine-count-before.png) | ![Counts in each element's block colour, groups in bold monospace](periodic-groups/atlas-chlorine-count-after.png) |
| Sodium opening, 390×844 | ![Sodium highlighted in pale blue](periodic-groups/atlas-phone-sodium-before.png) | ![Sodium as a solid deep blue cell; the player around it identical](periodic-groups/atlas-phone-sodium-after.png) |

Both columns use the player on `main`; only the scene differs (`bf24af0`'s palette before, Atlas after).

An earlier version of this PR restyled the shared player in Atlas's design language and added an 880 px standalone reading floor to every player. Both were removed: the player is shared by every explainer, and Atlas belongs to this explainer's picture only. Two defects the audit found came from that player styling and left with it: uppercase CSS that turned authored `-m` switches into `-M`, and a selected case that forced colours erased.

Without the reading floor, `main`'s player sizes this stage by the window's height. The full-table steps' smallest labels (atomic numbers and the block strip, 0.22 units) then draw at about 9.7 px at 1280×720 (708 px stage) and 11.9 px at 1366×768 (868 px), and 12.5 px at 1280×800 and larger (908 px). These sizes are computed from measured stage widths; the picture scales linearly. The count step's comparison stays at or above 12 px at every size `test/explain-periodic-reader.test.ts` measures.

## Adversarial audit repairs

The follow-up audit found five defects. Two were in the Atlas player styling, removed as described above. The other three are fixed here: overlapping bounds let an unchanged reorder count as new artwork; removing a duplicate layer missed newly revealed paint; and later descriptions claimed pale core cells while all 118 cells were solid block colours.

The description regression checks all 35 case/step combinations against independent expected cell fills, opacity, recorded state, text summary and HTML description. Original wording, missing complete-block paint and missing valid core wording each fail its deliberate-defect controls.

Review regressions compare native paint and use effective CSSOM poison controls for a newly revealed layer. The checker must reject an unchanged picture without a named subject and detect hidden paint that became visible after a duplicate was removed. These controls are separate from equivalent-redraw and disjoint-order acceptance tests.

Collection review combines built-in and companion claims. Claims and their loader enter its fingerprint, so edits, additions or removal invalidate older receipts. Every case and resting step remains subject to the browser review at both widths.

## Evidence and verification

The before/after captures above use the player on `main`. Older images in `periodic-groups/` (`phone-*`, `sodium-steps.png`, `countercases-count-step.png`) document earlier layouts in the player that preceded `main`'s redesign; `phone-*-before.png` come from `b944907`.

The PR records the commands and exact counts from the final verification run. Local Chromium checks do not establish physical iPhone behaviour, native Safari, speaker output or reader comprehension. Nothing here deploys the gallery. A future curated `site:export --only` selection must include the new `periodic-groups` entry.

This evidence note and the PR description were edited using [anti-slop-writing](https://github.com/adewale/anti-slop-writing): claims identify the mechanism and observed result, with source and browser limits stated beside them.
