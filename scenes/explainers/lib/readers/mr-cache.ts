import { Group } from '../../../../src/index.ts';
import { flow, label, tile } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(which: 'hit' | 'miss'): ReaderFrame[] {
  return [
    {
      id: 'reader-request',
      title: 'Does this request need the database?',
      line: `Selected request: cache ${which}.`,
      caption:
        'Without a cache, each request reads the database. A KV cache adds a decision before that read: if the key is present, use the saved value; otherwise fetch it and populate the cache. The outcome to watch is the number of database reads, not just a shorter-looking arrow.',
      values: { request: which, beforeReads: 1, afterReads: which === 'hit' ? 0 : 1 },
      draw: (s) =>
        new Group(
          flow(s, ['Request', 'Database', 'Response']),
          label('Before: one database read', 0, -1.4, s.palette.ink, 0.8),
        ),
    },
    {
      id: 'reader-outcome',
      title: which === 'hit' ? 'The hit skips the database' : 'The miss fills the cache',
      line: `Database reads for this request: ${which === 'hit' ? 0 : 1}.`,
      caption:
        which === 'hit'
          ? 'The key is present. The request reads the cached value and returns it without reading the database. This picture says nothing about whether that saved value is fresh; expiry and invalidation are separate policies.'
          : 'The key is absent. The request reads the database once, writes the result into KV and returns it. A later request may hit, but this miss still pays for the database read. The source diff shows where the branch and write were added.',
      values: { request: which, reads: which === 'hit' ? 0 : 1 },
      draw: (s) =>
        new Group(
          flow(
            s,
            which === 'hit' ? ['Request', 'KV hit', 'Response'] : ['KV miss', 'Database', 'KV write', 'Response'],
          ),
          label(`Database reads: ${which === 'hit' ? 0 : 1}`, 0, -1.4, s.palette.ink, 0.85),
          label(which === 'hit' ? 'Saved value returned' : 'Fetched value saved and returned', 0, -3, s.soft, 0.7),
        ),
    },
  ];
}
