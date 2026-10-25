import { Scene } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
const STYLE = 'nord';
/** Nord orange: marks that must stand out from the frost-blue diagrams. */
const HOT = '#d08770';
const SIGNIN = {
  direct:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n A->>C: Open authorization with PKCE and key thumbprint\n U->>C: Sign in and approve scopes\n C-->>A: Authorization code\n A->>C: Code, verifier and key proof\n C-->>A: Account and Session Tokens',
  device:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n A->>C: Request device authorization\n C-->>A: Link, user code and private device code\n A-->>U: Show company, link and user code\n U->>C: Sign in and approve on another device\n A->>C: Poll with device code and key proof\n C-->>A: Account and Session Tokens',
  mediated:
    'sequenceDiagram\n participant U as User\n participant A as Personal Agent\n participant C as Company\n U->>A: Supply credentials for this issuer\n A->>C: Credentials to mediated endpoint\n C-->>A: Optional one-time code request\n U->>A: Supply the code\n A->>C: Code for this sign-in\n C-->>A: Account and Session Tokens',
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
    sources: ['https://personalagentprotocol.org/docs/0.3/spec', 'https://www.rfc-editor.org/rfc/rfc9449'],
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
      s = stage(this, { style: STYLE });

    await this.step('map', {
      title: 'Discovery comes first, then a session',
      caption:
        'A Personal Agent acts for one user with a company. Draft 0.3 of the Personal Agent Protocol covers six areas: discovery, sessions and authorization, web browsing, APIs, conversations and extensions. The agent starts with the two marked areas, discovery and then a session.',
    });
    const map = await s.show(
      {
        source: 'mindmap\n root((Company))\n  Discovery\n  Sessions\n  Web\n  APIs\n  Conversations\n  Extensions',
      },
      { box: 'full' },
    );
    await map.mark(['Discovery', 'Sessions'], { color: HOT });
    await map.note('Discovery', 'first', { side: 'right', color: HOT });
    await map.note('Sessions', 'then', { side: 'above', color: HOT });

    await this.step('discover', {
      title: 'The domain names its issuer, and the issuer lists the domain back',
      caption:
        'The agent fetches poppy.json from the company’s domain. The file names an OAuth issuer, and the issuer’s metadata must list that domain in protected_resources. The agent checks both directions, so a domain cannot claim another company’s issuer and receive its tokens.',
    });
    await s.clear();
    const discovery = await s.show(
      {
        source:
          'graph LR\nDomain[example.com] --> Poppy[poppy.json]\nPoppy -->|auth.issuer| Issuer[Issuer metadata]\nIssuer -->|protected_resources| Domain',
      },
      { box: 'top' },
    );
    await discovery.walk(
      [
        ['Domain', 'Poppy'],
        ['Poppy', 'Issuer'],
      ],
      { trail: true },
    );
    await discovery.walk([['Issuer', 'Domain']], { trail: HOT });
    const found = await s.card(
      [
        ['organization.domain', 'the host that served it'],
        ['Metadata issuer', 'equals auth.issuer'],
        ['protected_resources', 'lists https://example.com'],
      ],
      { at: [-5, -4.25, 5, -0.9], fontSize: 0.28 },
    );
    await found.mark('protected_resources');

    await this.step('session', {
      title: 'A session starts signed out, named by its key',
      caption:
        'The agent makes a new key pair for each session, and the key’s thumbprint names the session at the company’s token endpoint. The session starts signed out; signing in attaches one account. After sign-out it can sign in again only to that same account.',
    });
    await s.clear();
    const states = await s.show(
      {
        source:
          'stateDiagram-v2\n direction LR\n state "Signed out" as SignedOut\n state "Signed in" as SignedIn\n state "Signed out again" as SignedOutAgain\n SignedOut --> SignedIn: Sign in\n SignedIn --> SignedOutAgain: Sign out\n SignedOutAgain --> SignedIn: Same account only',
      },
      { box: regionBox('top', { bottom: -0.2 }) },
    );
    let state: string = 'SignedOut';
    const session = await s.card(
      [
        ['Named by', 'session key thumbprint'],
        ['Account', 'none yet'],
      ],
      { at: regionBox('bottom', { top: -1.0 }), fontSize: 0.28 },
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
          ? 'The user signs in on the company’s own page, so the password never reaches the agent. The code is bound to the session key’s thumbprint, and the agent exchanges it with its PKCE verifier and a proof signed by that key.'
          : method === 'device'
            ? 'The agent shows the user the company, a link and a user code, and the user signs in on a device of their choosing. Meanwhile the agent keeps the device code private and polls with it, signing each poll with the session key.'
            : 'The user gives the agent credentials for this company, and the agent sends them only to the mediated endpoint in poppy.json. PAP defines this exchange itself, and calls it transitional; the company may send the user a one-time code that the agent submits.',
    });
    await s.clear();
    const seq = await s.show({ source: SIGNIN[method] }, { box: 'main', build: 'frame' });
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
        'The marked reply carries two tokens. The Session Token authorizes this session’s requests and is bound to the session key with DPoP, so each use needs a proof signed with that key. The Account Token is a refresh token kept outside model context.',
    });
    await s.clearOverlays();
    await seq.unmark();
    const last = `message:C->A#1`;
    await seq.dim([last]);
    await seq.mark([last], { color: HOT });
    const sessionCard = await s.card(
      [
        ['Kind', 'access token'],
        ['Bound to', 'session key (DPoP)'],
        ['Authorizes', 'this session'],
      ],
      { at: regionBox('side', { bottom: 0.1 }), title: 'Session Token', fontSize: 0.25 },
    );
    const accountCard = await s.card(
      [
        ['Kind', 'refresh token'],
        ['Kept', 'outside model context'],
      ],
      { at: regionBox('side', { top: -0.6 }), title: 'Account Token', fontSize: 0.25 },
    );
    await sessionCard.mark('Bound to');
    await accountCard.mark('Kept');

    await this.step('work', {
      title: 'One session reaches the APIs, the website and the company agent',
      caption:
        'With the Session Token and a DPoP proof, the agent calls the company’s APIs and talks to its company agent, which can hand off to a person. Its browser joins the same session and carries a cookie instead. The scopes granted at sign-in limit every call.',
    });
    await s.clear();
    const work = await s.show(
      {
        source:
          'graph LR\nSession[Authorized Session] --> API[API calls]\nSession --> Web[Web browsing]\nSession --> Conversation[Company Agent]\nConversation --> Human[Human handoff]',
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
    const limits = await s.card(
      [
        ['APIs', 'Session Token'],
        ['Company agent', 'Session Token'],
        ['Website', 'session cookie'],
        ['Scopes', 'granted at sign-in'],
      ],
      { at: 'side', fontSize: 0.24 },
    );
    await limits.mark('Scopes');

    await this.step('boundary', {
      title: 'A reply from Company A cannot approve an action at Company B',
      caption:
        'Company A’s reply reaches the agent as untrusted data, so it cannot approve the action at Company B or stand in for the user. That approval comes from the user, whose task and scopes are the agent’s authority, and secrets stay in the credential store the user chose.',
    });
    await s.clear();
    const trust = await s.show(
      {
        source:
          'graph TB\nUser[User] --> Agent[Personal Agent]\nA[Company A reply] -.-> Agent\nAgent --> B[Action at Company B]\nAgent --> Store[Chosen credential store]',
      },
      { box: 'full' },
    );
    await trust.walk([['User', 'Agent']], { trail: true });
    await trust.walk([['A', 'Agent']], { trail: s.bad });
    await trust.mark(['A'], { color: s.bad });
    await trust.note('User', 'authority: task and scopes', { side: 'above' });
    await trust.note('A', 'untrusted data', { side: 'above', color: s.bad });
    await trust.note('B', 'needs the user’s approval', { side: 'below' });
    await trust.note('Store', 'secrets stay here', { side: 'below' });
    this.state.signin = method;
  }
}
