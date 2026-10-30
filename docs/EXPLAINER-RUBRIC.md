# Explainer editorial rubric

Use this to assess a reader-paced *lesson*, not the quality of its animation or the importance of its topic. Read the gallery title, the declared default case, every resting step and caption, at least one countercase where available, the ending, and the source/test trail. Resolve the default from `settings[].default` in `describe.json`, **not** from the first case in the array. Look at the pictures, not only the text. For a one-case scene, assess an internal contrast or an explicit limit rather than deducting points for having no setting.

Score six dimensions from 0 to 4 (24 total). Apply the same anchors to each: **0** missing/contradicted; **1** asserted but not demonstrated; **2** partly shown, with a substantial inference left to the reader; **3** shown with a small gap or avoidable detour; **4** directly earned and easy to inspect. Record a specific reason for any score below 4. Equal-weight totals are a *triage order*, not calibrated measurements of comprehension; equal totals tie. Do not break ties by subjective decimal points.

| Dimension | What earns 4 |
| --- | --- |
| **Q — Question and promise** | The opening gives a concrete reason to follow, and the default case actually answers the gallery title. |
| **P — Progression and payoff** | Each step answers a needed question and prepares the next; the ending resolves the opening without changing subjects. |
| **V — Visible evidence** | A resting picture carries the values, paths and comparisons the caption uses; labels and framing let a reader inspect them without replaying motion. |
| **B — Boundaries and countercases** | A materially different case or an internal comparison tests the claim; conditional prose and explicit assumptions keep the conclusion true for its scope. One-case scenes can score 4. |
| **G — Grounding and calibration** | Claims identify an appropriate source, version, observed run or tested model; the explanation distinguishes what was measured from what is assumed and does not outrun that evidence. A linked source alone does not earn 4. |
| **E — Reader economy** | Terms arrive when needed, prose interprets rather than duplicates the image, and numbers and visual density are proportionate to the question. This is not a reward for fewer steps. |

**Before scoring:** a failing build, incorrect case selection, known false claim, inaccessible continuation, or materially misleading picture is a fix-first issue, not a small score deduction. Mark it separately, repair and regrade. The 0–4 scores cannot certify factual truth: inspect source and model tests for the top claim, and commission domain review where the cost of error merits it. `rayner check` and `rayner review` provide rendering/navigation evidence, not independent fact-checking or comprehension testing.

**How to report:** give Q/P/V/B/G/E, total, one observable strength or improvement, the assessed commit/export, and the limits of the review. Sort by total descending, ties together (alphabetical display within a tie is only for finding rows). Regrade after substantive changes; do not compare totals from different editions as if they were controlled reader-study results. See the dated [29-scene assessment](evidence/explainer-stack-rank-2026-10-30.md).
