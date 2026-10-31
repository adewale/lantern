// Insert-only Bloom filter. Three seeded FNV-1a hashes are a small teaching
// implementation, not a reproduction of Jason Davies's double-hash implementation.
export function fnv1a(text: string): number {
  let h = 2166136261;
  for (const byte of new TextEncoder().encode(text)) h = Math.imul(h ^ byte, 16777619) >>> 0;
  return h;
}
export function locations(word: string, size: number): number[] {
  if (!Number.isInteger(size) || size < 8 || size > 512) throw new Error('Filter size must be 8 to 512 bits');
  return [0, 1, 2].map(seed => fnv1a(`${seed}:${word}`) % size);
}
export function makeFilter(words: readonly string[], size: number): number[] {
  locations('', size);
  const bits = Array<number>(size).fill(0);
  for (const word of words) for (const i of locations(word, size)) bits[i] = 1;
  return bits;
}
export function membership(bits: readonly number[], word: string): boolean {
  return locations(word, bits.length).every(i => bits[i] === 1);
}
export function bloomStory(size: 16 | 32) {
  const words = ['cat', 'dog'], first = makeFilter(words.slice(0, 1), size), bits = makeFilter(words, size);
  const candidates = ['owl', 'fox', 'yak', 'eel', ...Array.from({length: 10000}, (_, i) => `word${i}`)];
  const absent = candidates.find(word => !words.includes(word) && !membership(bits, word));
  const falsePositive = candidates.find(word => !words.includes(word) && membership(bits, word));
  if (!absent || !falsePositive) throw new Error('Could not construct the Bloom lesson counterexamples');
  const queries = [absent, words[0]!, falsePositive].map(word => ({
    word, locations: locations(word, size), maybe: membership(bits, word), stored: words.includes(word),
  }));
  const sample = Array.from({length: 100}, (_, i) => `sample${i}`);
  return {size, words, first, bits, queries, exactLookups: queries.filter(q => q.maybe).length,
    sampleSize: sample.length, sampleFalsePositives: sample.filter(word => membership(bits, word)).length};
}
