# PR #32 reader preservation against latest main

Reviewed automerged reader sources against latest main `d8a300b`, while root integrated the main update into `audit/test-contracts`. Scope: `app/embed-closeup.ts`, `app/embed-zoom.ts`, `test/embed-closeup.property.test.ts`, `test/explain-embed.test.ts`, and relevant new player behavior. No source/test edits, production behavior changes or mutations were required from this lane. No commits or broad runs.

## Preservation

- Exact-positive/exact-zero stress membership fix remains the sole close-up production difference from latest main. The independent expected stress intersection oracle, four explicit thin/edge/line receipts, exact stable-partition property and original generated stress/stage domains remain.
- Independent near-label relevance and fallback, exact parts ownership/reading order, and rectangle-union cell/boundary coverage remain. Main's moved/new lettering ranking was combined with these stronger assertions rather than replacing them. The rank uses independently counted new/moved lettering; max ten changes makes its 1000 multiplier safely lexicographic.
- New main heading bounds, recorded heading bottom, fit/legibility and carried-block integration tests remain. These add four close-up declarations (18 total in this file). Main's heading contract changes close-up fit scale only where heading bounds apply; original unheaded geometry/legibility domains remain intact.
- Dead CSS painter/serializer/default and production inverse remain removed. Sole production StageZoom caller still supplies ReaderView.paint. Test-owned inverse readback and helper imports for actual card/diagram evidence remain compatible with the merged player.
- All 20 zoom declarations remain: independent screen projection, author-string identity, actual reset, noncentral anisotropic resize, controlled-RAF current-camera midpoint/Fit cancellation, and independent paint/callback counts survive unchanged.
- Layout assertions still wait for a fresh produced event matching the clicked data-step and target aria-current, then RAF. Main now puts controls immediately below the picture and adds a reserved lede; measuring controls/steps/transcript after produced state remains a valid stability contract.
- Main's player model now observes/asserts title/line/lede via stepWords; old caption/URL/current-step/picture/accessibility assertions remain. No adaptation removes meaningful expected behavior.
- New actual mid-motion Next property remains: actual browser delays, produced target step, exact stage SVG parity with a fresh link, target URL and page errors. This is distinct from settled Next parity and prepared-next DOM birth proof; none was deleted.
- Bounded quiet lifecycle waits, actual camera composition, offline/transport/security and PKCE all-label tour/full containment remain. Actual one-press touch/Enter proof remains in addition to both-attacker/reduced-motion all-label proof.

## Focused verification

`node --test test/embed-zoom.property.test.ts test/embed-closeup.property.test.ts`: **38/38 pass**, no skips, **1973.401ms**. This includes 20 zoom and all 18 close-up declarations. Evidence: `merge32-latest-reader-node.log`.

Targeted actual browser run is limited to caption/layout stability, semantic one-press Next-view touch/Enter, and new mid-motion Next (its original six generated cases); no global case override or generator exclusion. Final results are recorded below when complete. No broad suite was run by this lane; root owns complete merged-tree validation.

Targeted browser command: `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium EXPLAIN_BROWSER=1 node --test --test-name-pattern='stepping moves nothing|Next pressed mid-motion|one press of Next view' test/explain-embed.test.ts`. **3/3 pass**, no skips, **65.942s total including setup**. Layout 16.050s; semantic one-press touch/Enter 6.510s; six-case genuine mid-motion Next 40.658s. The latter retains real browser timing/race behavior and exact fresh-link SVG oracle; its duration is reported rather than hiding it through reduced counts. Evidence: `merge32-latest-reader-browser.log`.

No merge adaptation needed, no failures, no source changes, no allowance changes. Reader lane is frozen and ready for root's final checks.
