# Rayner: step-through explainers from one TypeScript scene

Rayner turns a TypeScript program into an explainer that a reader steps through at their own pace. A slide deck holds a fixed picture per slide. In Rayner one program computes every step: change a reader setting, such as the token bucket's refill rate, and the program runs again, so the numbers, the diagram and the captions follow that case. Every case is built and checked before anyone sees it, and the same scene also renders a silent, captioned video. Diagrams come from [Agentic Mermaid](https://github.com/adewale/agentic-mermaid) at build time and are stored beside the scene, so the page runs no diagram renderer and makes no network requests.

Rayner is for engineers and technical educators who write TypeScript and want readers to explore a protocol, algorithm or code change. It works best when changing a setting changes the explanation: a cache hit takes a different path from a miss, or exchanging an intercepted authorization code fails without the verifier. Authors need to test the model and review the pictures; the build checks cannot establish whether the explanation is true.

Start with [Your first explainer](docs/TUTORIAL.md), then use the [reference](docs/REFERENCE.md) while writing and [publishing guide](docs/PUBLISHING.md) when the page is ready. The [authoring skill](skills/rayner-explainers/SKILL.md) gives agents the same workflow, including how to test the model and review every case. The published examples are at [oshineye.dev/projects/rayner](https://oshineye.dev/projects/rayner). Work from a checkout for now; the npm package `rayner` has not been published.

## Requirements

Node 26 or later. CI runs on Ubuntu 24.04; other platforms have not been checked. In a checkout, `npm ci` installs everything except Chromium and FFmpeg. A package install leaves out the capture and picture packages; `explain --help` prints these lines:

| Needed for | Install |
| --- | --- |
| Capturing a new or changed diagram | `npm i agentic-mermaid@0.4.1 playwright-core@^1.64.1 svgpath@^2.6.0`, then `npx playwright-core install chromium` or set `CHROMIUM_EXECUTABLE_PATH` |
| PNGs and video: `preview`, `shots`, `render`, `demos:build` | `npm i @resvg/resvg-js@^2.6.2` |
| Video: `render` | FFmpeg on `PATH` |

`check` and `build` from committed snapshots need none of them.

Optional per-scene fonts, Arabic/Devanagari shaping, and typeset maths are documented in [Lettering on request](docs/LETTERING.md). Existing scenes retain their original output.

## See the demos

```sh
git clone https://github.com/adewale/rayner && cd rayner
npm ci
npm run demos:build
npm run demos:serve
```

Open http://127.0.0.1:5175/explainers/. Three to start with:

- **Why stealing an authorization code is not enough** (OAuth with PKCE): another app intercepts the redirect, then fails to exchange the code because it cannot produce the verifier. Setting "Show an attacker" to No leaves that step out.
- **Why June brings polar day to Tromsø and winter to Sydney**: switch the place, and the daylight chart is recomputed from the model.
- **Four added lines and one rewritten put a KV cache in front of D1**: the diff, then the same edit replayed on the architecture diagram, then a cache hit or miss.

The collection has 26 explainers with 140 cases between them, and uses all 15 Agentic Mermaid diagram families. Captured diagrams use 8 styles, which `out/explainers/evidence.json` lists per explainer; ring-buffer (dusk), seasons (tokyo-night) and token-bucket (github-dark) use a style only as the stage palette. Twenty have a video; six are pages only (`video: false` in `scenes/explainers/catalog.ts`).

## Write one

For a guided walkthrough, follow [Your first explainer](docs/TUTORIAL.md). These are the commands it uses:

```sh
npm run explain -- init my-explainer
npm run explain -- preview my-explainer/scene.ts --watch
npm run explain -- check my-explainer/scene.ts
npm run explain -- build my-explainer/scene.ts --out public/my-explainer.html
```

`init` writes this scene, which has one setting and two steps:

```ts
import { Scene } from 'rayner';
import { stage, settingsOf } from 'rayner/explain';

const FLOW = 'graph LR\nRequest[Request] --> Cache[Cache]\nCache -->|hit| Reply[Reply]\nCache -->|miss| Store[Database]\nStore --> Reply';
const PATH = {
  hit: [['Request', 'Cache'], ['Cache', 'Reply']],
  miss: [['Request', 'Cache'], ['Cache', 'Store'], ['Store', 'Reply']],
} as const;

export default class MyExplainer extends Scene {
  static meta = { id: 'my-explainer', title: 'Why a cache changes the request path' };
  static settings = [{ id: 'request', label: 'Follow a request', default: 'hit', options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }] }];
  override async construct() {
    // The heading follows each step title; the style sets the palette and every diagram's look.
    const s = stage(this, { style: 'nord' });
    const which = settingsOf(this).request as 'hit' | 'miss';

    await this.step('architecture', { title: 'A cache in front of storage', caption: 'A request checks the cache first and reads the database only on a miss.' });
    const d = await s.show({ source: FLOW }, { box: 'top' });

    await this.step('request', { title: which === 'hit' ? 'A cache hit' : 'A cache miss', caption: which === 'hit' ? 'The value is already cached, so the request returns without reading the database.' : 'The value is absent, so the request reads the database once and then returns.' });
    // Ask the program, then show its answer: here the path and the read count.
    const reads = which === 'hit' ? 0 : 1;
    await d.dim([...new Set(PATH[which].flat())]);
    await d.walk(PATH[which], { trail: true });
    await s.card([['Database reads', reads]], { at: 'bottom' });
    this.state.reads = reads;
  }
}
```

`preview` opens it as a page with two steps, and "Follow a request" under the title switches between a cache hit and a miss. `preview` serves the page and rebuilds it on save. `check` runs every case through [the checks](docs/REFERENCE.md#checks). `build` writes the page and the response headers it needs; [publishing](docs/PUBLISHING.md) shows how to embed it.

A scene is an ordinary Rayner scene, so beside the helpers it can use the engine features the explainers use. Each has a guide:

- [Camera](docs/CAMERA.md): `this.frame` zooms without moving a point; `d.focus` moves it when given `{ camera: true }`, and by default a focus still rescales the artwork
- [Matching and diff transforms](docs/MATCHING.md): code that morphs along its own diff (`TransformDiff`), and shapes and text matched by key
- [Emphasis](docs/EMPHASIS.md): emphasis that stays on the resting picture
- [Graphing](docs/GRAPHING.md): charts of the model's numbers (`Axes`)
- [Views](docs/VIEWS.md): readouts rebuilt from `scene.state` (`view`)
- [Code](docs/CODE.md): addressable, syntax-coloured code
- [Animations](docs/ANIMATIONS.md): `Restore`, `TransformFromCopy` and `Succession`

[The engine map](docs/ENGINE.md) says why the engine leaves out 3D, boolean path operations, runtime LaTeX, `transform` matrices, raster images and narration.

## Limits

- Default lettering uses embedded Inter and JetBrains Mono, with Noto subsets for Arabic-Indic, Devanagari and Chinese numerals. Bold is the Regular outline stroked, and there is no italic. A diagram style does not select its own font.
- Scenes can request Latin Extended, Greek and Cyrillic, or opt into Arabic, Devanagari, Hebrew and Chinese letters, registered replacement faces (such as a style's own face), real bold and italic, and typeset maths. The [lettering guide](docs/LETTERING.md) lists the supported requests, capture dependencies and snapshot rules. Unrequested characters and unsupported scripts fail the build.
- Right-to-left captions, titles and footers read and align right to left. Panels and diagram layouts stay left to right.
- Descriptions of the pictures are generated in English or French only, even for an explainer lettered in another script.
- On a phone each step opens on a close-up of what it changed, so a reader pans for the rest.
- The models are small and cited, and no subject expert has reviewed the explainers.

## Documents

- [Tutorial](docs/TUTORIAL.md): a first explainer, from `init` to a built page
- [Reference](docs/REFERENCE.md): helpers, checks, command line, URL and resize contract, accessibility, video files, scripts
- [Publishing](docs/PUBLISHING.md): hosting a page and exporting a video
- [Engine map](docs/ENGINE.md): the engine's guides (camera, matching and diff transforms, emphasis, graphing, views, code spans, animations) and what it leaves out
- [Upstream](docs/UPSTREAM.md): the fork base, engine changes and Agentic Mermaid
- [Design record](specs/rayner.md): why the project is shaped this way, and the open decisions
- [Changelog](CHANGELOG.md)
- [Lettering](docs/LETTERING.md): requested scripts, fonts, maths and snapshot capture
- [Authoring skill](skills/rayner-explainers/SKILL.md): the authoring and review workflow for agents

## Fork and engine

Rayner is a fork of Ivar Vong's [Lantern](https://github.com/ivarvong/lantern) at commit `2c7bad5`, maintained by [Ade Oshineye](https://github.com/adewale). It keeps Lantern's engine: shapes and glyphs stored as Bézier points, a fixed clock, and seeking by replay. [Upstream](docs/UPSTREAM.md) lists each engine change with the test that proves it. It deletes Lantern's development player, Cloudflare Worker, JSON scene format and flowchart parser. In their place, a build sits between the scene and the reader: Agentic Mermaid draws the diagrams, every reader setting becomes a case that is checked before it ships, and the output is a portable HTML page or a captioned video. Agents lose the Worker's endpoints in that trade.

## License and attribution

Rayner is MIT (`package.json`). `LICENSE` carries Lantern's notice: Lantern is MIT, copyright 2026 Ivar Vong. Inter 4.1, JetBrains Mono 2.242 and the Noto Sans Arabic, Devanagari and SC subsets are under the SIL Open Font License, with notices in `vendor/licenses/`. Agentic Mermaid 0.4.1 is an optional, build-only dependency. Neither project endorses this fork.

Report problems in [GitHub issues](https://github.com/adewale/rayner/issues).
