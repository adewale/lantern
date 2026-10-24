import { Scene, Code, FadeIn, FadeOut, Transform } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
const BEFORE = 'graph LR\nRequest[Request] --> H[Handler]\nH --> D1[Database]';
const AFTER =
  'graph LR\nRequest[Request] --> H[Handler]\nH --> KV[Cache]\nKV -->|miss| D1[Database]\nKV -->|hit| Reply[Reply]\nD1 --> Reply';
const OPS = [
  { kind: 'remove_edge', id: 'H->D1#0' },
  { kind: 'add_node', id: 'KV', label: 'Cache' },
  { kind: 'add_node', id: 'Reply', label: 'Reply' },
  { kind: 'add_edge', from: 'H', to: 'KV' },
  { kind: 'add_edge', from: 'KV', to: 'D1', label: 'miss' },
  { kind: 'add_edge', from: 'KV', to: 'Reply', label: 'hit' },
  { kind: 'add_edge', from: 'D1', to: 'Reply' },
];
export default class CacheMRExplainer extends Scene {
  static meta = {
    id: 'mr-cache',
    title: 'A code change becomes an architecture change',
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
    const which = settingsOf(this).request!,
      s = stage(this, { palette: palette('hand-drawn'), title: 'Before: every request reads storage' });
    await this.step('before', {
      title: 'Before: every request reads D1',
      caption:
        'The handler reads the database on every request. Follow the token: there is no earlier place to answer.',
    });
    const d = await s.show({ source: BEFORE, style: 'hand-drawn' }, { box: [-7, -0.5, 7, 2.8] });
    await d.walk([
      ['Request', 'H'],
      ['H', 'D1'],
    ]);
    this.state.databaseReads = 'every request';
    await this.step('diff', {
      title: 'Read the diff',
      caption:
        'Check the cache first. Only a miss reads storage and populates the cache. A time to live bounds how long cached values survive.',
    });
    const before = new Code(['return await DB.get(id);'], { fontSize: 0.28 }).moveTo([0, -2.0]);
    const after = new Code(
      [
        'const hit = await KV.get(id);',
        'if (hit) return hit;',
        'const row = await DB.get(id);',
        'await KV.put(id, row, { ttl: 300 });',
        'return row;',
      ],
      { fontSize: 0.25 },
    ).moveTo([0, -2]);
    after.setFill(s.palette.ink);
    before.setFill(s.palette.ink);
    await this.play(new FadeIn(before));
    await this.play(new Transform(before, after, { replace: true }));
    await this.step('after', {
      title: 'Apply the same edit to the architecture',
      caption:
        'The code and diagram describe one change. Existing identities stay put through the morph; new cache and reply marks arrive.',
    });
    await s.title('After: cache hits avoid a storage read');
    await this.play(new FadeOut(after));
    await d.morph({ source: AFTER, style: 'hand-drawn' }, { ops: OPS });
    this.state.databaseReads = 'misses only';
    await this.step('request', {
      title: which === 'hit' ? 'A cache hit' : 'A cache miss',
      caption:
        which === 'hit'
          ? 'The value is already cached. The request returns without touching the database. Switch cases to follow the longer path.'
          : 'The cache has no value. Read the database and return the result. Caching reduces repeated reads; it does not eliminate storage.',
    });
    await d.walk(
      which === 'hit'
        ? [
            ['Request', 'H'],
            ['H', 'KV'],
            ['KV', 'Reply'],
          ]
        : [
            ['Request', 'H'],
            ['H', 'KV'],
            ['KV', 'D1'],
            ['D1', 'Reply'],
          ],
    );
    this.state.request = which;
    this.state.reads = which === 'hit' ? 0 : 1;
    await s.card(
      [
        ['This request reads D1', this.state.reads],
        ['TTL', '300 seconds'],
      ],
      { at: [0, -2.5] },
    );
  }
}
