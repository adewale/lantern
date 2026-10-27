import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describeExplainer } from '../explain/index.ts';
import type { ExplainerClass, ExplainerDescription } from '../explain/index.ts';
import { writeDescriptions, summaryOf } from '../tools/lib/explain-site-describe.ts';
import RingBuffer from '../scenes/explainers/ring-buffer/scene.ts';

test('site:export writes each explainer as <id>.json beside its page, and llms.txt at the site root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'explain-site-'));
  try {
    await mkdir(join(root, 'projects/rayner'), { recursive: true });
    const sizes = await writeDescriptions(root, '/projects/rayner', [
      { id: 'glyph', group: 'toolchain' },
      { id: 'ring-buffer', group: 'topic' },
    ]);
    // The JSON is describeExplainer's object, drawings included, as `rayner describe` prints it.
    const json = await readFile(join(root, 'projects/rayner/ring-buffer.json'), 'utf8');
    assert.deepEqual(JSON.parse(json), await describeExplainer(RingBuffer as ExplainerClass));
    const llms = await readFile(join(root, 'llms.txt'), 'utf8');
    assert.equal(sizes.llms, Buffer.byteLength(llms));
    assert.ok(sizes.json > json.length);
    // llms.txt: an H1, a blockquote, then link lists by group, topics first.
    assert.match(llms, /^# Rayner explainers\n\n> \S.+\n/);
    assert.ok(llms.indexOf('## Explainers') < llms.indexOf('## How these are made'));
    assert.match(
      llms,
      /^- \[A ring buffer reuses freed slots and refuses a push when full\]\(\/projects\/rayner\/ring-buffer\): Head is the next value to pop; tail is the next slot to write\. JSON: \[ring-buffer\.json\]\(\/projects\/rayner\/ring-buffer\.json\)$/m,
    );
    assert.match(llms, /^## How these are made\n\n- \[[^\]]+\]\(\/projects\/rayner\/glyph\): .+ JSON: \[glyph\.json\]\(\/projects\/rayner\/glyph\.json\)$/m);
    // A second export replaces its own llms.txt, with absolute links given --origin; a site's own
    // llms.txt is left alone and the export fails.
    await writeDescriptions(root, '/projects/rayner', [{ id: 'ring-buffer', group: 'topic' }], 'https://example.org/');
    assert.match(
      await readFile(join(root, 'llms.txt'), 'utf8'),
      /\]\(https:\/\/example\.org\/projects\/rayner\/ring-buffer\): .+ JSON: \[ring-buffer\.json\]\(https:\/\/example\.org\/projects\/rayner\/ring-buffer\.json\)$/m,
    );
    await writeFile(join(root, 'llms.txt'), '# My site\n');
    await assert.rejects(writeDescriptions(root, '/projects/rayner', [{ id: 'ring-buffer', group: 'topic' }]), /not one site:export wrote/);
    assert.equal(await readFile(join(root, 'llms.txt'), 'utf8'), '# My site\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an explainer's llms.txt summary is the first sentence of its default case's first caption", () => {
  const step = (caption: string) => ({ step: 's', title: 'T', caption, start: 0, end: 1, state: {}, changed: {}, picture: '' });
  const d: ExplainerDescription = {
    schema: 1,
    id: 'x',
    title: 'X',
    lang: 'en',
    sources: [],
    settings: [{ id: 'n', label: 'N', default: 'b', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }],
    cases: [
      { values: { n: 'a' }, name: 'N: A', duration: 1, steps: [step('Not the default.')] },
      { values: { n: 'b' }, name: 'N: B', duration: 1, steps: [step('Version 4.3.3 sets  it.\nThe rest is detail.')] },
    ],
  };
  assert.equal(summaryOf(d), 'Version 4.3.3 sets it.');
});
