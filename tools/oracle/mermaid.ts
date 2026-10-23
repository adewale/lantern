// Oracle: mermaid's own flowchart parser, run in Chromium. Returns, per source,
// what mermaid's flowDb holds (vertices, edges, subgraphs, classes), or the
// error mermaid raised. The test compares src/mermaid.ts against it.
//
//   MERMAID_JS=path/to/mermaid.min.js   (mermaid 11.x; CI installs it with npm i --no-save)
import { readFileSync, existsSync } from 'node:fs';
import { launch } from '../lib/browser.ts';

/** What mermaid's flowDb holds for one source, in plain data. */
export interface MermaidResult {
  direction: string | null;
  vertices: Array<{ id: string; text: string; type: string | null; classes: string[]; styles: string[] }>;
  edges: Array<{ from: string; to: string; type: string; stroke: string; text: string; length: number; style: string[] | null }>;
  subgraphs: Array<{ id: string; title: string; nodes: string[]; dir: string | null }>;
  classes: Array<[string, string[]]>;
}
export type MermaidOutcome = (MermaidResult & { error?: undefined }) | { error: string };

/** The slice of mermaid's in-page API this calls; mermaid's own types are not installed. */
interface MermaidFlowDb {
  getDirection?(): string;
  getVertices(): Map<string, { id: string; text: string; type?: string; classes?: string[]; styles?: string[] }>;
  getEdges(): Array<{ start: string; end: string; type: string; stroke: string; text?: string; length?: number; style?: string[] }>;
  getSubGraphs(): Array<{ id: string; title: string; nodes: string[]; dir?: string }>;
  getClasses(): Map<string, { styles: string[] }>;
}
interface MermaidGlobal {
  initialize(config: object): void;
  mermaidAPI: { getDiagramFromText(src: string): Promise<{ db: MermaidFlowDb }> };
}

export function mermaidPath(): string | null {
  const p = process.env.MERMAID_JS;
  return p && existsSync(p) ? p : null;
}

export async function mermaidParse(sources: string[]): Promise<MermaidOutcome[]> {
  const lib = readFileSync(mermaidPath()!, 'utf8');
  const b = await launch();
  try {
    const p = await b.newPage();
    await p.setContent(`<html><head><meta charset="utf-8"></head><body><script>${lib.replace(/<\/script/g, '<\\/script')}</script></body></html>`);
    return await p.evaluate(async (sources) => {
      const mermaid = (window as unknown as { mermaid: MermaidGlobal }).mermaid;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      const out: MermaidOutcome[] = [];
      for (const src of sources) {
        try {
          const d = await mermaid.mermaidAPI.getDiagramFromText(src);
          const db = d.db;
          out.push({
            direction: db.getDirection?.() ?? null,
            vertices: [...db.getVertices().values()].map((v) => ({ id: v.id, text: v.text, type: v.type ?? null, classes: v.classes ?? [], styles: v.styles ?? [] })),
            edges: db.getEdges().map((e) => ({ from: e.start, to: e.end, type: e.type, stroke: e.stroke, text: e.text ?? '', length: e.length ?? 1, style: e.style ?? null })),
            subgraphs: db.getSubGraphs().map((s) => ({ id: s.id, title: s.title, nodes: s.nodes, dir: s.dir ?? null })),
            classes: [...db.getClasses().entries()].map(([k, v]): [string, string[]] => [k, v.styles]),
          });
        } catch (e) { out.push({ error: String((e as Error).message ?? e).slice(0, 200) }); }
      }
      return out;
    }, sources);
  } finally { await b.close(); }
}
