import { Scene } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
const STYLE = 'nord';
const RED = '#bf616a';
/** Nord orange: marks that must stand out from the frost-blue diagrams. */
const HOT = '#d08770';
const SIGNIN = {
  direct:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n A->>C: Open authorization with PKCE\n U->>C: Sign in and approve scopes\n C-->>A: Authorization code\n A->>C: Code, verifier and session_id\n C-->>A: Account and Session Tokens',
  device:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n A->>C: Request device authorization\n C-->>A: Link, user code and private device code\n A-->>U: Show company, link and user code\n U->>C: Sign in and approve on another device\n A->>C: Poll with device code and session_id\n C-->>A: Account and Session Tokens',
  mediated:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n U->>A: Supply credentials for this issuer\n A->>C: Credentials to mediated endpoint\n C-->>A: Optional verification challenge\n U->>A: Supply requested code\n A->>C: Complete sign-in for session_id\n C-->>A: Account and Session Tokens',
};
/** What sets each method apart, and the messages in its diagram that carry it. */
const METHOD = {
  direct: {
    where: 'company page',
    password: 'never to agent',
    proof: 'code + verifier',
    marks: ['message:U->C#0', 'message:A->C#1'],
    mark: 'Proof',
  },
  device: {
    where: 'own device',
    password: 'never to agent',
    proof: 'device code',
    marks: ['message:A->U#0', 'message:U->C#0', 'message:A->C#1'],
    mark: 'Signs in on',
  },
  mediated: {
    where: 'the agent',
    password: 'via the agent',
    proof: 'mediated endpoint',
    marks: ['message:U->A#0', 'message:A->C#0'],
    mark: 'Password',
  },
};
/** The session's own small state machine, as the stateDiagram draws it. */
const SESSION = { SignedOut: { signIn: 'SignedIn' }, SignedIn: { signOut: 'SignedOutAgain' } } as const;
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
      how = METHOD[method],
      s = stage(this, { palette: palette('nord') });

    await this.step('map', {
      title: 'Discovery comes first, then a session',
      caption:
        'A Personal Agent acts for the user with one company, which advertises five branches: discovery, sessions, APIs, web browsing and conversations. The agent starts with the two marked branches, discovery and then a session. This overview follows PAP draft 0.2 but does not run the draft’s checks.',
    });
    const map = await s.show(
      {
        source: 'mindmap\n root((Company))\n  Discovery\n  Sessions\n  APIs\n  Web\n  Conversations',
        style: STYLE,
      },
      { box: 'full' },
    );
    await map.mark(['Discovery', 'Sessions'], { color: HOT });
    await map.note('Discovery', 'first', { side: 'right', color: HOT });
    await map.note('Sessions', 'then', { side: 'above', color: HOT });

    await this.step('discover', {
      title: 'poppy.json names an OAuth issuer, which must match the domain',
      caption:
        'The agent fetches poppy.json from the company domain and checks that the OAuth issuer it names has the same owner as the domain. The file lists sign-in methods and endpoints; as the marked row says, listing an endpoint grants no licence to send secrets to it.',
    });
    await s.clearOverlays();
    await map.hide();
    const discovery = await s.show(
      {
        source:
          'graph TB\nDomain[Company domain] --> Poppy[poppy.json]\nPoppy --> Issuer[OAuth issuer]\nIssuer --> Verify[Verify domain link]\nVerify --> Session[Start Session]',
        style: STYLE,
      },
      { box: [-7.55, -4.25, -1.6, 3.25] },
    );
    await discovery.walk(
      [
        ['Domain', 'Poppy'],
        ['Poppy', 'Issuer'],
        ['Issuer', 'Verify'],
        ['Verify', 'Session'],
      ],
      { trail: true },
    );
    await discovery.mark(['Verify'], { color: HOT });
    await discovery.note('Verify', 'same owner?', { side: 'right', color: HOT });
    const found = await s.card(
      [
        ['Sign-in methods', 'advertised'],
        ['Endpoints', 'where each goes'],
        ['Not granted', 'licence to send secrets'],
      ],
      { at: [0.2, 0.85], fontSize: 0.28 },
    );
    await found.mark('Not granted');

    await this.step('session', {
      title: 'The session_id exists before anyone signs in',
      caption:
        'The session_id is issued for this user-agent interaction before any account signs in, and signing in attaches the user’s account to it. After sign-out it can sign in again only to that same account, so it never becomes another account’s session.',
    });
    await s.clearOverlays();
    await discovery.hide();
    const states = await s.show(
      {
        source:
          'stateDiagram-v2\n direction LR\n state "Signed out" as SignedOut\n state "Signed in" as SignedIn\n state "Signed out again" as SignedOutAgain\n SignedOut --> SignedIn: Sign in\n SignedIn --> SignedOutAgain: Sign out\n SignedOutAgain --> SignedIn: Same account only',
        style: STYLE,
      },
      { box: [-7.55, -0.2, 7.55, 3.25] },
    );
    let state: string = 'SignedOut';
    const session = await s.card(
      [
        ['session_id', 'issued before sign-in'],
        ['Account', 'none yet'],
      ],
      { at: [-7.55, -4.25, 7.55, -1.0], fontSize: 0.28 },
    );
    await states.mark(['SignedOut']);
    await states.walk([['SignedOut', 'SignedIn']], { trail: true });
    state = SESSION.SignedOut.signIn;
    await states.unmark(['SignedOut']);
    await states.mark(['SignedIn']);
    await session.set({ Account: 'the user’s account' });
    await session.mark('Account');
    this.state.session = state;

    await this.step('sign-in', {
      title:
        method === 'direct'
          ? 'Direct sign-in: the password stays on the company’s page'
          : method === 'device'
            ? 'Device sign-in: the user approves on another device'
            : 'Mediated sign-in: the agent carries the credentials',
      caption:
        method === 'direct'
          ? 'The user signs in on the company’s own page, so the password never reaches the agent. The agent then sends the marked exchange: the authorization code, its PKCE verifier and the current session_id.'
          : method === 'device'
            ? 'The agent shows the user the company, a link and a user code, and the user signs in on a device of their choosing. Meanwhile the agent keeps the device code private and polls the company with it and the session_id.'
            : 'The user gives the agent credentials for this company, and the agent sends them only to the mediated endpoint that discovery advertised. PAP defines this exchange itself instead of using an OAuth grant, and the company may reply with a challenge the user answers through the agent.',
    });
    await s.clearOverlays();
    await states.hide();
    const seq = await s.show({ source: SIGNIN[method], style: STYLE }, { box: 'main', build: 'frame' });
    const signin = await s.card(
      [
        ['Signs in on', how.where],
        ['Password', how.password],
        ['Proof', how.proof],
      ],
      { at: 'side', fontSize: 0.26 },
    );
    await seq.reveal(2);
    await seq.reveal('rest');
    await seq.mark(how.marks, { color: HOT });
    await signin.mark(how.mark);

    await this.step('tokens', {
      title: 'Sign-in returns a Session Token and an Account Token',
      caption:
        'The marked reply carries two tokens. The Session Token authorizes this session’s requests and is bound to the agent’s key with DPoP, so each use needs a proof signed with that key. The Account Token is a refresh token kept outside model context.',
    });
    await s.clearOverlays();
    await seq.unmark();
    const last = `message:C->A#1`;
    await seq.dim([last]);
    await seq.mark([last], { color: HOT });
    const sessionCard = await s.card(
      [
        ['Kind', 'access token'],
        ['Bound to', 'agent key (DPoP)'],
        ['Authorizes', 'this session'],
      ],
      { at: [2.65, 0.1, 7.55, 3.25], title: 'Session Token', fontSize: 0.25 },
    );
    const accountCard = await s.card(
      [
        ['Kind', 'refresh token'],
        ['Kept', 'outside model context'],
      ],
      { at: [2.65, -4.25, 7.55, -0.6], title: 'Account Token', fontSize: 0.25 },
    );
    await sessionCard.mark('Bound to');
    await accountCard.mark('Kept');

    await this.step('work', {
      title: 'One Session Token reaches the APIs, the website and the company agent',
      caption:
        'With the Session Token and its DPoP proof, the agent can call the company’s APIs, browse its website or talk to its company agent, which can hand off to a human. Every call is still checked against the card: scopes granted at sign-in, the resource’s audience and the user’s task.',
    });
    await s.clearOverlays();
    await seq.hide();
    const work = await s.show(
      {
        source:
          'graph LR\nSession[Authorized Session] --> API[API calls]\nSession --> Web[Web browsing]\nSession --> Conversation[Company Agent]\nConversation --> Human[Human handoff]',
        style: STYLE,
      },
      { box: 'main' },
    );
    await work.walk(
      [
        ['Session', 'API'],
        ['Session', 'Web'],
        ['Session', 'Conversation'],
      ],
      { parallel: true, trail: true },
    );
    await work.walk([['Conversation', 'Human']], { trail: true });
    await work.note('Session', 'Session Token + DPoP', { side: 'below' });
    const limits = await s.card(
      [
        ['Scopes', 'granted at sign-in'],
        ['Audience', 'each resource’s own'],
        ['Intent', 'the user’s task'],
      ],
      { at: 'side', fontSize: 0.24 },
    );
    await limits.mark('Scopes');

    await this.step('boundary', {
      title: 'A reply from Company A cannot approve an action at Company B',
      caption:
        'Company A’s reply reaches the agent as untrusted data, so it cannot approve the action at Company B or stand in for the user. That approval comes from the user, whose task and scopes are the agent’s authority, and secrets stay in the credential store the user chose.',
    });
    await s.clearOverlays();
    await work.hide();
    const trust = await s.show(
      {
        source:
          'graph TB\nUser[User] --> Agent[Personal Agent]\nA[Company A reply] -.-> Agent\nAgent --> B[Action at Company B]\nAgent --> Store[Chosen credential store]',
        style: STYLE,
      },
      { box: 'full' },
    );
    await trust.walk([['User', 'Agent']], { trail: true });
    await trust.walk([['A', 'Agent']], { trail: RED });
    await trust.mark(['A'], { color: RED });
    await trust.note('User', 'authority: task and scopes', { side: 'above' });
    await trust.note('A', 'untrusted data', { side: 'above', color: RED });
    await trust.note('B', 'needs the user’s approval', { side: 'below' });
    await trust.note('Store', 'secrets stay here', { side: 'below' });
    this.state.signin = method;
  }
}
