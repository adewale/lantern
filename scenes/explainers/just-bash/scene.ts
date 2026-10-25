import { Scene, Text, Group, Rectangle, FadeIn, Transform } from '../../../src/index.ts';
import type { Box } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { exec } from '../lib/models.ts';
import type { Shell } from '../lib/models.ts';

const STYLE = 'chalkboard';
const PIPELINE = [
  ['echo', 'hello'],
  ['tr', 'a-z', 'A-Z'],
] as const;
const FILE = 'shout.txt';
const q = (v: string) => JSON.stringify(v);
const files = (sh: Shell) => Object.keys(sh.fs).join(', ') || 'none';
/** Ask the model whether it can run a command name. Pure: no animation inside the catch. */
function lookup(name: string): 'builtin' | 'unsupported' {
  try {
    exec({ fs: {}, steps: 0 }, [[name]]);
    return 'builtin';
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unknown model command')) return 'unsupported';
    throw error;
  }
}
const TOP: Box = [-7.55, -0.2, 7.55, 3.25],
  BOTTOM: Box = [-7.55, -4.25, 7.55, -0.5],
  BOTTOM_LEFT: Box = [-7.55, -4.25, -0.15, -0.5],
  BOTTOM_RIGHT: Box = [0.15, -4.25, 7.55, -0.5];

export default class BashExplainer extends Scene {
  static meta = {
    id: 'just-bash',
    title: 'Running a command returns a new shell value',
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
      s = stage(this, { palette: palette(STYLE) }),
      ink = s.palette.ink,
      accent = s.emphasis;
    const old: Shell = { fs: {}, steps: 0 };

    // ── command: a line of text and a shell value ──────────────────────
    await this.step('command', {
      title: 'A command line and the empty shell it runs on',
      caption:
        'This executable model follows the JustBash example: a pipeline transforms strings and a redirect writes an in-memory filesystem. The shell starts as a plain value with no files.',
    });
    const parts: [string, string][] = [
      ['echo hello', 'command'],
      ['|', 'pipe'],
      ['tr a-z A-Z', 'command'],
      ['>', 'redirect'],
      [FILE, 'file'],
    ];
    const tokens = parts.map(([t]) => new Text(t, { fontSize: 0.56, font: 'mono', color: ink }));
    const line = new Group(...tokens).arrange([1, 0], 0.42).moveTo([0, 1.9]);
    const roles = parts.map(([, role], i) => {
      const tok = tokens[i]!,
        [a, , b] = tok.box()!,
        isOp = role === 'pipe' || role === 'redirect';
      const bar = new Rectangle({
        width: Math.max(0.3, b - a),
        height: 0.035,
        fill: isOp ? accent : ink,
        stroke: 'none',
      }).moveTo([(a + b) / 2, 1.4]);
      const label = new Text(role, { fontSize: 0.24, color: isOp ? accent : s.soft }).moveTo([(a + b) / 2, 1.05]);
      return new Group(bar, label);
    });
    s.keep(line);
    await this.play(new FadeIn(line, { runTime: 0.5 }));
    const legend = s.keep(new Group(...roles));
    await this.play(new FadeIn(legend, { runTime: 0.5 }));
    const api = await s.code(
      [`shell = { fs: ${JSON.stringify(old.fs)}, steps: ${old.steps} }`, 'exec(shell, pipeline, redirect)', '  → { shell, stdout }'],
      { at: BOTTOM, fontSize: 0.3 },
    );
    await api.focus(0);

    // ── parse: the command is a tree ────────────────────────────────────
    await this.step('parse', {
      title: 'The command line parses into a tree',
      caption:
        'A script holds a pipeline of two commands, echo and tr; the redirect records where the final output goes. The tree becomes the arguments the executor receives.',
    });
    await s.clear();
    const ast = await s.show(
      {
        source:
          'graph TD\nScript[Script] --> Pipeline[Pipeline]\nPipeline --> Echo[echo hello]\nPipeline --> Tr[tr a-z A-Z]\nScript --> Redirect[redirect to shout.txt]',
        style: STYLE,
      },
      { box: 'main' },
    );
    const call = await s.code(
      ['exec(shell,', '  [["echo", "hello"],', '   ["tr", "a-z", "A-Z"]],', `  "${FILE}")`],
      { at: 'side', fontSize: 0.3 },
    );
    await ast.mark(['Echo', 'Tr']);
    await call.focus([1, 2]);
    await ast.note('Redirect', 'not a command', { side: 'below' });

    // ── reduce: stdout threads through the builtins ─────────────────────
    await this.step('reduce', {
      title: 'A pipeline is a reduce over strings',
      caption:
        'Start with empty text. Echo replaces it with hello and a newline, and tr uppercases it. The note under each builtin is stdout after it runs: one string handed to the next, with no kernel pipe between them.',
    });
    await s.clear();
    const afterEcho = exec(old, [PIPELINE[0]]).stdout,
      afterTr = exec(old, PIPELINE).stdout;
    const flow = await s.show(
      {
        source: `graph LR\nInput[empty stdin] --> Echo[echo hello]\nEcho --> Tr[tr a-z A-Z]\nTr --> Output[stdout]`,
        style: STYLE,
      },
      { box: TOP },
    );
    const loop = await s.code(
      [
        'stdout = ""',
        'for each [name, ...args] in stages:',
        '  echo: stdout = args + "\\n"',
        '  tr:   stdout = upper(stdout)',
      ],
      { at: BOTTOM, fontSize: 0.3 },
    );
    await loop.focus(0);
    await flow.walk([['Input', 'Echo']], { trail: true });
    await loop.focus(2);
    await flow.note('Echo', q(afterEcho), { side: 'below' });
    await flow.walk([['Echo', 'Tr']], { trail: true });
    await loop.focus(3);
    await flow.note('Tr', q(afterTr), { side: 'below' });
    await flow.walk([['Tr', 'Output']], { trail: true });

    const run = exec(old, PIPELINE, FILE);
    this.state = { oldShell: old, newShell: run.shell, stdout: run.stdout };

    // ── redirect: the write lands in a new value ────────────────────────
    await this.step('redirect', {
      title: 'The redirect writes into a new shell',
      caption:
        'The redirect stores HELLO in shout.txt and empties stdout. Exec copies the filesystem into a new shell value and returns it, so the original shell on the left still has no files.',
    });
    await flow.clearNotes();
    await s.clearOverlays();
    await flow.morph({
      source: `graph LR\nInput[empty stdin] --> Echo[echo hello]\nEcho --> Tr[tr a-z A-Z]\nTr --> File[${FILE}]`,
      style: STYLE,
    });
    await flow.note('File', q(run.shell.fs[FILE]!), { side: 'below' });
    const before = await s.card(
      [
        ['files', files(old)],
        ['steps run', old.steps],
      ],
      { at: BOTTOM_LEFT, align: 'top', title: 'Original shell', fontSize: 0.3, width: 5.2 },
    );
    const after = await s.card(
      [
        ['files', files(old)],
        [FILE, '—'],
        ['steps run', old.steps],
        ['stdout', q(afterTr)],
      ],
      { at: BOTTOM_RIGHT, align: 'top', title: 'Returned shell', fontSize: 0.3, width: 5.2 },
    );
    await after.set({
      files: files(run.shell),
      [FILE]: q(run.shell.fs[FILE]!),
      'steps run': run.shell.steps,
      stdout: q(run.stdout),
    });
    await after.mark(FILE);
    await before.mark('files');

    // ── lookup: names resolve through a policy ──────────────────────────
    await this.step('lookup', {
      title: 'The model runs echo, tr and cat and refuses ls',
      caption:
        'Exec dispatches on the command name: echo, tr and cat each have a branch, and any other name, such as ls, falls through to the last line and throws “Unknown model command”.',
    });
    await s.clear();
    const names = ['echo', 'tr', 'cat', 'ls'],
      found = names.map((n) => [n, lookup(n)] as const);
    const policy = await s.show(
      {
        source:
          'graph LR\nName[command name] --> Builtin[look up the builtin]\nBuiltin --> Run[found: run on values]\nBuiltin --> Error[missing: refuse]',
        style: STYLE,
      },
      { box: TOP },
    );
    const dispatch = await s.code(
      [
        'if (name === "echo") …',
        'else if (name === "tr") …',
        'else if (name === "cat") …',
        'else throw Error("Unknown model command")',
      ],
      { at: BOTTOM, fontSize: 0.3 },
    );
    await policy.walk(
      [
        ['Name', 'Builtin'],
        ['Builtin', 'Run'],
      ],
      { trail: true },
    );
    await policy.note(
      'Run',
      found
        .filter(([, r]) => r === 'builtin')
        .map(([n]) => n)
        .join(' · '),
      { side: 'above' },
    );
    await policy.walk([['Builtin', 'Error']], { trail: '#ff8a80' });
    await policy.note(
      'Error',
      found
        .filter(([, r]) => r === 'unsupported')
        .map(([n]) => n)
        .join(' · '),
      { side: 'below' },
    );
    await dispatch.focus(3);

    // ── cat: the same command against two shells ────────────────────────
    const chosen = which === 'new' ? run.shell : old,
      result = exec(chosen, [['cat', FILE]]),
      other = exec(which === 'new' ? old : run.shell, [['cat', FILE]]);
    await this.step('cat', {
      title: which === 'new' ? 'cat reads the returned shell' : 'cat reads the original shell',
      caption:
        which === 'new'
          ? 'Cat receives the returned shell, finds shout.txt and prints HELLO. The write is visible only because the caller passed exec’s returned shell to this call.'
          : 'Cat receives the original shell, which has no shout.txt, so this model prints nothing. The earlier exec wrote HELLO into a copy and left this value as it was.',
    });
    await s.clear();
    await s.code([`exec(${which === 'new' ? 'returned' : 'original'}, [["cat", "${FILE}"]])`], {
      at: [-7.55, 1.6, 7.55, 3.25],
      fontSize: 0.4,
    });
    const shellCard = (sh: Shell, out: string, title: string, at: Box) =>
      s.card(
        [
          ['files', files(sh)],
          [FILE, sh.fs[FILE] == null ? 'missing' : q(sh.fs[FILE]!)],
          ['cat stdout', q(out)],
        ],
        { at, title, fontSize: 0.32 },
      );
    const oldResult = which === 'old' ? result.stdout : other.stdout,
      newResult = which === 'new' ? result.stdout : other.stdout;
    const L: Box = [-7.55, -4.25, -0.15, 1.3],
      R: Box = [0.15, -4.25, 7.55, 1.3];
    const oldCard = await shellCard(old, oldResult, 'Original shell', L),
      newCard = await shellCard(run.shell, newResult, 'Returned shell', R);
    const [picked, unpicked] = which === 'new' ? [newCard, oldCard] : [oldCard, newCard];
    const faded = unpicked.copy();
    faded.family().forEach((m, i) => {
      if (unpicked.family()[i] !== unpicked.bar) m.style.opacity = 0.4;
    });
    await this.play(new Transform(unpicked, faded, { runTime: 0.4 }));
    await picked.mark('cat stdout');
    this.state.cat = result.stdout;

    // ── lesson: the shell as a chain of values ──────────────────────────
    await this.step('lesson', {
      title: 'The caller holds both shells and can cat either',
      caption:
        'Every exec returns the next shell and leaves its input alone. Because the caller holds s0 and s1 at once, it can cat either: s1 prints HELLO and s0 prints nothing.',
    });
    await s.clear();
    const viaNew = exec(run.shell, [['cat', FILE]]).stdout,
      viaOld = exec(old, [['cat', FILE]]).stdout;
    const prints = (out: string) => (out ? `prints ${out.trim()}` : 'prints nothing');
    const chain = await s.show(
      {
        source:
          `graph LR\nS0["original shell<br/>files: ${files(old)}"]\nS1["returned shell<br/>files: ${files(run.shell)}"]\n` +
          `Out1["${prints(viaNew)}"]\nOut0["${prints(viaOld)}"]\n` +
          `S0 -->|echo, tr, redirect| S1\nS1 -->|cat| Out1\nS0 -->|cat| Out0`,
        style: STYLE,
      },
      { box: TOP },
    );
    const story = await s.code(
      [
        `s1 = exec(s0, pipeline, "${FILE}").shell`,
        `exec(s1, [["cat", "${FILE}"]]).stdout   // ${q(viaNew)}`,
        `exec(s0, [["cat", "${FILE}"]]).stdout   // ${q(viaOld)}`,
        `s0.fs                               // ${JSON.stringify(old.fs)}`,
      ],
      { at: BOTTOM, fontSize: 0.3 },
    );
    if (which === 'new')
      await chain.walk(
        [
          ['S0', 'S1'],
          ['S1', 'Out1'],
        ],
        { trail: true },
      );
    else await chain.walk([['S0', 'Out0']], { trail: true });
    await story.focus(which === 'new' ? 1 : 2);
  }
}
