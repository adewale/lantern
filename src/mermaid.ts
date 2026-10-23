// Mermaid flowchart syntax -> a plain graph. The subset that diagrams use:
// flowchart/graph with a direction, node shapes, links (solid, dotted, thick;
// arrow, open, cross, circle, both ends; labels as `-- text -->` or `-->|text|`),
// `&` lists, subgraphs (nested, with titles and `direction`), classDef/class,
// `:::class`, style, linkStyle, `%%` comments, `;` separators.
//
// The output mirrors mermaid's own flowDb (vertex types, edge types/strokes,
// subgraph membership), and test/flowchart.test.ts holds this parser to
// mermaid's on a corpus and on randomly generated flowcharts.

export interface FlowNode { id: string; text: string; shape: string | undefined; classes: string[]; style: string[] }
export type FlowStroke = 'normal' | 'thick' | 'dotted';
export type FlowEdgeType = 'arrow_point' | 'double_arrow_point' | 'arrow_cross' | 'arrow_circle' | 'arrow_open';
export interface FlowEdge { from: string; to: string; text: string; stroke: FlowStroke; type: FlowEdgeType; length: number; style?: string[] }
export interface FlowSubgraph { id: string; title: string; nodes: string[]; parent: string | null; dir?: string }
export interface FlowGraph { direction: string; nodes: Map<string, FlowNode>; edges: FlowEdge[]; subgraphs: FlowSubgraph[]; classDefs: Map<string, string[]> }

/** A subgraph while it is open: the node ids referenced inside it so far. */
type OpenSubgraph = FlowSubgraph & { refs?: Set<string> };

// Openers, longest first, with their closer and mermaid's vertex type
const SHAPES: ReadonlyArray<readonly [open: string, close: string, type: string]> = [
  ['(((', ')))', 'doublecircle'], ['((', '))', 'circle'], ['([', '])', 'stadium'], ['[[', ']]', 'subroutine'],
  ['[(', ')]', 'cylinder'], ['{{', '}}', 'hexagon'], ['[/', '/]', 'lean_right'], ['[\\', '\\]', 'lean_left'],
  ['[/', '\\]', 'trapezoid'], ['[\\', '/]', 'inv_trapezoid'], ['[', ']', 'square'], ['(', ')', 'round'], ['{', '}', 'diamond'], ['>', ']', 'odd'],
];

const ID = /^[\p{L}\p{N}_$][\p{L}\p{N}_$]*(?:-(?![-.>xo])[\p{L}\p{N}_$]+)*/u;
// Links. Unlabeled: solid ---/-->, thick ===/==>, dotted -.-/-.->, any of them with <, x, o
const LINK = /^(<|x|o)?(-{2,}|={2,}|-\.+-)(>|x|o)?/;
// Labeled: opener, text, closer (`-- text -->`, `== text ==>`, `-. text .->`)
const LABELED = /^(<|x|o)?(--|==|-\.)\s+([^]*?)\s*(-{2,}|={2,}|\.+-+)(>|x|o)?/;

const decode = (s: string): string => s.replace(/<br\s*\/?>/gi, '\n').replace(/#quot;/g, '"').replace(/#amp;/g, '&').replace(/#lt;/g, '<').replace(/#gt;/g, '>');

export function parseMermaid(src: string): FlowGraph {
  const g: FlowGraph = { direction: 'TB', nodes: new Map(), edges: [], subgraphs: [], classDefs: new Map() };
  const stack: OpenSubgraph[] = []; // open subgraphs, each with the set of node ids referenced inside it
  const claimed = new Set<string>(); // a node belongs to one subgraph: the first closed that references it
  const linkStyles: Array<[which: string, style: string[]]> = [];

  const lines = splitStatements(src);
  let headerSeen = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m: RegExpExecArray | null;
    if (!headerSeen) {
      if ((m = /^(?:flowchart|graph)(?:\s+(TB|TD|BT|LR|RL))?\s*$/i.exec(line))) {
        g.direction = (m[1] ?? 'TB').toUpperCase().replace('TD', 'TB');
        headerSeen = true; continue;
      }
      throw new SyntaxError(`expected "flowchart <dir>" or "graph <dir>", got: ${line}`);
    }
    if ((m = /^classDef\s+([\w,-]+)\s+(.+)$/.exec(line))) { for (const name of m[1]!.split(',')) g.classDefs.set(name, splitStyle(m[2]!)); continue; }
    // In source order, as mermaid does: `class` reaches only nodes that exist by then; `style` creates one
    if ((m = /^class\s+([\w,\s-]+?)\s+([\w-]+)$/.exec(line))) {
      for (const id of m[1]!.split(',').map((x) => x.trim())) g.nodes.get(id)?.classes.push(m[2]!);
      continue;
    }
    if ((m = /^style\s+([\w-]+)\s+(.+)$/.exec(line))) { ensure(g, m[1]!).style.push(...splitStyle(m[2]!)); continue; }
    if ((m = /^linkStyle\s+(default|[\d,\s]+?)\s+(.+)$/.exec(line))) { linkStyles.push([m[1]!, splitStyle(m[2]!)]); continue; }
    if ((m = /^direction\s+(TB|TD|BT|LR|RL)$/i.exec(line))) { if (stack.length) stack.at(-1)!.dir = m[1]!.toUpperCase().replace('TD', 'TB'); continue; }
    if ((m = /^subgraph\s+(.+)$/.exec(line))) {
      const rest = m[1]!.trim();
      let id: string, title: string;
      const withTitle = /^([\w-]+)\s*\[\s*"?([^"\]]*)"?\s*\]$/.exec(rest);
      if (withTitle) { id = withTitle[1]!; title = withTitle[2]!; }
      else if (/^"[^"]*"$/.test(rest)) { title = rest.slice(1, -1); id = title; }
      else if (/^[\w-]+$/.test(rest)) { id = rest; title = rest; }
      else { title = rest; id = rest; }
      const sg: FlowSubgraph = { id, title: decode(title), nodes: [], parent: stack.at(-1)?.id ?? null };
      g.subgraphs.push(sg);
      if (stack.length) stack.at(-1)!.nodes.push(id);
      stack.push(Object.assign(sg, { refs: new Set<string>() }));
      continue;
    }
    if (/^end$/.test(line)) {
      const sg = stack.pop();
      if (!sg) throw new SyntaxError('"end" without a subgraph');
      // Members: nodes referenced anywhere inside (nested included) not already claimed by a
      // subgraph that closed earlier, i.e. by an inner one or an earlier sibling
      for (const id of sg.refs!) if (!claimed.has(id)) { sg.nodes.push(id); claimed.add(id); }
      delete sg.refs;
      continue;
    }
    parseChain(line, g, stack);
  }
  if (stack.length) throw new SyntaxError(`subgraph "${stack.at(-1)!.id}" is not closed with "end"`);
  for (const [which, st] of linkStyles) {
    const idx = which === 'default' ? g.edges.map((_, i) => i) : which.split(',').map((s) => Number(s.trim()));
    for (const i of idx) if (g.edges[i]) g.edges[i].style = [...st, 'fill:none'];
  }
  return g;
}

/** Statements are separated by newlines and by `;` outside quotes and brackets. */
function splitStatements(src: string): string[] {
  const out: string[] = [];
  for (const rawLine of src.split('\n')) {
    const line = rawLine.replace(/%%.*$/, '');
    let cur = '', q = false, depth = 0;
    for (const ch of line) {
      if (ch === '"') q = !q;
      if (!q && '[({'.includes(ch)) depth++;
      if (!q && '])}'.includes(ch)) depth = Math.max(0, depth - 1);
      if (ch === ';' && !q && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
  }
  return out;
}

const splitStyle = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);

function ensure(g: FlowGraph, id: string): FlowNode {
  let n = g.nodes.get(id);
  if (!n) { n = { id, text: id, shape: undefined, classes: [], style: [] }; g.nodes.set(id, n); }
  return n;
}

/** `A[x] & B --> C -. y .-> D:::cls`; `open` is the stack of open subgraphs. */
function parseChain(line: string, g: FlowGraph, open: readonly OpenSubgraph[]): void {
  let s = line;
  const ws = () => { s = s.replace(/^\s+/, ''); };
  const nodeList = (): string[] => {
    const ids: string[] = [];
    for (;;) {
      ws();
      const id = node();
      ids.push(id);
      ws();
      if (s.startsWith('&')) { s = s.slice(1); continue; }
      return ids;
    }
  };
  const node = (): string => {
    const m = ID.exec(s);
    if (!m) throw new SyntaxError(`expected a node id at: ${s.slice(0, 30)}`);
    const id = m[0];
    s = s.slice(id.length);
    const n = ensure(g, id);
    if (!g.subgraphs.some((x) => x.id === id)) for (const sg of open) sg.refs!.add(id);
    for (const [open, close, type] of SHAPES) {
      if (!s.startsWith(open)) continue;
      const body = s.slice(open.length);
      let text: string, rest: string;
      const quoted = /^\s*"([^"]*)"\s*/.exec(body);
      if (quoted && body.slice(quoted[0].length).startsWith(close)) { text = quoted[1]!; rest = body.slice(quoted[0].length + close.length); }
      else {
        const end = body.indexOf(close);
        if (end < 0) continue; // not this shape (e.g. [/ that closes with \])
        text = body.slice(0, end).trim(); rest = body.slice(end + close.length);
      }
      n.text = decode(text); n.shape = type; s = rest;
      break;
    }
    const cls = /^:::([\w-]+)/.exec(s);
    if (cls) { n.classes.push(cls[1]!); s = s.slice(cls[0].length); }
    return id;
  };
  const link = (): Pick<FlowEdge, 'text' | 'stroke' | 'type' | 'length'> | null => {
    ws();
    let m = LABELED.exec(s), text = '';
    let start: string | undefined, body: string, end: string | undefined;
    let closer: string;
    if (m) { start = m[1]; body = m[2]! + m[4]!; closer = m[4]!; text = m[3]!; end = m[5]; }
    else if ((m = LINK.exec(s))) { start = m[1]; body = m[2]!; end = m[3]; closer = body; }
    else return null;
    s = s.slice(m[0].length);
    const pipe = /^\s*\|([^|]*)\|/.exec(s);
    if (pipe) { text = pipe[1]!; s = s.slice(pipe[0].length); }
    const stroke: FlowStroke = body.includes('=') ? 'thick' : body.includes('.') ? 'dotted' : 'normal';
    const type: FlowEdgeType = start === '<' && end === '>' ? 'double_arrow_point' : end === '>' ? 'arrow_point' : end === 'x' ? 'arrow_cross' : end === 'o' ? 'arrow_circle' : 'arrow_open';
    text = text.trim();
    if (/^"[^"]*"$/.test(text)) text = text.slice(1, -1); // a quoted label is its contents, as in mermaid
    return { text: decode(text), stroke, type, length: lengthOf(closer, stroke, end) };
  };
  let left = nodeList();
  for (;;) {
    const l = link();
    if (!l) { ws(); if (s.length) throw new SyntaxError(`unexpected: ${s.slice(0, 30)}`); return; }
    const right = nodeList();
    for (const a of left) for (const b of right) g.edges.push({ from: a, to: b, ...l });
    left = right;
  }
}

/**
 * Mermaid's edge length, from the closing marks only (for `-- t --->` that is
 * `--->`): solid/thick count `-`/`=` minus 1 with an arrowhead, minus 2
 * without; dotted counts the dots. Tabulated against mermaid 11.
 */
function lengthOf(closer: string, stroke: FlowStroke, end: string | undefined): number {
  if (stroke === 'dotted') return Math.max(1, (closer.match(/\./g) || []).length);
  const n = (closer.match(/[-=]/g) || []).length;
  return Math.max(1, end ? n - 1 : n - 2);
}
