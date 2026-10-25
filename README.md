# Lantern Explainers

Each explainer is one TypeScript `Scene`. A web page steps through it at the reader's pace, and the same scene can render a silent, captioned video. Diagrams come from [Agentic Mermaid](https://github.com/adewale/agentic-mermaid) at build time and are stored beside the scene, so the page runs no diagram renderer and makes no network requests.

This is a fork of [Lantern](https://github.com/ivarvong/lantern) by Ivar Vong. Nothing here is released or deployed: there is no npm release, and the pages exist only as local build output. The package keeps Lantern's npm name, `manim-js`, until a name is chosen.

## Requirements

Node 26 or later, and npm. Capturing a new or changed diagram needs Chromium (`npx playwright-core install chromium`, or set `CHROMIUM_EXECUTABLE_PATH`). Video needs FFmpeg. Building from committed snapshots needs neither.

## See the demos

```sh
npm ci
npm run demos:build
npm run demos:serve
```

Open http://127.0.0.1:5175/explainers/. Three to start with:

- **Why stealing an authorization code is not enough** (OAuth with PKCE): turn on the attacker and another app intercepts the redirect, then fails to exchange the code because it cannot produce the verifier.
- **Why June brings polar day to Tromsø and winter to Sydney**: switch the place, and the daylight chart is recomputed from the model.
- **Five added lines put a KV cache in front of D1**: the diff, then the same edit replayed on the architecture diagram, then a cache hit or miss.

`out/explainers/evidence.json` lists every explainer with its cases, diagrams, styles and Mermaid families.

## Write one

```sh
npm run explain -- init my-explainer
npm run explain -- preview my-explainer/scene.ts --watch
npm run explain -- check my-explainer/scene.ts
```

`init` writes a working scene with one setting. `preview` serves the page and rebuilds it on save. `check` runs every case and fails a step whose last frame matches the one before, labels under 14 px at a 1280 px stage, a seek that differs from playing, and motion that jumps or pops. Then `build --out` writes the page to publish:

```html
<iframe src="/explainers/my-explainer.html?step=request"
        title="Why a cache changes the request path"
        style="width:100%;height:640px;border:0;display:block"
        allow="fullscreen"
        loading="lazy"></iframe>
```

Limits: lettering is always the embedded Inter or JetBrains Mono, so styles lose their own fonts and other scripts fail the build; 14 px on a 1280 px stage is about 4 px on a phone until the reader zooms; only the Mermaid families in `evidence.json` are tested; the models are small and cited, and no subject expert has reviewed the explainers.

## Documents

- [Tutorial](docs/TUTORIAL.md): a first explainer, from `init` to an embed
- [Reference](docs/REFERENCE.md): helpers, checks, command line, URL and resize contract, video files, scripts
- [Publishing](docs/PUBLISHING.md): hosting a page and exporting a video
- [Upstream](docs/UPSTREAM.md): the fork base, engine changes and Agentic Mermaid
- [Design record](specs/kyle.md): why the project is shaped this way, and the open decisions
- [Changelog](CHANGELOG.md)
- [Agent skill](skills/lantern-explainers/SKILL.md)

## Attribution

Lantern is MIT, copyright 2026 Ivar Vong; its notice is in `LICENSE`. Inter 4.1 and JetBrains Mono 2.242 are under the SIL Open Font License, with notices in `vendor/licenses/`. Agentic Mermaid 0.4.1 is an optional, build-only dependency. Neither project endorses this fork.
