# Player redesign: one card, a step bar and a rail

The routes [specs/player-redesign.md](../../../specs/player-redesign.md) R12 names, at browser zoom 100% with reduced motion. **Before** is a build of `main` (`c78ceb7`); **after** is `feature/player-step-bar`. Each page was built from its scene with `buildExplainer` (as `npm run demos:build` builds it), served with the repository's static server and opened fresh. Screenshots are viewport-only Chromium captures at device scale factor 1; none relies on scrolling. The offsets are each Next step button's `getBoundingClientRect().top` in CSS pixels at scroll position zero: before has two (above the picture, then after the caption), after has one.

| Route | Viewport | Before | After | Next step top: before → after |
| --- | --- | --- | --- | --- |
| `mr-cache.html?step=before&request=hit` | 390 × 844 | [Before](before-mr-cache-before-390x844.jpg) | [After](after-mr-cache-before-390x844.jpg) | 211 and 785 → 423 |
| `mr-cache.html?step=before&request=hit` | 1280 × 800 | [Before](before-mr-cache-before-1280x800.jpg) | [After](after-mr-cache-before-1280x800.jpg) | 109 and 898 → 617 |
| `mr-cache.html?step=after&request=hit` | 390 × 844 | [Before](before-mr-cache-after-390x844.jpg) | [After](after-mr-cache-after-390x844.jpg) | 211 and 785 → 423 |
| `mr-cache.html?step=after&request=hit` | 1280 × 800 | [Before](before-mr-cache-after-1280x800.jpg) | [After](after-mr-cache-after-1280x800.jpg) | 109 and 898 → 617 |
| `oauth-pkce.html?attacker=yes&step=attack` | 390 × 844 | [Before](before-oauth-pkce-attack-390x844.jpg) | [After](after-oauth-pkce-attack-390x844.jpg) | 181 and 783 → 393 |
| `oauth-pkce.html?attacker=yes&step=attack` | 1280 × 800 | [Before](before-oauth-pkce-attack-1280x800.jpg) | [After](after-oauth-pkce-attack-1280x800.jpg) | 109 and 926 → 617 |
| `quotient-familial.html?step=multiplie` (step 6 of 10) | 390 × 844 | [Before](before-quotient-familial-step6-390x844.jpg) | [After](after-quotient-familial-step6-390x844.jpg) | 292 and 975 → 504 |
| `quotient-familial.html?step=multiplie` (step 6 of 10) | 1280 × 800 | [Before](before-quotient-familial-step6-1280x800.jpg) | [After](after-quotient-familial-step6-1280x800.jpg) | 109 and 984 → 617 |
| `layout-direction.html` | 1280 × 800 | [Before](before-layout-direction-1280x800.jpg) | [After](after-layout-direction-1280x800.jpg) | 70 and 830 → 578 |

`layout-direction` is not a right-to-left document: its page is `lang="en"` with no `dir`, and its subject is the direction of cards inside the picture. No catalog page sets `dir="rtl"`; a page whose lettering requests a right-to-left script sets each text's direction from its first letter and keeps the controls as they are (`tools/lib/explain-build.ts`). To show the logical properties the stepper row and rail use, [after-mr-cache-diff-dir-rtl-1280x800.jpg](after-mr-cache-diff-dir-rtl-1280x800.jpg) is `mr-cache.html?step=diff&request=hit` with `dir="rtl"` set on the document after load: the rail is on the left, Previous and Next are at the right of the stepper row and the step bar's done segments run from the right. The test `right to left: the step bar fills from the right and the rail sits on the left` in `test/explain-embed.test.ts` checks the same with the current segment's fill at one half.

On a phone the after captures show the view row under the stepper row; on oauth-pkce's attack step, which has one view, that row is unseen but keeps its place, as before, so the words do not move between that step and the case's steps with several views. The pictures and captions are unchanged. To reproduce, build the commit and open the same routes at the recorded viewports with `prefers-reduced-motion: reduce`; `after-offsets.json` and `before-offsets.json` hold the measured tops.
