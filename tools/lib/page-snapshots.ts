import type {SnapshotStore} from '../../integrations/agentic-mermaid/snapshot.ts';

/** The renderer admits path coordinates through Float32Array. Keep a short
 * decimal that reproduces that exact value, without rounding layout/text metadata.
 * Checked-in snapshots and their hashes remain untouched.
 */
export function pageSnapshots(store: SnapshotStore): SnapshotStore {
  const copy = structuredClone(store);
  const cache = new Map<number, number>();
  const point = (value: number) => {
    const cached = cache.get(value);
    if (cached !== undefined) return cached;
    // JSON normalizes literal -0 to +0. Negative nonzero doubles can underflow
    // to float32 -0; retain a nonzero negative decimal for that distinct case.
    const target = Math.fround(value === 0 ? 0 : value);
    if (Object.is(target, -0)) { cache.set(value, -1e-46); return -1e-46; }
    for (let digits = 1; digits <= 9; digits++) {
      const candidate = Number(target.toPrecision(digits));
      if (Object.is(Math.fround(candidate), target)) { cache.set(value, candidate); return candidate; }
    }
    return target;
  };
  for (const snapshot of Object.values(copy)) for (const part of snapshot.parts) for (const shape of part.shapes)
    shape.subpaths = shape.subpaths.map(path => path.map(point));
  return copy;
}
