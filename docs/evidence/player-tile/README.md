# Player tile: the explainer as one object

Captures for [specs/player-tile.md](../../../specs/player-tile.md) T10 and T12, at browser zoom 100% with reduced motion and the light device scheme. **Before** is a build of `feature/player-step-bar` (`2de8b6f`); **after** is `feature/player-tile`. Each page was built from its scene with `buildExplainer` (as `npm run demos:build` builds it), served with the repository's static server and opened fresh. Screenshots are viewport-only Chromium captures at device scale factor 1, except the crop pictures, which are `locator('.tile').screenshot()`.

| Route | Viewport | Before | After |
| --- | --- | --- | --- |
| `mr-cache.html?step=before&request=hit` | 1280 × 800 | [Before](before-mr-cache-1280x800.jpg) | [After](after-mr-cache-1280x800.jpg) |
| `mr-cache.html?step=before&request=hit` | 390 × 844 | [Before](before-mr-cache-390x844.jpg) | [After](after-mr-cache-390x844.jpg) |
| `exgit.html` (catppuccin-mocha, a dark paper) | 1280 × 800 | [Before](before-exgit-1280x800.jpg) | [After](after-exgit-1280x800.jpg) |
| `exgit.html` | 390 × 844 | [Before](before-exgit-390x844.jpg) | [After](after-exgit-390x844.jpg) |
| `embed-lab.html` (two loader embeds) | 1280 × 800 | [Before](before-embed-lab-1280x800.jpg) | [After](after-embed-lab-1280x800.jpg) |

The before lab is the old template (each embed in a host card, on `#eceff3`); the after lab is the new one (`tools/explain-demos.ts`), where the host writes no card and its article text sits above and below each embed.

## Next at load

The Next step button's `getBoundingClientRect()` and the step heading's bottom, in CSS pixels at scroll position zero (`offsets.json`). `--player-reserve` stays 300px.

| Page | Viewport | Next top, before → after | Next bottom after | Step heading bottom after |
| --- | --- | --- | --- | --- |
| mr-cache | 1280 × 800 | 617 → 637 | 677 | 768 |
| oauth-pkce | 1280 × 800 | 617 → 637 | 677 | 768 |
| quotient-familial | 1280 × 800 | 617 → 658 | 698 | 789 |
| mr-cache | 1440 × 900 | 617 → 648 | 688 | 778 |
| quotient-familial | 1440 × 900 | 617 → 669 | 709 | 799 |

quotient-familial's French title takes two lines in the header, which is why its Next is 21 px lower than mr-cache's.

## The crop test

The tile alone at 900 px, standalone: [crop-mr-cache-900.jpg](crop-mr-cache-900.jpg) and [crop-quotient-familial-900.jpg](crop-quotient-familial-900.jpg). The four questions of §1.1, and what answers each in these pictures:

| Question | Answered by |
| --- | --- |
| What it is | The stage with the stepper row under it: Previous, Next, the step bar (one segment per step) and the view tools; `section.player` is named "Explainer" / "Explication" |
| What it is about | The header's title (the page's one `h1`), the case picker beside it, and "Step 1 of 4" / "Étape 1 sur 10" with the step's title under the stepper row |
| Who made it | The footer's mark: three bars and the word "Rayner", linking to the project, named "Made with Rayner" / "Réalisé avec Rayner" |
| Where to go | The closed **All n steps** and **Transcript** rows; in a frame, "Open the explainer" at the footer's end (absent here, standalone) |

`test/explain-embed.test.ts` "the tile stands alone" asserts the same on every catalog page, standalone, in a raw iframe and in the loader, from the DOM inside `.tile`, and checks that every drawn element under `#content` is the tile or inside its box. Run against `feature/player-step-bar` it fails at the first page with `no .tile in #content`; on `feature/player-tile` it passes for all 30.

## Measurements

- `--tint` is 10%. `test/embed-tint.test.ts` passes at 10% for all thirteen palettes in both themes; the weakest pair, relative to its minimum, is `--muted` (#536170) on github-dark's paper (#0d1117) mixed into the light surface: 5.13:1 against 4.5:1.
- `app/embed.css` (`gzip -c app/embed.css | wc -c`) is 4020 bytes on `feature/player-step-bar` and 4839 bytes on `feature/player-tile`: 819 bytes more, under the 1.5 KiB allowance.
- Framed heights for mr-cache (`out/explainers/mr-cache/embed.json`): 1154 at 390 px, 990 at 640 px, 1068 at 900 px.

To reproduce, build each commit and open the same routes at the recorded viewports with `prefers-reduced-motion: reduce`.
