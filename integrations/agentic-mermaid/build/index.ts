import { parseRegisteredMermaid } from 'agentic-mermaid';
import type { SceneNode } from 'agentic-mermaid';
import type { AnyMutationOp } from 'agentic-mermaid/agent';
import { mutate, serializeMermaid, verifyMermaid } from 'agentic-mermaid/agent';
import { launch } from '../../../tools/lib/browser.ts';
import { capture } from './capture.ts';
import { readSvg } from './read-svg.ts';
import { diagramKey } from '../snapshot.ts';
import type {
  DiagramResolver,
  DiagramSnapshot,
  DiagramSpec,
  SnapshotStore,
  SnapshotPart,
} from '../snapshot.ts';

export function replayMorph(
  before: DiagramSpec,
  after: DiagramSpec,
  ops: readonly Readonly<Record<string, unknown>>[],
): void {
  const parsed = parseRegisteredMermaid(before.source),
    target = parseRegisteredMermaid(after.source);
  if (!parsed.ok || !target.ok) throw new Error('Cannot parse morph endpoints');
  let model = parsed.value;
  for (const op of ops) {
    const result = mutate(model, op as unknown as AnyMutationOp);
    if (!result.ok) throw new Error(`Morph edit failed: ${JSON.stringify(result.error)}`);
    model = result.value;
  }
  if (serializeMermaid(model) !== serializeMermaid(target.value))
    throw new Error('Morph ops do not produce the next diagram');
}

export async function snapshotBuilder(
  store: SnapshotStore = {},
): Promise<DiagramResolver & { store: SnapshotStore; close(): Promise<void>; edits: number }> {
  const browser = await launch();
  const page = await browser.newPage();
  await page.route('**/*', (r) => r.abort());
  const pending = new Map<string, Promise<DiagramSnapshot>>();
  let serial: Promise<unknown> = Promise.resolve();
  const builder = {
    store,
    edits: 0,
    async close() {
      await browser.close();
    },
    async diagram(spec: DiagramSpec): Promise<DiagramSnapshot> {
      const key = diagramKey(spec);
      if (store[key]) return store[key];
      if (pending.has(key)) return pending.get(key)!;
      const task = serial.then(async () => {
        const findings = verifyMermaid(spec.source);
        if (!findings.ok) throw new Error(`Diagram verification failed: ${JSON.stringify(findings)}`);
        const r = capture(spec);
        const lowered = await readSvg(page, r.marked);
        const parts: SnapshotPart[] = r.parts.map(({ node, svg }, i) => {
          const connector = (n: SceneNode): Extract<SceneNode, { kind: 'connector' }> | undefined =>
            n.kind === 'connector'
              ? n
              : n.kind === 'group'
                ? n.children.map((c) => connector(c.node)).find(Boolean)
                : undefined;
          const edge = connector(node);
          const geometry = edge?.route.geometry;
          const route: [number, number][] | undefined = geometry
            ? geometry.kind === 'line'
              ? [
                  [geometry.x1 / 100, -geometry.y1 / 100],
                  [geometry.x2 / 100, -geometry.y2 / 100],
                ]
              : geometry.points.map((p) => [p.x / 100, -p.y / 100])
            : undefined;
          // Graph wrappers use node:<id>, but the author's Mermaid ids are the public API.
          const id = node.id.startsWith('node:') ? node.id.slice(5) : node.id;
          return {
            id,
            role: node.role,
            kind: node.kind,
            svg,
            shapes: lowered.get(i) ?? [],
            ...(edge?.endpoints.from ? { from: edge.endpoints.from } : {}),
            ...(edge?.endpoints.to ? { to: edge.endpoints.to } : {}),
            ...(route ? { route } : {}),
            ...(node.channels ? { channels: node.channels } : {}),
          };
        });
        const ids = new Set(parts.map((p) => p.id));
        if (ids.size !== parts.length) throw new Error('Duplicate semantic mark ids in snapshot');
        for (const p of parts) {
          const owner = p.id.startsWith('edge-label:')
            ? p.id.replace('edge-label:', 'edge:')
            : p.id.startsWith('rel-label:')
              ? p.id.replace('rel-label:', 'rel:')
              : p.id.startsWith('task-label:')
                ? p.id.replace('task-label:', 'task:')
                : undefined;
          if (owner && ids.has(owner)) p.owner = owner;
        }
        if (lowered.has(-1))
          parts.unshift({ id: '__frame', role: 'frame', kind: 'shape', svg: '', shapes: lowered.get(-1)! });
        const value: DiagramSnapshot = {
          version: 1,
          renderer: 'agentic-mermaid@0.4.1',
          spec,
          family: /^\s*stateDiagram/m.test(spec.source) ? 'state' : r.doc.family,
          width: r.doc.width,
          height: r.doc.height,
          palette: r.palette,
          svg: r.svg,
          parts,
          findings,
        };
        store[key] = value;
        return value;
      });
      serial = task;
      pending.set(key, task);
      return task;
    },
    async morph(before: DiagramSpec, after: DiagramSpec, ops: readonly Readonly<Record<string, unknown>>[]) {
      replayMorph(before, after, ops);
      builder.edits++;
    },
  };
  return builder;
}
