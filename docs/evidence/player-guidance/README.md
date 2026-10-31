# Player guidance: evidence

Captures and measurements for [`specs/player-guidance.md`](../../../specs/player-guidance.md). Pages were built from this branch with `buildExplainer` and captured in Playwright's Chromium with reduced motion, default case unless named.

## What changed (G1)

| Capture | Shows |
| --- | --- |
| [changes-token-bucket-burst-1280x800.jpg](changes-token-bucket-burst-1280x800.jpg) | The burst step: "What changed", then "Tokens left: 5 → 0", "Accepted: 0 → 5", "Rejected: R6" under the caption |
| [changes-token-bucket-burst-390x844.jpg](changes-token-bucket-burst-390x844.jpg) | The same row on a phone, wrapped onto two lines |
| [changes-quotient-familial-quotient-1280x800.jpg](changes-quotient-familial-quotient-1280x800.jpg) | French: "Ce qui a changé", "Quotient : 26 269,55" |

Watched keys and labels: token-bucket `tokens` "Tokens left", `allowed` "Accepted", `rejected` "Rejected" (the stage readout's own words); mr-cache `databaseReads` "Database reads", `request` "Request", `reads` "D1 reads"; quotient-familial `rni` "Revenu net imposable", `parts` "Parts", `quotient` "Quotient", `impot` "Impôt". In quotient-familial six of ten steps (barème to plafond) change none of these four keys, so their row is empty but keeps its room.

## The end (G2)

| Capture | Shows |
| --- | --- |
| [end-mr-cache-request-1280x800.jpg](end-mr-cache-request-1280x800.jpg) | The last step at rest: Start again with its return arrow, then Try ‘Cache miss’, in the stepper row |
| [end-mr-cache-request-390x844.jpg](end-mr-cache-request-390x844.jpg) | On a phone Try takes the step bar's place beside Start again, and the bar joins the tools' row |
| [end-mr-cache-after-390x844.jpg](end-mr-cache-after-390x844.jpg) | The step before, for comparison: the stepper row has the same height, so nothing below moves |

At 320 and 360 px the end face needs a third row; the stepper row reserves it at every step there (measured in `reserve()`), so nothing moves between steps, at the cost of an empty band under the tools.

## The footer hint (G3)

| Capture | Shows |
| --- | --- |
| [hint-mr-cache-1280x800.jpg](hint-mr-cache-1280x800.jpg) | "← → to step · click a segment to jump" after the mark |
| [hint-mr-cache-390x844.jpg](hint-mr-cache-390x844.jpg) | The same line on a 390 px card (Chromium without touch emulation reports a fine pointer) |

The touch text is checked under `hasTouch` and `isMobile` in `test/explain-embed.test.ts`.

## Pictures in the steps list (G5): built, measured, left out

Thumbnails of each step's resting picture in the wide rail were built ([the patch](thumbnails-attempt.diff), [a capture](dropped-rail-thumbnails-quotient-familial-1280x800.jpg)) and measured with [thumbnails-bench.ts](thumbnails-bench.ts) against the player without them, at 1280 × 800 with Chromium's CPU throttling at 4×, five interleaved runs each. Raw numbers: [thumbnails-bench.json](thumbnails-bench.json).

Medians in milliseconds (base → with thumbnails); "longest task" is the longest main-thread task between data-ready and the last thumbnail loading, over five runs, where the base page had none over 50 ms in the same window.

| Page | Attempt | data-ready | First Next to stage change | First Next to rest | Longest task | All thumbnails after data-ready |
| --- | --- | --- | --- | --- | --- | --- |
| mr-cache | 1 | 1246 → 1440 (+15.6 %) | 45 → 43 | 6056 → 5994 | 133–181 | ≤ 764 |
| token-bucket | 1 | 1929 → 1877 (−2.7 %) | 70 → 69 | 4725 → 4723 | 149–238 | ≤ 1163 |
| quotient-familial | 1 | 2891 → 3215 (+11.2 %) | 92 → 91 | 2173 → 2178 | 208–246 | ≤ 1985 |
| mr-cache | 2 | 1364 → 1376 (+0.9 %) | 46 → 41 | 6022 → 6005 | 95–139 | ≤ 850 |
| token-bucket | 2 | 1804 → 1727 (−4.3 %) | 67 → 78 (+16.4 %) | 4714 → 4724 | 92–116 | ≤ 1092 |
| quotient-familial | 2 | 3079 → 2885 (−6.3 %) | 78 → 62 | 2160 → 2189 | 141–203 | ≤ 2178 |

Attempt 1 ran one step and drew its picture with `toSvgString` in one idle callback. Attempt 2 split each step into two idle callbacks (run the step, then draw) and drew with `cull: true`, leaving out what the camera cannot show. Timed inside the page at 4× (attempt 1, quotient-familial), running one step took 9 to 60 ms and drawing it 8 to 76 ms for SVGs of 139 to 292 kB; mr-cache's steps took 21 to 39 ms and 8 to 32 ms. Running a single step is already over 50 ms on quotient-familial's first and last steps, so the work cannot be cut under the budget without changing the engine.

The budget asks for every thumbnail task under 50 ms; every page failed it in both attempts. As the spec's stop rule asks, the rail is left as it was.
