# Your first explainer

This builds a two-case explainer of a cache, breaks one of the checks, fixes it, and builds the page. Run the commands from a checkout of this repository; in a project that installs the package, run the same commands as `npx rayner ...`.

You need Node 26 or later and `npm ci` run once, which installs the capture and video packages. The scene has a diagram, so the first run captures it with Chromium: install one with `npx playwright-core install chromium`, or point `CHROMIUM_EXECUTABLE_PATH` at an existing one.

## 1. Create the scene

```sh
npm run rayner -- init my-explainer
```

This writes `my-explainer/scene.ts`. Open it. It is an ordinary `Scene` from `rayner`:

- `static meta` gives the explainer an id (`my-explainer`, which names the output files) and a title.
- `static settings` declares one setting, `request`, with two options. With one setting, each option is a **case**; every case is built and checked before anyone reads it.
- `construct()` has two **steps**. Each has a stable name, a title and a caption. `stage(this, { style: 'nord' })` draws the paper and a heading that follows the step titles, and gives every diagram the `nord` style.
- The second step asks a tiny program for the answer (how many database reads), then shows it: `d.dim` fades the parts off the path, `d.walk(..., { trail: true })` sends a token along the real links and leaves them marked, and `s.card` shows the count.

## 2. Preview it

```sh
npm run rayner -- preview my-explainer/scene.ts --watch
```

The first run captures the diagram into `my-explainer/scene.snapshots/`; commit that folder with the scene. The command writes a contact sheet of every step (`out/explainers/my-explainer.steps.png`) and serves the page at http://127.0.0.1:5174/. Press **Next** to play a step; it stops on what the step leaves on screen, its **resting picture**, which is what a reader looks at while reading the caption.

Choose "Cache miss" above the stage, or open `http://127.0.0.1:5174/my-explainer.html?request=miss&step=request`. The URL names the case and the step, so a link opens exactly that picture. To see one case's steps without a browser:

```sh
npm run rayner -- shots my-explainer/scene.ts --case request=miss
```

Leave the preview running: with `--watch` it rebuilds on save, and a reload shows the change.

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
npm run rayner -- check my-explainer/scene.ts
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

Run `check` again. It passes and prints a report, also saved to `out/checks/my-explainer/report.json`. Its `restingFrames` field draws each step's resting picture roughly in text, and `legibility` gives label sizes on a laptop and a phone. [The reference](REFERENCE.md#checks) lists every check.

## 5. Build the page

```sh
npm run rayner -- build my-explainer/scene.ts --out public/my-explainer.html
```

This writes:

- `public/my-explainer.html`: the page, with both cases, a poster, a transcript and licence notices. It needs no network, fonts or storage.
- `public/my-explainer.html.headers.json`: the response headers your host must send, including a CSP that pins the inline script and style.
- `public/my-explainer.html.receipt.json`: hashes of the source, engine and snapshots.
- `public/loader.js`: an optional script that sizes the iframe to its content.

[Publishing](PUBLISHING.md) covers hosting these files, embedding the page with an iframe or the loader, and a video of the same scene.

## 6. Draw with the engine

The helpers cover diagrams, cards and code panels. For anything else a scene uses the engine itself, imported from `rayner`, and the engine has general features the explainers use. Each excerpt below is shortened from one of the demo scenes in `scenes/explainers/`; [the reference](REFERENCE.md#engine-features) lists them all with their guides.

Zoom onto what the step is about, then come back. The camera moves no point, so `check` measures labels as the reader sees them (`seasons`):

```ts
await this.play(this.frame.animate.fit(view, { margin: 0 }), { runTime: 1.2 });
// next step
await this.play(this.frame.animate.reset());
```

Morph code along its own diff, then read what each line did from the transform rather than typing it into the caption (`mr-cache`):

```ts
const diff = new TransformDiff(before, after, { runTime: 1.6 });
await this.play(diff);
const { same, changed, removed, added } = diff.plan;
```

Leave the emphasis on screen for the resting picture. A kept outline has no text, so it needs words (`mr-cache`):

```ts
const lookup = new Circumscribe(linesBox(after, 1, 2), { keep: true, color: hot });
s.keep(lookup.outline, { describe: 'The KV lookup is circled.' });
await this.play(lookup);
```

Chart the model's own function, and make a readout a picture of `scene.state` that follows it (`seasons`, `token-bucket`):

```ts
const curve = axes.plot(daylightAt(place.lat), { samples: 145, color: CURVE });
await this.play(new Create(curve), { runTime: 2 });

const readout = stateView(this, ['tokens', 'lastRefill', 'allowed', 'rejected']);
this.state = record(calls);
await this.play(readout.sync());
```

Run a step's operations in order in one play, with a copy of a value travelling into its slot while the source stays (`ring-buffer`):

```ts
await this.play(new Succession([
  new Create(outline, { runTime: 0.35 }),
  new TransformFromCopy(incoming, values[i], { runTime: 0.6 }),
]));
```

`check` treats all of these like the helpers: motion, seeking, words and legibility apply to every frame they draw.
