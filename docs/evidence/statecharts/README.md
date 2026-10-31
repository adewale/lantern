# Statecharts

This scene is for a developer who already writes flat state machines and has been told to use a statechart. It is based on the media-player example in David Khourshid's [Statecharts in 2 minutes](https://x.com/DavidKPiano/status/2116523008323981315) (31 October 2026). The model, captions and pictures are Rayner's.

## Plan

```text
Reader:    writes flat state machines (a reducer table, a Mermaid state diagram) and suspects a statechart is the same thing with more notation
Question:  if every statechart flattens to a state machine, what does a statechart change?
Answer:    behaviour stays the same: flattening the chart gives back the flat machine, and both reach the same state on every event.
           What changes is the drawing. A parent state's transition covers every child that does not handle the event,
           and parallel regions hold one state per control instead of one state per combination.
Model:     player(n) builds off | on{n two-state controls}; flatten() explores every reachable configuration; send() selects
           transitions with SCXML's rules for compound and parallel states
Sources:   Harel 1987; W3C SCXML 1.0 (2015), Appendix D; XState 5.33.3, run as the oracle
Case:      baseline: play and mute (two controls) | changed: play only (one control) | fixed: one POWER on on, two-state controls,
           the same events | predicted: flat 5 states/13 transitions → 3/5; chart 6/6 → 4/4 | pictured: both diagrams, the counts
           card, the growth table | conditional: with one control the chart has one more state and saves one arrow
Limit:     counts for controls that never depend on each other; no guards, history, entry/exit actions, delays or final states
```

The pivotal inference is the `power` step:

| question | before | model operation | after | same entity or invariant | resting witness | source |
| --- | --- | --- | --- | --- | --- | --- |
| Who handles POWER inside `on`? | playing, muted | `send(chart, ['playing','muted'], 'POWER')`: neither leaf has POWER, so the nearest ancestor that does, `on`, supplies the transition; its domain is the root, so both regions exit | off | the flat machine's `playing_muted → off` arrow from step 1 | trail on `on → off`, `off` marked active, card row "Handled by: on" | SCXML Appendix D `selectTransitions`; XState 5.33.3 reaches `off` |

The tempting shortcut is "a statechart is always smaller". The play-only case refutes it: the parent `on` is a state too, so with one control the chart has 4 states to the flat machine's 3 and saves a single arrow. The final table, computed by the model, shows where the saving comes from. With n controls the flat machine has 2ⁿ + 1 states and (n + 1)·2ⁿ + 1 transitions, while the chart has 2n + 2 of each. The chart has fewer states from three controls on.

## Checks

- `test/statecharts.test.ts` compares the model with `test/fixtures/statecharts-xstate.json`. That file holds XState 5.33.3's own exploration of each player with one to four controls (every reachable configuration, every event `can` accepts and where it leads), the explainer's event sequences, and a chart where a child and its parent both handle the same event. Regenerate it with `npm install --prefix <dir> xstate@5.33.3` and `node tools/oracle/statecharts.ts <dir>`; `--check` compares without writing. The tests also hold a hand-written list of the two-control flat machine's 13 transitions, closed-form counts, and a seeded property: any event sequence leaves the chart in the configuration its flat machine names.
- Two deliberate defects failed the tests before the source was restored. When a parallel state entered only its first region, five tests failed. When the outermost state's transition was chosen ahead of the innermost, the preemption test failed.
- `test/lib/fidelity/statecharts.ts` checks every step of both cases: counts, configurations, the state that handled each event, and the growth table. Every walk must ride the transition the model took. One captured diagram must draw exactly the flattened machine's transitions, and another exactly the chart's. Two mutations failed it: a wrong `handledBy`, and the events sent in a different order.
- The describer change (start and end dots named, composite states counted) is tested in `test/explain-real.test.ts`. The chart is described as "State diagram: 6 states, 6 transitions", the same as the model's counts.

`rayner check` passes both cases. No label is under 12 px in a phone close-up, and no caption is an outlier. `rayner review` passed 2 cases and 22 step/width openings at 390 and 1180 px, with no console errors and no runtime connections. The built page is 762 KiB, 301 KiB gzipped.

## Limits

The model covers compound and parallel states with event transitions only. XState is an oracle for these charts, not for statecharts in general. The counts assume independent two-state controls: a control that depends on another needs guards or cross-region events, which the model leaves out. On a 390 px phone the flat machine needs a seven-view tour. No subject expert has reviewed the scene.
