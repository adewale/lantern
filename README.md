# Lantern Explainers
**Write one native scene. Publish reader-paced steps. Export the same explanation as a captioned film.**

A downstream fork of [Lantern](https://github.com/ivarvong/lantern) by Ivar Vong, with a small explanation library, build-time [Agentic Mermaid](https://github.com/adewale/agentic-mermaid) integration, portable embeds and video tooling. No second scene language, hosted service or browser diagram renderer.

## See it work
Requires **Node 26+**, Git and npm. Video export also needs **FFmpeg/ffprobe**. Fresh diagram capture needs Chromium; checked-in snapshots let the demo collection build without it.

```sh
npm ci
npx playwright-core install chromium  # needed for fresh capture and browser tests
npm run demos:build
npm run demos:serve
```

Open **http://127.0.0.1:5174/explainers/**. Four good starting points:
- **Personal Agent Protocol:** direct, device and mediated sign-in, across four diagram families.
- **Seasons:** change London to Tromsø, Quito or Sydney; the daylight chart comes from the model.
- **OAuth with PKCE:** enable the attacker; a computed RFC test vector explains why the stolen code fails.
- **KV-cache merge request:** read the diff, watch the diagram gain a KV cache, then follow a cache hit or miss.

The collection contains **14 explanations, 31 cases, 52 captured diagrams, eight diagram families and twelve styles**. Each page loads only its own explanation. Contact sheets, HTML receipts and a two-embed integration lab are linked from the gallery.

```sh
npm run demos:check   # every case: seeking, motion, bare runtime, each step changes the picture, 14 px labels, footer fit
npm run demos:render  # fourteen default-case MP4s; skips unchanged exports
npm run demos:review  # served desktop/mobile cases, screenshots, headers and video delivery
```

Videos live in `out/videos/`: silent H.264, 1280 × 880, glyph-outline caption footer, embedded subtitles, chapters, adjacent WebVTT and receipts. **These are local build outputs, not a claim of a public deployment.**

## Author an explanation

```sh
npm run explain -- init my-explanation
npm run explain -- preview my-explanation/scene.ts
npm run explain -- snapshots my-explanation/scene.ts
npm run explain -- check my-explanation/scene.ts
npm run explain -- build my-explanation/scene.ts --out public/explanation.html
npm run explain -- render my-explanation/scene.ts --out public/explanation.mp4 --footer
```

The installed package exposes the same commands as `explain`. The package keeps its inherited `manim-js` name; a new public package/product name has not been selected. To test distribution locally, use `npm pack`, then install the generated archive in an author project. No published npm release is assumed.

```ts
import { Scene } from 'manim-js';
import { stage, settingsOf } from 'manim-js/explain';

export default class CacheExplanation extends Scene {
  static meta = { id: 'cache', title: 'A cache changes the request path' };
  static settings = [{
    id: 'request', label: 'Follow a request', default: 'hit',
    options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }],
  }];

  override async construct() {
    const s = stage(this); // adopts the first diagram's real style palette
    const which = settingsOf(this).request;
    await this.step('architecture', {
      title: 'Check the cache before storage',
      caption: 'A cache hit returns early. Only a miss needs the database.',
    });
    const d = await s.show({
      source: 'graph LR\nCache{Cached} -->|yes| Reply[Reply]\nCache -->|no| DB[Database]\nDB --> Reply',
      style: 'nord',
    });
    await this.step('request', {
      title: which === 'hit' ? 'A cache hit' : 'A cache miss',
      caption: which === 'hit' ? 'Return the cached value.' : 'Read storage, then return the result.',
    });
    await d.walk(which === 'hit' ? [['Cache', 'Reply']] : [['Cache', 'DB'], ['DB', 'Reply']]);
  }
}
```

`show`, `reveal`, `walk`, `morph`, `focus`, `highlight`, `card` and `chip` are ordinary helpers. Mix them with native `Code`, `Text`, `Transform` and any other Lantern object. Walks require real links and appear in state traces. Morphs with `ops` are checked by replaying Agentic Mermaid's typed mutations at build time.

## Publish a portable embed

```html
<iframe
  src="/explainers/cache.html?step=request&request=miss"
  title="How a cache changes the request path"
  style="width:100%;height:640px;border:0;display:block"
  allow="fullscreen"
  loading="lazy"></iframe>
<a href="/explainers/cache.html">Open explanation in a new page</a>
```

For auto-height, host the generated `loader.js` alongside your artifacts:

```html
<div id="cache-explanation"></div>
<script src="/explainers/loader.js"
        data-src="/explainers/cache.html?step=request&request=miss"
        data-target="cache-explanation"
        data-title="How a cache changes the request path"></script>
```

The page starts paused at a completed, meaningful step. Cases and steps survive links and browser history. The loader checks **both message origin and source window**, supports independent embeds, and resizes down as well as up. Raw iframes work without it. Every artifact includes a poster, all-case HTML transcript and license notices; it remains readable without JavaScript. No runtime network or storage is needed.

Apply the generated `.headers.json` recipe through your static host. `frame-ancestors` must be an HTTP CSP header, not a meta tag. CORS is not framing permission. See [embedding](docs/EMBEDDING.md).

## Check the claims

```sh
npm run check        # TypeScript, public declarations and consumer compilation
npm test             # inherited engine + new helper/model/protocol/CLI tests
npm run test:embeds  # real Chromium: cross-origin isolation, history, mobile, offline, no-JS, styles
npm run test:video   # real FFmpeg: H.264/VP9, captions, chapters, decode, receipts
npm run demos:check  # all fourteen authored scenes, all 31 cases
```

`CHROMIUM_EXECUTABLE_PATH=/path/to/chrome` selects an existing Chromium installation. Optional browser/video tests explicitly report when not enabled. Inherited Manim and Mermaid oracle tests have their own opt-in requirements. See [delivery evidence and remaining release gates](docs/KYLE-STATUS.md).

## Boundaries worth knowing
- Diagram text uses embedded **Inter**, not each Agentic Mermaid style's font. Native text also offers JetBrains Mono. Shapes, rough strokes, paint and routes come from the real style backend; unsupported SVG features fail rather than disappear.
- The SVG lowering pass runs at **build time**. Browser snapshots contain resolved cubic geometry and compact text runs; the runtime shapes those runs from its embedded font. No browser SVG parser, CSS colour resolver or diagram layout engine is shipped.
- The legibility gate, at a 1280-pixel stage, requires each diagram label to reach 14 px in some step's last frame, inside the diagram viewport, and each native label to reach 14 px while fully visible. On a 390-pixel phone that is about 4 px until the reader zooms the stage (pinch, double-tap or **+**); at 4× it is about 17 px.
- Models are scoped and cited. Seasons uses a stated astronomical approximation. The 2password example is a metadata/search/authentication **fixture**, not a verified port of unavailable source or a live vault audit.
- Preview prints a contact sheet and serves the built page. Rerun after edits; it is not a hot-reloading author IDE.

## More
[Authoring and helpers](docs/EXPLAINERS.md) · [Embedding](docs/EMBEDDING.md) · [Video export](docs/EXPORT.md) · [Demo tour](docs/DEMO-TOUR.md) · [Original engine README](docs/UPSTREAM-README.md) · [Proposal](specs/kyle.md)

**Attribution:** Lantern is MIT, copyright 2026 Ivar Vong; its notice is preserved. Inter 4.1 and JetBrains Mono 2.242 are SIL OFL, with notices in `vendor/licenses/`. Agentic Mermaid 0.4.1 is optional, pinned and build-only. The fork base is `2c7bad533be25fbd56d26a9a2b6c5651743f011e`; the `upstream` remote tracks the original project. No endorsement is implied.
