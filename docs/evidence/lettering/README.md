# Requested lettering output

These 960 × 540 PNGs come from the production SVG renderer and resvg, using the
committed `test/lettering/{arabic,devanagari,math,style}` inputs at their first
step's resting frame. They show Arabic joining/marks, Devanagari text, a fraction
with a superscript, and the explicitly requested EB Garamond face.

The same Arabic source on base `7f3d8266686603062c79b0eda4beabaf36cdd3bc`
fails with the error in `baseline-arabic.txt`. The input was copied unchanged
into a `git archive` extraction of that commit and run with its CLI. There is
no before image because that revision rejects `Arab` before rendering.

After `npm ci`, regenerate the after images from the repository root:

```sh
node --input-type=module <<'JS'
import {writeFile} from 'node:fs/promises';
import {collectProject,defaultVariant} from './tools/lib/explain-project.ts';
import {stillPng} from './tools/lib/explain-shots.ts';
import {restingTime} from './explain/trace.ts';
for (const id of ['arabic','devanagari','math','style']) {
  const p = await collectProject(`test/lettering/${id}`, {write:false});
  const v = defaultVariant(p);
  const t = restingTime(v.trace.steps[0], v.trace.fps);
  await writeFile(`docs/evidence/lettering/${id}.png`, await stillPng(v.Scene,t,960));
}
JS
```

The fixture snapshots mean this command needs no Python or font downloads.
`receipt.json` records input/output hashes and the render revision. Independent
HarfBuzz checks and the existing seek/bare-runtime gates are in
`test/lettering-outlines.test.ts`. The PNGs show four fixed cases; they do not
prove arbitrary language coverage, bidi isolates, morph pairing across complex
clusters, or legibility at every viewport.
