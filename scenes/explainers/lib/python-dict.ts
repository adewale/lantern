// CPython v3.12.14, Objects/dictobject.c: do_lookup(), insertdict(), delitem_common().
// This lesson fixes capacity at eight and uses three small integer keys. It
// models the compact combined table; resizing and split instance dicts are out of scope.
export const EMPTY = -1, DELETED = -2;
export interface DictEntry {key: number | null; value: string | null}
export interface DictTable {indices: number[]; entries: DictEntry[]}
export interface DictLookup {key: number; slots: number[]; found: boolean; value: string | null; stopped: 'key' | 'unused'}
export function probeSlots(key: number): number[] {
  if (!Number.isSafeInteger(key) || key < 0 || key > 0x7fffffff) throw new Error('Dictionary lesson keys must be nonnegative 31-bit integers');
  let slot = key & 7, perturb = key;
  const slots = [];
  // Once perturb reaches zero, the recurrence visits every slot in eight steps.
  for (let i = 0; i < 15; i++) {slots.push(slot); perturb >>>= 5; slot = (5 * slot + perturb + 1) & 7;}
  return slots;
}
export function lookup(table: DictTable, key: number): DictLookup {
  const slots: number[] = [];
  for (const slot of probeSlots(key)) {
    slots.push(slot);
    const index = table.indices[slot]!;
    if (index === EMPTY) return {key, slots, found: false, value: null, stopped: 'unused'};
    if (index >= 0 && table.entries[index]!.key === key)
      return {key, slots, found: true, value: table.entries[index]!.value, stopped: 'key'};
  }
  throw new Error('The eight-slot dictionary lesson needs an unused slot');
}
export function dictionary(): DictTable {
  const table: DictTable = {indices: Array(8).fill(EMPTY), entries: []};
  for (const [key, value] of [[0, 'apple'], [8, 'pear'], [16, 'plum']] as const) {
    const slot = probeSlots(key).find(s => table.indices[s] === EMPTY)!;
    table.indices[slot] = table.entries.length;
    table.entries.push({key, value});
  }
  return table;
}
export function deleteFirst(policy: 'marker' | 'clear'): DictTable {
  const table = dictionary();
  table.indices[0] = policy === 'marker' ? DELETED : EMPTY;
  table.entries[0] = {key: null, value: null};
  return table;
}
export function dictStory(key: number) {
  const original = dictionary(), wrong = deleteFirst('clear'), correct = deleteFirst('marker');
  return {
    original, wrong, correct,
    before: lookup(original, key), broken: lookup(wrong, key), repaired: lookup(correct, key), missing: lookup(correct, 24),
    starts: [0, 8, 16].map(key => ({key, hash: key, slot: key & 7})),
  };
}
