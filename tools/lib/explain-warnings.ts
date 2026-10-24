import type { DiagramSnapshot } from '../../integrations/agentic-mermaid/snapshot.ts';
/** Diagnostic only, not a Mermaid parser: recognize common explicit node-label forms.
 * Agentic Mermaid 0.4.1 can lose a label declared after the node was first referenced. */
export function lostLabelWarnings(snapshot: DiagramSnapshot): string[] {
  if (snapshot.family !== 'flowchart') return [];
  const warnings = new Set<string>();
  const definitions =
    /\b([A-Za-z_][\w.-]*)\s*(?:\[\[?|\(\(?|\{\{?)(["']?)([^()[\]{}\n]+?)\2(?:\]\]?|\)\)?|\}\}?)/g;
  for (const match of snapshot.spec.source.matchAll(definitions)) {
    const id = match[1]!,
      label = match[3]!.trim();
    if (label === id) continue;
    const part = snapshot.parts.find((p) => p.id === id && p.role === 'node');
    if (part?.shapes.some((s) => s.text === id))
      warnings.add(
        `Node ${id} rendered its bare id although the source defines “${label}”. Declare labeled nodes before using them in edges (Agentic Mermaid 0.4.1).`,
      );
  }
  return [...warnings];
}
