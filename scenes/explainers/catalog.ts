/**
 * The collection, in gallery order. `topic` explainers are about subjects a
 * reader might search for; `toolchain` explainers show how these explanations
 * are made (the engine, the diagrams, the text outlines). `step` chooses
 * the default case's step each gallery tile shows and links to.
 */
export const EXPLAINERS: readonly { id: string; step: string; group: 'topic' | 'toolchain' }[] = [
  { id: 'seasons', step: 'year', group: 'topic' },
  { id: 'oauth-pkce', step: 'attack', group: 'topic' },
  { id: 'exgit', step: 'change', group: 'topic' },
  { id: 'token-bucket', step: 'trace', group: 'topic' },
  { id: 'mr-cache', step: 'after', group: 'topic' },
  { id: 'state-machine', step: 'opened', group: 'topic' },
  { id: 'ring-buffer', step: 'result', group: 'topic' },
  { id: '2password', step: 'suggest', group: 'topic' },
  { id: 'just-bash', step: 'cat', group: 'topic' },
  { id: 'pyex-limits', step: 'failure', group: 'topic' },
  { id: 'lantern', step: 'objects', group: 'toolchain' },
  { id: 'agentic-mermaid', step: 'repair', group: 'toolchain' },
  { id: 'glyph', step: 'measure', group: 'toolchain' },
];
