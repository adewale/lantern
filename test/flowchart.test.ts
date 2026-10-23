// Mermaid flowcharts in Lantern: the parser against mermaid's own (when
// MERMAID_JS points at mermaid.min.js), and the layout against geometric
// invariants on random flowcharts. FULL=1 runs 10x the seeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaid } from '../src/mermaid.ts';
import { layoutGraph, isotonic } from '../src/graphlayout.ts';
import { flowchart, loadFonts, Scene, StringSink, LaggedStart, MotionSink, analyzeMotion } from '../src/index.ts';
import type { FlowEdge, FlowSubgraph } from '../src/index.ts';
import type { MermaidResult } from '../tools/oracle/mermaid.ts';
import { randomFlowchart } from './lib/random-mermaid.ts';
import { rng } from './lib/random-scene.ts';
import { mermaidPath, mermaidParse } from '../tools/oracle/mermaid.ts';

await loadFonts();
const N = process.env.FULL ? 2000 : 200;

test('parser: shapes, links, labels, lists, subgraphs, classes', () => {
  const g = parseMermaid(`flowchart LR
    classDef hot fill:#300,stroke:#f66
    A["two<br/>lines"]:::hot --> B(round) -- "label" --> C{diamond} & D([stadium])
    C -.-> E((circle)) ==>|thick| F[(db)]
    subgraph S [The title]
      direction TB
      E
    end
    D --- A
    style F fill:#222`);
  assert.equal(g.direction, 'LR');
  assert.deepEqual([...g.nodes.values()].map((n) => [n.id, n.shape]), [['A', 'square'], ['B', 'round'], ['C', 'diamond'], ['D', 'stadium'], ['E', 'circle'], ['F', 'cylinder']]);
  assert.equal(g.nodes.get('A')!.text, 'two\nlines');
  assert.deepEqual(g.nodes.get('A')!.classes, ['hot']);
  assert.deepEqual(g.edges.map((e) => [e.from, e.to, e.type, e.stroke, e.text]), [
    ['A', 'B', 'arrow_point', 'normal', ''], ['B', 'C', 'arrow_point', 'normal', 'label'], ['B', 'D', 'arrow_point', 'normal', 'label'],
    ['C', 'E', 'arrow_point', 'dotted', ''], ['E', 'F', 'arrow_point', 'thick', 'thick'], ['D', 'A', 'arrow_open', 'normal', ''],
  ]);
  assert.deepEqual(g.subgraphs.map((s) => [s.id, s.title, s.nodes, s.dir]), [['S', 'The title', ['E'], 'TB']]);
  assert.deepEqual(g.nodes.get('F')!.style, ['fill:#222']);
  assert.throws(() => parseMermaid('flowchart TB\n subgraph X\n A'), /not closed/);
  assert.throws(() => parseMermaid('sequenceDiagram\n A->>B: hi'), /expected "flowchart/);
});

test('parser agrees with mermaid itself on random flowcharts', { skip: !mermaidPath() && 'set MERMAID_JS to mermaid.min.js (11.x)' }, async () => {
  const srcs = Array.from({ length: N }, (_, i) => randomFlowchart(i + 1));
  const theirs = await mermaidParse(srcs);
  const norm = (t: string): string => t.replace(/<br\s*\/?>/gi, '\n');
  srcs.forEach((src, i) => {
    const outcome = theirs[i]!, ctx = `seed ${i + 1}`;
    if (outcome.error) { assert.throws(() => parseMermaid(src), `${ctx}: mermaid rejects it`); return; }
    const th = outcome as MermaidResult;
    const g = parseMermaid(src);
    const tv = th.vertices.map((v) => [v.id, norm(v.text), v.type, [...v.classes].sort()]).sort();
    const ov = [...g.nodes.values()].map((n) => [n.id, n.text, n.shape ?? null, [...n.classes].sort()]).sort();
    assert.deepEqual(ov, tv, `${ctx}: vertices`);
    const ek = (e: Pick<FlowEdge, 'from' | 'to' | 'type' | 'stroke' | 'text' | 'length'> | MermaidResult['edges'][number]): string => [e.from, e.to, e.type, e.stroke, norm(e.text), e.length].join('|');
    assert.deepEqual(g.edges.map(ek).sort(), th.edges.map(ek).sort(), `${ctx}: edges`);
    const sk = (s: Pick<FlowSubgraph, 'id' | 'title' | 'nodes'>): string => [s.id, s.title, [...s.nodes].sort().join(',')].join('|');
    assert.deepEqual(g.subgraphs.map(sk).sort(), th.subgraphs.map(sk).sort(), `${ctx}: subgraphs`);
  });
});

test('isotonic regression is the exact constrained least-squares solution', () => {
  const r = rng(7);
  for (let k = 0; k < 200; k++) {
    const n = r.int(1, 7), t = Array.from({ length: n }, () => r(-3, 3)), w = Array.from({ length: n }, () => r(0.2, 3));
    const y = isotonic(t, w);
    for (let i = 1; i < n; i++) assert.ok(y[i]! >= y[i - 1]! - 1e-12, 'non-decreasing');
    // KKT: no feasible perturbation lowers the cost; check against small moves of each block level
    const cost = (z: number[]): number => z.reduce((s, zi, i) => s + w[i]! * (zi - t[i]!) ** 2, 0);
    const base = cost(y);
    for (let i = 0; i < n; i++) for (const d of [-1e-3, 1e-3]) {
      const z = [...y]; const v = y[i]!;
      for (let j = 0; j < n; j++) if (Math.abs(y[j]! - v) < 1e-12) z[j]! += d; // move the whole block
      if (z.every((zi, j) => j === 0 || zi >= z[j - 1]! - 1e-12)) assert.ok(cost(z) >= base - 1e-9);
    }
  }
});

/** Membership as the parser decides it, transitively up the subgraph tree. */
function geometry(src: string) {
  const chart = flowchart(src, { width: 1e9, height: 1e9 }); // no fit-scaling: layout units
  const g = chart.graph, L = chart.layout;
  const parent = new Map(g.subgraphs.map((s) => [s.id, s.parent]));
  const direct = new Map<string, string>();
  for (const s of g.subgraphs) for (const id of s.nodes) direct.set(id, s.id);
  const ancestors = (id: string): string[] => { const out: string[] = []; let c: string | null | undefined = direct.get(id); while (c) { out.push(c); c = parent.get(c); } return out; };
  return { chart, g, L, ancestors, parent };
}
interface Rect { x0: number; x1: number; y0: number; y1: number }
const inter = (a: Rect, b: Rect, eps = 1e-6): boolean => a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps;
const boxOf = (n: { x: number; y: number; w: number; h: number }): Rect => ({ x0: n.x - n.w / 2, x1: n.x + n.w / 2, y0: n.y - n.h / 2, y1: n.y + n.h / 2 });

test('layout invariants on random flowcharts: no overlaps, edges flow, clusters contain and exclude', () => {
  for (let seed = 1; seed <= N; seed++) {
    const src = randomFlowchart(seed), ctx = `seed ${seed}`;
    const { g, L, ancestors, parent } = geometry(src);
    const ids = [...L.nodes.keys()];
    for (const v of L.nodes.values()) for (const k of ['x', 'y', 'w', 'h'] as const) assert.ok(Number.isFinite(v[k]), `${ctx}: ${k} not finite`);
    // nodes never overlap
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      assert.ok(!inter(boxOf(L.nodes.get(ids[i]!)!), boxOf(L.nodes.get(ids[j]!)!)), `${ctx}: ${ids[i]} overlaps ${ids[j]}`);
    }
    // every edge that was not reversed to break a cycle goes down a rank
    g.edges.forEach((e, i) => {
      const r = L.edges.get(i);
      if (!r || r.loop || r.reversed) return;
      assert.ok(L.nodes.get(e.to)!.rank > L.nodes.get(e.from)!.rank, `${ctx}: ${e.from}->${e.to} does not flow`);
    });
    // a cluster box contains its members and no other node
    for (const [c, b] of L.clusters) {
      for (const id of ids) {
        const inside = ancestors(id).includes(c), nb = boxOf(L.nodes.get(id)!);
        if (inside) assert.ok(nb.x0 >= b.x0 - 1e-6 && nb.x1 <= b.x1 + 1e-6 && nb.y0 >= b.y0 - 1e-6 && nb.y1 <= b.y1 + 1e-6, `${ctx}: ${id} outside its cluster ${c}`);
        else assert.ok(!inter(nb, b), `${ctx}: ${id} inside cluster ${c} it is not a member of`);
      }
    }
    // clusters that are not nested never overlap
    const cs = [...L.clusters.keys()];
    const isAnc = (a: string, b: string): boolean => { let p = parent.get(b); while (p) { if (p === a) return true; p = parent.get(p); } return false; };
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      if (isAnc(cs[i]!, cs[j]!) || isAnc(cs[j]!, cs[i]!)) continue;
      assert.ok(!inter(L.clusters.get(cs[i]!)!, L.clusters.get(cs[j]!)!), `${ctx}: clusters ${cs[i]} and ${cs[j]} overlap`);
    }
  }
});

test('layout is deterministic and orientation-consistent', () => {
  const src = (dir: string): string => `flowchart ${dir}\n A --> B & C\n B --> D\n C --> D`;
  const a = flowchart(src('TB')).layout, b = flowchart(src('TB')).layout;
  assert.deepEqual([...a.nodes], [...b.nodes]);
  const tb = flowchart(src('TB'), { width: 1e9, height: 1e9 }).layout.nodes, lr = flowchart(src('LR'), { width: 1e9, height: 1e9 }).layout.nodes;
  assert.ok(tb.get('D')!.y > tb.get('A')!.y, 'TB flows down');
  assert.ok(lr.get('D')!.x > lr.get('A')!.x, 'LR flows right');
  const bt = flowchart(src('BT'), { width: 1e9, height: 1e9 }).layout.nodes;
  assert.ok(bt.get('D')!.y < bt.get('A')!.y, 'BT flows up');
});

test('a chart animates in, cleanly, and its parts are addressable after copy', async () => {
  const src = `flowchart TB
    subgraph S[edge]
      R[Request] --> W{cached?}
    end
    W -- hit --> K[(KV)]
    W -. miss .-> D[(D1)]
    D --> K`;
  class Demo extends Scene {
    override async construct(): Promise<void> {
      const chart = flowchart(src);
      for (const stage of chart.reveal()) await this.play(new LaggedStart(stage, { lagRatio: 0.15 }), { runTime: 1.2 });
      this.state = { nodes: chart.nodeIds.length };
      const c = chart.copy();
      assert.notEqual(c.node('W'), chart.node('W'));
      assert.equal(c.node('W'), c.children[chart.children.indexOf(chart.node('W'))]);
      assert.ok(chart.edge('W', 'D') && chart.cluster('S'));
    }
  }
  const sink = new MotionSink();
  await new Demo(sink).run();
  const events = analyzeMotion(sink).filter((e) => e.kind !== 'handoff');
  assert.deepEqual(events.map((e) => `${e.kind} ${e.what}`), []);
  const out = new StringSink();
  await new Demo(out).run();
  assert.ok(out.frames.at(-1)!.length > 5000);
});
