# Merge32 motion-property triage and repair

The full merge32 run exposed a preexisting overclaim in the universal quiet-motion property, not a new geometry regression. No production geometry, detector thresholds, generator domain or case count was changed.

## Reproduction and classification

Full failure: seed -1799293976, path `2738:10:22:12:10:14:10:10:11:10:10:11:10:13:10:13:12:10:10:12:10:10:11:10:13:11:11:10:11:43:11:11:12:11:11:14:14:12:14:11:16:11:11:11`, source `(ab`, target `xab`, size0.25, move[2.4041374921798706,0], lag0.19999994473898122, sans. Log `/tmp/rayner-merge32-full.log`.

Simpler deterministic witness: same strings/font/size, move[2.5,0], lag0.2. At30fps the line box widths at frames7/8/9 are0.599342585,0.817815781,0.841825068. The middle relative change is0.267, exceeding minResize0.25 and three times neighboring relative changes. The `b` remains at its start while the earlier matched `a` travels; changing which glyph owns the line's left/right edge produces the box-size spike. The detector accurately applies its heuristic; that heuristic is not a mathematical continuity proof.

Matching and verifier production files are unchanged against origin/main. A temporary origin/main copy of the original test with the same public deterministic fixture fails too: `/tmp/rayner-motion-origin-red.log`. The original generated domain and assertion were identical; this audit had only renamed the property and added broader replay coverage. Temporary file removed.

Independent bounded public point probes show continuity. Around7/30, max coordinate difference across t±epsilon is0.014060259,0.001406074,0.000140667,0.000014067 for epsilon1e-3,1e-4,1e-5,1e-6. Around8/30 the corresponding changes are0.016802192,0.001680255,0.000167966,0.000016809. They decrease linearly rather than preserving a snap. Raw reproducible standalone scripts/logs: `/tmp/rayner-motion-repro.mjs`, `/tmp/rayner-motion-repro.log`, `/tmp/rayner-motion-continuity.mjs`, `/tmp/rayner-motion-continuity.log`.

The file header and MATCHING documentation already acknowledged that staggered matched glyphs can cross a line quickly and trigger verifier spikes; the empirical lag cutoff0.2 did not imply a universal quiet guarantee. The new header states the actual distinction. The historical warning is evidence here, not a permanently required diagnostic result; detector improvements may remove it without breaking this regression.

## Replacement contract and preservation

`test/matching-motion.test.ts` now retains the entire original string/size/move/lag/font generator, including default rate, and300 cases (3000 underFULL). It snapshots source/target authored glyph coordinates before begin. Public `pairs` selects correspondence only; expected geometry is computed from those independent snapshots and an independently expressed stagger schedule, at all31 frame times and each matched glyph's waiting/active/finished boundaries plus adjacent alphas. Quintic smoothstep is independently evaluated as6t^5-15t^4+10t^3, so default-rate behavior remains part of the contract. No production subAlpha, internal moves/fade rows or subject-generated aligned endpoints are read as numerical oracles.

The public pairs/removed/added lists are checked as disjoint complete partitions of the original authored glyphs. Pair-selection correctness remains owned by matching.test.ts (key matching, ordered runs, distances and source order); this replacement does not claim an independent pairing algorithm. This distinction avoids copying the production matching algorithm into expected values.

Every matched endpoint is pinned to exact authored coordinates. The entire visible source endpoint equals authored source geometry, and the entire final visible geometry equals authored target geometry: removed glyphs must be invisible, added glyphs must appear, no extra visible parts survive. The Text advance frame also equals the exact authored target frame; target geometry must remain unchanged. This preserves unmatched endpoint obligations, including cases with no matches.

Intermediate coordinate allowance is one Float32 relative unit at the authored coordinate scale plus a separately bounded IEEE expression/schedule term. It is derived from Float32 storage, not fitted to this failure, and is much smaller than ordinary fixed geometry budgets. There is no detector epsilon change, threshold change, event-kind filter or generator exclusion.

All four specific quiet regression fixtures remain unchanged, as do the Code quiet fixtures, played/seek regression and broader lag0..1 replay property. The simpler shrunk witness now explicitly exercises the same independent geometry law instead of asserting a heuristic warning must exist forever.

## Verification

Command:

```sh
PATH=/tmp/rayner-node-floor/node-v26.0.0-linux-x64/bin:$PATH FULL=1 FC_SEED=-1799293976 node --test test/matching-motion.test.ts
```

All6 declarations pass, zero skips/failures,14,480.185ms total. Generated authored interpolation:3000 cases,9787.016ms; broad lag replay:1000 cases,3904.867ms. Log `/tmp/rayner-motion-analytic-full.log`. No production changes or blanket recalibration. Independent preservation review remains a root responsibility before merge.

## Preservation follow-up: intermediate unmatched opacity

The same checker now snapshots authored source/target opacity before begin and validates every removed glyph against authoredOpacity×(1-local), every added copy against authoredTargetOpacity×local, and matched glyphs against unchanged authored opacity. The public fadesIn.sub reference is used solely to read the observed copy; no production row times, opacity snapshots or phase helpers supply expected values. Slot phases come independently from the documented pairs/removed/added order. Opacity arithmetic uses only128×Number.EPSILON×max(1,slots)×max(1,authoredOpacity), with exact endpoint values; there is no Float32 allowance because opacity is ordinary double state. Phase-boundary sampling now covers all slots, including unmatched parts, not only matched glyphs. Full visible source/target endpoint geometry assertions remain.

Final focused FULL run, same command/seed:6/6 pass, zero skips/failures,13,623.157ms total;3000 analytic cases10,255.005ms,1000 broad replay cases2706.642ms. Log `/tmp/rayner-motion-opacity-full.log`. Source remains unchanged; diff whitespace check passes. This restores the valid unmatched pop/fade obligations formerly conflated with the invalid universal line-box heuristic claim.
