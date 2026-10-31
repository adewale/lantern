import { Group, Circle } from '../../../../src/index.ts';
import { PLACEMENTS, nodeShares, shares, secondHop, percent, podsOf, value, seenSource } from '../traffic-policy.ts';
import type { PlacementKey, Policy } from '../traffic-policy.ts';
import { label, tile, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(key: PlacementKey, policy: Policy): ReaderFrame[] {
  const counts = PLACEMENTS[key],
    ns = nodeShares(counts, policy),
    pods = podsOf(counts),
    cluster = shares(counts, 'cluster'),
    local = shares(counts, 'local');
  return [
    {
      id: 'reader-nodes',
      title: 'Does equal node traffic mean equal pod traffic?',
      line: `${counts.join(' / ')} pods; externalTrafficPolicy ${policy}.`,
      caption: `The load balancer divides requests across healthy nodes. Under ${policy}, the node shares are ${ns.map(percent).join(', ')}. Cluster mode can forward to a pod on another node. Local mode excludes nodes without local endpoints, then divides each node’s share among its own pods.`,
      values: { key, policy, nodeShares: ns.map(value) },
      draw: (s) =>
        new Group(
          ...counts.map((n, i) => {
            const x = (i - 1) * 4.8;
            return new Group(
              tile(`Node ${i + 1}`, x, 2, 4.2, 1, s),
              label(percent(ns[i]!), x, 0.4, s.palette.ink, 0.8),
              label(`${n} pod${n === 1 ? '' : 's'}`, x, -1, s.palette.ink, 0.7),
              ...Array.from({ length: n }, (_, j) =>
                new Circle({ radius: 0.22, fill: s.emphasis, stroke: 'none' }).moveTo([
                  x + (j - (n - 1) / 2) * 0.65,
                  -2.3,
                ]),
              ),
            );
          }),
        ),
    },
    {
      id: 'reader-shares',
      title: 'Compare the share per pod',
      line: 'Same placement and outside traffic; only the policy changes.',
      caption: `Each row identifies one pod. Cluster mode spreads traffic over all endpoints. Local mode can give pods on a sparsely populated node a larger share. The selected policy sends ${percent(secondHop(counts, policy))} of outside requests through a second node hop; a pod on node 1 sees source ${seenSource(policy, 0)} in this model.`,
      values: { cluster, local },
      draw: (s) =>
        table(
          ['Pod', 'Cluster', 'Local'],
          pods.map((p) => [`${p.id} / N${p.node + 1}`, percent(cluster[p.id]!), percent(local[p.id]!)]),
          s,
          { xs: [-5, -0.4, 5], y: 2.6, gap: 1.25 },
        ),
    },
  ];
}
