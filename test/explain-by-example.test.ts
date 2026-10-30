import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectProject } from '../tools/lib/explain-project.ts';
import { TokenBucket, pkceChallenge } from '../scenes/explainers/lib/models.ts';

const lesson = () => readFileSync('docs/BY-EXAMPLE.md', 'utf8');

test('problem-led examples link to the question, changed input and witnessed result', async () => {
  const guide = lesson();
  for (const [id, cases, step] of [
    ['mr-cache', ['request=hit', 'request=miss'], 'request'],
    ['token-bucket', ['rate=1', 'rate=4'], 'trace'],
    ['oauth-pkce', ['attacker=yes', 'attacker=no'], 'exchange'],
  ] as const) {
    const project = await collectProject(`scenes/explainers/${id}`, { write: false });
    for (const setting of cases) {
      const [key, value] = setting.split('=');
      const variant = project.variants.find(v => v.values[key!] === value);
      assert.ok(variant, `${id}: ${setting} exists`);
      assert.ok(variant.trace.steps.some(s => s.step === step), `${id}: ${setting} has ${step}`);
      assert.ok(guide.includes(`https://oshineye.dev/projects/rayner/${id}?${setting}&step=${step}`), `${id}: link the real ${setting} result`);
    }
    assert.match(guide, new RegExp(`scenes/explainers/${id}/scene\\.ts`), `${id}: link the runnable scene`);
  }
});

test('by-example code excerpts come verbatim from the models or scenes', () => {
  const guide = lesson();
  const excerpts = [...guide.matchAll(/<!-- excerpt: ([^ ]+) -->\n```ts\n([\s\S]*?)\n```/g)];
  assert.equal(excerpts.length, 3);
  for (const [, file, snippet] of excerpts) {
    assert.ok(file && snippet);
    assert.ok(readFileSync(file, 'utf8').includes(snippet), `${file}: excerpt matches source`);
  }
});

test('the example comparisons retain their consequential model outcomes', async () => {
  const cache = await collectProject('scenes/explainers/mr-cache', { write: false });
  for (const [request, reads] of [['hit', 0], ['miss', 1]] as const) {
    const variant = cache.variants.find(v => v.values.request === request)!;
    const result = variant.trace.steps.find(s => s.step === 'request')!;
    assert.equal(result.after!.reads, reads);
  }
  const times = [0, 0, 0, 0, 0, 0, 0.5, 1, 1, 2];
  for (const [rate, rejected] of [[1, ['R6', 'R7', 'R9']], [4, ['R6']]] as const) {
    const bucket = new TokenBucket(rate);
    assert.deepEqual(times.flatMap((time, i) => bucket.allow(time) ? [] : [`R${i + 1}`]), rejected);
  }
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.notEqual(pkceChallenge('attacker-does-not-know-the-original-verifier'), pkceChallenge(verifier));
  const oauth = await collectProject('scenes/explainers/oauth-pkce', { write: false });
  assert.equal(oauth.variants.find(v => v.values.attacker === 'yes')!.trace.steps.find(s => s.step === 'attack')!.after!.attackerAccepted, false);
  assert.equal(oauth.variants.find(v => v.values.attacker === 'no')!.trace.steps.some(s => s.step === 'attack'), false);
});
