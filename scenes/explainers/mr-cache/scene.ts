import { Scene } from '../../../src/index.ts';
import { stage, settingsOf } from '../../../explain/index.ts';
const STYLE = 'hand-drawn';
const BEFORE = 'graph LR\nRequest[Request] --> H[Handler]\nH --> D1[(D1)]';
const AFTER =
  'graph LR\nRequest[Request] --> H[Handler]\nH --> KV[KV cache]\nKV -->|miss| D1[(D1)]\nKV -->|hit| Reply[Reply]\nD1 --> Reply';
const OPS = [
  { kind: 'remove_edge', id: 'H->D1#0' },
  { kind: 'add_node', id: 'KV', label: 'KV cache' },
  { kind: 'add_node', id: 'Reply', label: 'Reply' },
  { kind: 'add_edge', from: 'H', to: 'KV' },
  { kind: 'add_edge', from: 'KV', to: 'D1', label: 'miss' },
  { kind: 'add_edge', from: 'KV', to: 'Reply', label: 'hit' },
  { kind: 'add_edge', from: 'D1', to: 'Reply' },
];
// The merge request from Lantern's own example (scenes/mr-cache.ts).
const OLD = ['async function getUser(id, env) {', '  return env.DB.prepare(SQL).bind(id).first();', '}'];
const NEW = [
  'async function getUser(id, env) {',
  '  const hit = await env.KV.get(`user:${id}`, "json");',
  '  if (hit) return hit;',
  '  const row = await env.DB.prepare(SQL).bind(id).first();',
  '  await env.KV.put(`user:${id}`, JSON.stringify(row), { expirationTtl: 300 });',
  '  return row;',
  '}',
];
const PATH = {
  hit: [
    ['Request', 'H'],
    ['H', 'KV'],
    ['KV', 'Reply'],
  ],
  miss: [
    ['Request', 'H'],
    ['H', 'KV'],
    ['KV', 'D1'],
    ['D1', 'Reply'],
  ],
} as const;

export default class CacheMRExplainer extends Scene {
  static meta = {
    id: 'mr-cache',
    title: 'Five added lines put a KV cache in front of D1',
    sources: ['https://github.com/ivarvong/lantern/blob/2c7bad5/scenes/mr-cache.ts'],
  };
  static settings = [
    {
      id: 'request',
      label: 'Follow a request',
      default: 'hit',
      options: [
        { value: 'hit', label: 'Cache hit' },
        { value: 'miss', label: 'Cache miss' },
      ],
    },
  ];
  override async construct() {
    const which = settingsOf(this).request as 'hit' | 'miss',
      s = stage(this);

    await this.step('before', {
      title: 'Before: every request reads D1',
      caption:
        'getUser is a single D1 query, so the walked request goes from the handler straight to D1, and every lookup is a database read.',
    });
    const flow = await s.show({ source: BEFORE, style: STYLE }, { box: 'top' });
    const code = await s.code(OLD, { at: 'bottom' });
    await flow.walk(
      [
        ['Request', 'H'],
        ['H', 'D1'],
      ],
      { trail: true },
    );
    await code.focus(1);
    this.state.databaseReads = 'every request';

    await this.step('diff', {
      title: 'The merge request reads KV before D1',
      caption:
        'The five marked lines are the diff: a KV lookup, keyed by the user’s id, now runs before the D1 query. Only a miss reads the database, and it then writes the row to KV with expirationTtl: 300, a five-minute time to live.',
    });
    await flow.clearNotes();
    await flow.unmark();
    await code.morph(NEW, { markAdded: true });

    await this.step('after', {
      title: 'Replayed on the diagram, the diff adds KV and a hit path',
      caption:
        'The same edit, replayed as diagram operations, removes the handler’s edge to D1 and puts a KV cache between them. A hit goes from KV straight to Reply, while a miss falls through to D1 before replying.',
    });
    await code.clearMarks();
    await flow.morph({ source: AFTER, style: STYLE }, { ops: OPS });
    await flow.note('KV', 'TTL 300 s', { side: 'above' });
    this.state.databaseReads = 'misses only';

    await this.step('request', {
      title: which === 'hit' ? 'A cache hit returns from KV with no D1 read' : 'A cache miss reads D1 once, then caches the row',
      caption:
        which === 'hit'
          ? 'The user is already in KV, so getUser returns on line three, the second highlighted line, and the note under D1 shows 0 reads.'
          : 'KV has no entry, so getUser runs the highlighted lines: it reads the row from D1, puts it in KV for 300 seconds and returns it. Lookups for the same user in that window are hits; D1 still serves every miss.',
    });
    const path = PATH[which];
    await flow.clearNotes();
    await flow.dim([...new Set(path.flat())]);
    await flow.walk(path, { trail: true });
    await code.focus(which === 'hit' ? [1, 2] : [3, 5]);
    await flow.note('D1', which === 'hit' ? '0 reads' : '1 read', {
      side: 'below',
    });
    this.state.request = which;
    this.state.reads = which === 'hit' ? 0 : 1;
  }
}
