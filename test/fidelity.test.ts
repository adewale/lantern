// Is the explanation true? Every other check is self-consistency: a scene that
// animates the wrong answer smoothly and deterministically passes them all.
// Here a reference implementation of the program each scene explains replays
// the trace's step inputs (meta) and must reproduce the state the scene shows
// (after). The references are the code on screen, run for real.
//
// pyex-limits is the one example not covered: its program is Elixir, and its
// numbers are hand-derived from reading ctx.ex. See docs/VERIFY.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceScene } from '../src/index.ts';
import type { StepMeta } from '../src/index.ts';
import { SCENES } from '../scenes/index.ts';

/** Replay a scene's steps through `oracle(state, meta)`; every step's `after` must match. */
async function replay<S extends Record<string, unknown>>(name: string, initial: S, oracle: (state: S, meta: StepMeta) => S | undefined, keys: Array<keyof S & string>): Promise<void> {
  const { steps } = await traceScene(SCENES[name]!.Scene);
  let state = initial;
  for (const s of steps) {
    state = oracle(state, s.meta) ?? state;
    // A full trace closes every step, so each has an `after`
    const after = s.after!;
    for (const k of keys) assert.deepEqual(after[k], state[k], `${name} step "${s.step}": ${k} shown as ${JSON.stringify(after[k])}, program says ${JSON.stringify(state[k])}`);
  }
  assert.ok(steps.length > 3);
}

test('token-bucket: the shown tokens, refill time and verdicts are what allow(now) computes', async () => {
  const CAP = 10, RATE = 2;
  // The code on screen, verbatim in spirit: refill from elapsed time, then consume
  const bucket = { tokens: CAP, lastRefill: 0, allow(now: number): boolean {
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(CAP, this.tokens + elapsed * RATE);
    this.lastRefill = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  } };
  const responses: number[] = [];
  await replay('token-bucket', { tokens: CAP, lastRefill: 0, responses }, (st, meta) => {
    if (meta.at == null) return st;
    // The scene's step meta: { at: seconds, burst: request count }
    const at = meta.at as number, burst = meta.burst as number;
    for (let b = 0; b < burst; b++) {
      const ok = bucket.allow(at);
      responses.push(ok ? 200 : 429);
      if (!ok) break;                       // the scene stops a burst at its first 429
    }
    return { tokens: +bucket.tokens.toFixed(2), lastRefill: bucket.lastRefill, responses };
  }, ['tokens', 'lastRefill', 'responses']);
});

test('ring-buffer: head, tail and len follow push/pop with wraparound', async () => {
  const CAP = 6;
  const rb = { buf: new Array<unknown>(CAP), head: 0, tail: 0, len: 0,
    push(x: unknown) { if (this.len === CAP) throw new Error('Full'); this.buf[this.tail] = x; this.tail = (this.tail + 1) % CAP; this.len++; },
    pop(): unknown { const x = this.buf[this.head]; this.head = (this.head + 1) % CAP; this.len--; return x; } };
  await replay('ring-buffer', { head: 0, tail: 0, len: 0 }, (st, meta) => {
    if (meta.op === 'push') rb.push(meta.value);
    else if (meta.op === 'pop') assert.equal(rb.pop(), meta.value, 'pop returns the value the scene names');
    return { head: rb.head, tail: rb.tail, len: rb.len };
  }, ['head', 'tail', 'len']);
});

test('state-machine: every transition is what reduce(state, event) returns, including the throw', async () => {
  function reduce(state: string, event: { type: unknown }): string {
    switch (`${state}:${event.type}`) {
      case 'idle:CONNECT': return 'connecting';
      case 'connecting:OPENED': return 'open';
      case 'connecting:ERROR': return 'closed';
      case 'open:CLOSE': return 'closed';
      default: throw new Error('InvalidTransition');
    }
  }
  type MachineState = { state: string; event: unknown; error: string | undefined };
  await replay<MachineState>('state-machine', { state: 'idle', event: null, error: undefined }, (st, meta) => {
    if (!meta.event) return st;
    assert.equal(meta.from, st.state, 'the scene starts the transition from the real current state');
    try { return { state: reduce(st.state, { type: meta.event }), event: meta.event, error: undefined }; }
    catch (e) { return { state: st.state, event: meta.event, error: (e as Error).message }; }
  }, ['state', 'event', 'error']);
});

test('exgit: every object id the explainer shows is what the real git CLI computes', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { story } = await import('../scenes/lib/gitmodel.ts');
  const s = story();
  const dir = mkdtempSync(join(tmpdir(), 'exgit-oracle-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Ada', GIT_AUTHOR_EMAIL: 'ada@example.com', GIT_AUTHOR_DATE: '1700000000 +0000',
    GIT_COMMITTER_NAME: 'Ada', GIT_COMMITTER_EMAIL: 'ada@example.com', GIT_COMMITTER_DATE: '1700000000 +0000' };
  const git = (...a: string[]): string => execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...a], { cwd: dir, env, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    writeFileSync(join(dir, 'hello.txt'), 'hello\n'); git('add', 'hello.txt'); git('commit', '-q', '-m', 'add hello');
    writeFileSync(join(dir, 'world.txt'), 'world\n'); git('add', 'world.txt'); git('commit', '-q', '-m', 'add world');
    assert.equal(s.hello, git('rev-parse', 'HEAD:hello.txt'));
    assert.equal(s.world, git('rev-parse', 'HEAD:world.txt'));
    assert.equal(s.t1, git('rev-parse', 'HEAD~1^{tree}'));
    assert.equal(s.t2, git('rev-parse', 'HEAD^{tree}'));
    assert.equal(s.c1, git('rev-parse', 'HEAD~1'));
    assert.equal(s.c2, git('rev-parse', 'HEAD'));
    assert.equal(s.repo.resolve('HEAD'), git('rev-parse', 'HEAD'));
    assert.equal(s.repo.reachable(s.c2).length, git('rev-list', '--objects', 'HEAD').split('\n').length);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // and the scene shows these, not copies of them
  const { steps } = await traceScene(SCENES['exgit']!.Scene);
  const last = steps.at(-1)!.after!;
  assert.equal(last.head, s.c2);
  assert.equal(last.objects, 6);
});

test('lantern: every hop a token makes is an edge of the diagram the scene draws', async () => {
  const { ARCHITECTURE } = await import('../scenes/lantern.ts');
  const { parseMermaid } = await import('../src/mermaid.ts');
  const g = parseMermaid(ARCHITECTURE);
  const edges = new Set(g.edges.map((e) => `${e.from}->${e.to}`));
  const { steps } = await traceScene(SCENES['lantern']!.Scene);
  // The lantern scene's state records each hop as [from, to]
  const hops = steps.at(-1)!.after!.hops as Array<[string, string]>;
  assert.ok(hops.length >= 10, 'the walk covers the system');
  for (const [a, b] of hops) assert.ok(edges.has(`${a}->${b}`), `the scene shows ${a} -> ${b}, which is not in the diagram`);
  // and the oracle edge is the dotted one from the program
  assert.ok(g.edges.some((e) => e.from === 'P' && e.to === 'V1' && e.stroke === 'dotted'));
});
