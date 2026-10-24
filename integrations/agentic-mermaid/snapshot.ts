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
  svg: string;
  shapes: SnapshotShape[];
  owner?: string;
  from?: string;
  to?: string;
  route?: [number, number][];
  channels?: unknown;
}
export interface DiagramSnapshot {
  version: 1;
  renderer: 'agentic-mermaid@0.4.1';
  spec: DiagramSpec;
  family: string;
  width: number;
  height: number;
  palette: Palette;
  svg: string;
  parts: SnapshotPart[];
  findings: unknown;
}
export type SnapshotStore = Record<string, DiagramSnapshot>;
export type MutationOp = Readonly<Record<string, unknown>>;
export interface DiagramResolver {
  diagram(spec: DiagramSpec): Promise<DiagramSnapshot>;
  morph?(before: DiagramSpec, after: DiagramSpec, ops: readonly MutationOp[]): Promise<void>;
}
const resolvers = new WeakMap<Scene, DiagramResolver>();
export function diagramKey(spec: DiagramSpec): string {
  return JSON.stringify([
    spec.source.replace(/\r\n/g, '\n').trim(),
    spec.style ?? 'default',
    spec.spacing ?? null,
  ]);
}
export function useDiagrams(scene: Scene, resolver: DiagramResolver): void {
  resolvers.set(scene, resolver);
}
export function diagramsOf(scene: Scene): DiagramResolver {
  const resolver = resolvers.get(scene);
  if (!resolver)
    throw new Error('No diagram snapshots. Run explain snapshots/build, or bindSnapshots() first.');
  return resolver;
}
function validateSnapshot(value: DiagramSnapshot): void {
  const invalid = () => {
    throw new Error('Invalid diagram snapshot. Rebuild with explain snapshots --refresh.');
  };
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  const color = (v: unknown) =>
    typeof v === 'string' &&
    (v === 'none' || /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v));
  if (
    !value ||
    value.version !== 1 ||
    value.renderer !== 'agentic-mermaid@0.4.1' ||
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
  const ids = new Map(value.parts.map((p) => [p?.id, p]));
  if (ids.size !== value.parts.length) invalid();
  for (const part of value.parts) {
    if (!part || typeof part.id !== 'string' || !Array.isArray(part.shapes)) invalid();
    if (part.route && !part.route.every((p) => Array.isArray(p) && p.length === 2 && p.every(finite)))
      invalid();
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
        if (!Array.isArray(path) || path.length < 2 || path.length % 6 !== 2 || !path.every(finite))
          invalid();
      for (const key of ['fillOpacity', 'strokeOpacity', 'opacity', 'strokeWidth'] as const)
        if (!finite(shape.style[key]) || shape.style[key]! < 0) invalid();
      for (const n of Object.values(shape.style)) if (typeof n === 'number' && !finite(n)) invalid();
      if (
        shape.style.dashArray &&
        !shape.style.dashArray.split(/[ ,]+/).every((v) => finite(Number(v)) && Number(v) >= 0)
      )
        invalid();
      if (shape.textRun) {
        const r = shape.textRun;
        if (
          typeof r.text !== 'string' ||
          ![r.x, r.y, r.size].every(finite) ||
          r.size <= 0 ||
          !Array.isArray(r.matrix) ||
          r.matrix.length !== 6 ||
          !r.matrix.every(finite) ||
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
}
export function snapshotResolver(store: SnapshotStore): DiagramResolver {
  return {
    async diagram(spec) {
      const value = store[diagramKey(spec)];
      if (!value)
        throw new Error(`Missing diagram snapshot (${spec.style ?? 'default'}). Rebuild snapshots.`);
      validateSnapshot(value);
      if (diagramKey(value.spec) !== diagramKey(spec))
        throw new Error('Snapshot source does not match its key; rebuild snapshots.');
      return value;
    },
  };
}
