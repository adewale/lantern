# Current-main integration for PR #32

Merged main d8a300b (release, packed lettering, maths, player and stage tools) while retaining the original audit contracts. Final source/test head: 288b0e22185436e7594633726d9b393599ea1392. The following documentation commit changes no source or tests.

- Fresh standard whole suite: 846 cases, 789 pass, 57 optional skips, 0 failures (210.65s).
- Expanded FULL run initially found two faulty test expectations after 788 passes and 55 optional skips. The VTT oracle incorrectly expected empty captions to produce payloads; explicit empty-before/after cases now pin omission. The lagged-morph property promised a universal quiet bounding-box heuristic that was false even on original main. Its replacement checks independently authored coordinates and fade opacity at every frame and phase boundary, keeping the full original domain and concrete quiet regressions. Focused FULL reruns pass all 7 affected declarations. No product code or detector thresholds changed in these corrections.
- Two isolated motion mutations (wrong phase and nonlinear intermediate fade) fail the new value assertions; original and restored controls pass. Root independently reviewed this preservation repair. See motion triage and controls.
- TypeScript check passes.
- Enabled lettering compatibility: 75 pass, 1 optional upstream-checkout oracle skip.
- Browser suite:35 pass, 1 optional upstream-checkout oracle skip.
- Installed tested archive, TypeScript consumer, executable CLI, source author, capture, notices and lettering package checks pass.
- All 27 explainers / 142 cases pass their demo checks and served desktop/mobile review; 208 share pages pass preview-tag and image-size checks. Video delivery was not enabled.

All seven lettering fixtures were recaptured by the actual pipeline. Six changed fingerprints only. Styles preserves every existing run/face and adds exactly the two standalone bold digits used by numbered headings. Incoming main's 27 immutable page records were migrated before a separate intentional combined-runtime pin refresh. The proxy diagram manifest source hash was restamped by the actual catalog build; its diagram data stayed unchanged.

The original audit's inventories and validation remain historical evidence. Read the latest lettering/reader merge notes and structured results here for this integration. Local verification is separate from repository Actions, which remain tracked under issue #9.

## Final concurrent story integration

Main advanced again to bf78d14 while validation ran, merging PR #29's 18 rewritten stories. This changes scenes, their references and related tests, with no framework/runtime source changes from the validated d8a300b integration. The helper conflict retains the new labelsSaying evidence selector and the audit's test-owned zoom readback; obsolete production inverse imports remain removed.

The combined story tree passes TypeScript, 67 node checks (1 optional skip) over source fidelity, real scenes, language and close-up geometry, and 3 real browser checks covering target-aware caption layout, both-setting phone tours and touch/Enter evidence navigation. All 27 immutable page/header/receipt contracts were rebuilt after first migrating the exact incoming records. The framework's fresh 789-pass standard run and focused FULL repaired properties above remain applicable to unchanged framework source.
