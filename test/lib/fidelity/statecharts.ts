import assert from 'node:assert/strict';
import type { Trace } from '../../../src/trace.ts';
import type { SnapshotStore, DiagramSnapshot } from '../../../integrations/agentic-mermaid/snapshot.ts';
import { assertStepState } from '../explainer-state.ts';
import { CONTROLS, player, flatten, run, chartCounts, flatCounts } from '../../../scenes/explainers/lib/statecharts.ts';
import type { StateNode } from '../../../scenes/explainers/lib/statecharts.ts';
import { RUNS } from '../../../tools/oracle/statecharts.ts';

/** Every labelled arrow a captured diagram draws, as "from EVENT to"; arrows from a start dot have no event. */
function drawnArrows(snapshot: DiagramSnapshot): string[] {
  const text = (id: string) =>
    snapshot.parts
      .filter((p) => p.owner === id)
      .flatMap((p) => p.shapes.map((s) => s.text?.trim()).filter(Boolean))
      .join(' ');
  return snapshot.parts
    .filter((p) => p.role === 'edge' && p.from && p.to && text(p.id))
    .map((p) => `${p.from} ${text(p.id)} ${p.to}`)
    .sort();
}

const find = (node: StateNode, id: string): StateNode | undefined =>
  node.id === id ? node : (node.children ?? []).map((c) => find(c, id)).find(Boolean);

/** The transitions a chart writes on its states, as "from EVENT to". */
function written(node: StateNode): string[] {
  return [
    ...Object.entries(node.on ?? {}).map(([event, to]) => `${node.id} ${event} ${to}`),
    ...(node.children ?? []).flatMap(written),
  ];
}

/**
 * Each case's steps hold the model's counts, configurations and growth table; the walks ride the
 * transitions the model takes; and the two pictures draw exactly the flattened machine and the chart.
 */
export function check(values: Record<string, string>, trace: Trace, store: SnapshotStore): void {
  const n = values.controls === 'one' ? 1 : 2;
  const chart = player(n),
    flat = flatten(chart),
    counts = { flatCounts: flatCounts(flat), chartCounts: chartCounts(chart) };
  assert.deepEqual(
    trace.steps.map((s) => s.step),
    n === 2 ? ['flat', 'regions', 'parent', 'run', 'power', 'growth'] : ['flat', 'parent', 'run', 'power', 'growth'],
  );
  for (const step of n === 2 ? ['flat', 'regions', 'parent'] : ['flat', 'parent'])
    assertStepState(trace, step, { controls: n, active: ['off'], flat: 'off', ...counts });

  // The scene plays the oracle's event sequence; XState ends each event where the model does.
  const events = RUNS[n]!,
    steps = run(chart, events),
    beforePower = steps.at(-2)!;
  assertStepState(trace, 'run', {
    events: events.slice(0, -1),
    active: beforePower.config,
    flat: beforePower.config.join(' + '),
    handledBy: beforePower.sources,
  });
  assertStepState(trace, 'power', { events, active: ['off'], flat: 'off', handledBy: ['on'] });
  // A token rides each transition: from the state that handled the event to the state it targets.
  const walks = (trace.steps.at(-1)!.after!.walks ?? []) as { step: string; from: string; to: string }[];
  assert.deepEqual(
    walks.map((w) => `${w.step} ${w.from} ${w.to}`),
    steps.map((s, i) => `${i === steps.length - 1 ? 'power' : 'run'} ${s.sources[0]} ${find(chart, s.sources[0]!)!.on![s.event]}`),
  );
  assertStepState(trace, 'growth', {
    growth: CONTROLS.map((_, i) => ({ chart: chartCounts(player(i + 1)), flat: flatCounts(flatten(player(i + 1))) })),
  });

  // The pictures: one captured diagram draws the flattened machine's transitions and no others,
  // and one draws the chart's; the drawn arrows are the counts the card reports.
  const drawn = Object.values(store).map(drawnArrows);
  const flatArrows = flat.transitions.map((t) => `${t.from} ${t.event} ${t.to}`).sort();
  const chartArrows = written(chart).sort();
  assert.ok(drawn.some((d) => JSON.stringify(d) === JSON.stringify(flatArrows)), 'no diagram draws the flat machine');
  assert.ok(drawn.some((d) => JSON.stringify(d) === JSON.stringify(chartArrows)), 'no diagram draws the chart');
  assert.equal(flatArrows.length, counts.flatCounts.transitions);
  assert.equal(chartArrows.length, counts.chartCounts.transitions);
}
