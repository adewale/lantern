// How git works, told through elixir-ai-tools/exgit (pure-Elixir git).
//
// Four ideas: an object is content named by its hash; a tree names blobs; a
// commit names a tree and its parents; a ref names a commit. Then clone is
// just asking a server for names and the objects behind them.
//
// Every id on screen is computed by scenes/lib/gitmodel.ts the way
// Exgit.Object.compute_sha/2 computes it, and test/fidelity.test.ts checks
// them against the real git CLI. Source read at f7f095f: lib/exgit/object.ex,
// object/{blob,tree,commit}.ex, ref_store/memory.ex, object_store/memory.ex,
// transport/http.ex, pack/stream_parser.ex, repository.ex.
import {
  Scene, Group, Labeled, Rectangle, Text, Code, Arrow, FadeIn, FadeOut, Create, Write, Transform, Indicate,
  LaggedStart, UP, DOWN, LEFT, RIGHT, BLUE, TEAL, GOLD, GREEN, RED, GREY, WHITE, YELLOW, PURPLE, title,
} from '../src/index.ts';
import type { Mobject } from '../src/index.ts';
import { story, parseTree } from './lib/gitmodel.ts';

const short = (id: string) => id.slice(0, 7);
const mono = (s: string, size = 0.24, color = WHITE) => new Text(s, { font: 'mono', fontSize: size, color });
const sans = (s: string, size = 0.26, color = GREY) => new Text(s, { fontSize: size, color });
type Kind = 'blob' | 'tree' | 'commit';
const KIND: Record<Kind, string> = { blob: BLUE, tree: TEAL, commit: GOLD };

/** A node of the object graph: a rounded box with the kind and short id. */
function node(kind: Kind, id: string, label: string) {
  const t = new Group(mono(`${kind} ${short(id)}`, 0.2, WHITE), mono(label, 0.18, GREY)).arrange(DOWN, 0.06);
  const r = new Rectangle({ width: 2.3, height: label ? 0.82 : 0.6, cornerRadius: 0.12, stroke: KIND[kind], strokeWidth: 0.045, fill: KIND[kind], fillOpacity: 0.12 });
  return new Labeled(r, t);
}
const edge = (a: Labeled, b: Labeled, color = GREY) => new Arrow(a.shape.boxPoint(DOWN), b.shape.boxPoint(UP), { stroke: color, strokeWidth: 0.035, buff: 0.08 });

export class ExgitScene extends Scene {
  override async construct() {
    const s = story();
    const repo = s.repo;
    const st: { objects: number; refs: Record<string, string>; head: string | null; phase: string } = { objects: 0, refs: {}, head: null, phase: 'intro' };
    this.state = st;

    // ---- 1. four ideas ---------------------------------------------------------
    await this.step('intro', { caption: 'Git has a reputation for being complicated. Underneath there are only four ideas, and exgit, a git written in Elixir with no git binary, is small enough to see all four. An object is content named by its hash. A tree names files. A commit names a tree and a parent. A ref names a commit.' });
    const t = title('Git from the inside: four ideas, via exgit');
    await this.play(new Write(t), { runTime: 0.9 });
    const ideas = new Group(
      ...([['object', 'content, named by its SHA-1', BLUE], ['tree', 'names → objects: a directory', TEAL], ['commit', 'a tree, its parents, a message', GOLD], ['ref', 'a name for a commit', PURPLE]] as const)
        .map(([k, d, c]) => new Group(new Labeled(new Rectangle({ width: 1.8, height: 0.6, cornerRadius: 0.12, stroke: c, strokeWidth: 0.045, fill: c, fillOpacity: 0.12 }), mono(k, 0.24)), sans(d, 0.22)).arrange(RIGHT, 0.35)),
    ).arrange(DOWN, 0.35, LEFT).moveTo([-0.6, 0.6]);
    await this.play(new LaggedStart(ideas.children.map((g) => new FadeIn(g, { shift: [0, -0.15] })), { lagRatio: 0.25 }), { runTime: 1.6 });
    const store = sans('Exgit.ObjectStore.Memory: objects: %{id => {type, bytes}}   ·   Exgit.RefStore.Memory: refs: %{name => id}', 0.2).moveTo([0, -2.6]);
    await this.play(new FadeIn(store), { runTime: 0.5 });
    await this.wait(0.5);

    // ---- 2. a blob -------------------------------------------------------------------
    await this.step('blob', { caption: 'Idea one. A file\'s content becomes a blob. Git prefixes it with the type and size, hashes those bytes with SHA-1, and that hash is the object\'s name. The same content always gets the same name, anywhere, forever. Here is exgit\'s compute_sha: a header, then the content, into one digest.' });
    await this.play(new FadeOut(ideas), new FadeOut(store), { runTime: 0.4 });
    const file = new Group(mono('hello.txt', 0.22, GREY), mono('"hello\\n"', 0.3)).arrange(DOWN, 0.1).moveTo([-5.6, 1.6]);
    const header = mono('"blob 6\\0" <> "hello\\n"', 0.26, WHITE).moveTo([-1.6, 1.6]);
    const sha = mono(`sha1 → ${short(s.hello)}…`, 0.26, BLUE).moveTo([3.2, 1.6]);
    const a1 = new Arrow(file.right(), header.left(), { stroke: GREY, buff: 0.2 });
    const a2 = new Arrow(header.right(), sha.left(), { stroke: GREY, buff: 0.2 });
    await this.play(new FadeIn(file), { runTime: 0.4 });
    await this.play(new Create(a1), new FadeIn(header), { runTime: 0.6 });
    await this.play(new Create(a2), new Write(sha), { runTime: 0.8 });
    const shaCode = new Code([
      'def compute_sha(type_str, content) do',
      '  :crypto.hash_init(:sha)',
      '  |> :crypto.hash_update([type_str, ?\\s, Integer.to_string(size), 0])',
      '  |> hash_update_iodata(content)',
      '  |> :crypto.hash_final()',
      'end',
    ], { fontSize: 0.22 }).moveTo([-2.6, -0.6]);
    await this.play(new FadeIn(shaCode, { shift: [0, -0.2] }), { runTime: 0.5 });
    // the graph, bottom right, grows from here on
    const B1 = node('blob', s.hello, 'hello.txt').moveTo([5.2, -2.6]);
    await this.play(new FadeIn(B1, { scale: 0.8 }), { runTime: 0.5 });
    st.objects = 1; st.phase = 'blob';
    const full = mono(s.hello, 0.2, GREY).moveTo([-2.6, -2.3]);
    await this.play(new FadeIn(full), { runTime: 0.4 });
    await this.wait(0.6);

    // ---- 3. a tree ----------------------------------------------------------------------
    await this.step('tree', { caption: 'Idea two. A directory is a tree: a list of mode, name and the hash of what is at that name. It is encoded the same way and hashed the same way, so the tree\'s name depends on every file inside it. Change one byte in one file and the tree gets a new name.' });
    await this.play(new FadeOut(new Group(file, header, sha, a1, a2, shaCode, full)), { runTime: 0.4 });
    const entries = parseTree(repo.objects[s.t1]!.bytes);
    const treeCode = new Code([
      '# Exgit.Object.Tree.encode/1: [mode, ?\\s, name, 0, sha]',
      ...entries.map(([m, n, id]) => `${m} ${n}\\0<${short(id)}… 20 raw bytes>`),
      '',
      `"tree ${repo.objects[s.t1]!.bytes.length}\\0" <> entries  →  sha1  →  ${short(s.t1)}…`,
    ], { fontSize: 0.22 }).moveTo([-2.8, 1.2]);
    treeCode.lines[0]!.setFill(GREY); treeCode.lines[3]!.setFill(TEAL);
    await this.play(new FadeIn(treeCode, { shift: [0, -0.2] }), { runTime: 0.6 });
    const T1 = node('tree', s.t1, '1 entry').moveTo([5.2, -0.9]);
    const eT1 = edge(T1, B1);
    await this.play(new FadeIn(T1, { scale: 0.8 }), { runTime: 0.5 });
    await this.play(new Create(eT1), new Indicate(B1.shape, { color: TEAL, scaleFactor: 1.05 }), { runTime: 0.6 });
    st.objects = 2; st.phase = 'tree';
    const dep = sans('a tree\'s name depends on every blob under it', 0.24).moveTo([-2.8, -1.2]);
    await this.play(new FadeIn(dep), { runTime: 0.4 });
    await this.wait(0.6);

    // ---- 4. a commit -------------------------------------------------------------------
    await this.step('commit', { caption: 'Idea three. A commit is text: the tree it snapshots, the parent commit, who and when, and a message. Hashed like everything else. Because the tree hash is inside the commit, and blob hashes are inside the tree, a commit\'s name covers the whole project at that moment. That is what makes history tamper-evident.' });
    await this.play(new FadeOut(treeCode), new FadeOut(dep), { runTime: 0.4 });
    const commitText = repo.text(s.c1).trimEnd().split('\n');
    const commitCode = new Code([...commitText, '', `→ ${short(s.c1)}…`], { fontSize: 0.21 }).moveTo([-2.8, 1.0]);
    commitCode.lines.at(-1)!.setFill(GOLD);
    await this.play(new FadeIn(commitCode, { shift: [0, -0.2] }), { runTime: 0.6 });
    const C1 = node('commit', s.c1, 'add hello').moveTo([5.2, 0.9]);
    const eC1 = edge(C1, T1);
    await this.play(new FadeIn(C1, { scale: 0.8 }), { runTime: 0.5 });
    await this.play(new Create(eC1), new Indicate(T1.shape, { color: GOLD, scaleFactor: 1.05 }), { runTime: 0.6 });
    st.objects = 3; st.phase = 'commit';
    const chain = sans('commit → tree → blobs: one hash covers everything', 0.24).moveTo([-2.8, -1.4]);
    await this.play(new FadeIn(chain), { runTime: 0.4 });
    await this.wait(0.6);

    // ---- 5. a second commit: history, and sharing ---------------------------------------
    await this.step('history', { caption: 'Add a second file and commit again. The new tree has two entries, but hello.txt did not change, so its blob is the same object, named by the same hash: git stores it once. The new commit names its parent, and that parent link is the whole of history. There is no log; there is a chain.' });
    await this.play(new FadeOut(commitCode), new FadeOut(chain), { runTime: 0.4 });
    // make room: shift the graph down-left into two columns
    await this.play(new Group(B1, T1, C1, eT1, eC1).animate.shift([-3.6, -0.4]), { runTime: 0.6 });
    const B2 = node('blob', s.world, 'world.txt').moveTo([5.2, -3.0]);
    const T2 = node('tree', s.t2, '2 entries').moveTo([5.2, -1.3]);
    const C2 = node('commit', s.c2, 'add world').moveTo([5.2, 0.5]);
    const eT2a = edge(T2, B2), eT2b = new Arrow(T2.shape.boxPoint(DOWN), B1.shape.boxPoint(UP), { stroke: TEAL, strokeWidth: 0.035, buff: 0.08 });
    const eC2 = edge(C2, T2);
    const eParent = new Arrow(C2.shape.boxPoint(LEFT), C1.shape.boxPoint(RIGHT), { stroke: GOLD, strokeWidth: 0.04, buff: 0.08 });
    const parentLbl = mono('parent', 0.18, GOLD).nextTo(eParent, UP, 0.06);
    const story2 = new Code(['$ echo world > world.txt', '$ git add world.txt && git commit -m "add world"'], { fontSize: 0.22 }).moveTo([-3.4, 2.0]);
    await this.play(new FadeIn(story2, { shift: [0, -0.2] }), { runTime: 0.5 });
    await this.play(new FadeIn(B2, { scale: 0.8 }), { runTime: 0.4 });
    await this.play(new FadeIn(T2, { scale: 0.8 }), new Create(eT2a), { runTime: 0.5 });
    await this.play(new Create(eT2b), new Indicate(B1.shape, { color: TEAL, scaleFactor: 1.08 }), { runTime: 0.7 });
    const shared = sans('hello.txt: same bytes, same hash, stored once', 0.24, TEAL).moveTo([-3.4, 0.6]);
    await this.play(new FadeIn(shared), { runTime: 0.4 });
    await this.play(new FadeIn(C2, { scale: 0.8 }), new Create(eC2), { runTime: 0.5 });
    await this.play(new Create(eParent), new FadeIn(parentLbl), { runTime: 0.6 });
    st.objects = repo.reachable(s.c2).length; st.phase = 'history';
    const six = sans(`${st.objects} objects in the store: 2 commits, 2 trees, 2 blobs`, 0.24).moveTo([-3.4, -0.4]);
    await this.play(new FadeIn(six), { runTime: 0.4 });
    await this.wait(0.6);

    // ---- 6. refs ---------------------------------------------------------------------------
    await this.step('refs', { caption: 'Idea four. Hashes are not names people can use, so a ref is a name for a commit: refs/heads/main is the branch, and it is just a map entry holding a hash. HEAD is a symbolic ref, a name for a name. Resolving HEAD means following the pointers until you reach a hash. A branch moving is one map entry changing.' });
    await this.play(new FadeOut(new Group(story2, shared, six)), { runTime: 0.4 });
    const refsCode = new Code([
      '%Exgit.RefStore.Memory{refs: %{',
      `  "refs/heads/main" => ${short(s.c2)}…,`,
      '  "HEAD"            => {:symbolic, "refs/heads/main"}',
      '}}',
      '',
      'resolve_ref(store, "HEAD")',
      '  HEAD → refs/heads/main → ' + short(repo.resolve('HEAD')) + '…',
    ], { fontSize: 0.22 }).moveTo([-3.4, 1.0]);
    refsCode.lines[6]!.setFill(PURPLE);
    await this.play(new FadeIn(refsCode, { shift: [0, -0.2] }), { runTime: 0.6 });
    const main = new Labeled(new Rectangle({ width: 1.3, height: 0.5, cornerRadius: 0.1, stroke: PURPLE, strokeWidth: 0.04, fill: PURPLE, fillOpacity: 0.15 }), mono('main', 0.2)).moveTo([5.2, 2.4]);
    const head = new Labeled(new Rectangle({ width: 1.3, height: 0.5, cornerRadius: 0.1, stroke: PURPLE, strokeWidth: 0.04, fill: PURPLE, fillOpacity: 0.15 }), mono('HEAD', 0.2)).moveTo([2.9, 2.4]);
    const eMain = edge(main, C2, PURPLE);
    const eHead = new Arrow(head.shape.boxPoint(RIGHT), main.shape.boxPoint(LEFT), { stroke: PURPLE, strokeWidth: 0.035, buff: 0.08 });
    await this.play(new FadeIn(main), new Create(eMain), { runTime: 0.5 });
    await this.play(new FadeIn(head), new Create(eHead), { runTime: 0.5 });
    st.refs = { 'refs/heads/main': s.c2, HEAD: 'refs/heads/main' }; st.head = repo.resolve('HEAD'); st.phase = 'refs';
    await this.play(new Indicate(head.shape, { color: YELLOW }), { runTime: 0.4 });
    await this.play(new Indicate(main.shape, { color: YELLOW }), { runTime: 0.4 });
    await this.play(new Indicate(C2.shape, { color: YELLOW }), { runTime: 0.4 });
    await this.wait(0.6);

    // ---- 7. clone ----------------------------------------------------------------------------
    await this.step('clone', { caption: 'And clone. Over the smart HTTP protocol, exgit asks the server two things. ls-refs: what names do you have, and which hashes do they point to. Then fetch, with a want for the hash it needs, and the server sends a pack: every object reachable from that commit. Six objects here. The client stores them by hash and copies the names. That is a clone: names, plus the objects behind them.' });
    await this.play(new FadeOut(refsCode), { runTime: 0.4 });
    const proto = new Code([
      'POST /git-upload-pack  (protocol v2)',
      '',
      'command=ls-refs',
      `  ${s.c2} HEAD symref-target:refs/heads/main`,
      `  ${s.c2} refs/heads/main`,
      '',
      'command=fetch',
      `  want ${s.c2}`,
      '  done',
      '',
      `← PACK  version 2  objects ${st.objects}`,
      '  (commits, trees, blobs: everything reachable from the want)',
    ], { fontSize: 0.2 }).moveTo([-3.0, 0.6]);
    proto.lines[0]!.setFill(GREY); proto.lines[11]!.setFill(GREY); proto.lines[10]!.setFill(GREEN);
    await this.play(new FadeIn(proto, { shift: [0, -0.2] }), { runTime: 0.6 });
    const reach = [C2, C1, T2, T1, B2, B1];
    await this.play(new LaggedStart(reach.map((n) => new Indicate(n.shape, { color: GREEN, scaleFactor: 1.06 })), { lagRatio: 0.15 }), { runTime: 1.6 });
    st.phase = 'clone';
    const value = sans('{:ok, %Exgit.Repository{object_store, ref_store, mode: :eager}}: a value, no processes', 0.22).moveTo([-3.0, -2.6]);
    await this.play(new FadeIn(value), { runTime: 0.4 });
    await this.wait(0.8);

    // ---- 8. end ---------------------------------------------------------------------------------
    await this.step('end', { caption: 'That is git. Content named by its hash, trees naming blobs, commits naming trees and parents, refs naming commits. Everything else, branches, merges, rebases, is moving names around in that graph.' });
    await this.play(new FadeOut(proto), new FadeOut(value), { runTime: 0.4 });
    const closing = new Group(
      sans('object · tree · commit · ref', 0.34, WHITE),
      sans('everything else is moving names around this graph', 0.26, GREY),
    ).arrange(DOWN, 0.3).moveTo([-3.0, 0.4]);
    await this.play(new FadeIn(closing, { shift: [0, -0.15] }), { runTime: 0.6 });
    st.phase = 'end';
    await this.wait(2.0);
  }
}
