import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  sha256,
  pkceChallenge,
  reduceSession,
  TokenBucket,
  RingBuffer,
  Full,
  ringStory,
  exec,
  checkStep,
  sunlight,
  daylightYear,
} from '../scenes/explainers/lib/models.ts';
import { rankMetadata, secretWorkflow } from '../scenes/explainers/2password/model.ts';
import { Repo, AUTHOR } from '../scenes/lib/gitmodel.ts';

test('SHA-256 and PKCE agree with independent crypto and the RFC 7636 vector', () => {
  for (let n = 0; n < 180; n++) {
    const input = Array.from({ length: n }, (_, i) => String.fromCharCode(32 + ((i * 17 + n) % 90))).join('');
    assert.equal(
      Buffer.from(sha256(input)).toString('hex'),
      createHash('sha256').update(input).digest('hex'),
    );
  }
  assert.equal(
    pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
  assert.notEqual(pkceChallenge('stolen-code-wrong-verifier'), pkceChallenge('original-verifier'));
});
test('both session histories come from the reducer; closed rejects all modeled events', () => {
  for (const events of [
    ['CONNECT', 'OPENED', 'CLOSE'],
    ['CONNECT', 'ERROR'],
  ])
    assert.equal(events.reduce(reduceSession, 'idle'), 'closed');
  for (const event of ['CONNECT', 'OPENED', 'CLOSE', 'ERROR'])
    assert.throws(() => reduceSession('closed', event), /InvalidTransition/);
});
test('rate changes alter real decisions while balances stay inside capacity', () => {
  const successes = [];
  for (const rate of [1, 2, 4]) {
    const bucket = new TokenBucket(rate);
    const results = [0, 0, 0, 0, 0, 0, 0.5, 1, 1, 2].map((now) => {
      const ok = bucket.allow(now);
      assert.ok(bucket.tokens >= 0 && bucket.tokens <= 5);
      return ok;
    });
    assert.deepEqual(results.slice(0, 6), [true, true, true, true, true, false]);
    successes.push(results.filter(Boolean).length);
  }
  assert.deepEqual(successes, [7, 8, 9]);
});
test('ring wraps into freed slots and Full changes no state', () => {
  assert.deepEqual(ringStory('wrap').at(-1)!.result, { head: 2, tail: 2, length: 5, data: [6, 7, 3, 4, 5] });
  const full = ringStory('full');
  assert.deepEqual(full[5]!.result, full[4]!.result);
  assert.deepEqual(full[6]!.result, full[4]!.result);
  assert.equal(full[5]!.error, 'Full');
  for (let capacity = 1; capacity <= 16; capacity++) {
    const ring = new RingBuffer<number>(capacity);
    const reference: number[] = [];
    for (let i = 0; i < 100; i++) {
      if (i % 3 === 0 && reference.length) {
        assert.equal(ring.pop(), reference.shift());
      } else if (reference.length === capacity) {
        const before = ring.snapshot();
        assert.throws(() => ring.push(i), Full);
        assert.deepEqual(ring.snapshot(), before);
      } else {
        ring.push(i);
        reference.push(i);
      }
      assert.equal(ring.length, reference.length);
      assert.ok(ring.head >= 0 && ring.head < capacity && ring.tail >= 0 && ring.tail < capacity);
    }
  }
});
test('shell execution returns a new filesystem and never mutates its input', () => {
  const original = { fs: {}, steps: 0 };
  const next = exec(
    original,
    [
      ['echo', 'hello'],
      ['tr', 'a-z', 'A-Z'],
    ],
    'shout.txt',
  );
  assert.deepEqual(original, { fs: {}, steps: 0 });
  assert.equal(next.shell.fs['shout.txt'], 'HELLO\n');
  assert.equal(next.stdout, '');
  assert.equal(exec(original, [['cat', 'shout.txt']]).stdout, '');
  assert.equal(exec(next.shell, [['cat', 'shout.txt']]).stdout, 'HELLO\n');
});
test('resource errors use first matching clause, including simultaneous limits', () => {
  assert.deepEqual(
    checkStep({ steps: 3, memory: 30000, output: 100 }, { steps: 3, memory: 30000, output: 100 }, true),
    { status: 'step limit', steps: 3 },
  );
  assert.equal(
    checkStep({ steps: 3, memory: 30000, output: 100 }, { steps: 9, memory: 30000, output: 100 }, true)
      .status,
    'memory limit',
  );
  assert.equal(
    checkStep({ steps: 0, memory: 0, output: 0 }, { steps: 9, memory: 30000, output: 100 }, true).status,
    'deadline',
  );
  assert.deepEqual(checkStep({ steps: 0, memory: 0, output: 0 }, { steps: 9, memory: 30000, output: 100 }), {
    status: 'ok',
    steps: 1,
  });
});
test('sunlight is bounded, hemisphere-symmetric, and predicts polar extremes', () => {
  for (let latitude = -89; latitude <= 89; latitude++)
    for (let declination = -23; declination <= 23; declination++) {
      const value = sunlight(latitude, declination);
      assert.ok(value.daylight >= 0 && value.daylight <= 24);
      assert.ok(Math.abs(value.daylight - sunlight(-latitude, -declination).daylight) < 1e-10);
    }
  assert.equal(sunlight(69.65, 23.44).daylight, 24);
  assert.equal(sunlight(69.65, -23.44).daylight, 0);
  assert.deepEqual(daylightYear(0), Array(12).fill(12));
  assert.ok(sunlight(-33.87, 23.44).daylight < 12);
});
test('both git cases hash the exact typed bytes used by the Git CLI', () => {
  for (const change of ['add', 'edit']) {
    const repo = new Repo(),
      hello = repo.blob('hello\n'),
      t1 = repo.tree([['100644', 'hello.txt', hello]]),
      c1 = repo.commit({ tree: t1, author: AUTHOR, message: 'first\n' }),
      next = repo.blob(change === 'add' ? 'world\n' : 'hello again\n'),
      t2 = repo.tree(
        change === 'add'
          ? [
              ['100644', 'hello.txt', hello],
              ['100644', 'world.txt', next],
            ]
          : [['100644', 'hello.txt', next]],
      );
    repo.commit({ tree: t2, parents: [c1], author: AUTHOR, message: 'second\n' });
    for (const [id, obj] of Object.entries(repo.objects))
      assert.equal(
        execFileSync('git', ['hash-object', '-t', obj.type, '--stdin'], {
          input: obj.bytes,
          encoding: 'utf8',
        }).trim(),
        id,
      );
  }
});
test('secret fixture searches metadata and strips only the child auth credential', () => {
  assert.deepEqual(
    rankMetadata('production api').map((r) => r.id),
    ['prod'],
  );
  assert.deepEqual(rankMetadata('nonexistent'), []);
  for (const result of rankMetadata('api'))
    assert.deepEqual(Object.keys(result).sort(), ['id', 'score', 'tags', 'title', 'username']);
  for (const auth of ['desktop', 'service']) {
    const run = secretWorkflow(auth);
    assert.ok(!('OP_SERVICE_ACCOUNT_TOKEN' in run.childEnv));
    assert.equal(run.childEnv.APP_MODE, 'production');
    assert.equal(run.approvals, auth === 'service' ? 0 : 3);
    assert.equal(run.commands.at(-1), 'op run -- env -u OP_SERVICE_ACCOUNT_TOKEN app');
  }
});
