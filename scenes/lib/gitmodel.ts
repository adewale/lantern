// A git repository as exgit models it: an object store (a map from id to
// bytes) and a ref store (a map from name to id or symbolic target). The
// encodings are exgit's (Exgit.Object.{Blob,Tree,Commit}.encode/1) and the
// ids are what compute_sha/2 gives: sha1("<type> <size>\0" + content).
// test/fidelity.test.ts rebuilds the same repository with the real git CLI
// and requires identical ids.
import { objectId, bytes, unhex } from './sha1.ts';

const dec = new TextDecoder();

/** A tree entry: [mode, name, idHex]. */
export type TreeEntry = [mode: string, name: string, id: string];
export interface GitObject { type: string; bytes: Uint8Array }

export class Repo {
  objects: Record<string, GitObject>;
  refs: Record<string, string | { symbolic: string }>;

  constructor() {
    this.objects = {};
    this.refs = {};
  }
  put(type: string, content: Uint8Array | string): string {
    const body = typeof content === 'string' ? bytes(content) : content;
    const id = objectId(type, body);
    this.objects[id] = { type, bytes: body };
    return id;
  }
  blob(data: Uint8Array | string): string { return this.put('blob', data); }
  /** entries: [[mode, name, idHex], ...] in the order git sorts them (by name). */
  tree(entries: readonly TreeEntry[]): string {
    const sorted = [...entries].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return this.put('tree', bytes(...sorted.flatMap(([mode, name, id]) => [`${mode} ${name}\0`, unhex(id)])));
  }
  commit({ tree, parents = [], author, message }: { tree: string; parents?: string[]; author: string; message: string }): string {
    const headers: Array<[string, string]> = [['tree', tree], ...parents.map((p): [string, string] => ['parent', p]), ['author', author], ['committer', author]];
    return this.put('commit', headers.map(([k, v]) => `${k} ${v}\n`).join('') + '\n' + message);
  }
  /** Exgit.RefStore.Memory.resolve_ref/2: follow symbolic refs to an id. */
  resolve(ref: string, depth = 10): string {
    const v = this.refs[ref];
    if (v == null) throw new Error(`not found: ${ref}`);
    if (typeof v === 'string') return v;
    if (depth <= 0) throw new Error('too deep');
    return this.resolve(v.symbolic, depth - 1);
  }
  /** The object's content as text (for showing commits and trees). */
  text(id: string): string { return dec.decode(this.objects[id]!.bytes); }
  /** Every object reachable from a commit: what a clone has to fetch. */
  reachable(commitId: string): string[] {
    const seen = new Set<string>();
    const walk = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);
      const o = this.objects[id]!;
      if (o.type === 'commit') {
        for (const line of this.text(id).split('\n')) {
          const [k, v] = line.split(' ');
          if (k === 'tree' || k === 'parent') walk(v!);
          if (line === '') break;
        }
      } else if (o.type === 'tree') {
        for (const [, , id] of parseTree(o.bytes)) walk(id);
      }
    };
    walk(commitId);
    return [...seen];
  }
}

/** The entries of an encoded tree: [[mode, name, idHex], ...]. */
export function parseTree(b: Uint8Array): TreeEntry[] {
  const out: TreeEntry[] = [];
  let i = 0;
  while (i < b.length) {
    const sp = b.indexOf(0x20, i), nul = b.indexOf(0, sp);
    const mode = dec.decode(b.subarray(i, sp)), name = dec.decode(b.subarray(sp + 1, nul));
    const id = [...b.subarray(nul + 1, nul + 21)].map((x) => x.toString(16).padStart(2, '0')).join('');
    out.push([mode, name, id]);
    i = nul + 21;
  }
  return out;
}

export const AUTHOR = 'Ada <ada@example.com> 1700000000 +0000';

/** The story the explainer tells: two commits, one file kept, one added. */
export function story() {
  const repo = new Repo();
  const hello = repo.blob('hello\n');
  const t1 = repo.tree([['100644', 'hello.txt', hello]]);
  const c1 = repo.commit({ tree: t1, author: AUTHOR, message: 'add hello\n' });
  const world = repo.blob('world\n');
  const t2 = repo.tree([['100644', 'hello.txt', hello], ['100644', 'world.txt', world]]);
  const c2 = repo.commit({ tree: t2, parents: [c1], author: AUTHOR, message: 'add world\n' });
  repo.refs['refs/heads/main'] = c2;
  repo.refs['HEAD'] = { symbolic: 'refs/heads/main' };
  return { repo, hello, world, t1, t2, c1, c2 };
}
