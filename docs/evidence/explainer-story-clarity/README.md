# Font-metrics reader: before and after

The base page was built in Rayner CI [run 40969977785](https://github.com/adewale/rayner/actions/runs/40969977785) from the code merged as `05b33cc`. The revised page was generated with `npm run demos:check` on this branch. Each screenshot opens `font-metrics.html?step=advance` at rest, with reduced motion, a 1× device scale and the full page captured.

| Viewport | Before | After |
| --- | --- | --- |
| 390×568 | [Reader before](before-390x568.png) | [Reader after](after-390x568.png) |
| 1280×800 | [Reader before](before-1280x800.png) | [Reader after](after-1280x800.png) |

**What changed:** the old title and line said the ruler placed the *next word*. The text contains no trailing space, so its advance stops before the space a next word would require. The new caption states that limit, and the following step explains why its three smaller cut measurements cannot be compared directly with the first ruler.

To reproduce, serve the before CI catalog artifact and this branch's `out/explainers` on separate local ports. In Chromium, open each `font-metrics.html?step=advance` at the two viewport sizes above, wait for `[data-ready=true]`, and take a full-page screenshot with animations disabled. `npm run rayner -- review scenes/explainers/font-metrics/scene.ts` independently checks every resting step at 390 and 1180 pixels.
