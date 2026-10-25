/**
 * The collection, in gallery order. `topic` explainers are about subjects a
 * reader might search for; `toolchain` explainers show how these explanations
 * are made (the engine, the diagrams, the text outlines). `step` chooses
 * the default case's step each gallery tile shows and links to. `video: false`
 * leaves an explainer out of `demos:render`, so it ships as a page only.
 */
export const EXPLAINERS: readonly { id: string; step: string; group: 'topic' | 'toolchain'; video?: false }[] = [
  { id: 'seasons', step: 'year', group: 'topic' },
  { id: 'oauth-pkce', step: 'attack', group: 'topic' },
  { id: 'exgit', step: 'change', group: 'topic' },
  { id: 'token-bucket', step: 'trace', group: 'topic' },
  { id: 'mr-cache', step: 'after', group: 'topic' },
  { id: 'state-machine', step: 'opened', group: 'topic' },
  { id: 'ring-buffer', step: 'result', group: 'topic' },
  { id: '2password', step: 'suggest', group: 'topic' },
  { id: 'just-bash', step: 'cat', group: 'topic' },
  { id: 'cert-renewal', step: 'other-rule', group: 'topic' },
  { id: 'quotient-familial', step: 'plafond', group: 'topic' },
  { id: 'send-sync', step: 'wrap-arc', group: 'topic' },
  { id: 'gtfs', step: 'day', group: 'topic' },
  { id: 'pg-page', step: 'full', group: 'topic' },
  { id: 'traffic-policy', step: 'shares', group: 'topic' },
  { id: 'isdigit', step: 'outcome', group: 'topic' },
  { id: 'ical-recurrence', step: 'change', group: 'topic', video: false },
  { id: 'ext4-space', step: 'users', group: 'topic', video: false },
  { id: 'trust-proxy', step: 'requests', group: 'topic', video: false },
  { id: 'tailwind-gamut', step: 'palette', group: 'topic', video: false },
  { id: 'gnome-files', step: 'give-ups', group: 'topic', video: false },
  { id: 'wcag-map', step: 'v22', group: 'topic', video: false },
  { id: 'lantern', step: 'objects', group: 'toolchain' },
  { id: 'fork', step: 'fork', group: 'toolchain' },
  { id: 'agentic-mermaid', step: 'repair', group: 'toolchain' },
  { id: 'glyph', step: 'measure', group: 'toolchain' },
];
