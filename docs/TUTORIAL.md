# Your first explainer

A Rayner explainer is a web page that answers one technical question in steps. The reader presses Next, something on the stage changes, and the picture then holds still while they read the caption. This tutorial builds one about a cache: a request that finds its value in the cache never reads the database, so what changes when the value is missing?

You will plan the explainer before writing code, generate a starting scene, break a check on purpose, fix a caption that claims more than its picture shows, and build the page. Each step applies one of the principles below. The [authoring skill](../skills/rayner-explainers/SKILL.md) gives coding agents the same principles, and the [editorial rubric](EXPLAINER-RUBRIC.md) scores finished explainers against them.

## What makes an explainer work

1. Start from a reader's question. Write down who is asking, what result they saw and the answer you can support. If a screenshot or a short diff already answers the question, publish that instead.
2. Open on the result that needs explaining. Names for the parts can wait until the reader needs them.
3. Get every value from a model. The numbers, paths and outcomes on screen come from a small program, which you check against the real system by running the tool, using its test vectors or citing the exact source version you read. A caption never states an answer the model did not give.
4. Give each step one inference. A step answers a question the previous step raised. Its title says what the picture proves, its line says where to look, and its caption connects what is visible to what follows from it.
5. Leave the evidence on screen. Readers read the caption while the picture is still, so the path, mark or value the caption mentions must be there when the motion stops. Put a value beside the thing it measures.
6. Use a second case to test the tempting shortcut. Change one input that could prove the reader's guess wrong, keep everything else fixed, and write each case's caption for that case's own outcome. A change that only recolours the picture tests nothing.
7. Move things only to show order, identity or cause. If the final picture already tells the whole story, show it at once. When something changes form, keep it recognisable, because a morph on its own does not prove that the before and after are the same thing.
8. End on the specific result and its limit: what the explainer showed, and where the claim stops holding.

`rayner check` and `rayner review` find missing, overlapping and unreadable ink. Because they cannot tell whether a caption is true, principles 1, 3, 6 and 8 stay with you.

## Before you start

You need Node 24 or later. In your project, run `npm install --save-dev rayner`; the commands below then run as `npx rayner <command>`. In a checkout of this repository, run `npm ci` and use `npm run rayner -- <command>` instead.

Diagrams are captured in Chromium. Install it with `npx playwright-core install chromium`, or set `CHROMIUM_EXECUTABLE_PATH` to a Chromium you already have.

## 0. Hello, world!

```ts
import { Scene, Text, FadeIn } from 'rayner';

export default class HelloWorld extends Scene {
  static meta = { id: 'hello-world', title: 'Hello, world!' };
  override async construct() {
    await this.step('hello', { title: 'Hello, world!', caption: 'The picture says “Hello, world!”.' });
    await this.play(new FadeIn(new Text('Hello, world!', { fontSize: 1.2 })));
  }
}
```

Save this as `hello-world/scene.ts` and build it:

```sh
npx rayner build hello-world/scene.ts --out public/hello-world.html
```

Open `public/hello-world.html` in a browser. A page with one step that fades in "Hello, world!" means your setup works. Every scene has these parts: `meta` names the page, `step` starts a step with its title and caption, and `play` runs an animation. Hello World answers no question, so it is a setup check rather than an explainer.

## 1. Plan on paper

Write the plan before any code (principle 1). For the cache it fits in six lines:

```text
Reader:    a developer reviewing a change that puts a cache in front of the database
Question:  does every request still read the database?
Answer:    only a miss does; a hit replies with zero database reads
Model:     reads = 0 on a hit, 1 on a miss
Case:      baseline hit | changed to miss | same request and code | predicted 0 → 1 reads
Limit:     the model counts database reads; it does not measure time or staleness
```

Write the case line before you draw anything. A hit and a miss differ in one condition, whether the value is already cached, and the plan predicts what that condition changes. The picture then has to match the prediction (principle 6). The limit line becomes the last caption (principle 8).

Then ask whether a still would do. A single diagram with both paths answers this question for some readers. The stepped version earns its place only if following one request, then switching to the other case, makes the difference in reads easier to check. When it does not, publish the diagram.

## 2. Generate the scene

```sh
npx rayner init my-explainer
```

This writes `my-explainer/scene.ts`:

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

    await this.step('architecture', { title: 'A cache in front of storage', line: 'The cache sits between the request and the database.', caption: 'A request checks the cache first and reads the database only on a miss.' });
    const d = await s.show({ source: FLOW }, { box: 'top' });

    await this.step('request', { title: which === 'hit' ? 'A cache hit' : 'A cache miss', line: which === 'hit' ? 'The reply comes from the cache: no database read.' : 'The cache misses, so the database is read once.', caption: which === 'hit' ? 'The value is already cached, so the request returns without reading the database.' : 'The value is absent, so the request reads the database once and then returns.' });
    // Ask the program, then show its answer: here the path and the read count.
    const reads = which === 'hit' ? 0 : 1;
    await d.dim([...new Set(PATH[which].flat())]);
    await d.walk(PATH[which], { trail: true });
    await s.card([['Database reads', reads]], { at: 'bottom' });
    this.state.reads = reads;
  }
}
```

Read it from the top:

- `FLOW` is the diagram, written in Mermaid. `PATH` lists the links each kind of request travels. Every hop must be a link in `FLOW`, because `walk` throws on a link the diagram does not have.
- `static meta` holds the id, which names the output files, and the page title.
- `static settings` declares one setting with two options. Each option is a case: the reader can switch between them, and `check` and `review` visit both.
- `construct()` has two steps. Each has a stable name used in links, a title, a line and a caption. The stage draws the title and line above the picture; the page prints the caption beside it.
- `const reads = ...` is the model, one line long. The scene shows its answer in three places: `d.dim` fades the links off the path, `d.walk(..., { trail: true })` moves a token along the path and leaves its links marked, and `s.card` shows the count. `this.state.reads = reads` records the answer so that tests and `rayner describe` can read it.

The first step shows the architecture before any request runs. A strict reading of principle 2 would open on the miss and its extra read instead; with three boxes, orienting the reader costs one step.

## 3. Preview it

```sh
npx rayner preview my-explainer/scene.ts --watch
```

The first run captures the diagram into `my-explainer/scene.snapshots/`. Commit that folder with the scene. Open http://127.0.0.1:5174/ and press Next. Each step plays and then stops on its resting picture, which is what the reader looks at while reading the caption (principle 5). After step 2 the trail and the card stay on screen, so a reader can check the caption's claim about database reads against the picture.

Choose Cache miss above the stage. The URL names the case and step (`my-explainer.html?request=miss&step=request`), so a link opens that exact picture. Leave the preview running; it rebuilds when you save.

## 4. Add an ending and break a check

The plan's limit line is not in the scene yet. Here is a first attempt at an ending, added after `this.state.reads = reads;`:

```ts
    await this.step('reply', {
      title: 'One reply either way',
      caption: 'Both paths end at the same reply; only the number of database reads differs.',
    });
    await d.walk([PATH[which].at(-1)!]);
```

Run the checks:

```sh
npx rayner check my-explainer/scene.ts
```

```text
rayner: Each step must change the picture; these end exactly as the step before in Follow a request: Cache hit
+ actual - expected

+ [
+   'reply'
+ ]
- []
```

The new step walks the last link again. Step 2's trail already marked that link, so once the token disappears, step 3 rests on exactly the picture step 2 left. A reader pressing Next would see a token flash past and nothing new to read the caption against. The check reports the first case where this happens.

Make the step leave something on screen. Replace the walk with a note on the database (`Store` is its id in `FLOW`):

```ts
    await d.note('Store', reads === 0 ? 'not read' : 'read once', { side: 'below' });
```

The note puts the outcome on the node it describes (principle 5). Run `check` again and it passes. The report it saves to `out/checks/my-explainer/report.json` includes `legibility.labelsUnder12PxAt390`, the number of labels a phone reader sees smaller than 12 px. Keep it at 0 in every case.

## 5. Read each step as a newcomer

The check passed, but the caption is still wrong. Print the step as text:

```sh
npx rayner see my-explainer/scene.ts reply --case request=hit
```

After a rough text drawing of the resting picture, it prints:

```text
my-explainer · step 3 of 3: reply · Follow a request: Cache hit
Title: One reply either way
Caption: Both paths end at the same reply; only the number of database reads differs.
Picture: Flowchart: 4 nodes, 4 links; 1 labelled value. Note: “not read” beside Database; travelled: Request → Cache; Cache → Reply: hit.
Changed: nothing in scene.state
```

The `Picture` line lists only the hit path, but the caption compares two paths, so a reader in this case has nothing to check the comparison against. Either show both paths in the resting picture or make the caption claim only what this case shows. The second fix is smaller, and it leaves room for the plan's limit:

```ts
    await this.step('reply', {
      title: which === 'hit' ? 'Replied without the database' : 'Replied after one database read',
      caption: `This request needed ${reads} database read${reads === 1 ? '' : 's'}. The model counts reads; it says nothing about how long a request takes.`,
    });
```

Each case now has a title and caption written for its own outcome (principle 6), and the last step states the result and where it stops holding (principle 8).

Read every step of every case this way. `npx rayner describe my-explainer/scene.ts --out out/my-explainer.json` writes the whole explainer as JSON, and `npx rayner shots my-explainer/scene.ts --case request=miss` makes a contact sheet of one case. At each step, ask:

- Does the caption name a value, path or comparison that the picture does not show?
- Could a reader work out the cause from the resting pictures alone, without watching the motion?
- Would any sentence be false in another case?
- Does the first step deliver what the title promises, and does the last step earn its conclusion in every case?

## 6. Check the model against the real system

In this scene the model is `which === 'hit' ? 0 : 1`, which has nothing outside itself to be checked against. A model of a real system does (principle 3):

- Keep the model in its own module, with no drawing code, so that a test can import it.
- Check it against its source. Run the real program or library, or use its published test vectors, and pin the version in `meta.sources`. If you could only read the source, pin what you read (a tagged file, an RFC section) and say that you did not run it.
- Record each step's answer on `this.state`, as the template does with `reads`, and write a test that every case's state matches the model. Break the model once and watch the test fail.

The [`isdigit` explainer](../scenes/explainers/isdigit/scene.ts) is a complete example. Its [model](../scenes/explainers/lib/isdigit.ts) of Python's `isdigit()` and `int()` is checked against CPython 3.15.1 in [`test/explain-isdigit.test.ts`](../test/explain-isdigit.test.ts).

## 7. Review and build

```sh
npx rayner review my-explainer/scene.ts
```

`review` runs the checks, then opens every step of every case at phone and desktop widths in Chromium and saves screenshots in `out/review/my-explainer/`. Look at them yourself; a passing review shows that the pictures render, not that they explain.

```sh
npx rayner build my-explainer/scene.ts --out public/my-explainer.html
```

`build` does not repeat the checks. It writes the page, which needs no network, plus `my-explainer.html.headers.json` with the response headers your host must send, a receipt of input hashes and an optional `loader.js` that sizes an embedding iframe. [Publishing](PUBLISHING.md) covers hosting and embedding.

## Next

- To explain another kind of subject, start from the nearest example. The [skill's table](../skills/rayner-explainers/SKILL.md#start-from-an-example) matches subjects such as a protocol, a race, a state machine or a code change to explainers in `scenes/explainers/`.
- The [reference](REFERENCE.md) covers the stage, diagram and check APIs. The [engine map](ENGINE.md) covers camera moves, code diffs, charts and pictures rebuilt from state.
- The [editorial rubric](EXPLAINER-RUBRIC.md) scores a finished explainer against the principles at the top of this page.
