import { Scene, Code, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { exec } from '../lib/models.ts';
export default class BashExplainer extends Scene {
  static meta = {
    id: 'just-bash',
    title: 'A shell can be a value, not a process',
    sources: [
      'https://github.com/elixir-ai-tools/just_bash',
      'https://github.com/ivarvong/lantern/blob/2c7bad5/scenes/just-bash.ts',
    ],
  };
  static settings = [
    {
      id: 'shell',
      label: 'Run cat against',
      default: 'new',
      options: [
        { value: 'new', label: 'The returned shell' },
        { value: 'old', label: 'The original shell' },
      ],
    },
  ];
  override async construct() {
    const which = settingsOf(this).shell,
      s = stage(this, { palette: palette('chalkboard'), title: 'echo hello | tr a-z A-Z > shout.txt' });
    await this.step('command', {
      title: 'One command, no operating-system processes',
      caption:
        'This small executable model follows the original JustBash example: a pipeline transforms strings and a redirect writes an in-memory filesystem. It models three builtins, not the whole shell language.',
    });
    const code = new Code(['echo hello | tr a-z A-Z > shout.txt'], { fontSize: 0.42 }).moveTo([0, 0]);
    code.setFill(s.palette.ink);
    await this.play(new FadeIn(code));
    await this.step('parse', {
      title: 'The pipeline has structure',
      caption:
        'A script contains a pipeline. Its two commands are echo and tr; the redirect records where the final output goes. Parsing and execution are separate responsibilities.',
    });
    await this.play(new FadeOut(code));
    const ast = await s.show({
      source:
        'graph TD\nScript[Script] --> Pipeline[Pipeline]\nPipeline --> Echo[echo hello]\nPipeline --> Tr[tr a-z A-Z]\nTr --> Redirect[shout.txt]',
      style: 'chalkboard',
    });
    await this.step('reduce', {
      title: 'Pass stdout to the next builtin',
      caption:
        'Echo produces hello and a newline. Tr receives that string as stdin and returns uppercase text. A pipeline is a reduction over values, not a set of kernel pipes in this model.',
    });
    await ast.hide();
    const flow = await s.show({
      source:
        'graph LR\nInput[Empty stdin] --> Echo[echo hello]\nEcho --> Tr[tr a-z A-Z]\nTr --> Output[HELLO]',
      style: 'chalkboard',
    });
    await flow.walk([
      ['Input', 'Echo'],
      ['Echo', 'Tr'],
      ['Tr', 'Output'],
    ]);
    const old = { fs: {}, steps: 0 },
      run = exec(
        old,
        [
          ['echo', 'hello'],
          ['tr', 'a-z', 'A-Z'],
        ],
        'shout.txt',
      );
    this.state = { oldShell: old, newShell: run.shell, stdout: run.stdout };
    await this.step('redirect', {
      title: 'Redirection changes the returned value',
      caption:
        'The redirect stores HELLO in shout.txt and consumes stdout. Exec returns a new shell. The original shell’s filesystem remains empty.',
    });
    await flow.hide();
    await s.card(
      [
        ['Original files', Object.keys(old.fs).length],
        ['Returned files', Object.keys(run.shell.fs).length],
        ['Returned stdout', JSON.stringify(run.stdout)],
        ['Stored text', JSON.stringify(run.shell.fs['shout.txt'])],
      ],
      { at: [0, 0], width: 8 },
    );
    await this.step('lookup', {
      title: 'Command lookup is a policy',
      caption:
        'The full interpreter chooses a builtin or another supported command implementation. This diagram separates lookup from execution; our model deliberately admits only echo, tr and cat.',
    });
    await s.clearOverlays();
    const lookup = await s.show({
      source:
        'graph LR\nName[Command name] --> Builtin{Known builtin}\nBuiltin -->|yes| Run[Run on values]\nBuiltin -->|no| Error[Unsupported here]',
      style: 'chalkboard',
    });
    await lookup.walk([
      ['Name', 'Builtin'],
      ['Builtin', 'Run'],
    ]);
    await this.step('cat', {
      title: which === 'new' ? 'Read from the new shell' : 'Read from the old shell',
      caption:
        which === 'new'
          ? 'Cat receives the returned shell and finds shout.txt. The result is HELLO and a newline. The write became visible by passing the new value forward.'
          : 'Cat receives the original shell, which has no shout.txt. This model returns empty text for a missing file. Exec did not mutate its input behind the caller’s back.',
    });
    await lookup.hide();
    const result = exec(which === 'new' ? run.shell : old, [['cat', 'shout.txt']]);
    this.state.cat = result.stdout;
    await s.card(
      [
        ['Selected shell', which],
        ['cat stdout', JSON.stringify(result.stdout)],
      ],
      { at: [0, 0], width: 8 },
    );
    await this.step('lesson', {
      title: 'State travels explicitly',
      caption:
        'The returned shell is the continuation of the computation. Keeping the old value means keeping the old filesystem. That is the important difference between an immutable shell model and a global process environment.',
    });
    await s.chip('exec(old, command) → result + new');
  }
}
