# Validation

Product and review implementation: `76ee1201349ca0cb5faca199fb80ca45b1534669`. Node 24.22.1, Linux, Chromium 154. The final evidence-only commit does not change rendered output or review code.

| Check | Observed result |
| --- | --- |
| TypeScript and installed consumer | `npm run check` passes after the final subject changes |
| Standard suite | 869 cases: 810 passed, 59 explicit optional skips, no failures; two test workers to share the machine with browser review |
| Final affected owners | Both story test files with `EXPLAIN_BROWSER=1`: 10 passed, no skips or failures, including the subsequently added independent subject-selection law |
| Pure geometric properties | Rectangle-union owner passes 10,000 cases with `FULL=1 FC_SEED=20261028`, against independent integer-cell centres |
| Pure inventory properties | All three plan owners pass at `FULL=1 FC_SEED=20261028`, including generated round-robin inventories and malformed/missing/stale/duplicate receipt controls |
| Deliberate defects | 23 distinct mutations reject at assertions; production bytes restored. See `mutations.json` and `mutation-assertions.txt` |
| WCAG backend checker | All 12 cases pass after the Focus Visible cue; prior full catalog backend validation is retained in PR #41 |
| Old WCAG production page | Rejects the independently named `c2_4_7` opening requirement at 390px |
| Bounded browser probes | Complete Saturday/airport GTFS variant: 18 states; complete Local/3-1-0 traffic-policy variant: 14 states; zero page errors |
| Full production browser review | All 27 explainers, 142 cases and 1,037 resting frames at both widths: 2,074 states and opening screenshots; zero console errors or external connections |
| Artifact union | Real merge CLI passes; an additional comparison against built `describe.json` lists confirms the exact case, step and width inventory and screenshot count |
| Deployment checks | Every part passes headers, the two-embed host and metadata/picture checks for all 208 exported pages |
| Installed package | Exact archive from clean `cc7a96390cc7f45f0834805f237985835064bb97` passes installed TypeScript/JS authoring, browser playback, diagram/PNG capture and real Arabic/maths capture. Packing the final source produces identical archive bytes |

The standard run preceded the final subject-priority changes and one added pure test. Both affected files were rerun with all browser checks enabled after those changes; the entire final catalog was then reviewed with the same implementation hash. Optional checks skipped in the standard run are not counted as pass evidence.

The final parts contain 48/47/47 cases and 706/692/676 step-width rows. Each has catalog hash `f0b750e254dac5350c8755d1be29ceaa58eca3725f7ebd62c2dc63dd819b0ea8` and review-code hash `6c35abf55b8a1fa976551ea570cab9d06f0b009ad6071ac82acadf004ae3fd85`. The combined raw receipt SHA-256 is recorded in `coverage.json`.

The tested archive integrity is `sha512-h8iQ9aBIW6gse5vHDeO4q+EhfD3KBT4QV+/latQB8ORUITcZKiq3t0u/Iq/iklmyKQJM1gk9U+pbPWu4HCfdgQ==`. No package was published.

## What the first attempts taught us

The initial all-step run rejected diagram background paper in GTFS. The next attempt rejected a rebuilt but unchanged axis label, and a traffic-policy incoming route intentionally entering an authored viewport. These were review-contract errors, recorded in `classification-controls.json`; no product change was made to force those compositions through the check. Primary caption/helper subjects now take precedence, labels and explicit arrow claims remain complete, and helper route shapes may use the authored visible portion. Independent acceptance and rejection owners protect that distinction.

A style-attribute poison initially survived because CSP blocked it and left an earlier hidden state. An incidental-context mutation initially survived the small browser fixture because its tour included that context. The repaired controls verify their visible starting state, use real CSSOM changes, and add an independent subject-plan law. Those initial survivors are not reported as successful rejection evidence.

## Hosted execution and access

GitHub previously returned 422, “Actions has been disabled for this repository,” and 403 when this credential attempted to enable Actions. No hosted or macOS pass is claimed. An owner must enable Actions and require the check, catalog, story and compatibility checks under issue #9.

At final PR preparation, the active managed network policy also denied `api.github.com`, including PR readback. The saved environment draft already allows that host, but the active configuration does not. The reusable draft now selects the tested Node 24.22.1 instead of stale Node 26 instructions. Saving that draft does not apply it: review/save the environment settings and publish the environment to activate the pending configuration. Normal repository Git access remains available; repository protections still apply to pushes.
