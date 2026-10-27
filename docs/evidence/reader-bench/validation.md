# Reader benchmark verification

The original proposal is reviewed in ../pr-11-test-review.md. This branch resolves its arithmetic, invalid-data, observation-window, baseline-dependency and artifact-cost findings. Browser stage writes are labelled as DOM mutations, with no completed-paint claim. Both rounds contribute to the layout invariant. Cleanup proceeds for every resource even if one closer fails.

Verification after merging PR #32/main 9091f5a:

- Fresh whole-project suite: 885 cases; 826 pass, 59 optional skips, 0 failures (193.21s).
- Focused FULL=1 FC_SEED=20261027:37 tests pass, including 24 arithmetic/decision declarations and 13 actual CLI rejection cases (2.17s).
- Two real Chromium controls pass (3.60s): known 120ms click blocking produces observed task/frame/DOM/event values; corrupt observer timestamps reject instead of becoming a pass.
- npm run check passes.
- Actual BASE=HEAD build uses independent locked dependencies, produces identical page/header hashes and skips browser measurements with an explicit artifact-equivalence outcome.
- A forced 1-pair CPU 1 mr-cache control reports every timing as inconclusive. It exits 1 because both unchanged revisions have an observed layout-shift score near 0.002, consistent with the preserved zero-shift rule. This is an existing product finding, not evidence of a timing regression or a green performance result. The seven-pair four-fixture performance campaign was not repeated; thresholds remain a manual calibration heuristic.

Five focused new contracts fail as assertions against the original helpers. Additional controls catch the first fix's large-origin arithmetic error and an ignored second-round shift. Source bytes are restored after every control. Independent implementation-only reviews are retained here; their findings prompted the relative-time arithmetic, both-round shift gate, resource-cleanup and record-validation fixes.

Metric semantics changed deliberately: interaction blocking is the clipped part after a task's first 50ms, and the frame gap includes the final window tail. These replace the proposal's start-only/no-tail definitions. No test silently redefines the old helper contract. Median identity/subnormal/extreme values, finite-input rejection, varied thresholds, small pair counts, pair permutations, window boundaries and both rounds have cheap property proof. Existing browser integration establishes that actual observations reach those functions.

Raw records include time traces, rules, scenario, tool versions, dependency-tree/lock/package hashes, artifact hashes and working-tree fingerprints. The manual control's out/bench/samples.json carries the actual captured data. Optional video and external upstream-checkout oracles remain skipped in the ordinary suite. Repository Actions are still tracked under issue #9; these are local results.
