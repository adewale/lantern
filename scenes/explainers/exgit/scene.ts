import { Scene, Text, Rectangle, Arrow, Group, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
import { Repo, AUTHOR, parseTree } from '../lib/git.ts';

const STYLE = 'catppuccin-mocha';
const short = (id: string) => id.slice(0, 7);
const DIAGRAM = regionBox('top', { bottom: -0.85 }),
  BOTTOM = regionBox('bottom', { top: -1.1 });
/** "<type> <length>\0", the header Git hashes in front of an object's bytes. */
const objectHeader = (repo: Repo, id: string) => `${repo.objects[id]!.type} ${repo.objects[id]!.bytes.length}\\0`;
/** A tree's entries as stored: mode, name, a zero byte, then the 20-byte id (shown as hex). */
const entryLines = (repo: Repo, id: string, hex: number) =>
  parseTree(repo.objects[id]!.bytes).map(
    ([mode, name, child]) => `${mode} ${name}\\0 ${hex < 40 ? child.slice(0, hex) + '…' : child}`,
  );
/** A tree's bytes as listed on stage: its header, its entries with full ids, then its own id. */
const treeLines = (repo: Repo, id: string) => [`header  ${objectHeader(repo, id)}`, ...entryLines(repo, id, 40), `sha1    ${id}`];
/** A commit's stored text, one line per row. */
const objectLines = (repo: Repo, id: string) => repo.text(id).replace(/\n$/, '').split('\n');
/** How a byte reads in a cell: printable, or its escape. */
const glyph = (b: number) => (b === 0 ? '\\0' : b === 10 ? '\\n' : b === 32 ? 'sp' : String.fromCharCode(b));

export default class GitExplainer extends Scene {
  static meta = {
    id: 'exgit',
    title: 'Git names each object by the hash of its bytes',
    sources: [
      'https://git-scm.com/book/en/v2/Git-Internals-Git-Objects',
      'https://github.com/ivarvong/lantern/blob/2c7bad5/scenes/lib/gitmodel.ts',
    ],
  };
  static settings = [
    {
      id: 'change',
      label: 'The second commit',
      default: 'add',
      options: [
        { value: 'add', label: 'Add world.txt' },
        { value: 'edit', label: 'Edit hello.txt' },
      ],
    },
  ];
  override async construct() {
    const which = settingsOf(this).change,
      add = which === 'add',
      repo = new Repo(),
      s = stage(this, { style: STYLE }),
      ink = s.palette.ink,
      accent = s.emphasis;

    // ── blob: the bytes that are hashed ────────────────────────────────
    await this.step('blob', {
      title: 'A blob id is the SHA-1 of typed bytes',
      caption:
        'Git hashes a header (the type, the byte length and a zero byte) followed by the content. The id is the SHA-1 of exactly these 13 bytes, and later pictures name it by its first seven digits.',
    });
    const hello = repo.blob('hello\n');
    this.state.hello = hello;
    const object = repo.objects[hello]!,
      header = new TextEncoder().encode(`${object.type} ${object.bytes.length}\0`),
      all = [...header, ...object.bytes];
    const cell = 0.98,
      gap = 0.1,
      x0 = -((all.length - 1) * (cell + gap)) / 2,
      cellY = 0.5;
    const cells = all.map((b, i) => {
      const isHead = i < header.length;
      const box = new Rectangle({
        width: cell,
        height: 0.9,
        cornerRadius: 0.08,
        fill: isHead ? accent : ink,
        fillOpacity: 0.1,
        stroke: isHead ? accent : s.soft,
        strokeWidth: 0.02,
      });
      const ch = new Text(glyph(b), { fontSize: 0.36, font: 'mono', color: isHead ? accent : ink });
      const hex = new Text(b.toString(16).padStart(2, '0'), { fontSize: 0.22, font: 'mono', color: s.soft });
      const x = x0 + i * (cell + gap);
      box.moveTo([x, cellY]);
      ch.moveTo([x, cellY]);
      hex.moveTo([x, cellY - 0.72]);
      return new Group(box, ch, hex);
    });
    const headCells = new Group(...cells.slice(0, header.length)),
      bodyCells = new Group(...cells.slice(header.length));
    const span = (g: Group, text: string, color: string) => {
      const [a, , b] = g.box()!;
      const t = new Text(text, { fontSize: 0.26, color });
      t.moveTo([(a + b) / 2, cellY + 0.85]);
      const rule = new Rectangle({ width: b - a, height: 0.03, fill: color, stroke: 'none' }).moveTo([
        (a + b) / 2,
        cellY + 0.58,
      ]);
      return new Group(t, rule);
    };
    const bodyLabel = span(bodyCells, 'content', ink),
      headLabel = span(headCells, 'header', accent);
    await s.enter(bodyCells, bodyLabel, {
      runTime: 0.5,
      describe: `The content bytes ${JSON.stringify(new TextDecoder().decode(object.bytes))}, one cell each with its hex value`,
    });
    await s.enter(headCells, headLabel, {
      runTime: 0.6,
      shift: [0.6, 0],
      describe: `The header bytes “${object.type} ${object.bytes.length}” and a zero byte, in front of the content`,
    });
    const arrow = new Arrow([0, cellY - 1.1], [0, cellY - 2.05], { stroke: s.soft, strokeWidth: 0.03, tipLength: 0.2 });
    const how = new Text('SHA-1', { fontSize: 0.24, color: s.soft, anchor: 'start' }).moveTo([0.3, cellY - 1.57], [-1, 0]);
    const idHead = new Text(short(hello), { fontSize: 0.42, font: 'mono', color: accent, weight: 'bold' }),
      idTail = new Text(hello.slice(7), { fontSize: 0.42, font: 'mono', color: ink });
    const idRow = new Group(idHead, idTail);
    idTail.nextTo(idHead, [1, 0], 0.02);
    idRow.moveTo([0, cellY - 2.65]);
    await s.enter(arrow, how, { runTime: 0.4, describe: 'An arrow labelled SHA-1 from the bytes to their id' });
    await s.enter(idRow, { runTime: 0.6, describe: `The blob id ${hello}, its first seven digits highlighted` });

    // ── tree: names live in the tree ────────────────────────────────────
    await this.step('tree', {
      title: 'A tree gives those bytes a name',
      caption:
        'A tree entry stores a mode, the name hello.txt and the blob’s id. Hashing the tree’s own bytes gives it an id too. The name lives in the tree, never in the blob.',
    });
    await s.clear();
    const t1 = repo.tree([['100644', 'hello.txt', hello]]);
    const B1 = `Hello["blob<br/>${short(hello)}"]`;
    const T1 = `T1["tree ${short(t1)}<br/>hello.txt"]`;
    const TREE = `graph LR\n${T1}\n${B1}\nT1 --> Hello`;
    const d = await s.show({ source: TREE }, { box: DIAGRAM });
    const treeCode = await s.code(treeLines(repo, t1), { at: BOTTOM });
    await treeCode.focus(1);

    // ── commit: a commit names a tree; a branch names a commit ─────────
    await this.step('commit', {
      title: 'A commit names a tree; a branch names a commit',
      caption:
        'The commit’s first line is its tree’s id. The branch main is just a reference holding the commit’s id. Follow main to the commit, its tree and the file bytes.',
    });
    const c1 = repo.commit({ tree: t1, author: AUTHOR, message: 'first\n' });
    repo.refs['refs/heads/main'] = c1;
    const C1 = `C1["commit<br/>${short(c1)}"]`;
    const COMMIT = `graph LR\nMain([main])\n${C1}\n${T1}\n${B1}\nMain --> C1\nC1 --> T1\nT1 --> Hello`;
    const commitCode = await s.code(objectLines(repo, c1), { at: BOTTOM, enter: false });
    await this.play(new FadeOut(treeCode), new FadeIn(commitCode));
    await d.morph({ source: COMMIT });
    await d.walk(
      [
        ['Main', 'C1'],
        ['C1', 'T1'],
        ['T1', 'Hello'],
      ],
      { trail: true },
    );
    await commitCode.focus(0);
    this.state = { hello, t1, c1, head: repo.resolve('refs/heads/main') };

    // ── change: a second commit writes only what is new ────────────────
    await this.step('change', {
      title: add ? 'Add a file: the old blob is reused' : 'Edit a file: new blob, new tree, new commit',
      caption: add
        ? 'Tree two keeps tree one’s hello.txt entry byte for byte and adds world.txt. The marked lines changed: the header’s byte length, the new entry and the tree’s own id. The world.txt blob, tree two and commit two are new objects, and main still points at commit one.'
        : 'New bytes hash to a new blob id. Tree two’s entry holds that id, so the tree’s own id changes too (the marked lines), and so does the commit’s. Commit one and its objects are untouched.',
    });
    const nextBlob = repo.blob(add ? 'world\n' : 'hello again\n');
    const t2 = repo.tree(
      add
        ? [
            ['100644', 'hello.txt', hello],
            ['100644', 'world.txt', nextBlob],
          ]
        : [['100644', 'hello.txt', nextBlob]],
    );
    const c2 = repo.commit({ tree: t2, parents: [c1], author: AUTHOR, message: 'second\n' });
    const B2 = `New["blob<br/>${short(nextBlob)}"]`,
      T2 = `T2["tree ${short(t2)}<br/>${add ? 'hello.txt, world.txt' : 'hello.txt'}"]`,
      C2 = `C2["commit<br/>${short(c2)}"]`;
    const objects =
      `${C2}\n${C1}\n${T2}\n${T1}\n${B2}\n${B1}\n` +
      `C1 --> T1\nT1 --> Hello\nC2 --> C1\nC2 --> T2\n` +
      (add ? `T2 --> Hello\nT2 --> New` : `T2 --> New`);
    const CHANGE = `graph LR\nMain([main])\n${objects}\nMain --> C1`;
    await s.clearOverlays();
    await d.morph({ source: CHANGE });
    await d.note('edge:C2->C1#0', 'parent', { side: 'below' });
    // Tree one's bytes, as in the tree step, turn into tree two's: a line that
    // survives is unchanged, and a marked line changed.
    const treeDiff = await s.code(treeLines(repo, t1), { at: BOTTOM });
    await treeDiff.morph(treeLines(repo, t2), { markAdded: true });
    if (add) {
      await d.mark(['Hello', 'edge:T1->Hello#0', 'edge:T2->Hello#0']);
      await d.note('Hello', 'one blob, two trees', { side: 'above' });
    } else {
      await d.mark(['C2', 'T2', 'New']);
      await d.note('New', 'new bytes, new id', { side: 'below' });
    }

    // ── head: the branch moves; HEAD follows it ─────────────────────────
    await this.step('head', {
      title: 'Moving main to commit two changes one reference',
      caption:
        'HEAD names refs/heads/main, and moving the branch rewrote the id main holds from commit one to commit two. No object was copied, and commit one stays reachable through commit two’s parent link.',
    });
    await s.clearOverlays();
    const refs = await s.card(
      [
        ['HEAD', 'ref: refs/heads/main'],
        ['refs/heads/main', c1],
      ],
      { at: BOTTOM, width: 10 },
    );
    repo.refs['refs/heads/main'] = c2;
    repo.refs.HEAD = { symbolic: 'refs/heads/main' };
    this.state.head = repo.resolve('HEAD');
    const HEADS = `graph LR\nHEAD([HEAD])\nMain([main])\n${objects}\nHEAD --> Main\nMain --> C2`;
    await d.morph({ source: HEADS });
    await refs.set({ 'refs/heads/main': c2 });
    await refs.mark('refs/heads/main');
    await d.walk(
      [
        ['HEAD', 'Main'],
        ['Main', 'C2'],
        ['C2', 'T2'],
        ['T2', 'New'],
      ],
      { trail: true },
    );
    await d.note('edge:C2->C1#0', 'parent', { side: 'below' });

    // ── hashes: every id covers the ids beneath it ──────────────────────
    await this.step('hashes', {
      title: 'Commit two’s id depends on every object it reaches',
      caption:
        'Commit two’s bytes contain its tree’s id and its parent’s id, so its own id depends on everything it reaches. These ids came from the model, and a test checks each one against git hash-object.',
    });
    await s.clearOverlays();
    const body = await s.code(objectLines(repo, c2), { at: BOTTOM });
    await d.unmark();
    await d.mark(['C2', 'T2', 'C1', 'edge:C2->T2#0', 'edge:C2->C1#0']);
    await d.note('edge:C2->C1#0', 'parent', { side: 'below' });
    await body.focus([0, 1]);
    this.state = { hello, t1, c1, nextBlob, t2, c2, shared: add, head: this.state.head };
  }
}
