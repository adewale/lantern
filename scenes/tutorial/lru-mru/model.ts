export type Policy = 'lru' | 'mru';

export interface Request {
  key: string;
  hit: boolean;
  /** The item this request pushed out, if the cache was full and the key missed. */
  evicted?: string;
  /** What the cache holds after this request, most recently used first. */
  cache: string[];
}

/** Send each request to a cache that holds `size` items and replaces them by `policy`. */
export function run(policy: Policy, size: number, requests: string[]): Request[] {
  let cache: string[] = [];
  return requests.map((key) => {
    const hit = cache.includes(key);
    let evicted: string | undefined;
    if (!hit && cache.length === size) evicted = policy === 'lru' ? cache.at(-1) : cache[0];
    cache = [key, ...cache.filter((k) => k !== key && k !== evicted)];
    return { key, hit, evicted, cache };
  });
}
