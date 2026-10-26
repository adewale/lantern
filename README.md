# Lantern Explainers

Each explainer is one TypeScript `Scene`. A web page steps through it at the reader's pace, and the same scene can render a silent, captioned video. Diagrams come from [Agentic Mermaid](https://github.com/adewale/agentic-mermaid) at build time and are stored beside the scene, so the page runs no diagram renderer and makes no network requests.

This is a fork of [Lantern](https://github.com/ivarvong/lantern) by Ivar Vong, maintained by [Ade Oshineye](https://github.com/adewale). The explainers are published at [oshineye.dev/projects/lantern-explainers](https://oshineye.dev/projects/lantern-explainers). The npm package is named `rayner` and has not been published.

## Requirements

Node 26 or later. In a checkout, `npm ci` installs everything except Chromium and FFmpeg. A package install leaves out the capture and picture packages; `explain --help` prints these lines:

| Needed for | Install |
| --- | --- |
| Capturing a new or changed diagram | `npm i agentic-mermaid@0.4.1 playwright-core@^1.64.1 svgpath@^2.6.0`, then `npx playwright-core install chromium` or set `CHROMIUM_EXECUTABLE_PATH` |
| PNGs and video: `preview`, `shots`, `render`, `demos:build` | `npm i @resvg/resvg-js@^2.6.2` |
| Video: `render` | FFmpeg on `PATH` |

`check` and `build` from committed snapshots need none of them.

## See the demos

```sh
npm ci
npm run demos:build
npm run demos:serve
```

Open http://127.0.0.1:5175/explainers/. Three to start with:

- **Why stealing an authorization code is not enough** (OAuth with PKCE): another app intercepts the redirect, then fails to exchange the code because it cannot produce the verifier. Setting "Show an attacker" to No leaves that step out.
- **Why June brings polar day to Tromsø and winter to Sydney**: switch the place, and the daylight chart is recomputed from the model.
- **Four added lines and one rewritten put a KV cache in front of D1**: the diff, then the same edit replayed on the architecture diagram, then a cache hit or miss.

The collection has 27 explainers with 142 cases between them, and uses all 15 Agentic Mermaid diagram families. Captured diagrams use 8 styles, which `out/explainers/evidence.json` lists per explainer; ring-buffer (dusk), seasons (tokyo-night) and token-bucket (github-dark) use a style only as the stage palette. Twenty-one have a video; six are pages only (`video: false` in `scenes/explainers/catalog.ts`).

## Write one

```sh
npm run explain -- init my-explainer
npm run explain -- preview my-explainer/scene.ts --watch
npm run explain -- check my-explainer/scene.ts
npm run explain -- filmstrip my-explainer/scene.ts --every 0.5
npm run explain -- build my-explainer/scene.ts --out public/my-explainer.html
```

`init` writes a working scene with one setting. `preview` serves the page and rebuilds it on save. `check` runs every case through [the checks](docs/REFERENCE.md#checks), the video's pacing among them. `filmstrip` samples the video mid-motion, where a resting picture hides collisions and clipping. `build` writes the page and the response headers it needs; [publishing](docs/PUBLISHING.md) shows how to embed it.

A scene is ordinary Lantern, so beside the helpers it can use the general engine features the explainers use: a camera that zooms without moving a point (`this.frame`, which `d.focus` moves when given `{ camera: true }`; by default a focus still rescales the artwork), code that morphs along its own diff (`TransformDiff`), matching transforms, emphasis that stays on the resting picture, charts of the model's numbers (`Axes`), readouts rebuilt from `scene.state` (`view`), addressable and syntax-coloured code, and `Restore`, `TransformFromCopy` and `Succession`. [The engine map](docs/ENGINE.md) links a guide for each and says why the engine leaves out 3D, boolean path operations, runtime LaTeX, `transform` matrices, raster images and narration.

Limits: lettering is the embedded Inter or JetBrains Mono, so styles lose their own fonts; beyond Latin, only numerals draw (Arabic-Indic, Devanagari and Chinese, from small Noto subsets), and other scripts fail the build; descriptions of the pictures are generated in English or French only; on a phone each step opens on a close-up of what it changed, so a reader pans for the rest; the models are small and cited, and no subject expert has reviewed the explainers.

## Documents

- [Tutorial](docs/TUTORIAL.md): a first explainer, from `init` to a built page
- [Reference](docs/REFERENCE.md): helpers, checks, command line, URL and resize contract, accessibility, video files, scripts
- [Publishing](docs/PUBLISHING.md): hosting a page and exporting a video
- [Engine map](docs/ENGINE.md): the engine's guides (camera, matching and diff transforms, emphasis, graphing, views, code spans, animations) and what it leaves out
- [Upstream](docs/UPSTREAM.md): the fork base, engine changes and Agentic Mermaid
- [Design record](specs/rayner.md): why the project is shaped this way, and the open decisions
- [Changelog](CHANGELOG.md)
- [Agent skill](skills/lantern-explainers/SKILL.md)

## Attribution

Lantern is MIT, copyright 2026 Ivar Vong; its notice is in `LICENSE`. Inter 4.1, JetBrains Mono 2.242 and the Noto Sans Arabic, Devanagari and SC subsets are under the SIL Open Font License, with notices in `vendor/licenses/`. Agentic Mermaid 0.4.1 is an optional, build-only dependency. Neither project endorses this fork.
