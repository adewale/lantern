// A controlled JavaScript promise run, not a network benchmark. Search A is
// started first; search B is the latest intent. We choose the completion order
// by resolving their promises explicitly, without sleeps or invented latency.
export type Query = 'A' | 'B';
export type CompletionOrder = 'new-first' | 'old-first';

export interface SearchSnapshot {
  event: string;
  active: Query;
  shown: Query | null;
  completed: Query[];
  writes: Query[];
}

/** The same ticket check that the scene displays in its code panel. */
export function createSearch(guarded: boolean, publish: (result: Query) => void) {
  let latest = 0;
  return (job: Promise<Query>) => {
    const ticket = ++latest;
    return job.then(result => {
      if (!guarded || ticket === latest) publish(result);
    });
  };
}

// Compact excerpt of createSearch for the picture; the test exercises the
// exported function with real, controlled promises rather than trusting text.
export const SEARCH_CODE = [
  'let latest = 0',
  'function search(job) {',
  '  const ticket = ++latest',
  '  return job.then(result => {',
  '    if (!guarded || ticket === latest)',
  '      publish(result)',
  '  })',
  '}',
];

export async function runSearch(guarded: boolean, order: CompletionOrder): Promise<{ snapshots: SearchSnapshot[] }> {
  const pending = () => {
    let resolve!: (result: Query) => void;
    const promise = new Promise<Query>(done => { resolve = done; });
    return { promise, resolve };
  };
  const a = pending(), b = pending();
  const writes: Query[] = [], completed: Query[] = [];
  let shown: Query | null = null;
  const start = createSearch(guarded, result => { shown = result; writes.push(result); });
  const waitA = start(a.promise), waitB = start(b.promise);
  const snapshot = (event: string): SearchSnapshot => ({
    event, active: 'B', shown, completed: [...completed], writes: [...writes],
  });
  const snapshots = [snapshot('Both started: A then B')];
  for (const id of (order === 'new-first' ? ['B', 'A'] : ['A', 'B']) as Query[]) {
    if (id === 'A') { a.resolve('A'); await waitA; }
    else { b.resolve('B'); await waitB; }
    completed.push(id);
    snapshots.push(snapshot(`${id} completed`));
  }
  return { snapshots };
}
