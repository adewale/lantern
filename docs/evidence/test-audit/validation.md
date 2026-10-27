# Validation

Final tested source/test head: `35384175b8f527be62996e35f2ced90ad2f687a8`, including main `fad29b00a0c1984984ab4e0f4bbe363199520371`. Node 26.12.1, Chromium 154, pinned lettering fonts and Python environment. Property-run defaults and dependencies are unchanged. The final documentation commit adds no source/test edits.

| Check | Result |
| --- | --- |
| npm run check | Pass: all TypeScript projects and package consumer |
| npm run test:full | 772 cases: 733 pass, 39 explicit optional skips, zero failures; 1033.27s |
| Enabled lettering and outline browser checks | 39 pass, zero failures/skips; 28.82s |
| npm run test:embeds | 23 pass, zero failures/skips; 499.86s |
| npm run demos:check | All 26 explainers, 140 cases pass |
| EXPLAIN_BROWSER=1 npm run pack:smoke | Fresh archive install, executable bin, compiled engine, authoring/check/build/see/describe, notices, lettering and installed diagram capture pass |
| npm run demos:review | All 140 served cases pass desktop/mobile, caption/artwork, error/network, headers, preview tags and two-embed host checks |

[Structured results](validation-results.json) record the final run. Optional video/FFmpeg delivery was not tested. Skips are not counted as passes. Elapsed times include shared-host effects and are not controlled before/after suite benchmarks.

The enabled lettering command was:

```sh
EXPLAIN_LETTERING=1 EXPLAIN_BROWSER=1 node --test test/lettering-outlines.test.ts test/lettering-*-audit.test.ts
```

The final commands used `npm_config_cache=/workspace/.npm`, `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` and `RAYNER_LETTERING_PYTHON=/workspace/.tools/lettering-venv/bin/python`.

Before concurrent main integration, a full run passed 728 cases with 38 optional skips; enabled lettering 39, browser 22 and all 140 demo cases also passed. Those are historical results, not substituted for the final integrated runs above. The first package attempt failed before installation because npm's default /home/agent cache directory was unavailable; using the writable configured cache corrected that environment error. The package check was then repeated on the final tree.

Twenty-four deliberate defects were killed at intended assertions before main integration; production bytes were restored after every control. Cross-lane reviews checked that the combined tree retained their contracts. Each of five production fixes also has a pre-fix failure, including the thin-intersection regression added after integration. Generator/oracle mistakes found by controls and preservation reviews are recorded in lane actions and the main-update review.

Repository Actions were disabled during this work (tracked in #9). These are local results; this report does not claim a green GitHub workflow.
