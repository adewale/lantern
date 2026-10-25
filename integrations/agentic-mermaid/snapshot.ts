import type { Style } from '../../src/mobject.ts';
import type { Scene } from '../../src/scene.ts';

export interface DiagramSpec {
  source: string;
  style?: string;
  spacing?: number;
}
export interface Palette {
  paper: string;
  ink: string;
  accent: string;
  muted: string;
}
export interface SnapshotTextRun {
  text: string;
  x: number;
  y: number;
  size: number;
  anchor?: string;
  baseline?: string;
  width?: number;
  matrix: number[];
}
export interface SnapshotShape {
  subpaths: number[][];
  closed: boolean[];
  style: Style;
  text?: string;
  fontSize?: number;
  textRun?: SnapshotTextRun;
}
export interface SnapshotPart {
  id: string;
  role: string;
  kind: string;
  shapes: SnapshotShape[];
  owner?: string;
  from?: string;
  to?: string;
  route?: [number, number][];
  channels?: unknown;
}
/** Agentic Mermaid's SVG pixels per scene unit: imported geometry and text divide by this. */
export const SVG_PX_PER_UNIT = 100;
/** The renderer every snapshot was captured with; receipts and indexes name it from here. */
export const RENDERER = 'agentic-mermaid@0.4.1';
/** The one remedy for a missing, stale or damaged snapshot. */
const RECAPTURE = 'Run `explain snapshots <scene> --refresh`.';
export interface DiagramSnapshot {
  version: 1;
  renderer: typeof RENDERER;
  spec: DiagramSpec;
  family: string;
  width: number;
  height: number;
  palette: Palette;
  parts: SnapshotPart[];
  findings: Findings;
  /** An XY chart's series as written: the renderer's channels hold them normalised. */
  chart?: ChartData;
}
export interface ChartData {
  categories?: string[];
  series: { kind: string; values: number[] }[];
}
/** Agentic Mermaid's verifier result. */
export interface Findings {
  ok: boolean;
  warnings: Finding[];
  /** The verifier's layout; its `edges` are every edge in source order, the order a warning's `edge` counts in. */
  layout?: { edges?: { from: string; to: string }[] };
}
export type SnapshotStore = Record<string, DiagramSnapshot>;
export type MutationOp = Readonly<Record<string, unknown>>;
export interface DiagramResolver {
  diagram(spec: DiagramSpec): Promise<DiagramSnapshot>;
  morph?(before: DiagramSpec, after: DiagramSpec, ops: readonly MutationOp[]): Promise<void>;
}
const resolvers = new WeakMap<Scene, DiagramResolver>();
export function diagramKey(spec: DiagramSpec): string {
  // JSON would write NaN and Infinity as null, the key of the default spacing.
  if (spec.spacing != null && !Number.isFinite(spec.spacing))
    throw new Error(`Diagram spacing must be a finite number, not ${spec.spacing}`);
  return JSON.stringify([
    spec.source.replace(/\r\n/g, '\n').trim(),
    // An empty style renders as the default (capture passes no style), so it is the default's key.
    spec.style || 'default',
    spec.spacing ?? null,
  ]);
}
export function useDiagrams(scene: Scene, resolver: DiagramResolver): void {
  resolvers.set(scene, resolver);
}
export function diagramsOf(scene: Scene): DiagramResolver {
  const resolver = resolvers.get(scene);
  if (!resolver)
    throw new Error('No diagram snapshots are bound to this scene: run it through the explain CLI, or bind them with bindSnapshots().');
  return resolver;
}
/** Snapshots already validated: a store is checked once, not on every resolve. */
const valid = new WeakSet<DiagramSnapshot>();
function validateSnapshot(value: DiagramSnapshot): void {
  if (valid.has(value)) return;
  const invalid = () => {
    throw new Error(`Invalid diagram snapshot. ${RECAPTURE}`);
  };
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  // Points are stored as float32: a coordinate must stay finite there too.
  const point = (n: unknown): n is number => finite(n) && Number.isFinite(Math.fround(n));
  const color = (v: unknown) =>
    typeof v === 'string' &&
    (v === 'none' || /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v));
  if (
    !value ||
    value.version !== 1 ||
    value.renderer !== RENDERER ||
    !finite(value.width) ||
    !finite(value.height) ||
    value.width <= 0 ||
    value.height <= 0 ||
    !value.spec ||
    typeof value.spec.source !== 'string' ||
    !value.palette ||
    ![value.palette.paper, value.palette.ink, value.palette.accent, value.palette.muted].every(color) ||
    !Array.isArray(value.parts)
  )
    invalid();
  const { findings, chart } = value;
  const text = (v: unknown) => typeof v === 'string';
  if (
    !findings ||
    typeof findings.ok !== 'boolean' ||
    !Array.isArray(findings.warnings) ||
    !findings.warnings.every((w) => w && text(w.code) && (w.edge == null || text(w.edge))) ||
    (findings.layout?.edges != null &&
      (!Array.isArray(findings.layout.edges) || !findings.layout.edges.every((e) => e && text(e.from) && text(e.to))))
  )
    invalid();
  if (
    chart != null &&
    (!Array.isArray(chart.series) ||
      !chart.series.every((s) => s && text(s.kind) && Array.isArray(s.values) && s.values.every(finite)) ||
      (chart.categories != null && (!Array.isArray(chart.categories) || !chart.categories.every(text))))
  )
    invalid();
  const ids = new Map(value.parts.map((p) => [p?.id, p]));
  if (ids.size !== value.parts.length) invalid();
  for (const part of value.parts) {
    if (!part || typeof part.id !== 'string' || !Array.isArray(part.shapes)) invalid();
    if (
      part.route != null &&
      (!Array.isArray(part.route) || !part.route.every((p) => Array.isArray(p) && p.length === 2 && p.every(point)))
    )
      invalid();
    for (const key of ['owner', 'from', 'to', 'role', 'kind'] as const)
      if (part[key] != null && typeof part[key] !== 'string') invalid();
    // An owner names a part: '' would read as "no owner" in some places and as an id in others.
    if (part.owner === '') invalid();
    const ancestors = new Set([part.id]);
    let owner = part.owner;
    while (owner) {
      if (ancestors.has(owner) || !ids.has(owner)) invalid();
      ancestors.add(owner);
      owner = ids.get(owner)!.owner;
    }
    for (const shape of part.shapes) {
      if (
        !shape ||
        !Array.isArray(shape.subpaths) ||
        !Array.isArray(shape.closed) ||
        shape.subpaths.length !== shape.closed.length ||
        !shape.closed.every((b) => typeof b === 'boolean') ||
        !shape.style ||
        !color(shape.style.fill) ||
        !color(shape.style.stroke)
      )
        invalid();
      for (const path of shape.subpaths)
        if (!Array.isArray(path) || path.length < 2 || path.length % 6 !== 2 || !path.every(point))
          invalid();
      for (const key of ['fillOpacity', 'strokeOpacity', 'opacity', 'strokeWidth'] as const)
        if (!finite(shape.style[key]) || shape.style[key]! < 0) invalid();
      for (const n of Object.values(shape.style)) if (typeof n === 'number' && !finite(n)) invalid();
      const dash = shape.style.dashArray;
      if (
        dash != null &&
        (typeof dash !== 'string' ||
          !dash
            .split(/[ ,]+/)
            .filter((v) => v !== '')
            .every((v) => finite(Number(v)) && Number(v) >= 0))
      )
        invalid();
      if (shape.textRun) {
        const r = shape.textRun;
        if (
          typeof r.text !== 'string' ||
          ![r.x, r.y, r.size].every(point) ||
          r.size <= 0 ||
          !Array.isArray(r.matrix) ||
          r.matrix.length !== 6 ||
          !r.matrix.every(point) ||
          (r.width != null && (!finite(r.width) || r.width < 0)) ||
          (r.baseline != null &&
            !['auto', 'alphabetic', 'middle', 'central', 'text-before-edge', 'text-after-edge'].includes(
              r.baseline,
            ))
        )
          invalid();
      }
    }
  }
  valid.add(value);
}
export function snapshotResolver(store: SnapshotStore): DiagramResolver {
  return {
    async diagram(spec) {
      const value = store[diagramKey(spec)];
      if (!value)
        throw new Error(
          `Missing diagram snapshot for "${spec.source.trim().split('\n')[0]}" (${spec.style ?? 'default'}). ${RECAPTURE}`,
        );
      validateSnapshot(value);
      if (diagramKey(value.spec) !== diagramKey(spec))
        throw new Error(`Snapshot source does not match its key. ${RECAPTURE}`);
      return value;
    },
  };
}

/** A verifier warning, with the snapshot part it is about when it names an edge. */
export interface Finding {
  code: string;
  node?: string;
  edge?: string;
  part?: string;
  [key: string]: unknown;
}
/**
 * The part id for an edge the verifier names by its position among all edges
 * ("A->C#1"). Snapshot parts number edges per endpoint pair ("edge:A->C#0").
 * The verifier's layout lists edges in global order, so the k-th layout edge
 * and the count of earlier edges with the same endpoints give the part exactly.
 */
export function edgePartOf(snapshot: DiagramSnapshot, globalEdge: string): string | undefined {
  const named = /^(.*)#(\d+)$/s.exec(globalEdge);
  if (!named) return undefined;
  const index = Number(named[2]);
  const order =
    snapshot.findings.layout?.edges ??
    snapshot.parts.filter((p) => p.from && p.to && !p.owner).map((p) => ({ from: p.from!, to: p.to! }));
  const edge = order[index];
  // The name carries the edge's endpoints: an index that points at a different edge is not this one.
  if (!edge || named[1] !== `${edge.from}->${edge.to}`) return undefined;
  const nth = order.slice(0, index).filter((e) => e.from === edge.from && e.to === edge.to).length;
  const part = `edge:${edge.from}->${edge.to}#${nth}`;
  return snapshot.parts.some((p) => p.id === part) ? part : undefined;
}
/** The snapshot's verifier warnings, each with the `part` its edge names (see `edgePartOf`). */
export function findingsOf(snapshot: DiagramSnapshot): Finding[] {
  // `part` is always derived here, never carried over.
  return snapshot.findings.warnings.map(({ part: _stale, ...warning }) => {
    const part = warning.edge != null ? edgePartOf(snapshot, warning.edge) : undefined;
    return part ? { ...warning, part } : warning;
  });
}
