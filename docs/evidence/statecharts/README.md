# Statecharts: decisions

Based on the media player in David Khourshid's [Statecharts in 2 minutes](https://x.com/DavidKPiano/status/2116523008323981315).

- **Reader and claim.** For someone who writes flat state machines: a statechart behaves the same as its flattened machine. It draws fewer arrows because a parent's transition covers its children, and parallel regions hold one state per control instead of one state per combination.
- **Countercase: play only.** It tests the shortcut "a statechart is always smaller". With one control the chart has one more state (`on`) and saves one arrow.
- **No three-control drawing.** Its flat machine (9 states, 33 transitions) isn't legible at the check's label sizes, so the growth for 1 to 4 controls is a table instead.
- **Oracle.** XState 5.33.3 is run against the same charts; see `tools/oracle/statecharts.ts`. The model covers compound and parallel states with event transitions only, and XState vouches for these charts, not for statecharts in general.
- **Limits.** The counts assume controls that never depend on each other. On a 390 px phone the flat machine needs a seven-view tour. No subject expert has reviewed the scene.
