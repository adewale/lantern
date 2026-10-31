# Neutral player and forced-colour markers

These comparisons render the same inputs through Rayner's production build and CSP server at two source revisions:

- Base: `11ff5694757646185f238e22b4f7cb050c6a337b`
- Fixed: `4fe3186054430fead2de5d18153910ce9525a42b`

The capture environment was Chromium 154.0.8037.57 on Linux, Node 24.19.0, 1280 × 800, with reduced motion. [receipt.json](receipt.json) records source revisions, matching input hashes, browser version, interaction steps and image hashes. Contact sheets arrange the original browser screenshots, which are retained alongside them.

## What to inspect

[Neutral colours](normal-comparison.png): `mr-cache`, `request=hit&step=diff`, light above dark. Base is on the left; fixed is on the right. Compare Next, the completed/current step-bar segments and the current step in the rail. The drawing uses the same input at both revisions.

[Forced colours](forced-comparison.png): both players open the hit case at `diff`, switch to Cache miss, then move focus to the stage. Inspect the selected case's fill and outline, the current step's outline and filled number, and the step bar's filled done segment, thick current outline and hollow later segments. Light is above dark. The contact sheet crops the three controls; the full `before-forced-*.png` and `after-forced-*.png` captures retain their page context.

[Opt-in cues](cued-comparison.png): the palette/casing fixture from `test/explain-player-style.test.ts`, with explicit ink for the on-stage “Hello” label. Both revisions receive the same `meta.player` declaration: accent, paper, square corners and an 880 px stage floor. Base ignores that unsupported option. Fixed uses paper `#fff7ed` and accent `#9a3412` in light mode and falls back to neutral colours in dark mode. `Arc<T>`, `isdigit()`, `-m` and `-M` retain their case.

## Reproduce

From the PR checkout, with dependencies installed and Chromium available:

```sh
git worktree add --detach /tmp/rayner-player-base 11ff5694757646185f238e22b4f7cb050c6a337b
git worktree add --detach /tmp/rayner-player-head 4fe3186054430fead2de5d18153910ce9525a42b
ln -s "$PWD/node_modules" /tmp/rayner-player-base/node_modules
ln -s "$PWD/node_modules" /tmp/rayner-player-head/node_modules
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node docs/evidence/player-neutral/capture.ts --base /tmp/rayner-player-base --head /tmp/rayner-player-head
```

The script builds both pages, serves their generated CSP headers, drives the same interactions, captures full tiles and control crops, then assembles contact sheets. Use fresh worktree paths. Change the Chromium executable path when needed; the receipt records the browser that actually ran.

## Checks and limits

`test/explain-player-style.test.ts` independently checks palette contrast across all 13 palettes in both themes, page isolation, case resets, and forced-colour markers on neutral and cued players. Its negative control removes the served forced-colour CSS rule, checks that the selection-outline assertion rejects, then restores the rule. `test/explain-embed.test.ts` checks neutral chrome across case changes and before JavaScript runs.

The full browser suite passed with 116 tests and two optional lettering skips. The three collection-review partitions and their merge verified all 191 cases and 2,568 step/width states. Type checks and page budgets passed.

These screenshots cover one desktop viewport in Chromium. Forced colours are emulated; native Windows high-contrast rendering was not captured. The cue fixture illustrates palette adoption and fallback, while the collection review covers the authored explainers at desktop and phone widths.
