# Your first explainer

A Rayner explainer is a web page that answers one technical question in steps. The reader presses Next, something on the stage changes, and the picture then holds still while they read the caption. This tutorial builds one that answers this question: what is the difference between the LRU and MRU cache replacement policies?

You will plan the explainer before writing code, write and test a small model of the two policies, draw its answers, break a check on purpose, fix a caption that claims more than its picture shows, and build the page. Each step applies one of the principles below. The [authoring skill](../skills/rayner-explainers/SKILL.md) gives coding agents the same principles, and the [editorial rubric](EXPLAINER-RUBRIC.md) scores finished explainers against them.

## What makes an explainer work

1. Start from a reader's question. Write down who is asking, what result they saw and the answer you can support. If a screenshot or a short diff already answers the question, publish that instead.
2. Open on the result that needs explaining. Names for the parts can wait until the reader needs them.
3. Get every value from a model. The numbers, paths and outcomes on screen come from a small program, which you check against the real system by running the tool, using its test vectors or citing the exact source version you read. A caption never states an answer the model did not give.
4. Give each step one inference. A step answers a question the previous step raised. Its title says what the picture proves, its line says where to look, and its caption connects what is visible to what follows from it.
5. Leave the evidence on screen. Readers read the caption while the picture is still, so the item, mark or value the caption mentions must be there when the motion stops. Put a value beside the thing it measures.
6. Use a second case to test the tempting shortcut. Change one input that could prove the reader's guess wrong, keep everything else fixed, and write each case's caption for that case's own outcome. A change that only recolours the picture tests nothing.
7. Move things only to show order, identity or cause. If the final picture already tells the whole story, show it at once. When something changes form, keep it recognisable, because a morph on its own does not prove that the before and after are the same thing.
8. End on the specific result and its limit: what the explainer showed, and where the claim stops holding.

`rayner check` and `rayner review` find missing, overlapping and unreadable ink. Because they cannot tell whether a caption is true, principles 1, 3, 6 and 8 stay with you.

## Before you start

You need Node 24 or later. In your project, run `npm install --save-dev rayner`; the commands below then run as `npx rayner <command>`. In a checkout of this repository, run `npm ci` and use `npm run rayner -- <command>` instead. The finished explainer is in [`scenes/tutorial/lru-mru/`](../scenes/tutorial/lru-mru/).

This explainer draws no diagrams, so `check`, `preview` and `build` work without a browser. `review` opens the page in Chromium: install it with `npx playwright-core install chromium`, or set `CHROMIUM_EXECUTABLE_PATH` to a Chromium you already have.

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

Write the plan before any code (principle 1):

```text
Reader:    a developer choosing a replacement policy who assumes recently used data is always worth keeping
Question:  what is the difference between LRU and MRU, and when does it matter?
Answer:    on a miss in a full cache, LRU evicts the item used longest ago and MRU evicts the item used most
           recently; which one gets more hits depends on the order of requests
Model:     run(policy, size, requests) returns each request's hit, eviction and cache contents
Sources:   the worked examples in Wikipedia's "Cache replacement policies"; Chou and DeWitt, VLDB 1985
Case:      baseline A B C D A B C D | changed: last four are C D C D | fixed: three slots, same first four
           requests, both policies | predicted hits: LRU 0, MRU 3 → LRU 4, MRU 0
Limit:     hit counts for eight requests through three slots; not the cost of tracking recency, and no claim
           about random access
```

The case line is written before any drawing, so the picture has to match a prediction (principle 6). The tempting shortcut is that keeping recent items is always right. A loop over more items than the cache holds is the request pattern that could prove it wrong. Chou and DeWitt wrote that a file being repeatedly scanned should be kept in memory if possible, and that if it is too large to fit, "an MRU replacement algorithm should be used to manage the buffer pool". The two cases share their first four requests, so the first eviction is identical in both and only what follows it differs.

The limit line keeps the explainer inside what it tests. It counts hits, so it cannot say anything about latency or the bookkeeping LRU needs to track recency. It does not test random access either, where Chou and DeWitt report that "the choice of a replacement algorithm is immaterial". The limit becomes the last caption (principle 8).

Then ask whether a still would do. A trace table of eight requests and two policies answers the question for a reader who already reads trace tables. The stepped version earns its place by isolating the one decision where the policies differ before it shows what that decision costs over the whole sequence.

## 2. Write the model

Create `lru-mru/model.ts`. It has no drawing code, so a test can import it:

<!-- lru-mru/model.ts -->
```ts
export type Policy = 'lru' | 'mru';

export interface Request {
  key: string;
  hit: boolean;
  /** The item this request pushed out, if the cache was full and the key missed. */
  evicted?: string;
  /** What the cache holds after this request, most recently used first. */
  cache: string[];
}

/** Send each request to a cache that holds `size` items and replaces them by `policy`. */
export function run(policy: Policy, size: number, requests: string[]): Request[] {
  let cache: string[] = [];
  return requests.map((key) => {
    const hit = cache.includes(key);
    let evicted: string | undefined;
    if (!hit && cache.length === size) evicted = policy === 'lru' ? cache.at(-1) : cache[0];
    cache = [key, ...cache.filter((k) => k !== key && k !== evicted)];
    return { key, hit, evicted, cache };
  });
}
```

The cache is a list ordered by recency, most recently used first, and every request moves its key to the front. A hit changes only the order. A miss in a full cache evicts one item first, and the two policies differ in exactly one expression: LRU removes the last item in the list and MRU removes the first. Because every request moves its key to the front, the first item is always the one requested just before, so an MRU miss evicts the previous request's item.

## 3. Check the model against the source

Wikipedia's article walks through one example per policy on a cache of four blocks. For LRU and the requests A B C D E D F, "E will replace A" and "F is then accessed, replacing B". For MRU and A B C D E C D B, E replaces D, and C is later replaced because "it was the block accessed just before D". Turn both examples into tests in `lru-mru/model.test.ts`:

<!-- lru-mru/model.test.ts -->
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, type Policy } from './model.ts';

const evictions = (policy: Policy, requests: string) =>
  run(policy, 4, [...requests]).map((r) => r.evicted ?? '-').join(' ');

test("LRU matches Wikipedia's example: E replaces A, then F replaces B", () => {
  assert.equal(evictions('lru', 'ABCDEDF'), '- - - - A - B');
});

test("MRU matches Wikipedia's example: E replaces D, then D replaces C", () => {
  assert.equal(evictions('mru', 'ABCDECDB'), '- - - - D - C -');
});
```

```sh
node --test lru-mru/model.test.ts
```

Both pass. Now swap `cache.at(-1)` and `cache[0]` in `model.ts` and run the tests again: both fail, so they can tell the two policies apart. Swap them back.

Pin what you checked against in the scene's `meta.sources` (principle 3). The scene below links the exact Wikipedia revision it was checked against, not the live page, and the 1985 paper.

## 4. Write the scene

Create `lru-mru/scene.ts`:

<!-- lru-mru/scene.ts -->
```ts
import { Scene } from 'rayner';
import { stage, settingsOf } from 'rayner/explain';
import { run, type Policy } from './model.ts';

const SIZE = 3;
const NEXT = { loop: 'ABCD', reuse: 'CDCD' };

export default class LruMru extends Scene {
  static meta = {
    id: 'lru-mru',
    title: 'What is the difference between LRU and MRU?',
    sources: [
      'https://en.wikipedia.org/w/index.php?title=Cache_replacement_policies&oldid=1376205644',
      'https://www.vldb.org/conf/1985/P127.PDF',
    ],
  };
  static settings = [{ id: 'next', label: 'After A B C D, request', default: 'loop', options: [{ value: 'loop', label: 'A B C D again' }, { value: 'reuse', label: 'C D C D' }] }];

  override async construct() {
    const s = stage(this, { style: 'nord' });
    const next = settingsOf(this).next as keyof typeof NEXT;
    const requests = [...('ABCD' + NEXT[next])];
    const trace = { lru: run('lru', SIZE, requests), mru: run('mru', SIZE, requests) };

    // What each card shows after the first n requests, read from the model's trace.
    const rows = (policy: Policy, n: number) => {
      const done = trace[policy].slice(0, n), hits = done.filter((r) => r.hit).map((r) => r.key);
      return {
        'Cache, newest first': done.at(-1)!.cache.join(' '),
        Evicted: done.flatMap((r) => r.evicted ?? []).join(' ') || 'none',
        Hits: hits.length ? `${hits.length}: ${hits.join(' ')}` : '0',
      };
    };
    const show = async (n: number) => {
      await sent.set({ Requests: requests.slice(0, n).join(' ') });
      await lru.set(rows('lru', n));
      await mru.set(rows('mru', n));
      this.state.lru = rows('lru', n);
      this.state.mru = rows('mru', n);
    };

    await this.step('full', { title: 'Same items, same order', line: 'A, B and C missed and filled all three slots.', caption: 'Both caches have seen the same three requests, so both hold C, B, A from newest to oldest. The next request, D, misses in both and forces each policy to evict one item.' });
    const sent = await s.card([['Requests', 'A B C'], ['Cache size', `${SIZE} items`]], { at: 'top', width: 9 });
    const lru = await s.card(Object.entries(rows('lru', 3)), { at: 'left', title: 'LRU', width: 7 });
    const mru = await s.card(Object.entries(rows('mru', 3)), { at: 'right', title: 'MRU', width: 7 });
    await show(3);

    const [lruOut, mruOut] = [trace.lru[3]!.evicted, trace.mru[3]!.evicted];
    await this.step('evict', { title: 'D evicts opposite ends', line: `LRU drops ${lruOut}, the oldest; MRU drops ${mruOut}, the newest.`, caption: `LRU evicts the item used longest ago, ${lruOut}. MRU evicts the item used most recently, ${mruOut}. Each then records D as its newest item.` });
    await show(4);
    await lru.mark('Evicted');
    await mru.mark('Evicted');

    const lruHits = trace.lru.filter((r) => r.hit).length, mruHits = trace.mru.filter((r) => r.hit).length;
    await this.step('rest', {
      title: `LRU ${lruHits} hits, MRU ${mruHits}`,
      line: next === 'loop' ? 'Each item LRU evicts is the next one the loop asks for.' : 'Each item MRU evicts is the next one requested.',
      caption: next === 'loop'
        ? 'The loop asks for A, B, C and D again. LRU always evicts the item the loop needs next, so all eight requests miss. MRU evicted C to make room for D, so on the second pass A, B and D hit and only C misses.'
        : 'C and D now alternate. LRU still holds both after evicting A, so all four repeats hit. MRU evicts the item requested just before, which is always the next one requested, so all four repeats miss.',
    });
    await show(8);
  }
}
```

Read it from the top:

- `static settings` declares one setting with two options. Each option is a case: the reader can switch between them, and `check` and `review` visit both. Both cases send A B C D first, then either repeat the loop or alternate C and D.
- `trace` asks the model once per case. Every value on the cards comes from it: `rows` turns the trace into what each card shows after the first `n` requests, and `show(n)` updates the three cards and records the same values on `this.state`, where tests and `rayner describe` can read them.
- `stage(this, { style: 'nord' })` draws the paper and a heading that follows the steps. `s.card` places labelled values in a region of the stage.
- There are three steps. Each has a stable name used in links, a title, a line and a caption. The stage draws the title and line above the picture; the page prints the caption beside it.

The first step opens on the moment the policies are about to diverge (principle 2): both caches hold the same items in the same order and D is about to miss. The second step is the whole difference between the policies, so it gets a step of its own (principle 4), and its marks on the Evicted rows stay on screen while the reader reads why (principle 5). Its captions take the evicted items from the model. The third step's captions are written by hand for each case; they are claims about the model too, so the repository's copy of this scene has [a test](../test/explain-tutorial.test.ts) that checks each one.

## 5. Preview it

```sh
npx rayner preview lru-mru/scene.ts --watch
```

Open http://127.0.0.1:5174/ and press Next. Each step plays and then stops on its resting picture, which is what the reader looks at while reading the caption. After step 3 the Evicted row of each card lists every eviction in order. On the loop, LRU's evictions read A B C D A: each item LRU evicts is the next one the loop asks for.

Choose C D C D above the stage. The URL names the case and step (`lru-mru.html?next=reuse&step=rest`), so a link opens that exact picture. Now MRU's evictions read C D C D C, and each item MRU evicts is the next one requested. In both cases the losing policy evicts the item needed soonest, the opposite of Bélády's optimal algorithm, which discards the information that "would not be needed for the longest time". Leave the preview running; it rebuilds when you save.

## 6. Add an ending and break a check

The plan's limit line is not in the scene yet. Here is a first attempt at an ending, added after `await show(8);`:

```ts
    await this.step('verdict', {
      title: 'MRU keeps more',
      caption: 'MRU holds on to older items, so it gets more hits than LRU.',
    });
```

Run the checks:

```sh
npx rayner check lru-mru/scene.ts
```

```text
rayner: Each step must change the picture; these end exactly as the step before in After A B C D, request: A B C D again
+ actual - expected

+ [
+   'verdict'
+ ]
- []
```

The new step plays nothing, so it rests on exactly the picture step 3 left. A reader pressing Next would get a new caption and nothing new on the stage to read it against. The check reports the first case where this happens.

Make the step point at its evidence. Move each card's mark from the Evicted row to the Hits row:

```ts
    await lru.mark('Hits');
    await mru.mark('Hits');
```

Run `check` again and it passes. The report it saves to `out/checks/lru-mru/report.json` includes `legibility.labelsUnder12PxAt390`, the number of labels a phone reader sees smaller than 12 px. Keep it at 0 in every case.

## 7. Read each step as a newcomer

The check passed, but the caption is still wrong. Print the step as text in the other case:

```sh
npx rayner see lru-mru/scene.ts verdict --case next=reuse
```

After a rough text drawing of the resting picture, it prints:

```text
lru-mru · step 4 of 4: verdict · After A B C D, request: C D C D
Title: MRU keeps more
Caption: MRU holds on to older items, so it gets more hits than LRU.
Picture: 2 labelled values; “LRU”, 3 labelled values; “MRU”, 3 labelled values. Marked: Hits: 4: C D C D; Hits: 0.
Changed: nothing in scene.state
```

The marked rows say LRU hit four times and MRU never did, so in this case the caption is false. It was written from the loop case and from the shortcut the plan set out to test. Replace the step with one whose title and caption come from each case's own outcome (principle 6) and end on the plan's limit (principle 8):

<!-- lru-mru/scene.ts ending -->
```ts
    await this.step('verdict', {
      title: next === 'loop' ? 'A loop favours MRU' : 'Reuse favours LRU',
      caption: next === 'loop'
        ? `On this loop MRU hits ${mruHits} times and LRU ${lruHits}. Four items do not fit in three slots, which is when Chou and DeWitt recommend MRU for a repeated scan; a file that fits should stay in memory. The counts leave out what tracking recency costs.`
        : `On this pattern LRU hits ${lruHits} times and MRU ${mruHits}, because the items just used are the next ones requested. The counts cover eight requests through three slots and leave out what tracking recency costs.`,
    });
    await lru.mark('Hits');
    await mru.mark('Hits');
```

Read every step of every case this way. `npx rayner describe lru-mru/scene.ts --out out/lru-mru.json` writes the whole explainer as JSON, and `npx rayner shots lru-mru/scene.ts --case next=reuse` makes a contact sheet of one case. At each step, ask:

- Does the caption name a value, item or comparison that the picture does not show?
- Could a reader work out the cause from the resting pictures alone, without watching the motion?
- Would any sentence be false in another case?
- Does the first step deliver what the title promises, and does the last step earn its conclusion in every case?
- Does any sentence claim more than the sources say? Chou and DeWitt recommend MRU for a looping file only when it is too large to fit, which is why the loop's ending says so.

## 8. Review and build

```sh
npx rayner review lru-mru/scene.ts
```

`review` runs the checks, then opens every step of every case at phone and desktop widths in Chromium and saves screenshots in `out/review/lru-mru/`. Look at them yourself; a passing review shows that the pictures render, not that they explain.

```sh
npx rayner build lru-mru/scene.ts --out public/lru-mru.html
```

`build` does not repeat the checks. It writes the page, which needs no network, plus `lru-mru.html.headers.json` with the response headers your host must send, a receipt of input hashes and an optional `loader.js` that sizes an embedding iframe. [Publishing](PUBLISHING.md) covers hosting and embedding.

## Next

- To explain another kind of subject, start from the nearest example. The [skill's table](../skills/rayner-explainers/SKILL.md#start-from-an-example) matches subjects such as a protocol, a race, a state machine or a code change to explainers in `scenes/explainers/`. `npx rayner init <directory>` writes a two-case starter scene with a diagram.
- The [reference](REFERENCE.md) covers the stage, card, diagram and check APIs. The [engine map](ENGINE.md) covers camera moves, code diffs, charts and pictures rebuilt from state.
- The [editorial rubric](EXPLAINER-RUBRIC.md) scores a finished explainer against the principles at the top of this page.
