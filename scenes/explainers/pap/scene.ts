import { Scene } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
const SIGNIN = {
  direct:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n A->>C: Open authorization with PKCE\n U->>C: Sign in and approve scopes\n C-->>A: Authorization code\n A->>C: Code, verifier and session_id\n C-->>A: Account and Session Tokens',
  device:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n A->>C: Request device authorization\n C-->>A: Link, user code and private device code\n A-->>U: Show company, link and user code\n U->>C: Sign in and approve on another device\n A->>C: Poll with device code and session_id\n C-->>A: Account and Session Tokens',
  mediated:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n U->>A: Supply credentials for this issuer\n A->>C: Credentials to mediated endpoint\n C-->>A: Optional verification challenge\n U->>A: Supply requested code\n A->>C: Complete sign-in for session_id\n C-->>A: Account and Session Tokens',
};
export default class PAPExplainer extends Scene {
  static meta = {
    id: 'pap',
    title: 'Personal agents need a session before a sign-in',
    sources: ['https://personalagentprotocol.org/docs/0.2/spec', 'https://www.rfc-editor.org/rfc/rfc9449'],
  };
  static settings = [
    {
      id: 'signin',
      label: 'Sign-in method',
      default: 'direct',
      options: [
        { value: 'direct', label: 'Direct' },
        { value: 'device', label: 'Device' },
        { value: 'mediated', label: 'Mediated' },
      ],
    },
  ];
  override async construct() {
    const method = settingsOf(this).signin as keyof typeof SIGNIN,
      s = stage(this, { palette: palette('nord'), title: 'Personal Agent Protocol · draft 0.2' });
    await this.step('map', {
      title: 'One company, several ways to work',
      caption:
        'The Personal Agent acts for the user. A company advertises discovery, authorization, APIs, web browsing and conversations. This is an overview of draft 0.2, not an implementation of its security checks.',
    });
    const map = await s.show({
      source: 'mindmap\n root((Company))\n  Discovery\n  Sessions\n  APIs\n  Web\n  Conversations',
      style: 'nord',
    });
    await this.step('discover', {
      title: 'Discover before sending secrets',
      caption:
        'Fetch poppy.json and check the link between the company domain and its OAuth issuer. The discovery document names supported sign-in methods and interaction endpoints; it is not permission to send arbitrary secrets anywhere.',
    });
    await map.hide();
    const discovery = await s.show({
      source:
        'graph LR\nDomain[Company domain] --> Poppy[poppy.json]\nPoppy --> Issuer[OAuth issuer]\nIssuer --> Verify[Verify domain link]\nVerify --> Session[Start Session]',
      style: 'nord',
    });
    await discovery.walk([
      ['Domain', 'Poppy'],
      ['Poppy', 'Issuer'],
      ['Issuer', 'Verify'],
      ['Verify', 'Session'],
    ]);
    await this.step('session', {
      title: 'A session can start signed out',
      caption:
        'The session identifies this user-agent interaction even before account sign-in. An account grant can sign that session in. Signing out does not let it become a different account’s session.',
    });
    await discovery.hide();
    const states = await s.show({
      source:
        'stateDiagram-v2\n direction LR\n SignedOut --> SignedIn: Sign in\n SignedIn --> SignedOutAgain: Sign out\n SignedOutAgain --> SignedIn: Same account only',
      style: 'nord',
    });
    await states.walk([['SignedOut', 'SignedIn']]);
    await this.step('sign-in', {
      title: `${method[0]!.toUpperCase() + method.slice(1)} sign-in`,
      caption:
        method === 'direct'
          ? 'The user signs in on the company’s own page. The agent exchanges an authorization code with PKCE and the current session id. The agent need not receive the password.'
          : method === 'device'
            ? 'The agent shows a company link and user code. The user signs in on a device they choose; the agent keeps the device code private and polls at the required interval.'
            : 'The user supplies credentials for this company. The agent sends them only to the advertised mediated endpoint. This is a protocol-defined credential exchange, not an OAuth grant.',
    });
    await states.hide();
    const seq = await s.show({ source: SIGNIN[method], style: 'nord' }, { build: 'frame' });
    await seq.reveal(2);
    await seq.reveal('rest');
    await this.step('tokens', {
      title: 'Different tokens have different jobs',
      caption:
        'A Session Token authorizes requests in a session and is bound to the agent’s key with DPoP. An Account Token is a refresh token retained outside model context. They are not interchangeable strings.',
    });
    await seq.hide();
    await s.card(
      [
        ['Session Token', 'Access token + DPoP'],
        ['Account Token', 'Refresh token; keep out of model'],
        ['Selected sign-in', method],
      ],
      { at: [0, 0], width: 11 },
    );
    await this.step('work', {
      title: 'One authorized session, several interfaces',
      caption:
        'The agent can use the company’s APIs, website or company-agent conversations as the task requires. Access still depends on scopes, resource audience and user intent.',
    });
    await s.clearOverlays();
    const work = await s.show({
      source:
        'graph LR\nSession[Authorized Session] --> API[API calls]\nSession --> Web[Web browsing]\nSession --> Conversation[Company Agent]\nConversation --> Human[Human handoff]',
      style: 'nord',
    });
    await work.walk([
      ['Session', 'Conversation'],
      ['Conversation', 'Human'],
    ]);
    await this.step('boundary', {
      title: 'Company text is data, not user consent',
      caption:
        'A company’s response cannot authorize an action at another company or stand in for user approval. The protocol keeps trust, secrets and user intent distinct from whatever text a model happens to read.',
    });
    await work.hide();
    await s.card(
      [
        ['Authority', 'The user’s task and granted scopes'],
        ['Untrusted content', 'Company messages and tool results'],
        ['Secret handling', 'Code and chosen credential store'],
      ],
      { at: [0, 0], width: 12 },
    );
    this.state.signin = method;
  }
}
