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

## Shared player

Atlas's paper, black, blue, red and mustard colours and square corners apply to the player and gallery. Each scene retains its own stage palette. The periodic table uses solid block colours with paper lettering; its palest text/block pair exceeds 4.5:1. The shared chrome retains main's tile, single stepper row, accessible step list, progress bar, disclosures, measured header and frame-sizing protocol.

Author-provided text keeps its original case: `-m`, `Arc<T>`, `i32` and `isdigit()` remain distinct identifiers. Selected settings and the current step remain marked in forced colours. Muted light-theme text is `#606060` so the existing 78 palette/theme/role contrast checks retain their thresholds with main's tile tint.

Standalone stages have an 880px reading floor when space permits: the smallest detailed-table label is 0.22 scene units, or 12.1 CSS pixels at that width. Narrow windows fit their available width. Framed pages retain host-driven sizing to avoid height/width feedback. The floor can require scrolling in a short desktop window; it does not promise that every caption fits above the fold.

## Adversarial audit repairs

The follow-up audit found five defects: CSS changed identifier case; forced colours erased the selected setting; overlapping bounds let an unchanged reorder count as new artwork; removing a duplicate layer missed newly revealed paint; and later descriptions claimed pale core cells while all 118 cells were solid block colours.

The description regression checks all 35 case/step combinations against independent expected cell fills, opacity, recorded state, text summary and HTML description. Original wording, missing complete-block paint and missing valid core wording each fail its deliberate-defect controls.

Player regressions use served pages to inspect authored casing and selected/current state, including Chromium's forced-colours mode. Review regressions compare native paint and use effective CSSOM poison controls for a newly revealed layer. The checker must reject an unchanged picture without a named subject and detect hidden paint that became visible after a duplicate was removed. These controls are separate from equivalent-redraw and disjoint-order acceptance tests.

Collection review combines built-in and companion claims. Claims and their loader enter its fingerprint, so edits, additions or removal invalidate older receipts. Every case and resting step remains subject to the browser review at both widths.

## Evidence and verification

The current capture commands, immutable source revisions, image receipts and focused before/after comparisons are in [periodic-groups-audit/README.md](periodic-groups-audit/README.md). Earlier images in `periodic-groups/` document intermediate layouts and are retained as history; they do not show the integrated player.

The PR records the commands and exact counts from the final verification run. Local Chromium checks do not establish physical iPhone behaviour, native Safari, speaker output or reader comprehension. Nothing here deploys the gallery. A future curated `site:export --only` selection must include the new `periodic-groups` entry.

This evidence note and the PR description were edited using [anti-slop-writing](https://github.com/adewale/anti-slop-writing): claims identify the mechanism and observed result, with source and browser limits stated beside them.
