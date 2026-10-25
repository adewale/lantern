/**
 * The collection, in gallery order. `topic` explainers are about subjects a
 * reader might search for; `toolchain` explainers show how these explanations
 * are made, and stay off the gallery's first screen. `step` (and `query`)
 * choose the frame each gallery tile shows and links to.
 */
export const EXPLAINERS: readonly { id: string; step: string; query?: string; group: 'topic' | 'toolchain' }[] = [
  { id: 'seasons', step: 'year', group: 'topic' },
  { id: 'oauth-pkce', step: 'attack', query: 'attacker=yes', group: 'topic' },
  { id: 'pap', step: 'sign-in', group: 'topic' },
  { id: 'exgit', step: 'change', group: 'topic' },
  { id: 'token-bucket', step: 'trace', group: 'topic' },
  { id: 'mr-cache', step: 'after', group: 'topic' },
  { id: 'state-machine', step: 'opened', group: 'topic' },
  { id: 'ring-buffer', step: 'result', group: 'topic' },
  { id: 'lantern', step: 'objects', group: 'toolchain' },
  { id: 'agentic-mermaid', step: 'repair', group: 'toolchain' },
  { id: 'glyph', step: 'measure', group: 'toolchain' },
  { id: 'just-bash', step: 'cat', group: 'toolchain' },
  { id: 'pyex-limits', step: 'failure', group: 'toolchain' },
  { id: '2password', step: 'boundary', group: 'toolchain' },
];
