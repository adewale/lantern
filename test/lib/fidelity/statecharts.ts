import assert from 'node:assert/strict';
import type { Trace } from '../../../src/trace.ts';
import type { SnapshotStore, DiagramSnapshot } from '../../../integrations/agentic-mermaid/snapshot.ts';
import { RUNS, player, flatten, run } from '../../../scenes/explainers/lib/statecharts.ts';
import type { StateNode } from '../../../scenes/explainers/lib/statecharts.ts';

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
const written = (node: StateNode): string[] => [
  ...Object.entries(node.on ?? {}).map(([event, to]) => `${node.id} ${event} ${to}`),
  ...(node.children ?? []).flatMap(written),
];

/**
 * What the scene's own code does not guarantee: each token rides the arrow the chart defines for the
 * state that handled the event (the scene picks the arrow its own way), and the captured pictures draw
 * exactly the flattened machine's transitions and the chart's.
 */
export function check(values: Record<string, string>, trace: Trace, store: SnapshotStore): void {
  const n = values.controls === 'one' ? 1 : 2,
    chart = player(n),
    steps = run(chart, RUNS[n]!);
  const walks = (trace.steps.at(-1)!.after!.walks ?? []) as { step: string; from: string; to: string }[];
  assert.deepEqual(
    walks.map((w) => `${w.step} ${w.from} ${w.to}`),
    steps.map((s, i) => `${i === steps.length - 1 ? 'power' : 'run'} ${s.sources[0]} ${find(chart, s.sources[0]!)!.on![s.event]}`),
  );
  const drawn = Object.values(store).map((s) => drawnArrows(s).join('\n'));
  const flat = flatten(chart).transitions.map((t) => `${t.from} ${t.event} ${t.to}`).sort();
  assert.ok(drawn.includes(flat.join('\n')), 'no diagram draws exactly the flat machine');
  assert.ok(drawn.includes(written(chart).sort().join('\n')), 'no diagram draws exactly the chart');
}
