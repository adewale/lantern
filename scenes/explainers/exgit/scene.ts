import { Scene, Code, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { Repo, AUTHOR } from '../../lib/gitmodel.ts';
export default class GitExplainer extends Scene {
  static meta = {
    id: 'exgit',
    title: 'Git shares bytes, not filenames',
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
      repo = new Repo(),
      s = stage(this, {
        palette: palette('catppuccin-mocha'),
        title: 'An object id is a hash of typed bytes',
      });
    await this.step('blob', {
      title: 'Start with a blob',
      caption:
        'A blob stores bytes, not a filename. Its id hashes the object type, byte length, a zero byte and the content. The ids here are computed by the same encoding Git uses.',
    });
    const hello = repo.blob('hello\n');
    this.state.hello = hello;
    const code = new Code(['content: "hello\\n"', 'header:  "blob 6\\0"', `sha1:    ${hello}`], {
      fontSize: 0.25,
    }).moveTo([0, 0]);
    code.setFill(s.palette.ink);
    await this.play(new FadeIn(code));
    await this.step('tree', {
      title: 'A tree gives bytes a name',
      caption:
        'The tree associates hello.txt with the blob id and file mode. A commit names that tree. Three different objects now describe one snapshot.',
    });
    await this.play(new FadeOut(code));
    const t1 = repo.tree([['100644', 'hello.txt', hello]]),
      c1 = repo.commit({ tree: t1, author: AUTHOR, message: 'first\n' });
    const first = `graph LR\nC1[Commit one] --> T1[Tree one]\nT1 --> Hello[hello.txt blob]`;
    const d = await s.show({ source: first, style: 'catppuccin-mocha' });
    this.state = { hello, t1, c1 };
    await this.step('commit', {
      title: 'Commit points to a complete snapshot',
      caption:
        'Reading a commit leads to a tree, then to the file bytes. The branch name is only a movable reference to a commit, not a directory containing those objects.',
    });
    await d.walk([
      ['C1', 'T1'],
      ['T1', 'Hello'],
    ]);
    await this.step('change', {
      title: which === 'add' ? 'Add a file; reuse the old blob' : 'Edit a file; make a new blob',
      caption:
        which === 'add'
          ? 'Adding world.txt makes a new tree and commit. The unchanged hello.txt still names exactly the same blob. Content addressing makes reuse automatic.'
          : 'Changing hello.txt changes its blob id. The tree that names that blob also changes, and so does the commit above it. The old history remains addressable.',
    });
    const nextBlob = repo.blob(which === 'add' ? 'world\n' : 'hello again\n');
    const t2 = repo.tree(
      which === 'add'
        ? [
            ['100644', 'hello.txt', hello],
            ['100644', 'world.txt', nextBlob],
          ]
        : [['100644', 'hello.txt', nextBlob]],
    );
    const c2 = repo.commit({ tree: t2, parents: [c1], author: AUTHOR, message: 'second\n' });
    const next =
      first +
      `\nC2[Commit two] --> T2[Tree two]\nC2 --> C1\nT2 --> New[${which === 'add' ? 'world.txt' : 'edited hello.txt'} blob]` +
      (which === 'add' ? '\nT2 --> Hello' : '');
    await d.morph({ source: next, style: 'catppuccin-mocha' });
    this.state = { hello, t1, c1, nextBlob, t2, c2, shared: which === 'add' };
    await this.step('head', {
      title: 'A branch selects the latest commit',
      caption:
        'HEAD resolves through the branch reference to commit two. A checkout follows that commit’s tree. The parent link preserves the first snapshot regardless of what changed.',
    });
    repo.refs['refs/heads/main'] = c2;
    repo.refs.HEAD = { symbolic: 'refs/heads/main' };
    this.state.head = repo.resolve('HEAD');
    await d.walk([
      ['C2', 'T2'],
      ['T2', 'New'],
    ]);
    await this.step('hashes', {
      title: 'Inspect the actual object ids',
      caption:
        'These are not decorative hashes. The executable model produced every id. An independent test checks the same objects against the Git command line.',
    });
    await d.hide();
    await s.card(
      [
        ['First blob', hello.slice(0, 18)],
        ['New blob', nextBlob.slice(0, 18)],
        ['First tree', t1.slice(0, 18)],
        ['Next tree', t2.slice(0, 18)],
        ['HEAD', String(this.state.head).slice(0, 18)],
      ],
      { at: [0, 0], width: 9 },
    );
  }
}
