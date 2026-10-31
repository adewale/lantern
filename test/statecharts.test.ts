// The statecharts explainer's model, against XState and against the player the article describes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONTROLS,
  RUNS,
  player,
  initial,
  send,
  run,
  events,
  flatten,
  flatName,
  chartCounts,
  flatCounts,
} from '../scenes/explainers/lib/statecharts.ts';
import { XSTATE_VERSION, FIXTURE, PREEMPT } from '../tools/oracle/statecharts.ts';
import type { Expected } from '../tools/oracle/statecharts.ts';

// Captured by `node tools/oracle/statecharts.ts <dir>` with the pinned XState; see that file.
const xstate = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Expected;

test('flattening each player reaches the configurations and transitions XState reaches', () => {
  assert.equal(xstate.xstate, XSTATE_VERSION);
  assert.deepEqual(xstate.players.map((p) => p.controls), CONTROLS.map((_, i) => i + 1));
  for (const x of xstate.players) {
    const chart = player(x.controls),
      flat = flatten(chart);
    assert.deepEqual(events(chart), x.events, `${x.controls}: event alphabet`);
    assert.equal(flat.initial, flatName(x.initial));
    const names = x.configurations.map(flatName);
    assert.deepEqual([...flat.states].sort(), [...names].sort(), `${x.controls}: states`);
    const key = (t: { from: string; event: string; to: string }) => `${t.from} ${t.event} ${t.to}`;
    assert.deepEqual(
      flat.transitions.map(key).sort(),
      x.transitions.map(([from, event, to]) => key({ from: names[from]!, event, to: names[to]! })).sort(),
      `${x.controls}: transitions`,
    );
    // XState's `can` and the model's `handled` agree on every reachable configuration and event,
    // including the events a configuration ignores.
    for (const config of x.configurations)
      for (const event of x.events)
        assert.equal(
          send(chart, config, event).handled,
          x.transitions.some(([from, e]) => names[from] === flatName(config) && e === event),
          `${x.controls}: ${flatName(config)} ${event}`,
        );
  }
});

test('the event sequences the explainer plays end where XState ends them', () => {
  for (const x of xstate.players) {
    assert.deepEqual(x.run.map((r) => r.event), RUNS[x.controls]);
    assert.deepEqual(
      run(player(x.controls), RUNS[x.controls]!).map((s) => ({ event: s.event, can: s.handled, config: s.config })),
      x.run,
    );
  }
});

test('flat states double with each control while the chart adds two states and two transitions', () => {
  const rows = CONTROLS.map((_, i) => {
    const chart = player(i + 1);
    return [i + 1, chartCounts(chart), flatCounts(flatten(chart))] as const;
  });
  // 2^n combinations plus off; each combination has a POWER arrow and one
  // arrow per control, and off has one; the chart has two states and two arrows per control, plus off and on.
  for (const [n, c, f] of rows) {
    assert.equal(f.states, 2 ** n + 1);
    assert.equal(f.transitions, (n + 1) * 2 ** n + 1);
    assert.deepEqual(c, { states: 2 * n + 2, transitions: 2 * n + 2 });
  }
});

test('POWER in a nested state is taken by on, which leaves every region at once', () => {
  const steps = run(player(2), ['POWER', 'PLAY', 'MUTE', 'POWER']);
  assert.deepEqual(steps[0], {
    event: 'POWER', handled: true, sources: ['off'], exited: ['off'], entered: ['paused', 'unmuted'], config: ['paused', 'unmuted'],
  });
  assert.deepEqual(steps[1]!.sources, ['paused']);
  assert.deepEqual(steps[1]!.exited, ['paused'], 'PLAY leaves the volume region alone');
  assert.deepEqual(steps[2]!.sources, ['unmuted']);
  assert.deepEqual(steps[3], {
    event: 'POWER', handled: true, sources: ['on'], exited: ['playing', 'muted'], entered: ['off'], config: ['off'],
  });
  const one = run(player(1), ['POWER', 'PLAY', 'POWER']);
  assert.deepEqual(one.map((s) => s.sources), [['off'], ['paused'], ['on']]);
});

test('a child that handles an event itself preempts its parent, as in XState, and an event no state handles changes nothing', () => {
  // SCXML selects the transition on the innermost state that has one.
  const chart = PREEMPT;
  assert.deepEqual(send(chart, ['a1'], 'GO').config, ['a2']);
  assert.deepEqual(send(chart, ['a1'], 'GO').sources, ['a1']);
  assert.deepEqual(send(chart, ['a2'], 'GO').config, ['b']);
  assert.deepEqual(send(chart, ['a2'], 'GO').sources, ['a']);
  assert.deepEqual(send(chart, ['b'], 'GO'), { event: 'GO', handled: false, sources: [], exited: [], entered: [], config: ['b'] });
  assert.deepEqual(send(player(2), ['off'], 'PLAY').config, ['off']);
  // XState goes a1 → a2 → b on two GOs, and takes no GO in b.
  const x = xstate.preempt,
    names = x.configurations.map(flatName),
    flat = flatten(chart);
  assert.deepEqual(names, ['a1', 'a2', 'b']);
  assert.deepEqual(x.transitions, [[0, 'GO', 1], [1, 'GO', 2]]);
  assert.deepEqual(flat.transitions.map((t) => [names.indexOf(t.from), t.event, names.indexOf(t.to)]), x.transitions);
});

test('charts that break the model’s rules are refused', () => {
  assert.throws(() => player(0), RangeError);
  assert.throws(() => player(CONTROLS.length + 1), RangeError);
  assert.throws(() => initial({ id: 'r', type: 'compound', initial: 'x', children: [{ id: 'a', type: 'atomic' }] }), /initial is not a child/);
  assert.throws(() => initial({ id: 'r', type: 'compound', initial: 'a', children: [{ id: 'a', type: 'atomic', on: { GO: 'z' } }] }), /unknown state z/);
  assert.throws(() => initial({ id: 'r', type: 'compound', initial: 'a', children: [{ id: 'a', type: 'atomic' }, { id: 'a', type: 'atomic' }] }), /Duplicate/);
});
