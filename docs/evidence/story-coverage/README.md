# Story coverage audit

The previous collection review opened one selected step per settings case. It checked caption text and label size without proving that the named artwork was painted or reachable. Source-box projection could also credit missing SVG paths. These were missing contracts; increasing generated-case counts could not catch them.

`tools/lib/explain-story-review.ts` now owns every resting step at both review widths. It observes the matching ready event, checks the served record signatures, reads native SVG geometry and computed paint, and visits the real close-up tour. Every frame needs a subject. Fresh helper emphasis and declared caption claims identify the primary subjects. Changed artwork supplies fallback subjects when neither exists; independent caption claims cover the OAuth arrows, Lantern edge labels, cache labels, token-bucket labels and WCAG Focus Visible opening. A caption over unchanged artwork must declare its subject. Reserved diagram `__frame` paper, like stage paper and headings, cannot supply an automatic story subject. Explicit caption claims remain checked.

Arrow claims additionally require painted stroke ink: a surviving label alone cannot stand in for its route. Both OAuth settings cases pass the stronger source contract, and a label-only route rejects.

The WCAG AA/AAA 2.4 Focus Visible step exposed a real omission: the caption discussed criterion 2.4.7 while the phone opening showed other criteria. Marking the criterion supplies the missing narrative cue. The matched screenshots use `level=AA&guideline=2.4&step=focus-visible` at 390×844. Inspect the card in the stage: before it shows Page Titled, Link Purpose and Headings; after it shows Focus Visible. The screenshot pair does not prove all captions or all mobile layouts.

The first expanded browser run exposed a GTFS classification error: a newly replaced background rectangle was treated as content that every tour had to cover. The phone intentionally focuses on the trip rows. The corrected classification uses the existing reserved `__frame` key, and the Saturday day step independently requires the four AAMV route-50 labels named by its caption. The next run exposed unchanged axis context rebuilt during the same edit. Primary subjects now take precedence over that incidental context. All six GTFS source cases pass; the complete Saturday/airport browser variant passes 18 states.

Traffic-policy’s Local path intentionally clips the incoming load-balancer route while showing what happens inside Node 1. Fresh helper route shapes are checked within their authored clip/camera; their labels remain whole. Explicit caption targets remain whole, including the internal Node-1-to-pod-a arrow, the node and pod, and the client-address note. The complete Local/3-1-0 browser variant passes 14 states. The real fixture separately proves that a highlighted line entering a viewport passes, an explicit whole-arrow claim rejects the crop, and an entirely off-screen highlighted route rejects even when another highlighted subject is visible.

## Owners and controls

| Contract | Owner and independent check |
| --- | --- |
| Complete step/width inventory, including final step | Real served five-step fixture; exact ten-row expectation and omitted-step/desktop mutations |
| Tour coverage without holes | Rectangle-union PBT against integer unit-cell centres, including adjacent views and a gap |
| Complete named labels | Logical glyph checks before accepting surviving rendered records; opacity, clipping and partial-draw controls |
| Stage membership and replacement ink | Missing fresh emphasis rejects; marked route must bind the painted sibling rather than its invisible carrier |
| Actual paint at the reachable view | Real Chromium checks computed fill/stroke, ancestor opacity/visibility and effective clips; missing-path, transparent-paint, CSS-clip, transformed-clip and later-view controls |
| Expected context independent of damaged DOM | Authored clip determines the obligation; live clipped ink determines coverage at each stop |
| Caption over unchanged artwork | Missing declaration rejects; explicit existing subject accepts |
| Full catalog across parallel jobs | Independent built description inventory; exact shard identities, case assignment, steps/widths and catalog/reviewer hashes; omitted/duplicate/stale/error controls |
| Focus Visible opening | Independent named criterion claim rejects the old production page and accepts the marked version |

An incidental-context mutation initially survived the small browser fixture because its tour happened to include that context. An independent subject-plan law now checks both caption and helper selection, with GTFS as the browser counterexample.

The browser controls themselves needed repair. A style-attribute poison was blocked by CSP and retained an earlier hidden state. Each poison now starts from verified visible ink and uses individual CSSOM properties. The final structural clip controls reject displaced rect/clipPath transforms and object-bounding-box units, while normal clips remain accepted. Twenty-three deliberate mutations reject at assertions. A separate injected server-listen failure reproduces the old stale-receipt bug; the repaired command removes the old success receipt and writes the injected error to its failure report. The same control passes for an asynchronous listen error. A real occupied-port test additionally requires the exact `EADDRINUSE` rejection and verifies that the existing host remains usable.

Mutation rejection is evidence only when the intended assertion fails; import or syntax failures do not count.

## Scope decisions

Named caption subjects and fresh emphasis require complete labels. Explicit arrow claims require the whole arrow; a helper-highlighted route may enter an authored viewport, but cannot disappear entirely. Declared subjects and fresh helper intent take priority over incidental context; changed artwork is a fallback. Incidental context may be cropped by an authored viewport, as in traffic-policy detail views; its expected visible portion must still be painted and reachable. A mutable browser clip cannot reduce that expectation. Existing route checks continue to own native/imported label crossings, stroke footprints, clips, paint order and label plates.

The stage allowance is one CSS pixel for antialiasing and stroke-edge rounding, matching the existing narrow-phone PKCE contract. A preliminary French tax-code card border differed by about 0.1 CSS pixel; this was a rounding fringe, not missing story content. Rectangle union remains exact. SVG path-formatting allowance is separately bounded to one SVG unit.

A preliminary token-bucket claim demanded an unchanged balance readout during the rate-trace step. Reading the caption showed that the step explains the three rate labels. The independent claim now names those labels; the product was not changed to satisfy the mistaken expectation.

The source survey covers all 27 explainers, 142 settings cases and 1,037 resting frames. Existing transport, motion/races, offline/no-JS, keyboard, touch, 320-pixel PKCE, wording/value and raster owners remain in place. PBT supplies cheap geometric proof; it does not replace those boundaries or infer arbitrary caption meaning. Arbitrary SVG occlusion still needs the retained collision/raster checks and visual review.

[Final validation](validation.md) records the completed commands, exact split counts, receipt hashes, package integrity and remaining hosted-access limits.

## Reproduction and CI

Use Node 24 and Chromium. Run `npm run check`, `npm test`, `EXPLAIN_BROWSER=1 node --test test/explain-story-review.test.ts`, `npm run demos:check`, then `npm run demos:review`. Review screenshots are written under `out/review/story`; the success receipt is `out/validation/browser-review.json`. Each started review invalidates its scoped success receipt before server startup, and saves a failure screenshot/error when a review fails. CI passes the exact catalog artifact to three story jobs and uploads each part’s review artifacts even on failure. Each part owns its directory and receipt. `node tools/explain-review-merge.ts` requires all three matching parts, compares every case and step/width against the built descriptions, then writes the full success receipt. The required `story` job runs even after an upstream failure and fails explicitly; a skipped dependency cannot turn into a passing required check.

To run the split locally, launch `npm run demos:review -- --shard 1/3`, `2/3` and `3/3` independently, then run the merge command. Each part writes under `out/review/shard-N-of-3` and `out/validation/browser-review-shard-N-of-3.json`. An unsplit review remains available without arguments. Pure generated-inventory tests cover the split and merge cheaply; native SVG/browser owners still prove the rendered subjects.

GitHub currently rejects workflow dispatches with HTTP 422: “Actions has been disabled for this repository.” Updating Actions permissions returns HTTP 403 with the session credential. An owner must enable Actions and require the check, catalog, story and compatibility jobs. Workflow files and local passes do not establish hosted enforcement. This external blocker remains tracked in issue #9.
