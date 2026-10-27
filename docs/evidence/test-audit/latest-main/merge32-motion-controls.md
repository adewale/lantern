# Isolated controls for restored matching-motion contracts

Root production and benchmark source were never mutated. A detached temporary worktree at commit f182c6869d4991c321640a56608dcab5a7bdb33f received the current root matching-motion test bytes and a node_modules symlink to /workspace/rayner/node_modules. Only its src/animation.ts was temporarily mutated. The root all-files suite could continue independently.

Control runner: `/tmp/run-motion-isolated-controls.py`; structured results: `/tmp/motion-isolated-controls.json`. It saves original source bytes, applies one defect, runs only the deterministic restored-law witness, restores bytes in finally and asserts equality after each defect. It removes the entire temporary worktree in an outer finally and separately verifies root src/animation.ts bytes never changed. git worktree list confirms the temporary worktree is gone.

Command in the isolated worktree (Node26):

```sh
/tmp/rayner-node-floor/node-v26.0.0-linux-x64/bin/node --test --test-name-pattern='continuous matched glyphs' test/matching-motion.test.ts
```

| State | Result | Intended failure | Log |
| --- | --- | --- | --- |
| Unmodified copied witness | Pass | none | /tmp/motion-control-baseline-green.log |
| Phase offset index×lag changed to index×lag×0.8 | Assertion failure | pair1 at alpha0.12186864197530864, coordinate-1.64929282665 versus authored expectation-1.80498051643 | /tmp/motion-control-phase-red.log |
| Riding fade intermediate opacity size changed to size², endpoints retained | Assertion failure | opacity0.96322757544 versus authored independent phase expectation0.98144158025 at alpha0.26159901234567895 | /tmp/motion-control-opacity-red.log |
| Original bytes restored | Pass | none | /tmp/motion-control-restored-green.log |

The opacity defect leaves size0 and size1 unchanged, so its kill demonstrates intermediate fade-law evidence rather than merely endpoint coverage. The phase defect is rejected by the authored point-value oracle, not by the motion detector. Both failures are assertions, not syntax/loading failures.

Original/restored isolated animation source SHA256:416a5cf0f43516845bb4c3451df1c5c4562ca7d7c79c8782927acf3fd8a4d07d. Full copied-test SHA and per-defect source hashes are recorded in the structured results. Root source/test files remained frozen during these runs.

Root's independent preservation review accepted the authored point and unmatched-opacity proof before these controls. The repaired test retains all original strings/sizes/moves/lag/fonts and300 cases (3000FULL), four concrete quiet regressions, Code quiet proof, seek replay and broad-lag replay. No quiet threshold, generator restriction, detector exemption or production geometry was changed. Public pairs supply correspondence only; matching.test.ts independently owns selection. Expected values use authored snapshots, independent stagger phases and default-rate polynomial. The historical box-heuristic warning is documented in merge32-motion-triage.md, not required as immutable API behavior.
