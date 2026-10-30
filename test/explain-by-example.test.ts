import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectProject } from '../tools/lib/explain-project.ts';
import { pkceChallenge } from '../scenes/explainers/lib/models.ts';
import { CHARS, guarded } from '../scenes/explainers/lib/isdigit.ts';

const lesson = () => readFileSync('docs/BY-EXAMPLE.md', 'utf8');

test('problem-led examples link to the question, changed input and witnessed result', async () => {
  const guide = lesson();
  for (const [id, cases, step] of [
    ['mr-cache', ['request=hit', 'request=miss'], 'request'],
    ['isdigit', ['char=super&guard=isdigit', 'char=super&guard=isdecimal'], 'outcome'],
    ['oauth-pkce', ['attacker=yes', 'attacker=no'], 'exchange'],
  ] as const) {
    const project = await collectProject(`scenes/explainers/${id}`, { write: false });
    for (const setting of cases) {
      const values = new URLSearchParams(setting);
      const variant = project.variants.find(v => [...values].every(([key, value]) => v.values[key] === value));
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
  assert.deepEqual(guarded(CHARS.super, 'isdigit'), {
    passes: true, outcome: 'raised', int: { error: "invalid literal for int() with base 10: '²'" },
  });
  assert.equal(guarded(CHARS.super, 'isdecimal').outcome, 'refused');
  const digits = await collectProject('scenes/explainers/isdigit', { write: false });
  for (const [guard, outcome] of [['isdigit', 'raised'], ['isdecimal', 'refused']] as const) {
    const variant = digits.variants.find(v => v.values.char === 'super' && v.values.guard === guard)!;
    assert.equal(variant.trace.steps.find(s => s.step === 'outcome')!.after!.outcome, outcome);
  }
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.notEqual(pkceChallenge('attacker-does-not-know-the-original-verifier'), pkceChallenge(verifier));
  const oauth = await collectProject('scenes/explainers/oauth-pkce', { write: false });
  assert.equal(oauth.variants.find(v => v.values.attacker === 'yes')!.trace.steps.find(s => s.step === 'attack')!.after!.attackerAccepted, false);
  assert.equal(oauth.variants.find(v => v.values.attacker === 'no')!.trace.steps.some(s => s.step === 'attack'), false);
});
