import { Scene, Text, Arrow, Group, Line, FadeIn, FadeOut, Create } from '../../../src/index.ts';
import { stage, palette, settingsOf, CodeBlock } from '../../../explain/index.ts';
import { ITEMS, rankMetadata, secretWorkflow } from './model.ts';

const STYLE = 'excalidraw';
const QUERY = 'production api';
const TOKEN = 'OP_SERVICE_ACCOUNT_TOKEN';
const BOUNDARY =
  'graph LR\nAgent[Agent model] --> Tool[Secret tool]\nTool --> Metadata[Search metadata]\nTool --> Op[1Password CLI]\nOp --> Vault[Vault]';
const pad = (v: unknown, n: number) => String(v).padEnd(n);
const lpad = (v: unknown, n: number) => String(v).padStart(n);
/** A command as it fits on a sequence arrow. */
const short = (c: string) => (c.includes(' -- ') ? `${c.split(' -- ')[0]} … ${c.split(' ').at(-1)}` : c);

export default class PasswordExplainer extends Scene {
  static meta = {
    id: '2password',
    title: 'Search 1Password metadata and hand the agent a reference',
    sources: [
      'https://developer.1password.com/docs/cli/secret-references/',
      'https://developer.1password.com/docs/service-accounts/use-with-1password-cli/',
    ],
  };
  static settings = [
    {
      id: 'auth',
      label: 'Authenticate with',
      default: 'desktop',
      options: [
        { value: 'desktop', label: 'Desktop approvals' },
        { value: 'service', label: 'Service account' },
      ],
    },
  ];
  override async construct() {
    const auth = settingsOf(this).auth!,
      service = auth === 'service',
      model = secretWorkflow(auth),
      s = stage(this, { palette: palette(STYLE) }),
      hot = s.emphasis;
    const fields = Object.keys(ITEMS[0]!).filter((k) => k !== 'id');
    const results = rankMetadata(QUERY),
      selected = results[0]!;

    await this.step('boundary', {
      title: 'The secret tool searches metadata before the CLI',
      caption:
        'An offline fixture of three made-up items stands in for the vault, and no 2password code is reproduced. The agent calls a secret tool, which searches item metadata before it asks the 1Password CLI for any item.',
    });
    const boundary = await s.show({ source: BOUNDARY, style: STYLE }, { box: 'top' });
    await boundary.walk(
      [
        ['Agent', 'Tool'],
        ['Tool', 'Metadata'],
      ],
      { trail: true },
    );
    await boundary.note('Vault', 'never opened here', { side: 'below' });
    const table = [
      pad('title', 16) + pad('username', 10) + 'tags',
      ...ITEMS.map((i) => pad(i.title, 16) + pad(i.username, 10) + i.tags.join(', ')),
    ];
    const items = await s.code(table, {
      at: [-5.5, -4.25, 5.5, -0.5],
      title: `fixture items: ${fields.join(', ')}; no secret field`,
      fontSize: 0.3,
    });
    await items.focus([1, ITEMS.length]);

    await this.step('search', {
      title: 'Only Production API matches both query words',
      caption:
        'rankMetadata scores titles, usernames and tags, and drops any item missing a query word. Production API scores 80 and the other two are filtered out. The fixture items have no password field to search.',
    });
    await boundary.clearNotes();
    await boundary.dim(['Agent', 'Tool', 'Metadata']);
    await boundary.note('Metadata', `${results.length} match of ${ITEMS.length}`, { side: 'right' });
    const terms = QUERY.split(' ');
    const termScore = (id: string, term: string) => rankMetadata(term).find((r) => r.id === id)?.score;
    const scored = [
      `query "${QUERY}"`,
      pad('item', 16) + terms.map((t) => lpad(t, 12)).join('') + lpad('score', 10),
      ...ITEMS.map((i) => {
        const hit = results.find((r) => r.id === i.id);
        return (
          pad(i.title, 16) +
          terms.map((t) => lpad(termScore(i.id, t) != null ? `+${termScore(i.id, t)}` : '–', 12)).join('') +
          lpad(hit ? hit.score : 'filtered', 10)
        );
      }),
    ];
    const ranking = new CodeBlock(this, s.palette, scored, {
      at: [-5.5, -4.25, 5.5, -0.5],
      title: 'rankMetadata (model.ts)',
      fontSize: 0.3,
    });
    s.keep(ranking);
    await this.play(new FadeOut(items), new FadeIn(ranking));
    await ranking.focus(2 + ITEMS.findIndex((i) => i.id === selected.id));
    this.state.matches = results;

    await this.step('select', {
      title: 'op item get asks for one item: prod',
      caption:
        'The top result’s id, prod, is the only item the CLI is asked for: op item get prod, noted under the CLI node. Retrieval is limited to that one item, so the other items never reach the model.',
    });
    await boundary.clearNotes();
    await boundary.dim(['Agent', 'Tool', 'Metadata', 'Op']);
    await boundary.walk([['Tool', 'Op']], { trail: true });
    await boundary.note('Op', model.commands[1]!, { side: 'below' });
    await ranking.focus(2 + ITEMS.findIndex((i) => i.id === selected.id));
    const pick = new Text(`selected id: ${selected.id}`, { fontSize: 0.26, color: hot, font: 'mono' });
    pick.moveTo([ranking.panel.box()![2] + 0.25, ranking.panel.center()[1]], [-1, 0]);
    s.keep(pick);
    await this.play(new FadeIn(pick, { shift: [-0.1, 0] }));

    await this.step('auth', {
      title: service ? 'With a service-account token, op never prompts' : 'The fixture counts one approval per op command',
      caption: service
        ? 'With a service-account token, op authenticates without prompting, so the ledger totals zero approvals. Because op now holds that token, the wrapper has to keep it out of the app’s environment.'
        : 'In this fixture each of the three op commands asks the desktop app for approval, so the ledger totals 3. Whether the real app reuses an approval depends on policy; the fixture assumes it never does.',
    });
    await s.clear();
    const third = service ? 'V as 1Password service' : 'U as Desktop app';
    const answer = service ? 'O->>V: token auth' : 'O->>U: approve?';
    const sequence = await s.show(
      {
        source: [
          'sequenceDiagram',
          ' participant A as Agent tool',
          ' participant O as op CLI',
          ` participant ${third}`,
          ...model.commands.flatMap((c) => [` A->>O: ${short(c)}`, ` ${answer}`]),
        ].join('\n'),
        style: STYLE,
      },
      { box: 'main' },
    );
    const asks = sequence.snapshot.parts.filter((p) => p.role === 'message' && p.from === 'O').map((p) => p.id);
    if (!service) await sequence.mark(asks);
    const each = model.approvals / model.commands.length;
    const ledger = new CodeBlock(
      this,
      s.palette,
      [
        ...model.commands.flatMap((c) => [
          short(c),
          each ? `  + ${each} desktop approval` : '  token, no prompt',
        ]),
        '',
        `approvals: ${model.approvals}`,
      ],
      { at: s.regions.side, title: 'secretWorkflow (model.ts)', fontSize: 0.28 },
    );
    s.keep(ledger);
    await this.play(new FadeIn(ledger));
    await ledger.focus(model.commands.length * 2 + 1);
    this.state.auth = auth;
    this.state.approvals = model.approvals;

    await this.step('reference', {
      title: 'The transcript holds a secret reference',
      caption:
        'The underlined parts of op://Fixture/prod/credential name the vault, item and field, and the secret itself is not in the string. The transcript keeps the reference; op run resolves it for the app at run time.',
    });
    await s.clear();
    const ref = `op://Fixture/${selected.id}/credential`;
    const refText = new Text(ref, { fontSize: 0.62, font: 'mono', color: s.palette.ink }).moveTo([0, 2.1]);
    const parts = ['vault', 'item', 'field'],
      segs = ref.slice(5).split('/'),
      per = refText.advance() / ref.length,
      x0 = refText.box()![0],
      y = refText.box()![1] - 0.1;
    const anatomy = new Group();
    let at = 5;
    segs.forEach((seg, i) => {
      const a = x0 + at * per,
        b = a + seg.length * per,
        color = parts[i] === 'item' ? hot : s.soft;
      anatomy.add(
        new Line([a + 0.04, y], [b - 0.04, y], { stroke: color, strokeWidth: 0.03 }),
        new Text(parts[i]!, { fontSize: 0.24, color }).moveTo([(a + b) / 2, y - 0.3]),
      );
      at += seg.length + 1;
    });
    s.keep(refText);
    s.keep(anatomy);
    await this.play(new FadeIn(refText, { runTime: 0.5 }));
    await this.play(new Create(anatomy, { lagRatio: 0 }));
    const transcript = await s.card(
      [
        ['Reference', ref],
        ['Item, from search', selected.id],
        ['Secret value', 'not in transcript'],
      ],
      { at: [-7.3, -3.0, -0.4, 0.6], title: 'What the agent sees' },
    );
    const run = await s.card(
      [
        ['Resolved by', 'op run'],
        ['Delivered to', 'app environment'],
        ['Approvals (fixture)', model.approvals],
      ],
      { at: [0.9, -3.0, 7.3, 0.6], title: 'At run time' },
    );
    const link = s.keep(
      new Arrow([transcript.panel.box()![2] + 0.1, transcript.panel.center()[1]], [run.panel.box()![0] - 0.1, transcript.panel.center()[1]], {
        stroke: hot,
        strokeWidth: 0.03,
        tipLength: 0.2,
        tipWidth: 0.16,
      }),
    );
    await this.play(new Create(link));
    await transcript.mark('Secret value');

    await this.step('child', {
      title: service ? 'env -u strips op’s token from the app' : 'Desktop approval leaves no token to strip',
      caption: service
        ? 'op authenticates with OP_SERVICE_ACCOUNT_TOKEN, and env -u removes it before the app starts, so the app’s environment keeps only PATH and APP_MODE.'
        : 'With desktop approvals op’s environment has no service token, so the same env -u removes nothing and the app still gets only PATH and APP_MODE.',
    });
    await s.clear();
    const command = await s.code([model.commands[2]!], { at: [-7.55, 1.6, 7.55, 3.25], fontSize: 0.34, title: 'wrapper command' });
    const parent: Record<string, string> = {
      ...model.childEnv,
      ...(model.hasServiceTokenBefore ? { [TOKEN]: '<fixture token>' } : {}),
    };
    const before = new CodeBlock(
      this,
      s.palette,
      [
        ...Object.entries(parent).map(([k, v]) => (k === TOKEN ? '- ' : '  ') + `${k}=${v}`),
        ...(model.hasServiceTokenBefore ? [] : ['  (no service token set)']),
      ],
      { at: [-7.55, -4.25, -0.75, 1.1], title: "op's environment", fontSize: 0.27, diff: true },
    );
    const child = new CodeBlock(
      this,
      s.palette,
      Object.entries(model.childEnv).map(([k, v]) => `${k}=${v}`),
      { at: [0.75, -4.25, 7.55, 1.1], title: "app's environment (childEnv)", fontSize: 0.27 },
    );
    const yArrow = (before.panel.box()![1] + before.panel.box()![3]) / 2;
    const pass = new Arrow([before.panel.box()![2] + 0.1, yArrow], [child.panel.box()![0] - 0.1, yArrow], {
      stroke: hot,
      strokeWidth: 0.035,
      tipLength: 0.22,
      tipWidth: 0.18,
    });
    s.keep(before);
    s.keep(child);
    s.keep(pass);
    await this.play(new FadeIn(before));
    await this.play(new Create(pass), new FadeIn(child));
    await command.focus(0);
    const gone = new Text(
      TOKEN in model.childEnv ? `${TOKEN} reached the app` : `${TOKEN}: absent`,
      { fontSize: 0.24, color: hot, font: 'mono' },
    ).moveTo([(child.panel.box()![0] + child.panel.box()![2]) / 2, child.panel.box()![1] - 0.35]);
    s.keep(gone);
    await this.play(new FadeIn(gone));
    this.state.childEnv = model.childEnv;

    await this.step('invariants', {
      title: 'Results and childEnv, checked on the model',
      caption:
        'Each card row is computed from the model’s output when the scene builds: search results have no secret-like field, and childEnv has no OP_SERVICE_ACCOUNT_TOKEN.',
    });
    await s.clear();
    const credential = service ? 'Service-account token' : 'Desktop approval';
    const flow = await s.show(
      {
        source: `graph LR\nCredential[${credential}] --> Op[op run]\nRefs[Secret reference] --> Op\nOp --> Scrub[env -u token]\nScrub --> Child[app]`,
        style: STYLE,
      },
      { box: 'top' },
    );
    await flow.walk(
      [
        ['Refs', 'Op'],
        ['Op', 'Scrub'],
        ['Scrub', 'Child'],
      ],
      { trail: true },
    );
    await flow.note('Credential', service ? 'token stops at op' : 'no token variable', { side: 'above', color: '#e03131' });
    await flow.note('Child', `${Object.keys(model.childEnv).join(', ')} only`, { side: 'below' });
    const resultKeys = [...new Set(results.flatMap((r) => Object.keys(r)))];
    const secretish = resultKeys.filter((k) => /pass|secret|credential|value/i.test(k));
    const checks = await s.card(
      [
        ['Fields in search results', resultKeys.join(', ')],
        ['Secret-like fields', secretish.length ? secretish.join(', ') : 'none'],
        [`${TOKEN} in childEnv`, TOKEN in model.childEnv ? 'present' : 'absent'],
      ],
      { at: [-5, -4.25, 5, -0.4], title: 'Checked on the model', fontSize: 0.27 },
    );
    await checks.mark(`${TOKEN} in childEnv`);

    await this.step('scope', {
      title: 'Both authentication cases side by side',
      caption:
        'The two cards come from secretWorkflow. Desktop approvals cost 3 prompts and leave op without a token; the service account costs none and gives op the token. Neither case puts the token in the app’s environment.',
    });
    await s.clearOverlays();
    const cards = [];
    for (const which of ['desktop', 'service'] as const) {
      const m = secretWorkflow(which);
      cards.push(
        await s.card(
          [
            ['Approvals', m.approvals],
            [`Token in op's env`, m.hasServiceTokenBefore ? 'yes' : 'no'],
            [`Token in app's env`, TOKEN in m.childEnv ? 'yes' : 'no'],
          ],
          {
            at: which === 'desktop' ? [-7.3, -3.5, -0.4, -0.3] : [0.4, -3.5, 7.3, -0.3],
            title: (which === 'desktop' ? 'Desktop approvals' : 'Service account') + (which === auth ? ' (this case)' : ''),
            fontSize: 0.27,
            width: 6.2,
          },
        ),
      );
    }
    await cards[service ? 1 : 0]!.mark('Approvals');
    await s.note('Offline fixture: three made-up items, no vault, no network, no real credentials.', {
      at: [0, -3.95],
    });
  }
}
