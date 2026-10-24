import { Scene, Code, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { rankMetadata, secretWorkflow } from './model.ts';
export default class PasswordExplainer extends Scene {
  static meta = {
    id: '2password',
    title: 'Find the item without handing the model every secret',
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
      model = secretWorkflow(auth),
      s = stage(this, {
        palette: palette('excalidraw'),
        title: '2password · metadata first, secrets only when needed',
      });
    await this.step('boundary', {
      title: 'Put a boundary around secret retrieval',
      caption:
        'This 2password-inspired fixture demonstrates a secret-tool workflow without opening a vault. It models three CLI invocations and explicit environment hygiene; it is not a live security audit or a port of unavailable private code.',
    });
    const boundary = await s.show({
      source:
        'graph LR\nAgent[Agent model] --> Tool[Secret tool]\nTool --> Metadata[Search metadata]\nTool --> Op[1Password CLI]\nOp --> Vault[Vault]',
      style: 'excalidraw',
    });
    await boundary.walk([
      ['Agent', 'Tool'],
      ['Tool', 'Metadata'],
    ]);
    await this.step('search', {
      title: 'Search metadata, not password contents',
      caption:
        'The fixture ranks item titles, usernames and tags. No password field is present. The scoring function is deliberately local and inspectable; real matching policies must be checked against their own source.',
    });
    await boundary.hide();
    const results = rankMetadata('production api');
    this.state.matches = results;
    await s.card(
      results.map((r) => [r.title, `score ${r.score}`] as const),
      { at: [0, 0], width: 10 },
    );
    await this.step('select', {
      title: 'Select the narrow item before retrieving it',
      caption:
        'The production API item wins because it matches every query term. Selecting a concrete item id keeps the subsequent retrieval narrower than dumping all vault contents into the model.',
    });
    await s.chip(`Selected: ${results[0]!.id}`);
    await this.step('auth', {
      title:
        auth === 'desktop' ? 'Three commands, three modeled approvals' : 'A service account changes the path',
      caption:
        auth === 'desktop'
          ? 'In this fixture, each of the three CLI invocations requires a desktop approval. Actual approval reuse depends on desktop integration and policy; this count is the model’s assumption, not a universal CLI guarantee.'
          : 'The fixture supplies a service-account token to the CLI instead of desktop approval. That credential changes the authentication path and must not leak into the child application’s environment.',
    });
    await s.clearOverlays();
    const sequence = await s.show({
      source:
        auth === 'desktop'
          ? 'sequenceDiagram\n participant A as Agent\n participant O as CLI\n participant U as User desktop\n A->>O: List metadata\n O->>U: Approve list\n A->>O: Get selected item\n O->>U: Approve retrieval\n A->>O: Run application\n O->>U: Approve run'
          : 'sequenceDiagram\n participant A as Agent tool\n participant O as CLI\n participant V as Vault\n A->>O: Supply service-account credential\n O->>V: List and retrieve authorized items\n V-->>O: Scoped results\n A->>O: Run application',
      style: 'excalidraw',
    });
    this.state.auth = auth;
    this.state.approvals = model.approvals;
    await this.step('reference', {
      title: 'Use a reference where possible',
      caption:
        'A secret reference names a field without containing its value. The child application can receive resolved values through its execution environment rather than exposing every value in the authoring transcript.',
    });
    await sequence.hide();
    await s.card(
      [
        ['Reference', 'op://Production/API/credential'],
        ['Approvals in fixture', model.approvals],
        ['Secret values displayed', 'none'],
      ],
      { at: [0, 0], width: 12 },
    );
    await this.step('child', {
      title: 'Keep CLI authentication out of the child',
      caption:
        auth === 'service'
          ? 'The CLI needs its authentication credential; the application does not. The wrapper runs an environment scrubber as the child command so the token remains available to op but is removed before app starts.'
          : 'Desktop approvals need no service-account environment token. The same scrubber is harmless when that variable is absent. In either case, the application receives its selected resolved secret, not a service-account credential.',
    });
    await s.clearOverlays();
    const command = new Code(['op run -- env -u OP_SERVICE_ACCOUNT_TOKEN app'], { fontSize: 0.3 }).moveTo([
      0, 0,
    ]);
    command.setFill(s.palette.ink);
    await this.play(new FadeIn(command));
    this.state.childEnv = model.childEnv;
    await this.step('invariants', {
      title: 'Check what must not cross the boundary',
      caption:
        'The model asserts two separate properties: search results contain metadata only, and the child environment contains no service-account token. A successful animation cannot establish either property by itself.',
    });
    await this.play(new FadeOut(command));
    const flow = await s.show({
      source:
        'graph LR\nCredential[CLI auth credential] --> Op[op run]\nOp --> Scrub[Remove auth variable]\nScrub --> Child[Application]\nRefs[Secret references] --> Op',
      style: 'excalidraw',
    });
    await flow.walk([
      ['Credential', 'Op'],
      ['Op', 'Scrub'],
      ['Scrub', 'Child'],
    ]);
    await this.step('scope', {
      title: 'Choose another authentication case',
      caption:
        'Switching authentication changes the approval story and environment handling, not the visual palette. The fixture remains offline and includes no real credentials or vault identifiers.',
    });
    await flow.hide();
    await s.card(
      [
        ['Auth', auth],
        ['Modeled approvals', model.approvals],
        ['Child auth-token variable', 'absent'],
      ],
      { at: [0, 0], width: 10 },
    );
  }
}
