// Mermaid flowcharts as Lantern mobjects: parse (mermaid.ts), measure the
// labels with the real glyph outlines, lay out (graphlayout.ts), then build
// shapes, paths and arrowheads that animate like anything else.
//
//   const chart = flowchart(`flowchart LR
//     A[Request] --> B{cached?} -- yes --> C[(KV)]
//     B -- no --> D[(D1)]`);
//   await this.play(...chart.reveal().map((stage) => new LaggedStart(stage)));
//   await this.play(new Indicate(chart.node('B').shape));
//
// Nodes, edges and cluster boxes are reachable by id (node, edge, cluster)
// through child indices, so they stay correct on copies.

import { Group } from './mobject.ts';
import type { Mobject, Style } from './mobject.ts';
import { VMobject } from './vmobject.ts';
import { Rectangle, Polygon, Circle, Labeled } from './shapes.ts';
import { Text } from './text.ts';
import type { FontName } from './fonts.ts';
import { FadeIn, Create } from './animation.ts';
import type { Animation } from './animation.ts';
import { parseMermaid } from './mermaid.ts';
import type { FlowGraph, FlowNode } from './mermaid.ts';
import { layoutGraph } from './graphlayout.ts';
import type { Layout, LayoutOptions, LEdge, NodePlacement, Point } from './graphlayout.ts';
import type { Vec } from './vec.ts';

/** Paint for one kind of chart part; `color` is the label's. */
export interface FlowStyle { stroke: string; fill?: string; fillOpacity?: number; color: string; strokeWidth: number }
export interface FlowchartTheme { node: Required<FlowStyle>; cluster: Required<FlowStyle>; edge: FlowStyle; labelBg: string }

export const FLOWCHART_THEME: FlowchartTheme = {
  node: { stroke: '#58c4dd', fill: '#58c4dd', fillOpacity: 0.12, color: '#ffffff', strokeWidth: 0.03 },
  cluster: { stroke: '#4a4a4a', fill: '#ffffff', fillOpacity: 0.035, color: '#9a9a9a', strokeWidth: 0.022 },
  edge: { stroke: '#8a8a8a', color: '#bbbbbb', strokeWidth: 0.024 },
  labelBg: '#1a1a1a',
};

const PAD_X = 0.26, PAD_Y = 0.17;

/** A mermaid style list as Lantern paint, plus the two non-paint keys. */
interface ParsedStyle { fill?: string; fillOpacity?: number; stroke?: string; color?: string; strokeWidth?: number; dashed?: boolean; opacity?: number }

/** Mermaid style strings (`fill:#111`, `stroke-width:2px`) to a Lantern style. */
function styleOf(list: readonly string[]): ParsedStyle {
  const s: ParsedStyle = {};
  for (const item of list) {
    const [k, v] = item.split(':').map((x) => x.trim());
    if (!v) continue;
    if (k === 'fill') { s.fill = v; s.fillOpacity = v === 'none' ? 0 : 1; }
    else if (k === 'stroke') s.stroke = v;
    else if (k === 'color') s.color = v;
    else if (k === 'stroke-width') s.strokeWidth = parseFloat(v) * 0.014;
    else if (k === 'stroke-dasharray') s.dashed = true;
    else if (k === 'opacity') s.opacity = parseFloat(v);
  }
  return s;
}

function label(text: string, { fontSize, color, font = 'sans' }: { fontSize: number; color: string; font?: FontName }): Text | Group {
  const lines = String(text).split('\n').map((l) => new Text(l || ' ', { fontSize, color, font }));
  return lines.length === 1 ? lines[0]! : new Group(...lines).arrange([0, -1], fontSize * 0.28);
}

/** A node's shape for a label of size w x h. */
function shapeFor(type: string, w: number, h: number, style: Required<FlowStyle>): VMobject {
  const st: Style = { stroke: style.stroke, strokeWidth: style.strokeWidth, fill: style.fill, fillOpacity: style.fillOpacity };
  const W = w + 2 * PAD_X, H = h + 2 * PAD_Y;
  switch (type) {
    case 'round': return new Rectangle({ width: W, height: H, cornerRadius: Math.min(0.2, H * 0.3), ...st });
    case 'stadium': return new Rectangle({ width: W + H * 0.3, height: H, cornerRadius: H / 2, ...st });
    case 'circle': case 'doublecircle': { const d = Math.hypot(w, h) + 2 * PAD_Y; return new Circle({ radius: d / 2, ...st }); }
    case 'diamond': {
      // A rhombus that contains the label box: w/W' + h/H' <= 1
      const A = w * 1.45 + h + 0.25, B = h * 1.45 + w * 0.3 + 0.25;
      return new Polygon([[0, B / 2], [A / 2, 0], [0, -B / 2], [-A / 2, 0]], st);
    }
    case 'hexagon': { const k = H / 2; return new Polygon([[-W / 2 - k / 2, 0], [-W / 2 + k / 2, H / 2], [W / 2 - k / 2, H / 2], [W / 2 + k / 2, 0], [W / 2 - k / 2, -H / 2], [-W / 2 + k / 2, -H / 2]], st); }
    case 'odd': return new Polygon([[-W / 2 - H * 0.3, H / 2], [W / 2, H / 2], [W / 2, -H / 2], [-W / 2 - H * 0.3, -H / 2], [-W / 2, 0]], st);
    case 'lean_right': return new Polygon([[-W / 2 + H * 0.2, H / 2], [W / 2 + H * 0.2, H / 2], [W / 2 - H * 0.2, -H / 2], [-W / 2 - H * 0.2, -H / 2]], st);
    case 'lean_left': return new Polygon([[-W / 2 - H * 0.2, H / 2], [W / 2 - H * 0.2, H / 2], [W / 2 + H * 0.2, -H / 2], [-W / 2 + H * 0.2, -H / 2]], st);
    case 'trapezoid': return new Polygon([[-W / 2 + H * 0.2, H / 2], [W / 2 - H * 0.2, H / 2], [W / 2 + H * 0.2, -H / 2], [-W / 2 - H * 0.2, -H / 2]], st);
    case 'inv_trapezoid': return new Polygon([[-W / 2 - H * 0.2, H / 2], [W / 2 + H * 0.2, H / 2], [W / 2 - H * 0.2, -H / 2], [-W / 2 + H * 0.2, -H / 2]], st);
    case 'cylinder': return cylinder(W, H + 0.2, st);
    case 'subroutine': {
      const r = new Rectangle({ width: W + 0.2, height: H, ...st });
      const k = W / 2 + 0.02;
      r.startNewPath([-k, H / 2]); r.addLineTo([-k, -H / 2]);
      r.startNewPath([k, H / 2]); r.addLineTo([k, -H / 2]);
      return r;
    }
    default: return new Rectangle({ width: W, height: H, cornerRadius: 0.05, ...st });
  }
}

/** A database: body with a curved bottom, and the top ellipse drawn over it. */
function cylinder(W: number, H: number, st: Style): VMobject {
  const c = new VMobject(st);
  const rx = W / 2, ry = Math.min(0.12, H * 0.12), top = H / 2 - ry, bot = -H / 2 + ry, k = 0.5523;
  c.startNewPath([-rx, top]);
  c.addLineTo([-rx, bot]);
  c.addCubic([-rx, bot - k * ry], [-k * rx, bot - ry], [0, bot - ry]);
  c.addCubic([k * rx, bot - ry], [rx, bot - k * ry], [rx, bot]);
  c.addLineTo([rx, top]);
  c.addCubic([rx, top - k * ry], [k * rx, top - ry], [0, top - ry]);
  c.addCubic([-k * rx, top - ry], [-rx, top - k * ry], [-rx, top]);
  c.closed[0] = true;
  c.startNewPath([-rx, top]);
  c.addCubic([-rx, top + k * ry], [-k * rx, top + ry], [0, top + ry]);
  c.addCubic([k * rx, top + ry], [rx, top + k * ry], [rx, top]);
  c.addCubic([rx, top - k * ry], [k * rx, top - ry], [0, top - ry]);
  c.addCubic([-k * rx, top - ry], [-rx, top - k * ry], [-rx, top]);
  c.closed[1] = true;
  return c;
}

type NodeKind = 'circle' | 'diamond' | 'rect';

/** Where the segment from a node's center toward `p` leaves the node. */
function clip(n: NodePlacement & { kind: NodeKind }, p: Point): Point {
  const dx = p[0] - n.x, dy = p[1] - n.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return [n.x, n.y];
  let t: number;
  if (n.kind === 'circle') t = (n.w / 2) / Math.hypot(dx, dy);
  else if (n.kind === 'diamond') t = 1 / (Math.abs(dx) / (n.w / 2) + Math.abs(dy) / (n.h / 2));
  else t = Math.min(Math.abs(dx) > 1e-9 ? (n.w / 2) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? (n.h / 2) / Math.abs(dy) : Infinity);
  t = Math.min(t, 1);
  return [n.x + dx * t, n.y + dy * t];
}

/**
 * A path through `pts` as d3's curveBasis draws it (what mermaid uses): it
 * starts and ends on the end points and is pulled toward the ones between.
 */
function basisPath(pts: readonly Vec[], style: Style): VMobject {
  const m = new VMobject(style);
  if (pts.length === 2) { m.startNewPath(pts[0]!); m.addLineTo(pts[1]!); return m; }
  const P = [pts[0]!, ...pts, pts.at(-1)!]; // clamp: repeat the ends
  m.startNewPath(pts[0]!);
  m.addLineTo([(5 * P[0]![0] + P[1]![0]) / 6, (5 * P[0]![1] + P[1]![1]) / 6]);
  for (let i = 2; i < P.length; i++) {
    const [x0, y0] = P[i - 2]!, [x1, y1] = P[i - 1]!, [x, y] = P[i]!;
    m.addCubic([(2 * x0 + x1) / 3, (2 * y0 + y1) / 3], [(x0 + 2 * x1) / 3, (y0 + 2 * y1) / 3], [(x0 + 4 * x1 + x) / 6, (y0 + 4 * y1 + y) / 6]);
  }
  m.addLineTo(pts.at(-1)!);
  return m;
}

/** A path chopped into dashes (dotted links), as geometry so it animates and seeks like any path. */
function dashed(path: VMobject, style: Style, dash = 0.09, gap = 0.07): VMobject {
  const out = new VMobject({ ...style, fill: 'none' });
  const n = path.numCurves(0), samples: Vec[] = [];
  for (let c = 0; c < n; c++) for (let k = 0; k < 16; k++) samples.push(path.pointOnCurve(0, c, k / 16));
  samples.push(path.pointOnCurve(0, n - 1, 1));
  let acc = 0, on = true, cur: true | null = null;
  for (let i = 1; i < samples.length; i++) {
    let [ax, ay] = samples[i - 1]!;
    const [bx, by] = samples[i]!;
    let seg = Math.hypot(bx - ax, by - ay);
    while (seg > 1e-9) {
      const left = (on ? dash : gap) - acc, step = Math.min(left, seg), t = step / seg;
      const nx = ax + (bx - ax) * t, ny = ay + (by - ay) * t;
      if (on) { if (!cur) { out.startNewPath([ax, ay]); cur = true; } out.addLineTo([nx, ny]); }
      acc += step; seg -= step; ax = nx; ay = ny;
      if (acc >= (on ? dash : gap) - 1e-9) { acc = 0; on = !on; cur = null; }
    }
  }
  return out;
}

function arrowHead(tip: Vec, dir: Vec, size: number, color: string): Polygon {
  const [ux, uy] = dir, px = -uy, py = ux, L = size, W = size * 0.62;
  const bx = tip[0] - ux * L, by = tip[1] - uy * L;
  return new Polygon([tip, [bx + px * W / 2, by + py * W / 2], [bx - px * W / 2, by - py * W / 2]], { fill: color, stroke: 'none' });
}

export interface FlowchartOpts {
  /** The chart is scaled down to fit width × height (never up). */
  width?: number;
  height?: number;
  fontSize?: number;
  theme?: FlowchartTheme;
  layout?: LayoutOptions;
}

/** An edge's endpoints and where its Group sits among the chart's children. */
interface EdgeIndex { from: string; to: string; index: number }

export class Flowchart extends Group {
  graph: FlowGraph;
  layout: Layout;
  _cluster: Map<string, number>;
  _node: Map<string, number>;
  _edge: EdgeIndex[];

  /** `src`: mermaid flowchart source, or a parsed graph. */
  constructor(src: string | FlowGraph, { width = 15, height = 7.6, fontSize = 0.24, theme = FLOWCHART_THEME, layout = {} }: FlowchartOpts = {}) {
    super();
    const g = typeof src === 'string' ? parseMermaid(src) : src;
    this.graph = g;
    const classStyle = (n: FlowNode): ParsedStyle => Object.assign({}, ...n.classes.map((c) => styleOf(g.classDefs.get(c) ?? [])), styleOf(n.style));
    const sgIds = new Set(g.subgraphs.map((s) => s.id));

    // Labels first: their measured size is the node size the layout sees
    const nodeIds = [...g.nodes.keys()].filter((id) => !sgIds.has(id));
    const built = new Map<string, { shape: VMobject; lab: Text | Group; kind: NodeKind; w: number; h: number }>();
    for (const id of nodeIds) {
      const n = g.nodes.get(id)!;
      // Theme defaults, overridden by whatever the classes and style set
      const st = { ...theme.node, ...classStyle(n) } as Required<FlowStyle>;
      const lab = label(n.text, { fontSize, color: st.color });
      const shape = shapeFor(n.shape ?? 'square', lab.width(), lab.height(), st);
      const kind: NodeKind = n.shape === 'circle' || n.shape === 'doublecircle' ? 'circle' : n.shape === 'diamond' ? 'diamond' : 'rect';
      built.set(id, { shape, lab, kind, w: shape.width(), h: shape.height() });
    }
    const memberOf = new Map<string, string>();
    for (const s of g.subgraphs) for (const id of s.nodes) if (!sgIds.has(id)) memberOf.set(id, s.id);
    // An edge to a subgraph attaches to its first member node
    const anchor = (id: string): string | null => {
      if (!sgIds.has(id)) return id;
      const s = g.subgraphs.find((x) => x.id === id)!;
      for (const m of s.nodes) { const a = anchor(m); if (a) return a; }
      return null;
    };
    const edgeLabels = g.edges.map((e) => (e.text ? label(e.text, { fontSize: fontSize * 0.85, color: theme.edge.color }) : null));
    const titles = new Map(g.subgraphs.map((s) => [s.id, label(s.title, { fontSize: fontSize * 0.85, color: theme.cluster.color })]));

    const L = layoutGraph({
      direction: g.direction,
      nodes: nodeIds.map((id) => ({ id, w: built.get(id)!.w, h: built.get(id)!.h, cluster: memberOf.get(id) ?? null })),
      edges: g.edges.map((e, i) => { const l = edgeLabels[i]; return { from: anchor(e.from), to: anchor(e.to), minlen: e.length, label: l ? { w: l.width() + 0.16, h: l.height() + 0.1 } : null }; }).map((e) => (e.from && e.to ? e as LEdge : { ...e, from: '', to: '' })),
      clusters: g.subgraphs.map((s) => { const t = titles.get(s.id); return { id: s.id, parent: s.parent, title: t ? { w: t.width(), h: t.height() } : null }; }),
    }, layout);
    this.layout = L;
    // Layout is y-down; the scene is y-up
    const P = ([x, y]: Readonly<Point>): Vec => [x, -y];

    // Cluster boxes, outermost first so inner ones draw on top
    const depth = (id: string): number => { let d = 0, s = g.subgraphs.find((x) => x.id === id); while (s?.parent) { const p = s.parent; d++; s = g.subgraphs.find((x) => x.id === p); } return d; };
    this._cluster = new Map(); this._node = new Map(); this._edge = [];
    for (const s of [...g.subgraphs].sort((a, b) => depth(a.id) - depth(b.id))) {
      const b = L.clusters.get(s.id);
      if (!b) continue;
      const st = { ...theme.cluster, ...styleOf(g.nodes.get(s.id)?.style ?? []) } as Required<FlowStyle>;
      const box = new Rectangle({ width: b.x1 - b.x0, height: b.y1 - b.y0, cornerRadius: 0.1, stroke: st.stroke, strokeWidth: st.strokeWidth, fill: st.fill, fillOpacity: st.fillOpacity });
      box.moveTo(P([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]));
      const t = titles.get(s.id)!;
      t.moveTo(P([(b.x0 + b.x1) / 2, b.y0 + 0.12 + t.height() / 2]));
      const c = new Labeled(box, t, { center: false });
      this._cluster.set(s.id, this.children.length); this.add(c);
    }
    // Edges under nodes
    g.edges.forEach((e, i) => {
      const r = L.edges.get(i);
      if (!r) return;
      const st = { ...theme.edge, ...styleOf(e.style ?? []) };
      // A routed edge has both ends anchored on laid-out nodes
      const from = anchor(e.from)!, to = anchor(e.to)!;
      const a = L.nodes.get(from)!, z = L.nodes.get(to)!;
      const na = { ...a, kind: built.get(from)!.kind }, nz = { ...z, kind: built.get(to)!.kind };
      const pts = r.points.map((p): Point => [...p]);
      if (!r.loop) { pts[0] = clip(na, pts[1]!); pts[pts.length - 1] = clip(nz, pts[pts.length - 2]!); }
      const width = e.stroke === 'thick' ? st.strokeWidth * 2.2 : st.strokeWidth;
      const head = 0.17 + width;
      const endsArrow = e.type === 'arrow_point' || e.type === 'double_arrow_point';
      const unit = (p: Vec, q: Vec): Vec => { const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
      // Shorten the path where an arrowhead covers it
      const sp = pts.map(P);
      const tipEnd = sp.at(-1)!, dirEnd = unit(sp.at(-2)!, sp.at(-1)!);
      const tipStart = sp[0]!, dirStart = unit(sp[1]!, sp[0]!);
      if (endsArrow) sp[sp.length - 1] = [tipEnd[0] - dirEnd[0] * head * 0.8, tipEnd[1] - dirEnd[1] * head * 0.8];
      if (e.type === 'double_arrow_point') sp[0] = [tipStart[0] - dirStart[0] * head * 0.8, tipStart[1] - dirStart[1] * head * 0.8];
      const pathStyle: Style = { stroke: st.stroke, strokeWidth: width, fill: 'none' };
      let path = basisPath(sp, pathStyle);
      if (e.stroke === 'dotted' || st.dashed) path = dashed(path, pathStyle);
      const parts: Mobject[] = [path];
      if (endsArrow) parts.push(arrowHead(tipEnd, dirEnd, head, st.stroke));
      if (e.type === 'double_arrow_point') parts.push(arrowHead(tipStart, dirStart, head, st.stroke));
      if (e.type === 'arrow_circle') parts.push(new Circle({ radius: 0.06, fill: st.stroke, fillOpacity: 1, stroke: 'none' }).moveTo([tipEnd[0] - dirEnd[0] * 0.06, tipEnd[1] - dirEnd[1] * 0.06]));
      if (e.type === 'arrow_cross') {
        const c: Vec = [tipEnd[0] - dirEnd[0] * 0.08, tipEnd[1] - dirEnd[1] * 0.08], k = 0.07;
        const x = new VMobject({ stroke: st.stroke, strokeWidth: width * 1.3, fill: 'none' });
        x.startNewPath([c[0] - k, c[1] - k]); x.addLineTo([c[0] + k, c[1] + k]);
        x.startNewPath([c[0] - k, c[1] + k]); x.addLineTo([c[0] + k, c[1] - k]);
        parts.push(x);
      }
      const lab = edgeLabels[i];
      if (lab && r.label) {
        const bg = new Rectangle({ width: lab.width() + 0.16, height: lab.height() + 0.1, cornerRadius: 0.04, fill: theme.labelBg, fillOpacity: 0.92, stroke: 'none' });
        parts.push(new Labeled(bg.moveTo(P(r.label)), lab));
      }
      const grp = new Group(...parts);
      this._edge.push({ from: e.from, to: e.to, index: this.children.length });
      this.add(grp);
    });
    for (const id of nodeIds) {
      const { shape, lab } = built.get(id)!, n = L.nodes.get(id)!;
      const node = new Labeled(shape, lab).moveTo(P([n.x, n.y]));
      this._node.set(id, this.children.length); this.add(node);
    }
    // Fit, then center on the origin
    const s = Math.min(1, width / Math.max(this.width(), 1e-9), height / Math.max(this.height(), 1e-9));
    if (s < 1) this.scale(s);
    this.moveTo([0, 0]);
  }

  /** The node `id`: a Labeled (`.shape`, `.label`), or undefined. */
  node(id: string): Labeled<VMobject, Text | Group> { return this.children[this._node.get(id)!] as Labeled<VMobject, Text | Group>; }
  /** The k-th edge from `from` to `to`: a Group [path, arrowheads..., label?]. */
  edge(from: string, to: string, k = 0): Group | undefined { const e = this._edge.filter((x) => x.from === from && x.to === to)[k]; return e ? this.children[e.index] as Group : undefined; }
  /** The subgraph `id`: a Labeled (`.shape` is the box, `.label` the title), or undefined. */
  cluster(id: string): Labeled<Rectangle, Text | Group> { return this.children[this._cluster.get(id)!] as Labeled<Rectangle, Text | Group>; }
  get nodeIds(): string[] { return [...this._node.keys()]; }

  /**
   * Draw one edge in: the line traces from its source and the arrowhead with
   * it, all parts at once (no stagger: a label's glyphs would otherwise pop in
   * one frame apart); its label fades in on top.
   */
  drawEdge(from: string, to: string, k = 0): Animation[] {
    const grp = this.edge(from, to, k);
    if (!grp) return [];
    const out: Animation[] = [];
    for (const part of grp.children) out.push(part instanceof Labeled ? new FadeIn(part, { scale: 0.9 }) : new Create(part, { lagRatio: 0 }));
    return out;
  }

  /**
   * Animations that draw the chart in layout order: per rank, the clusters that
   * begin there, the nodes on it, and the edges arriving at it. Play the stages
   * in sequence (each is a list of animations that can run together).
   */
  reveal(): Animation[][] {
    const g = this.graph, L = this.layout;
    const ranks = [...new Set([...L.nodes.values()].map((n) => n.rank))].sort((a, b) => a - b);
    const shownClusters = new Set<string>();
    const clusterRank = (sid: string): number => {
      const s = g.subgraphs.find((x) => x.id === sid)!;
      const rs = s.nodes.flatMap((m) => (L.nodes.has(m) ? [L.nodes.get(m)!.rank] : g.subgraphs.some((x) => x.id === m) ? [clusterRank(m)] : []));
      return rs.length ? Math.min(...rs) : Infinity;
    };
    const rankOf = (id: string): number | undefined => L.nodes.get(id)?.rank;
    return ranks.map((r) => {
      const anims: Animation[] = [];
      for (const s of g.subgraphs) if (!shownClusters.has(s.id) && clusterRank(s.id) <= r && this._cluster.has(s.id)) { shownClusters.add(s.id); anims.push(new FadeIn(this.cluster(s.id))); }
      for (const e of this._edge) if (Math.max(rankOf(e.from) ?? -1, rankOf(e.to) ?? -1) === r) anims.push(...this.drawEdge(e.from, e.to, this._edge.filter((x) => x.from === e.from && x.to === e.to).indexOf(e)));
      for (const [id] of this._node) if (rankOf(id) === r) anims.push(new FadeIn(this.node(id), { shift: [0, -0.15] }));
      return anims;
    }).filter((a) => a.length);
  }
}

/** Parse and lay out a mermaid flowchart. Fonts must be loaded (Scene.run does it). */
export function flowchart(src: string | FlowGraph, opts?: FlowchartOpts): Flowchart { return new Flowchart(src, opts); }
