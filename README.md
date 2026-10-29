# Rayner: interactive technical explanations from TypeScript

Rayner helps engineers and technical educators turn TypeScript models into explanations of protocols, algorithms and code changes. Readers step through at their own pace and choose cases, such as a cache hit or a miss. The model computes the numbers, diagrams and captions for each case. Publish the result as a portable HTML page with a transcript and no runtime network requests.

[![A cache hit follows the cache-to-reply path and reads the database zero times.](https://raw.githubusercontent.com/adewale/rayner/8d344c16fab72d2fa52554f905cd97bf840c553c/docs/images/cache-hit.png)](https://oshineye.dev/projects/rayner/mr-cache?request=hit)

[Try the examples](https://oshineye.dev/projects/rayner) · [Write your first explainer](https://github.com/adewale/rayner/blob/main/docs/TUTORIAL.md)

Use Rayner when a different input changes what you need to explain: which route a request takes, why an attack fails, or how a code change affects the system. Reader settings are finite choices, with every combination built ahead of time. Authors must test the model against its sources and review the pictures; automated checks cannot establish that the explanation is true.

## Try a checkout

Requires Node 24 or later and Chromium. Authoring targets Ubuntu and macOS; Windows is not yet supported. The [release guide](https://github.com/adewale/rayner/blob/main/docs/RELEASING.md) records the required platform validation.

```sh
git clone https://github.com/adewale/rayner && cd rayner
npm ci
npx playwright-core install chromium
npm run demos:build
npm run demos:serve
```

Open http://127.0.0.1:5175/explainers/. Start with OAuth with PKCE, the seasons, or the KV-cache code change. If Chromium is already installed, set `CHROMIUM_EXECUTABLE_PATH` instead of downloading it.

## Write and publish one

In a checkout:

```sh
npm run rayner -- init my-explainer
npm run rayner -- preview my-explainer/scene.ts --watch
```

The starter has two cases, a cache hit and a miss. Open the printed localhost URL, change the request setting, then edit `my-explainer/scene.ts`. Preview rebuilds on save; reload to see the change.

Before publishing, run the served-reader review and build the page:

```sh
npm run rayner -- review my-explainer/scene.ts
npm run rayner -- build my-explainer/scene.ts --out public/cache.html
```

`review` runs every case through the checks, then opens each step at phone and desktop widths. It saves screenshots and a receipt. `build` writes the HTML, its receipt, response-header recipe and optional iframe loader; it does not repeat validation. The [tutorial](https://github.com/adewale/rayner/blob/main/docs/TUTORIAL.md) explains the scene and how to add independent caption expectations. The [publishing guide](https://github.com/adewale/rayner/blob/main/docs/PUBLISHING.md) covers hosting and embedding.

For a published npm release, create an author project with `npm init -y`, `npm pkg set type=module` and `npm install --save-dev rayner`. Install Chromium as above, then use `npx rayner …` for the same commands.

## Scope and limits

Scenes are ordinary TypeScript classes. Diagrams are captured from [Agentic Mermaid](https://github.com/adewale/agentic-mermaid) at build time; authors can also draw native shapes, charts, code diffs and camera moves. The browser loads no diagram renderer.

- Default text uses embedded Inter and JetBrains Mono. Additional scripts, replacement faces, real bold and italic, and typeset maths require explicit [lettering requests](https://github.com/adewale/rayner/blob/main/docs/LETTERING.md). New lettering capture needs Python and source fonts; committed snapshots replay without them.
- Right-to-left captions and titles are supported; panel and diagram layouts remain left to right. Diagram labels fit the captured layout's widths, even when a different face is requested. A diagram style does not implicitly select its font.
- Player controls and generated picture descriptions are available in English and French. Other caption languages retain English controls and descriptions.
- Phones use close-ups and a **Next view** tour. Review the opening and the whole tour so the caption's subject remains visible.
- The example models are small and cited. They have not had subject-expert review.

## Documentation and contributions

[Tutorial](https://github.com/adewale/rayner/blob/main/docs/TUTORIAL.md) · [API and CLI reference](https://github.com/adewale/rayner/blob/main/docs/REFERENCE.md) · [Engine guides](https://github.com/adewale/rayner/blob/main/docs/ENGINE.md) · [Agent authoring skill](https://github.com/adewale/rayner/blob/main/skills/rayner-explainers/SKILL.md)

Report bugs in [GitHub issues](https://github.com/adewale/rayner/issues), with the scene, case, step and viewport needed to reproduce them. For code changes, run `npm run check` and `npm test`; [testing guidance](https://github.com/adewale/rayner/blob/main/docs/TESTING.md) covers browser, property and capture checks. [Publishing npm releases](https://github.com/adewale/rayner/blob/main/docs/RELEASING.md) is a separate maintainer workflow.

## License and attribution

Rayner is MIT, maintained by [Ade Oshineye](https://github.com/adewale), and forked from Ivar Vong's [Lantern](https://github.com/ivarvong/lantern) at `2c7bad5`. [Upstream](https://github.com/adewale/rayner/blob/main/docs/UPSTREAM.md) records the engine changes. Embedded font and glyph notices ship in `vendor/licenses/`. Neither Lantern nor Agentic Mermaid endorses this fork.
