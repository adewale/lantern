# LRU/MRU tutorial explainer: resting pictures

The contact sheets come from `scenes/tutorial/lru-mru/scene.ts` at commit `a37f2a3d14371e497ec40d217ea6cf4c81dfa45a` and are unchanged since. The phone screenshots were retaken after merging the player redesign (#59, #65) at commit `777577a`; the step bar and card player changed their pixels, not what the close-ups show. The scene shows both policies in one card with an LRU and an MRU column.

| File | What it shows | Command |
| --- | --- | --- |
| [`contact-loop.png`](contact-loop.png) | Every resting step of the A B C D A B C D case at 1280 px | `npm run rayner -- shots scenes/tutorial/lru-mru/scene.ts --case next=loop --out docs/evidence/lru-mru-tutorial/contact-loop.png` |
| [`contact-reuse.png`](contact-reuse.png) | Every resting step of the A B C D C D C D case at 1280 px | the same command with `--case next=reuse` |
| [`phone-loop-rest-390.png`](phone-loop-rest-390.png) | Step 3 of the loop case on a 390 px page | `npm run rayner -- review scenes/tutorial/lru-mru/scene.ts`, file `0/rest.390.png` |
| [`phone-reuse-verdict-390.png`](phone-reuse-verdict-390.png) | Step 4 of the C D C D case on a 390 px page | the same review, file `1/verdict.390.png` |

`rayner review` opened both cases at 390 and 1180 px: 16 step-width checks, one phone view per step, no console errors and no runtime connections (`sourceHash` `a5961f2b…`, `artifactHash` `02f680a6…`). `rayner check` reports no labels under 12 px in either case.

The values on the card are tested separately: `test/explain-tutorial.test.ts` compares each case's card with the model and runs the model against Wikipedia's worked examples.

**Limitation:** the phone close-up frames what changed in a step. At step 4 that is the Hits row, so the top of the card (Requests and Slots) sits above the view; both hit counts are in it.
