import type {SnapshotStore} from '../integrations/agentic-mermaid/snapshot.ts';

/** Expand the page's lossless diagram payload using the browser's native stream API. */
export async function inflateSnapshots(encoded: string): Promise<SnapshotStore> {
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).json() as SnapshotStore;
}
