import { Scene, Text, Arrow, Group, Line, FadeIn, Create } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
import {
  ITEMS,
  SOURCE,
  SUGGESTION_THRESHOLD,
  PROMPTS_PER_COMMAND,
  find,
  run,
  closeness,
  distance,
  matches,
  terms,
} from './model.ts';

const STYLE = 'excalidraw';
const QUERIES = ['cloud api', 'databse'] as const;
const TOKEN = 'OP_SERVICE_ACCOUNT_TOKEN';
const BOUNDARY =
  'graph LR\nAgent[Agent] --> Find[2password find]\nFind --> Op[op CLI]\nOp --> Vault[1Password vault]';
const pad = (v: unknown, n: number) => String(v).padEnd(n);

export default class PasswordExplainer extends Scene {
  static meta = {
    id: '2password',
    title: 'How 2password finds a secret without showing it to the agent',
    sources: [
      `${SOURCE}/src/discover.ts`,
      `${SOURCE}/src/op.ts`,
      `${SOURCE}/README.md`,
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
    const auth = settingsOf(this).auth as 'desktop' | 'service',
      service = auth === 'service',
      s = stage(this, { style: STYLE }),
      hot = s.emphasis;
    const found = find(QUERIES),
      [hitQuery, missQuery] = QUERIES,
      match = found.matches[0]!,
      suggestion = found.suggestions![0]!;

    await this.step('boundary', {
      title: 'find starts by listing item titles',
      caption: `2password lets a coding agent find and use 1Password secrets without seeing them. Here the agent runs find with two queries, ${hitQuery} and the typo ${missQuery}, against three sample items from 2password’s own tests.`,
    });
    const boundary = await s.show({ source: BOUNDARY }, { box: 'top' });
    await boundary.walk(
      [
        ['Agent', 'Find'],
        ['Find', 'Op'],
      ],
      { trail: true },
    );
    const W = 14;
    const listing = await s.code(
      [
        pad('title', W) + pad('category', 16) + 'vault',
        ...ITEMS.map((i) => pad(i.title, W) + pad(i.category, 16) + i.vault),
      ],
      { at: [-5.5, -4.25, 5.5, -0.5], fontSize: 0.3 },
    );
    await listing.focus([1, ITEMS.length]);

    await this.step('match', {
      title: 'A title matches when it contains every query word',
      caption: `find lowercases each query and keeps a title only if it contains every word; tags and fields are not searched. Cloud API matches ${hitQuery}. No title contains ${missQuery}, so that query is a miss.`,
    });
    await boundary.dim(['Agent', 'Find']);
    const cell = (query: string, title: string) => {
      if (matches(query, title)) return 'match';
      const missing = terms(query).filter((t) => !title.toLowerCase().includes(t));
      return `no ${missing.join(', ')}`;
    };
    await listing.morph([
      pad('title', W) + QUERIES.map((q) => pad(q, 16)).join(''),
      ...ITEMS.map((i) => pad(i.title, W) + QUERIES.map((q) => pad(cell(q, i.title), 16)).join('')),
    ]);
    await listing.focus(1 + ITEMS.findIndex((i) => i.title === match.title));
    this.state.matches = Object.fromEntries(
      QUERIES.map((q) => [q, ITEMS.filter((i) => matches(q, i.title)).map((i) => i.title)]),
    );

    const near = ITEMS.find((i) => i.title === suggestion.title)!;
    const word = near.title.toLowerCase(),
      edits = distance(missQuery, word),
      longer = Math.max(missQuery.length, word.length);
    await this.step('suggest', {
      title: `A miss returns titles that score at least ${SUGGESTION_THRESHOLD}`,
      caption: `For a query with no match, find scores each title word as 1 − edit distance ÷ the longer word’s length, and a title takes its best word. ${near.title} is ${edits} edit${edits === 1 ? '' : 's'} from ${missQuery}, so it scores 1 − ${edits}/${longer} = ${closeness(terms(missQuery), near.title)} and comes back as a suggestion.`,
    });
    await listing.morph([
      pad('title', W) + pad(`closeness to ${missQuery}`, 24) + `≥ ${SUGGESTION_THRESHOLD}`,
      ...ITEMS.map((i) => {
        const score = closeness(terms(missQuery), i.title);
        return (
          pad(i.title, W) + pad(score.toFixed(3), 24) + (score >= SUGGESTION_THRESHOLD ? 'suggested' : '–')
        );
      }),
    ]);
    await listing.focus(1 + ITEMS.indexOf(near));
    this.state.found = found;

    await this.step('fetch', {
      title: 'One op item get fetches the match and the suggestion',
      caption: service
        ? `find makes two op calls: item list for titles, then one item get for every item a match or suggestion needs, here ${found.fetched.join(' and ')}. With a service-account token in the environment, op asks for no approval.`
        : `find makes two op calls: item list for titles, then one item get for every item a match or suggestion needs, here ${found.fetched.join(' and ')}. 2password’s README says the whole command costs one desktop approval.`,
    });
    await s.clear();
    const sequence = await s.show(
      {
        source: [
          'sequenceDiagram',
          ' participant A as Agent',
          ' participant T as 2password',
          ' participant O as op CLI',
          ' A->>T: find with two queries',
          ` T->>O: ${found.opCalls[0]!.split(' --')[0]}`,
          ' O-->>T: ids and titles',
          ` T->>O: item get for ${found.fetched.length} items`,
          ' O-->>T: item details',
          ' T-->>A: op:// references',
        ].join('\n'),
      },
      { box: 'main' },
    );
    await sequence.mark(['message:T->O#1']);
    const ledger = await s.card(
      [
        ['op calls', found.opCalls.length],
        ['Items fetched', found.fetched.length],
        ['Approvals', PROMPTS_PER_COMMAND[auth]],
      ],
      { at: 'side', fontSize: 0.27 },
    );
    await ledger.mark('Approvals');
    this.state.auth = auth;

    await this.step('reference', {
      title: 'find prints references and drops the values',
      caption:
        'find returns a reference for each match and suggestion, and drops field values while it decodes op’s reply. A reference names a vault, an item and a field: the underlined parts of the Cloud API reference.',
    });
    await s.clear();
    const ref = match.ref;
    const refText = new Text(ref, { fontSize: 0.56, font: 'mono', color: s.palette.ink }).moveTo([0, 2.1]);
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
    await s.enter(refText, { runTime: 0.5 });
    await this.play(new Create(s.keep(anatomy), { lagRatio: 0 }));
    const values = ITEMS.flatMap((i) => i.fields.map((f) => f.value));
    const printed = JSON.stringify(found);
    const output = await s.card(
      [
        [`Match for ${hitQuery}`, match.ref],
        [`Suggestion for ${missQuery}`, suggestion.ref],
        ['Secret values printed', values.filter((v) => printed.includes(v)).length || 'none'],
      ],
      { at: [-6, -3.6, 6, 0.2], fontSize: 0.27 },
    );
    await output.mark('Secret values printed');

    const launched = run(auth, { API_KEY: ref }, ['app']);
    await this.step('run', {
      title: service
        ? 'env -u keeps the service token out of the app'
        : 'op run starts the app with the secret',
      caption: service
        ? 'run hands op the reference, and op puts the secret into the app’s environment. With a service-account token, 2password has op start env -u OP_SERVICE_ACCOUNT_TOKEN app, so the app gets the secret and not the token.'
        : 'run hands op the reference, and op puts the secret into the app’s environment. With desktop approval op holds no token, so it starts the app directly; the app gets the secret and PATH.',
    });
    await s.clear();
    const command = await s.code(
      [`2password run --env "API_KEY=${ref}" -- app`, `→ ${launched.argv.join(' ')}`],
      { at: regionBox('top', { bottom: 1.2 }), fontSize: 0.3 },
    );
    const before = await s.code(
      Object.entries(launched.opEnv).map(([k, v]) => (k === TOKEN ? '- ' : '  ') + `${k}=${v}`),
      { at: [-7.55, -4.25, -0.75, 0.7], title: "op's environment", fontSize: 0.26, diff: true, enter: false },
    );
    const child = await s.code(
      Object.entries(launched.childEnv).map(([k, v]) => `${k}=${v}`),
      { at: [0.75, -4.25, 7.55, 0.7], title: "app's environment", fontSize: 0.26, enter: false },
    );
    const yArrow = (before.panel.box()![1] + before.panel.box()![3]) / 2;
    const pass = new Arrow([before.panel.box()![2] + 0.1, yArrow], [child.panel.box()![0] - 0.1, yArrow], {
      stroke: hot,
      strokeWidth: 0.035,
      tipLength: 0.22,
      tipWidth: 0.18,
    });
    await s.enter(before);
    await this.play(new Create(s.keep(pass)), new FadeIn(child));
    await command.focus(1);
    this.state.argv = launched.argv;
    this.state.childEnv = launched.childEnv;
  }
}
