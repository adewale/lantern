// Layered graph layout (Sugiyama), the family mermaid uses through dagre, with
// clusters (subgraphs) kept contiguous. Pure: sizes in, positions out, no
// mobjects. Screen convention here: x right, y down; flowchart.ts converts.
//
//   1. break cycles (DFS back edges reversed)
//   2. rank by longest path, every edge spanning >= 2 ranks (as dagre does), so
//      each edge has a midpoint to bend through and a place for its label
//   3. dummy nodes on the ranks a long edge crosses
//   4. order each rank: barycenter sweeps, clusters kept as contiguous blocks,
//      the ordering with fewest crossings kept
//   5. positions along each rank: weighted least squares toward neighbors under
//      minimum-separation constraints, solved exactly by isotonic regression (PAVA)
//   6. cluster boxes; non-members pushed out of boxes they would sit inside
//   7. edges as point lists through their dummies, clipped to node borders by the renderer

export interface Size { w: number; h: number }
export interface LNode { id: string; w: number; h: number; cluster?: string | null }
export interface LEdge { from: string; to: string; minlen?: number; label?: Size | null }
export interface LCluster { id: string; parent: string | null; title?: Size | null }
export interface LGraph { direction?: string; nodes: LNode[]; edges: LEdge[]; clusters?: LCluster[] }

export interface LayoutOptions { nodeSep?: number; rankSep?: number; clusterPad?: number; dummySep?: number; iterations?: number }

/** Screen coordinates: x right, y down. */
export type Point = [x: number, y: number];
export interface NodePlacement { x: number; y: number; w: number; h: number; rank: number }
export interface EdgeRoute { points: Point[]; label: Point | null; reversed?: boolean; loop?: boolean }
export interface ClusterBox { x0: number; y0: number; x1: number; y1: number }
export interface Layout {
  nodes: Map<string, NodePlacement>;
  edges: Map<number, EdgeRoute>;
  clusters: Map<string, ClusterBox>;
  crossings: number;
  ranks: number;
}

/** An edge after cycle breaking: u ranks above v. */
interface E { index: number; u: Vert; v: Vert; minlen: number; label: Size | null; reversed: boolean }
interface VertBase { id: string; rank: number; order: number; pos: number; cluster: string | null; thick: number; breadth: number }
/** A graph node. thick: extent along the rank axis; breadth: along the order axis. */
interface RealVert extends VertBase { real: true; index: number; w: number; h: number; isLabel?: undefined }
/** A point a long edge passes through on an intermediate rank; one per edge holds its label. */
interface DummyVert extends VertBase { real: false; isLabel: boolean | null; edge: E }
type Vert = RealVert | DummyVert;
type Interval = [lo: number, hi: number];

const DEFAULTS: Required<LayoutOptions> = { nodeSep: 0.45, rankSep: 0.9, clusterPad: 0.22, dummySep: 0.14, iterations: 24 };

export function layoutGraph(graph: LGraph, options: LayoutOptions = {}): Layout {
  const o = { ...DEFAULTS, ...options };
  const dir = (graph.direction ?? 'TB').replace('TD', 'TB');
  const horizontal = dir === 'LR' || dir === 'RL';
  const flip = dir === 'BT' || dir === 'RL';

  // ---- nodes, clusters --------------------------------------------------------
  const clusters = new Map((graph.clusters ?? []).map((c) => [c.id, { ...c, title: c.title ?? { w: 0, h: 0 } }]));
  const pathCache = new Map<string, string[]>();
  const clusterPath = (cid: string | null): string[] => {
    if (cid == null) return [];
    let p = pathCache.get(cid);
    if (p) return p;
    const c = clusters.get(cid);
    p = c ? [...clusterPath(c.parent), cid] : [];
    pathCache.set(cid, p);
    return p;
  };
  const V: Vert[] = [];
  const byId = new Map<string, RealVert>();
  graph.nodes.forEach((n, i) => {
    // thick: extent along the rank axis; breadth: extent along the order axis
    const v: RealVert = { id: n.id, real: true, index: i, thick: horizontal ? n.w : n.h, breadth: horizontal ? n.h : n.w, w: n.w, h: n.h, cluster: n.cluster ?? null, rank: 0, order: 0, pos: 0 };
    V.push(v); byId.set(n.id, v);
  });
  const lca = (a: string | null, b: string | null): string | null => {
    const pa = clusterPath(a), pb = clusterPath(b);
    let k = 0; while (k < pa.length && k < pb.length && pa[k] === pb[k]) k++;
    return k ? pa[k - 1]! : null;
  };

  // ---- 1. cycles --------------------------------------------------------------------
  const E: E[] = [];
  graph.edges.forEach((e, i) => {
    if (e.from === e.to || !byId.has(e.from) || !byId.has(e.to)) return;
    E.push({ index: i, u: byId.get(e.from)!, v: byId.get(e.to)!, minlen: 2 * Math.max(1, e.minlen ?? 1), label: e.label ?? null, reversed: false });
  });
  {
    const out = new Map(V.map((v) => [v, [] as E[]]));
    for (const e of E) out.get(e.u)!.push(e);
    const state = new Map<Vert, 1 | 2>(); // 1 on stack, 2 done
    const visit = (v: Vert): void => {
      state.set(v, 1);
      for (const e of out.get(v)!) {
        const s = state.get(e.v);
        if (s === 1) e.reversed = true; // back edge
        else if (!s) visit(e.v);
      }
      state.set(v, 2);
    };
    for (const v of V) if (!state.get(v)) visit(v);
    for (const e of E) if (e.reversed) [e.u, e.v] = [e.v, e.u];
  }

  // ---- 2. ranks ---------------------------------------------------------------------
  const preds = new Map(V.map((v) => [v, [] as E[]])), succs = new Map(V.map((v) => [v, [] as E[]]));
  for (const e of E) { succs.get(e.u)!.push(e); preds.get(e.v)!.push(e); }
  const topo: Vert[] = [];
  {
    const indeg = new Map(V.map((v) => [v, preds.get(v)!.length]));
    const queue = V.filter((v) => indeg.get(v) === 0);
    while (queue.length) {
      const v = queue.shift()!; topo.push(v);
      for (const e of succs.get(v)!) { indeg.set(e.v, indeg.get(e.v)! - 1); if (indeg.get(e.v) === 0) queue.push(e.v); }
    }
  }
  const relax = (): void => { for (const v of topo) for (const e of succs.get(v)!) e.v.rank = Math.max(e.v.rank, v.rank + e.minlen); };
  relax();
  // Sources sit just above their nearest successor, not at the very top
  for (const v of [...topo].reverse()) {
    if (preds.get(v)!.length === 0 && succs.get(v)!.length) v.rank = Math.min(...succs.get(v)!.map((e) => e.v.rank - e.minlen));
  }
  // A cluster whose members share no edges is a row: put them on one rank
  for (const c of clusters.values()) {
    const members = V.filter((v) => clusterPath(v.cluster).includes(c.id));
    if (members.length < 2) continue;
    const inside = new Set(members);
    if (E.some((e) => inside.has(e.u) && inside.has(e.v))) continue;
    const r = Math.max(...members.map((v) => v.rank));
    for (const v of members) v.rank = r;
  }
  relax();
  const minRank = Math.min(0, ...V.map((v) => v.rank));
  for (const v of V) v.rank -= minRank;

  // ---- 3. dummies ---------------------------------------------------------------------
  const chains: Array<{ e: E; chain: Vert[] }> = []; // per edge: [u, d1, ..., v]
  const links: Array<[Vert, Vert]> = []; // consecutive pairs, for ordering and positioning
  for (const e of E) {
    const chain: Vert[] = [e.u];
    const mid = e.u.rank + Math.floor((e.v.rank - e.u.rank) / 2);
    const cl = lca(e.u.cluster, e.v.cluster);
    for (let r = e.u.rank + 1; r < e.v.rank; r++) {
      const isLabel = e.label && r === mid;
      const d: DummyVert = {
        id: `~${e.index}:${r}`, real: false, isLabel, edge: e, rank: r, order: 0, pos: 0, cluster: cl,
        thick: isLabel ? (horizontal ? e.label!.w : e.label!.h) : 0,
        breadth: isLabel ? (horizontal ? e.label!.h : e.label!.w) : 0,
      };
      V.push(d); chain.push(d);
    }
    chain.push(e.v);
    chains.push({ e, chain });
    for (let i = 1; i < chain.length; i++) links.push([chain[i - 1]!, chain[i]!]);
  }
  const maxRank = Math.max(0, ...V.map((v) => v.rank));
  const layers = Array.from({ length: maxRank + 1 }, (): Vert[] => []);
  for (const v of V) layers[v.rank]!.push(v);
  const up = new Map(V.map((v) => [v, [] as Vert[]])), down = new Map(V.map((v) => [v, [] as Vert[]]));
  for (const [a, b] of links) { down.get(a)!.push(b); up.get(b)!.push(a); }

  // ---- 4. order --------------------------------------------------------------------------
  layers.forEach((L) => L.forEach((v, i) => { v.order = i; }));
  const sortLayer = (L: Vert[], nbrs: Map<Vert, Vert[]>): void => {
    const bary = new Map<Vert, number>();
    for (const v of L) {
      const ns = nbrs.get(v)!;
      bary.set(v, ns.length ? ns.reduce((s, n) => s + n.order, 0) / ns.length : v.order);
    }
    // Group by cluster at each depth so a cluster's members stay contiguous
    // A group's key is a cluster id, or the vertex itself when it is outside any cluster at this depth
    const arrange = (items: Vert[], depth: number): Vert[] => {
      const groups = new Map<string | Vert, Vert[]>();
      for (const v of items) {
        const p = clusterPath(v.cluster);
        const key = depth < p.length ? p[depth]! : v;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(v);
      }
      const gs = [...groups.entries()].map(([key, vs]) => ({
        key, vs, b: vs.reduce((s, v) => s + bary.get(v)!, 0) / vs.length, first: Math.min(...vs.map((v) => v.order)),
      }));
      gs.sort((a, b) => a.b - b.b || a.first - b.first);
      return gs.flatMap((g) => (typeof g.key === 'string' ? arrange(g.vs, depth + 1) : g.vs));
    };
    arrange(L, 0).forEach((v, i) => { v.order = i; });
    L.sort((a, b) => a.order - b.order);
  };
  const crossings = (): number => {
    let n = 0;
    for (let r = 0; r < maxRank; r++) {
      const ls = links.filter(([a]) => a.rank === r);
      for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
        const [a1, b1] = ls[i]!, [a2, b2] = ls[j]!;
        if ((a1.order - a2.order) * (b1.order - b2.order) < 0) n++;
      }
    }
    return n;
  };
  let best = crossings(), bestOrder = V.map((v) => v.order);
  for (let it = 0; it < o.iterations && best > 0; it++) {
    if (it % 2 === 0) for (let r = 1; r <= maxRank; r++) sortLayer(layers[r]!, up);
    else for (let r = maxRank - 1; r >= 0; r--) sortLayer(layers[r]!, down);
    const c = crossings();
    if (c < best) { best = c; bestOrder = V.map((v) => v.order); }
  }
  V.forEach((v, i) => { v.order = bestOrder[i]!; });
  for (const L of layers) L.sort((a, b) => a.order - b.order);

  // ---- 5. positions along each rank -------------------------------------------------------
  const titleBand = (c: string): number => clusters.get(c)!.title.h + 0.1;
  const sep = (a: Vert, b: Vert): number => {
    let s = (a.breadth + b.breadth) / 2 + (a.real || b.real || a.isLabel || b.isLabel ? o.nodeSep : o.dummySep);
    const pa = clusterPath(a.cluster), pb = clusterPath(b.cluster);
    let k = 0; while (k < pa.length && k < pb.length && pa[k] === pb[k]) k++;
    s += (pa.length - k) * o.clusterPad + (pb.length - k) * o.clusterPad;
    // In LR the order axis is vertical and a cluster's title sits on its top edge
    if (horizontal) for (let i = k; i < pb.length; i++) s += titleBand(pb[i]!);
    return s;
  };
  for (const L of layers) { let x = 0; L.forEach((v, i) => { if (i) x += sep(L[i - 1]!, v); v.pos = x; }); const mid = x / 2; for (const v of L) v.pos -= mid; }
  const weight = (a: Vert, b: Vert): number => (!a.real && !b.real ? 8 : !a.real || !b.real ? 2 : 1);
  const place = (L: Vert[], nbrs: Map<Vert, Vert[]>): void => {
    const n = L.length;
    if (!n) return;
    const off = new Array(n).fill(0);
    for (let i = 1; i < n; i++) off[i] = off[i - 1]! + sep(L[i - 1]!, L[i]!);
    const target: number[] = [], wts: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = L[i]!, ns = nbrs.get(v)!;
      let sw = 0, sx = 0;
      for (const u of ns) { const w = weight(u, v); sw += w; sx += w * u.pos; }
      target.push((sw ? sx / sw : v.pos) - off[i]!); wts.push(sw || 0.5);
    }
    const y = isotonic(target, wts);
    for (let i = 0; i < n; i++) L[i]!.pos = y[i]! + off[i]!;
  };
  const both = new Map(V.map((v) => [v, [...up.get(v)!, ...down.get(v)!]]));
  for (let it = 0; it < 16; it++) {
    if (it % 2 === 0) for (let r = 1; r <= maxRank; r++) place(layers[r]!, up);
    else for (let r = maxRank - 1; r >= 0; r--) place(layers[r]!, down);
  }
  for (let it = 0; it < 4; it++) for (const L of layers) place(L, both);

  // ---- along the rank axis ------------------------------------------------------------------
  const thick = layers.map((L) => Math.max(0, ...L.map((v) => v.thick)));
  const span = new Map<string, Interval>();
  for (const v of V) for (const c of clusterPath(v.cluster)) {
    const s = span.get(c) ?? [Infinity, -Infinity];
    span.set(c, [Math.min(s[0], v.rank), Math.max(s[1], v.rank)]);
  }
  const chainLen = (ids: string[]): number => {
    let m = 0;
    for (const c of ids) { let k = 0, p: string | null = c; while (p != null && ids.includes(p)) { k++; p = clusters.get(p)!.parent; } m = Math.max(m, k); }
    return m;
  };
  const major = [0];
  for (let r = 1; r <= maxRank; r++) {
    const opening = [...span].filter(([, s]) => s[0] === r).map(([c]) => c);
    const closing = [...span].filter(([, s]) => s[1] === r - 1).map(([c]) => c);
    const openPad = horizontal ? o.clusterPad : o.clusterPad + Math.max(0, ...opening.map(titleBand));
    const gap = o.rankSep / 2 + chainLen(opening) * openPad + chainLen(closing) * o.clusterPad;
    major.push(major[r - 1]! + thick[r - 1]! / 2 + gap + thick[r]! / 2);
  }

  // Screen coordinates
  const toXY = (pos: number, mj: number): Point => {
    const m = flip ? -mj : mj;
    return horizontal ? [m, pos] : [pos, m];
  };
  const centerOf = (v: Vert): Point => toXY(v.pos, major[v.rank]!);

  // ---- 6. cluster boxes, and keeping non-members out of them -----------------------------------
  const boxes = (): Map<string, ClusterBox> => {
    const out = new Map<string, ClusterBox>();
    const order = [...clusters.keys()].sort((a, b) => clusterPath(b).length - clusterPath(a).length); // innermost first
    for (const c of order) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const grow = (a: number, b: number, cx: number, cy: number) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy); };
      for (const v of V) {
        if (!clusterPath(v.cluster).includes(c) || (!v.real && !v.isLabel)) continue;
        const [x, y] = centerOf(v), w = v.real ? v.w : horizontal ? v.thick : v.breadth, h = v.real ? v.h : horizontal ? v.breadth : v.thick;
        grow(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
      }
      for (const [k, b] of out) if (clusters.get(k)!.parent === c) grow(b.x0, b.y0, b.x1, b.y1);
      if (x0 === Infinity) continue;
      const t = clusters.get(c)!.title;
      x0 -= o.clusterPad; x1 += o.clusterPad; y1 += o.clusterPad; y0 -= o.clusterPad + (t.h ? t.h + 0.1 : 0);
      const need = t.w + 2 * o.clusterPad - (x1 - x0);
      if (need > 0) { x0 -= need / 2; x1 += need / 2; }
      out.set(c, { x0, y0, x1, y1 });
    }
    return out;
  };
  // Order axis interval of a box, and of a vertex
  const ivBox = (b: ClusterBox): Interval => (horizontal ? [b.y0, b.y1] : [b.x0, b.x1]);
  const ivMajorBox = (b: ClusterBox): Interval => (horizontal ? [b.x0, b.x1] : [b.y0, b.y1]);
  const ivV = (v: Vert): Interval => [v.pos - v.breadth / 2, v.pos + v.breadth / 2];
  const overlaps = (a: Interval, b: Interval): boolean => a[0] < b[1] - 1e-9 && b[0] < a[1] - 1e-9;
  // After a block moves, restore separation in the direction it moved, keeping each rank's order
  const cascade = (L: Vert[], moved: Set<Vert>, dir: number): void => {
    const idx = L.map((v, i) => (moved.has(v) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return;
    if (dir > 0) for (let j = Math.max(...idx) + 1; j < L.length; j++) L[j]!.pos = Math.max(L[j]!.pos, L[j - 1]!.pos + sep(L[j - 1]!, L[j]!));
    else for (let j = Math.min(...idx) - 1; j >= 0; j--) L[j]!.pos = Math.min(L[j]!.pos, L[j + 1]!.pos - sep(L[j]!, L[j + 1]!));
  };
  for (let pass = 0; pass < 400; pass++) {
    const B = boxes();
    let moved: { set: Set<Vert>; dir: number } | null = null;
    for (const [c, b] of B) {
      const [bmin, bmax] = ivMajorBox(b);
      const [lo0, hi0] = ivBox(b), cx = (lo0 + hi0) / 2;
      // Push out real nodes and labels outside c's subtree; a node in a sibling cluster
      // moves with its whole cluster (its outermost cluster that is not an ancestor of c)
      const anc = new Set(clusterPath(c));
      for (const v of V) {
        if ((!v.real && !v.isLabel) || clusterPath(v.cluster).includes(c)) continue;
        const [vx, vy] = centerOf(v);
        const vmaj = horizontal ? vx : vy, vth = v.thick / 2 + 0.01;
        if (!(vmaj + vth > bmin && vmaj - vth < bmax)) continue;
        if (!overlaps(ivV(v), [lo0, hi0])) continue;
        const outer = clusterPath(v.cluster).find((x) => !anc.has(x));
        const block = outer ? V.filter((u) => clusterPath(u.cluster).includes(outer)) : [v];
        const lo = Math.min(...block.map((u) => u.pos - u.breadth / 2)), hi = Math.max(...block.map((u) => u.pos + u.breadth / 2));
        const right = (lo + hi) / 2 >= cx;
        const delta = right ? hi0 + o.nodeSep * 0.6 - lo : lo0 - o.nodeSep * 0.6 - hi;
        for (const u of block) u.pos += delta;
        moved = { set: new Set(block), dir: Math.sign(delta) };
        break;
      }
      if (moved) break;
    }
    // Boxes of unrelated clusters must not overlap either (their padding can, with no node inside)
    if (!moved) {
      const ids = [...B.keys()];
      outer: for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const pa = clusterPath(ids[i]!), pb = clusterPath(ids[j]!);
        if (pa.includes(ids[j]!) || pb.includes(ids[i]!)) continue;
        const a = B.get(ids[i]!)!, bb = B.get(ids[j]!)!;
        if (!(overlaps(ivBox(a), ivBox(bb)) && overlaps(ivMajorBox(a), ivMajorBox(bb)))) continue;
        // Move the outermost cluster on j's side that is not shared with i
        // (pb ends with ids[j], which pa lacks, so there is one)
        const top = pb.find((x) => !pa.includes(x))!;
        const block = V.filter((u) => clusterPath(u.cluster).includes(top));
        const [alo, ahi] = ivBox(a), [blo, bhi] = ivBox(bb);
        const right = (blo + bhi) / 2 >= (alo + ahi) / 2;
        const delta = right ? ahi + o.nodeSep * 0.4 - blo : alo - o.nodeSep * 0.4 - bhi;
        for (const u of block) u.pos += delta;
        moved = { set: new Set(block), dir: Math.sign(delta) };
        break outer;
      }
    }
    if (!moved) break;
    for (const L of layers) cascade(L, moved.set, moved.dir);
  }

  // ---- 7. output -----------------------------------------------------------------------------
  const nodes = new Map<string, NodePlacement>();
  for (const v of V) if (v.real) { const [x, y] = centerOf(v); nodes.set(v.id, { x, y, w: v.w, h: v.h, rank: v.rank }); }
  const edges = new Map<number, EdgeRoute>();
  for (const { e, chain } of chains) {
    let pts = chain.map(centerOf);
    if (e.reversed) pts = pts.reverse();
    const lab = chain.find((d) => d.isLabel);
    edges.set(e.index, { points: pts, label: lab ? centerOf(lab) : null, reversed: e.reversed });
  }
  // Self loops: a small loop off the node's right side
  graph.edges.forEach((e, i) => {
    if (e.from !== e.to || !nodes.has(e.from)) return;
    const n = nodes.get(e.from)!, r = Math.min(n.h, 0.6) / 2;
    edges.set(i, { points: [[n.x + n.w / 2, n.y - r * 0.6], [n.x + n.w / 2 + r * 1.6, n.y - r], [n.x + n.w / 2 + r * 1.6, n.y + r], [n.x + n.w / 2, n.y + r * 0.6]], label: e.label ? [n.x + n.w / 2 + r * 1.6 + e.label.w / 2 + 0.05, n.y] : null, loop: true });
  });
  return { nodes, edges, clusters: boxes(), crossings: best, ranks: maxRank + 1 };
}

/**
 * Weighted isotonic regression (pool adjacent violators): the non-decreasing
 * sequence closest to `t` in weighted least squares. Exact, O(n).
 */
export function isotonic(t: readonly number[], w: readonly number[]): number[] {
  const blocks: Array<{ v: number; w: number; n: number }> = [];
  for (let i = 0; i < t.length; i++) {
    blocks.push({ v: t[i]!, w: w[i]!, n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2]!.v > blocks[blocks.length - 1]!.v) {
      const b = blocks.pop()!, a = blocks.pop()!;
      const ww = a.w + b.w;
      blocks.push({ v: (a.v * a.w + b.v * b.w) / ww, w: ww, n: a.n + b.n });
    }
  }
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.v);
  return out;
}
