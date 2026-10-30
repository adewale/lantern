# LRU/MRU tutorial explainer: resting pictures

These images come from `scenes/tutorial/lru-mru/scene.ts` at commit `e27a32ea7a95aa944c9c309f8ef8d6ed9ce4e0a4`, rendered by the production player. The explainer is new, so there is no earlier picture to compare against.

| File | What it shows | Command |
| --- | --- | --- |
| [`contact-loop.png`](contact-loop.png) | Every resting step of the A B C D A B C D case at 1280 px | `npm run rayner -- shots scenes/tutorial/lru-mru/scene.ts --case next=loop --out docs/evidence/lru-mru-tutorial/contact-loop.png` |
| [`contact-reuse.png`](contact-reuse.png) | Every resting step of the A B C D C D C D case at 1280 px | the same command with `--case next=reuse` |
| [`phone-loop-rest-390.png`](phone-loop-rest-390.png) | The opening close-up of step 3, loop case, on a 390 px page | `npm run rayner -- review scenes/tutorial/lru-mru/scene.ts`, file `0/rest.390.png` |

`rayner review` opened both cases at 390 and 1180 px: 16 step-width checks, no console errors and no runtime connections (`sourceHash` `613e89be…`, `artifactHash` `26122948…`). `rayner check` reports no labels under 12 px in either case.

The values on the cards are tested separately: `test/explain-tutorial.test.ts` compares each case's cards with the model and runs the model against Wikipedia's worked examples.

**Limitation:** on a 390 px page the player opens each step on a close-up of part of the stage, so step 3 shows the MRU card first and the LRU card in a second view. A phone reader cannot see both hit counts at once.
