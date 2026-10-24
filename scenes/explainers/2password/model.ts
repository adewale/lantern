// Explicit fixture model, not a connection to a vault or a claim to reproduce private 2password code.
export const ITEMS = [
  { id: 'prod', title: 'Production API', username: 'deploy', tags: ['production', 'api'] },
  { id: 'stage', title: 'Staging API', username: 'test', tags: ['staging', 'api'] },
  { id: 'notes', title: 'Team notes', username: 'team', tags: ['notes'] },
];
export function rankMetadata(query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return ITEMS.map((item) => {
    const title = item.title.toLowerCase(),
      fields = [title, item.username, ...item.tags].join(' ').toLowerCase();
    return {
      ...item,
      score: terms.every((t) => fields.includes(t))
        ? terms.reduce(
            (sum, t) => sum + (title === t ? 100 : title.startsWith(t) ? 50 : title.includes(t) ? 30 : 10),
            0,
          )
        : 0,
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function secretWorkflow(auth: string) {
  const env: Record<string, string> = {
    PATH: '/usr/bin',
    APP_MODE: 'production',
    ...(auth === 'service' ? { OP_SERVICE_ACCOUNT_TOKEN: 'fixture-not-a-real-token' } : {}),
  };
  const child = { ...env };
  delete child.OP_SERVICE_ACCOUNT_TOKEN;
  return {
    approvals: auth === 'service' ? 0 : 3,
    commands: ['op item list', 'op item get prod', 'op run -- env -u OP_SERVICE_ACCOUNT_TOKEN app'],
    childEnv: child,
    hasServiceTokenBefore: auth === 'service',
  };
}
