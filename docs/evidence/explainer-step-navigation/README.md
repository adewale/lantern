# Step navigation before the picture

The first step of `mr-cache`, cache-hit case (`?step=before&request=hit`), at browser zoom 100% with reduced motion. **Before** is the production export of Rayner `5b0b4ee`; **after** is this branch, built with `npm run demos:build` and served with `npm run demos:serve`. Screenshots are viewport-only Chromium captures at device scale factor 1. Neither screenshot relies on scrolling.

| Viewport | Before | After | What changes |
| --- | --- | --- | --- |
| 390 × 568 | [Before](before-390x568.jpg) | [After](after-390x568.jpg) | Next step begins at 855px before; a labeled Next step begins at 211px after. |
| 1280 × 800 | [Before](before-1280x800.jpg) | [After](after-1280x800.jpg) | Next step begins at 859px before; a labeled Next step begins at 109px after. |

The second Next remains after the caption for readers who scroll through it. The pictures and source-backed captions are unchanged; the caption's maximum reading width is now 52ch. To reproduce the before screenshots, build commit `5b0b4ee` and open the same route at the recorded viewports; to reproduce the after screenshots, build this branch and open `out/explainers/mr-cache.html?step=before&request=hit` through `npm run demos:serve`.
