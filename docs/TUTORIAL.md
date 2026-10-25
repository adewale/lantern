# Your first explainer

This builds a two-case explainer of a cache, breaks one of the checks, fixes it, and embeds the page. Run the commands from a checkout of this repository; an installed package runs the same commands as `explain`.

You need Node 26 or later and `npm ci` run once. The scene has a diagram, so the first run captures it with Chromium: install one with `npx playwright-core install chromium`, or point `CHROMIUM_EXECUTABLE_PATH` at an existing one.

## 1. Create the scene

```sh
npm run explain -- init first-explainer
```

This writes `first-explainer/scene.ts`. Open it. It is an ordinary Lantern `Scene`:

- `static meta` gives the explainer an id (`my-explainer`, which names the output files) and a title.
- `static settings` declares one setting, `request`, with two options. Each option is a **case**; every case is built and checked before anyone reads it.
- `construct()` has two **steps**. Each has a stable name, a title and a caption. `stage(this, { style: 'nord' })` draws the paper and a heading that follows the step titles, and gives every diagram the `nord` style.
- The second step asks a tiny program for the answer (how many database reads), then shows it: `d.dim` fades the parts off the path, `d.walk(..., { trail: true })` sends a token along the real links and leaves them marked, and `s.card` shows the count.

## 2. Preview it

```sh
npm run explain -- preview first-explainer/scene.ts --watch
```

The first run captures the diagram into `first-explainer/scene.snapshots/`; commit that folder with the scene. The command prints a contact sheet of every step (`out/explainers/my-explainer.steps.png`) and serves the page at http://127.0.0.1:5174/. Press **Next** to play a step; it stops on the step's last frame, the **resting frame**, which is what a reader looks at while reading the caption.

Choose "Cache miss" above the stage, or open `http://127.0.0.1:5174/my-explainer.html?request=miss&step=request`. The URL names the case and the step, so a link opens exactly that picture. To see one case's steps without a browser:

```sh
npm run explain -- shots first-explainer/scene.ts --case request=miss
```

Leave the preview running. With `--watch` it rebuilds when you save the scene; reload the browser to see the change.

## 3. Add a step that fails the check

Add a third step at the end of `construct()`:

```ts
    await this.step('reply', {
      title: 'One reply either way',
      caption: 'Both paths end at the same reply; only the number of database reads differs.',
    });
    await d.walk([PATH[which].at(-1)!]);
```

Then run the checks:

```sh
npm run explain -- check first-explainer/scene.ts
```

```text
explain: Each step must change the picture; these end exactly as the step before in Follow a request: Cache hit
+ actual - expected

+ [
+   'reply'
+ ]
- []
```

The new step walks the last link again. The token travels and disappears, and the link was already marked by the previous step's trail, so the step ends on the same picture as the step before. A reader who presses Next would see a token flash past and then nothing new beside the caption. The check names the first case that fails.

## 4. Fix it

Make the step leave something on screen that its caption talks about. Replace the walk with a mark on the reply:

```ts
    await d.mark(['Reply']);
```

Run `check` again. It passes and prints a report, also saved to `out/checks/my-explainer/report.json`. Its `restingFrames` field shows each step's resting frame as text, and `legibility` gives the smallest label size at a 1280 px stage and on a 390 px phone. [The reference](REFERENCE.md#checks) lists every check.

## 5. Build the page

```sh
npm run explain -- build first-explainer/scene.ts --out public/first.html
```

This writes:

- `public/first.html`: the page, with both cases, a poster, a transcript and licence notices. It needs no network, fonts or storage.
- `public/first.html.headers.json`: the response headers your host must send, including a CSP that pins the inline script and style.
- `public/first.html.receipt.json`: hashes of the source, engine and snapshots.
- `public/loader.js`: an optional script that sizes the iframe to its content.

## 6. Embed it

Host the files and put an iframe on any page:

```html
<iframe src="/first.html?step=request&request=miss"
        title="Why a cache changes the request path"
        style="width:100%;height:640px;border:0;display:block"
        allow="fullscreen"
        loading="lazy"></iframe>
```

The page adds its own "Open in a new tab" link inside the frame. [Publishing](PUBLISHING.md) covers the headers, the auto-sizing loader and a video of the same scene.
