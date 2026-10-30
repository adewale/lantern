import { Scene } from '../../../src/index.ts';
import { stage, settingsOf } from '../../../explain/index.ts';
import { run, type Policy } from './model.ts';

const SIZE = 3;
const NEXT = { loop: 'ABCD', reuse: 'CDCD' };

export default class LruMru extends Scene {
  static meta = {
    id: 'lru-mru',
    title: 'What is the difference between LRU and MRU?',
    sources: [
      'https://en.wikipedia.org/w/index.php?title=Cache_replacement_policies&oldid=1376205644',
      'https://www.vldb.org/conf/1985/P127.PDF',
    ],
  };
  static settings = [{ id: 'next', label: 'After A B C D, request', default: 'loop', options: [{ value: 'loop', label: 'A B C D again' }, { value: 'reuse', label: 'C D C D' }] }];

  override async construct() {
    const s = stage(this, { style: 'nord' });
    const next = settingsOf(this).next as keyof typeof NEXT;
    const requests = [...('ABCD' + NEXT[next])];
    const trace = { lru: run('lru', SIZE, requests), mru: run('mru', SIZE, requests) };

    // What each card shows after the first n requests, read from the model's trace.
    const rows = (policy: Policy, n: number) => {
      const done = trace[policy].slice(0, n), hits = done.filter((r) => r.hit).map((r) => r.key);
      return {
        'Cache, newest first': done.at(-1)!.cache.join(' '),
        Evicted: done.flatMap((r) => r.evicted ?? []).join(' ') || 'none',
        Hits: hits.length ? `${hits.length}: ${hits.join(' ')}` : '0',
      };
    };
    const show = async (n: number) => {
      await sent.set({ Requests: requests.slice(0, n).join(' ') });
      await lru.set(rows('lru', n));
      await mru.set(rows('mru', n));
      this.state.lru = rows('lru', n);
      this.state.mru = rows('mru', n);
    };

    await this.step('full', { title: 'Same items, same order', line: 'A, B and C missed and filled all three slots.', caption: 'Both caches have seen the same three requests, so both hold C, B, A from newest to oldest. The next request, D, misses in both and forces each policy to evict one item.' });
    const sent = await s.card([['Requests', 'A B C'], ['Cache size', `${SIZE} items`]], { at: 'top', width: 9 });
    const lru = await s.card(Object.entries(rows('lru', 3)), { at: 'left', title: 'LRU', width: 7 });
    const mru = await s.card(Object.entries(rows('mru', 3)), { at: 'right', title: 'MRU', width: 7 });
    await show(3);

    const [lruOut, mruOut] = [trace.lru[3]!.evicted, trace.mru[3]!.evicted];
    await this.step('evict', { title: 'D evicts opposite ends', line: `LRU drops ${lruOut}, the oldest; MRU drops ${mruOut}, the newest.`, caption: `LRU evicts the item used longest ago, ${lruOut}. MRU evicts the item used most recently, ${mruOut}. Each then records D as its newest item.` });
    await show(4);
    await lru.mark('Evicted');
    await mru.mark('Evicted');

    const lruHits = trace.lru.filter((r) => r.hit).length, mruHits = trace.mru.filter((r) => r.hit).length;
    await this.step('rest', {
      title: `LRU ${lruHits} hits, MRU ${mruHits}`,
      line: next === 'loop' ? 'Each item LRU evicts is the next one the loop asks for.' : 'Each item MRU evicts is the next one requested.',
      caption: next === 'loop'
        ? 'The loop asks for A, B, C and D again. LRU always evicts the item the loop needs next, so all eight requests miss. MRU evicted C to make room for D, so on the second pass A, B and D hit and only C misses.'
        : 'C and D now alternate. LRU still holds both after evicting A, so all four repeats hit. MRU evicts the item requested just before, which is always the next one requested, so all four repeats miss.',
    });
    await show(8);

    await this.step('verdict', {
      title: next === 'loop' ? 'A loop favours MRU' : 'Reuse favours LRU',
      caption: next === 'loop'
        ? `On this loop MRU hits ${mruHits} times and LRU ${lruHits}. Four items do not fit in three slots, which is when Chou and DeWitt recommend MRU for a repeated scan; a file that fits should stay in memory. The counts leave out what tracking recency costs.`
        : `On this pattern LRU hits ${lruHits} times and MRU ${mruHits}, because the items just used are the next ones requested. The counts cover eight requests through three slots and leave out what tracking recency costs.`,
    });
    await lru.mark('Hits');
    await mru.mark('Hits');
  }
}
