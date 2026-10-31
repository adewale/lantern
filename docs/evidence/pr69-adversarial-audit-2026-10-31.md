# PR #69 adversarial audit

Five agents independently reviewed phone layout, reader behavior, test obligations, source claims and integration evidence. The starting revision was `210e347ba62de85a581dadbbc5a8de630baebd70`. A second pass challenged the fixes and their tests. The user chose to consolidate the pending work into #69 targeting main.

The combined code includes main at `11ff5694757646185f238e22b4f7cb050c6a337b`, the pending periodic-table work and the lesson improvements. Integration preserves the shipped player: one stepper row, responsive progress rail, measured header and caption sizing, watch and host APIs, endpoint controls, optional audio and card sizing. Teaching/source navigation still retains raw step identities and direct source links. Neither PR was merged into main and nothing was deployed.

## Findings and repairs

| Finding | Repair and proof |
| --- | --- |
| Sodium’s count step offered a redundant second phone view. | The larger heading reduced available framing space. All required data was already complete in its first view at about 12.67px. Insetting the row headers restores one view without shrinking text. The original five-element test still requires all 20 phone openings to use one view, and checks 10 short-laptop stages. |
| Authored openings could cut through a question heading or leave its subtitle alone. | The planner records the full visible heading bounds. It accepts an opening only when the heading is complete or outside the view. A wide comparison may include the full heading instead of being forced into a narrower area below it. Native browser checks cover GTFS, token refill and the guarded-search comparison. |
| Unchanged and dimmed declared text could escape the reading-size calculation. | Declared subject labels participate even when a different object changes. Their opacity admission matches painted subjects; faint text is enlarged rather than silently omitted. Ordinary incidental-label selection is unchanged. |
| Rotation, unequal scaling and shear could inflate font-size credit. | Font measurements use the least scale of the transformed text basis and the browser’s effective path transform. Neither axis-aligned box height nor the geometric mean of unequal scales establishes readable size. A browser witness that previously measured a 3px em now measures 12px after the planner enlarges it. Rotation, native compression and CSS compression/shear have rejection controls. |
| An invalid step link could expose a leading reference step. | Fallback selects the first teaching step. Explicit source permalinks remain valid. The served fixture checks initial loading and case changes. |
| The traffic caption confused an ingress node’s source address with a destination pod’s address. | The short comparison now discusses the per-pod shares actually drawn. Correct packet-path and source-address modeling remains in the source walkthrough. Six independently expected share tables remain checked. |
| GNOME’s six-participant comparison named colors without explaining their categories. | Each participant has a semantic outcome label. The source colors and full report meanings remain recorded. Independent vectors cover all 36 participant/case outcomes, including the excluded approach. |
| The prior 320px preflight omitted undeclared comparisons, including the failing periodic step. | The canonical served review now checks independently claimed main openings at 320×568, including actual paint and 12px labels. It retains the full 390/1180 case/step/tour matrix. |
| A narrow-review receipt could otherwise disguise a missing check as an exclusion. | Catalog generation records per-case target, label and exclusion obligations before review. The merger rejects false exclusions, missing label metrics, labelled null minima, stale shards and incomplete inventories. All-detail scenes retain the reader’s main-path fallback. |
| The stack conflicted with player improvements already on main. | The integration uses the shipped player shell and combines both reader test models. It also catches a hidden progress bar overridden by CSS and guidance referring to an unavailable control. Main’s browser and benchmark contracts are retained. |
| Startup sampling omitted the largest requested-font page. | `font-metrics` joins cache, token bucket and gamut in the existing startup cohort. The size and latency limits are unchanged. |

## Coverage and limits

The canonical inventory has 196 cases. It requires **550 main openings** at 320px and records **1,076 reference-step exclusions** and **32 main steps without opening claims**. The latter are the feature-tour recipe/result across 15 cases and the detailed pen drawing across two seeds. They retain the complete two-width tour review; their exemptions do not establish a complete 320px opening.

The earlier [copy/layout record](editorial-crap-2026-10-31.md) correctly called its 538 openings *declared* comparisons, but it was insufficient evidence for all teaching steps. The new catalog obligations include independent opening claims and explicitly inventory exclusions. Old receipts cannot validate the new reviewer.

An independent browser pass checks 98 main-step/width rows across 11 scenes at 320 and 390 pixels. It checks every body label against native SVG geometry, heading completeness and horizontal overflow. All five periodic elements are included. Separate rotated compressed-text witnesses measure the actual transformed em, independently of the planner’s size calculation. The capture directory is fresh and binds HTML artifacts and build inputs; source and engine hashes alone do not cover reader-app changes.

Isolated mutation controls restore the old readers, font metrics, opacity cutoff, fallback and exclusion behavior. They reject the defects without modifying production bytes. One second-pass control also found a defect in the initial repair: `Text.textSize()` deliberately returns a geometric mean when stretched, so it could not supply the new readability metric. That public API remains unchanged.

## Matched-input captures

The baseline is the audited PR revision `210e347ba62de85a581dadbbc5a8de630baebd70`. The repaired reader is `51a976d5801597c9c7fb409badf4e0ccdda8b8bc`, which includes main at `11ff5694757646185f238e22b4f7cb050c6a337b`. These are unscaled, lossless stage captures at the same settings and named step, with reduced motion. Each pair puts the baseline on the left.

![Before and after: the GTFS service-date question is cropped in the baseline and complete after the repair](pr69-adversarial/comparison-gtfs-reader-date-320.webp)

At 320×568, `gtfs`, date `2007-06-04`, stop `airport`, step `reader-date`: inspect the question above the route/trip/service comparison. Its letters are complete after the repair; the service decision remains visible.

![Before and after: GNOME participants have unexplained color names in the baseline and readable outcome meanings after the repair](pr69-adversarial/comparison-gnome-files-reader-sample-390.webp)

At 390×844, `gnome-files`, participant `P1`, step `reader-sample`: inspect the words below the six participant IDs. They explain the original categories without inventing task times or aggregating outcomes.

The [capture receipt](pr69-adversarial/captures.json) records settings, model state, artifact/build fingerprints, image hashes, all 98 native geometry results and three compressed-text witnesses. It also identifies the [GTFS stop](pr69-adversarial/comparison-gtfs-reader-stop-320.webp), [token refill](pr69-adversarial/comparison-token-bucket-reader-refill-320.webp) and [search guard](pr69-adversarial/comparison-latest-search-reader-guard-320.webp) pairs. A heading entirely outside a close-up remains available in the HTML caption; the repair does not require every close-up to include the scene header.

To reproduce, run `npm ci` and `npm run rayner -- preview scenes/explainers/gtfs` at either revision. Open `?date=2007-06-04&stop=airport&step=reader-date` at 320×568 with reduced motion. The independent served regression owner is `authored phone openings keep comparison ink readable without painting a clipped heading` in `test/explain-embed.test.ts`.

## Final validation

Final integrated results are recorded here after the canonical runs finish.

These checks establish the tested geometry, values and navigation behavior. They do not establish learning outcomes, arbitrary caption truth, physical-phone performance or local Safari support. Native Safari and WebKit have their existing Mac CI owners. No deployment or publication is part of this audit.
