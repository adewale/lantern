import { Scene } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { pkceChallenge, sha256 } from '../lib/models.ts';
const STYLE = 'github-light';
// RFC 7636 appendix B's example verifier; everything derived from it is computed below.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const GUESS = 'attacker-does-not-know-the-original-verifier';
// One colour per value, so the reader can follow each across the flow.
const CHALLENGE = '#0969da',
  CODE = '#bc4c00',
  VERIFIED = '#1a7f37',
  ATTACK = '#cf222e';
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const short = (s: string, n = 12) => (s.length > n ? s.slice(0, n) + '…' : s);
function sequence(attacker: boolean): string {
  return [
    'sequenceDiagram',
    ' participant C as Client',
    ' participant S as Auth server',
    ...(attacker ? [' participant X as Attacker'] : []),
    ' C->>S: Authorize request + code_challenge',
    ' S-->>C: Redirect with code',
    ...(attacker
      ? [' S-->>X: Same redirect, intercepted', ' X->>S: Token request: code + a guess', ' S-->>X: invalid_grant']
      : []),
    ' C->>S: Token request: code + code_verifier',
    ' S-->>C: Access token',
  ].join('\n');
}
export default class OAuthExplainer extends Scene {
  static meta = {
    id: 'oauth-pkce',
    title: 'Why stealing an authorization code is not enough',
    sources: ['https://www.rfc-editor.org/rfc/rfc7636#appendix-B', 'https://www.rfc-editor.org/rfc/rfc6749'],
  };
  static settings = [
    {
      id: 'attacker',
      label: 'Show an attacker',
      default: 'no',
      options: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ],
    },
  ];
  override async construct() {
    const attacker = settingsOf(this).attacker === 'yes';
    let stolen = 'not attempted';
    const digest = sha256(VERIFIER),
      challenge = pkceChallenge(VERIFIER),
      s = stage(this, { palette: palette('github-light') });

    await this.step('secret', {
      title: 'The client keeps the verifier and sends only its challenge',
      caption:
        'The client generates a high-entropy verifier; with the S256 method, the challenge is the base64url encoding of its SHA-256 digest. The card starts from RFC 7636’s example verifier, and the scene computes the other two rows.',
    });
    const derive = await s.show(
      {
        source:
          'graph LR\nV[code_verifier] -->|SHA-256| H[32-byte digest]\nH -->|base64url| C[code_challenge]',
        style: STYLE,
      },
      { box: [-7.55, 0.1, 7.55, 3.25] },
    );
    const values = await s.card(
      [
        ['code_verifier', VERIFIER],
        ['SHA-256 (hex)', hex(digest)],
        ['code_challenge', challenge],
      ],
      { at: [-7.55, -4.25, 7.55, -0.6], title: 'RFC 7636 appendix B, computed', fontSize: 0.27 },
    );
    await derive.walk(
      [
        ['V', 'H'],
        ['H', 'C'],
      ],
      { trail: true },
    );
    await derive.mark(['C'], { color: CHALLENGE });
    await derive.note('V', 'stays on the client', { side: 'below', color: VERIFIED });
    await derive.note('C', 'sent to the server', { side: 'below', color: CHALLENGE });
    await values.mark('code_challenge');
    this.state = { verifier: VERIFIER, challenge };

    await this.step('authorize', {
      title: 'The authorization request carries the challenge and S256',
      caption:
        'The client sends the challenge and the S256 method in the authorization request, through the user’s browser, while the verifier stays with the client, as the card’s last row shows. The user then signs in and consents at the auth server.',
    });
    await s.clearOverlays();
    await derive.hide();
    const seq = await s.show({ source: sequence(attacker), style: STYLE }, { box: 'main', build: 'frame' });
    const request = await s.card(
      [
        ['code_challenge', short(challenge)],
        ['method', 'S256'],
        ['code_verifier', 'not sent'],
      ],
      { at: 'side', title: 'Authorization request', fontSize: 0.26 },
    );
    await seq.reveal(['message:C->S#0']);
    await seq.mark(['message:C->S#0'], { color: CHALLENGE });
    await seq.note('message:C->S#0', 'via the user’s browser', { side: 'below', color: CHALLENGE });
    await request.mark('code_challenge');

    await this.step('code', {
      title: 'The redirect carries a short-lived code bound to the challenge',
      caption:
        'The server stores the challenge with a short-lived code and redirects the browser back to the client. Because the verifier never travelled, anyone who intercepts this redirect gets only the code, which must still be exchanged for an access token.',
    });
    await s.clearOverlays();
    await seq.clearNotes();
    await seq.reveal(['message:S->C#0']);
    await seq.mark(['message:S->C#0'], { color: CODE });
    await seq.note('message:S->C#0', 'code only, no verifier', { side: 'below', color: CODE });
    const redirect = await s.card(
      [
        ['carries', 'code'],
        ['code_verifier', 'not in it'],
        ['code bound to', short(challenge)],
        ['code is', 'short-lived'],
      ],
      { at: 'side', title: 'Redirect', fontSize: 0.26 },
    );
    await redirect.mark('code bound to');

    if (attacker) {
      await this.step('attack', {
        title: 'A stolen code fails without the verifier',
        caption:
          'The attacker has the code but has to guess a verifier. S256 of the guess does not match the challenge bound to the code, so the server answers invalid_grant. If the verifier were stolen as well, this check would pass.',
      });
      const bad = pkceChallenge(GUESS);
      this.state.attackerChallenge = bad;
      this.state.attackerAccepted = bad === challenge;
      stolen = bad === challenge ? 'accepted' : 'rejected: invalid_grant';
      await s.clearOverlays();
      await seq.clearNotes();
      await seq.reveal(['message:S->X#0', 'message:X->S#0', 'message:S->X#1']);
      await seq.mark(['message:S->X#0', 'message:X->S#0', 'message:S->X#1'], { color: ATTACK });
      const check = await s.card(
        [
          ['code', 'stolen, valid'],
          ['guessed verifier', short(GUESS)],
          ['S256(guess)', short(bad)],
          ['bound challenge', short(challenge)],
          ['match', String(bad === challenge)],
          ['result', bad === challenge ? 'token' : 'invalid_grant'],
        ],
        { at: 'side', title: 'Attacker’s exchange', fontSize: 0.26 },
      );
      await check.mark('match');
      await seq.note('message:S->X#1', 'S256(guess) ≠ bound challenge', { side: 'below', color: ATTACK });
    }

    await this.step('exchange', {
      title: 'The token endpoint returns a token only when S256(verifier) matches',
      caption:
        'The real client sends the code with the original verifier. The server computes S256 of the verifier, finds that it matches the challenge stored with the code, and returns an access token once its usual code and client checks also pass.',
    });
    await s.clearOverlays();
    await seq.clearNotes();
    await seq.reveal(['message:C->S#1', 'message:S->C#1']);
    await seq.mark(['message:C->S#1', 'message:S->C#1'], { color: VERIFIED });
    const recomputed = pkceChallenge(VERIFIER);
    const accepted = recomputed === challenge;
    const verify = await s.card(
      [
        ['code_verifier', short(VERIFIER)],
        ['S256(verifier)', short(recomputed)],
        ['bound challenge', short(challenge)],
        ['match', String(accepted)],
        ['result', accepted ? 'access token' : 'invalid_grant'],
      ],
      { at: 'side', title: 'Token endpoint check', fontSize: 0.26 },
    );
    await verify.mark('match');
    await seq.note('message:S->C#1', 'only after S256(verifier) matches', { side: 'below', color: VERIFIED });
    this.state.accepted = accepted;

    await this.step('lifetime', {
      title: 'The access token outlives the verifier and the code',
      caption:
        'The client holds the verifier for the authorization transaction, the code is brief and single-use, and the access token can outlive both. The minutes on the chart are illustrative; real expiry is set by the server’s policy.',
    });
    await s.clearOverlays();
    await seq.hide();
    const time = await s.show(
      {
        source:
          'gantt\n dateFormat HH:mm\n axisFormat %H:%M\n tickInterval 2minute\n section Client\n code_verifier held :v, 00:00, 4m\n section Auth server\n challenge stored :ch, 00:01, 3m\n code valid :c, 00:02, 2m\n section API\n access token :t, 00:04, 8m',
        style: STYLE,
      },
      { box: [-7.55, -3.3, 7.55, 3.25] },
    );
    await time.mark(['task:c'], { color: CODE });
    await time.note('task:c', 'single use', { side: 'right', color: CODE });
    await time.note('task:t', 'outlives both', { side: 'above', color: VERIFIED });
    await s.note('Illustrative minutes; real expiry is the server’s policy.', { at: [0, -3.85], size: 0.26 });

    await this.step('limits', {
      title: 'PKCE adds one check: does the exchanger hold the verifier?',
      caption:
        'A token still depends on TLS, exact redirect matching and OAuth’s code and client checks, drawn before it in the chain. PKCE asks only whether this exchanger holds the verifier bound to the code, so a stolen verifier gets past it.',
    });
    await s.clearOverlays();
    await time.hide();
    const checks = await s.show(
      {
        source:
          'graph LR\nTLS[TLS] --> Redirect[Exact redirect]\nRedirect --> Client[Code + client checks]\nClient --> PKCE[PKCE: S256 match]\nPKCE --> Token[Token]',
        style: STYLE,
      },
      { box: [-7.55, 0.7, 7.55, 3.25] },
    );
    await checks.walk(
      [
        ['TLS', 'Redirect'],
        ['Redirect', 'Client'],
        ['Client', 'PKCE'],
        ['PKCE', 'Token'],
      ],
      { trail: true },
    );
    await checks.mark(['PKCE'], { color: VERIFIED });
    await checks.note('PKCE', 'checks the verifier', { side: 'below', color: VERIFIED });
    const scope = await s.card(
      [
        ['PKCE answers', 'does the exchanger hold the verifier?'],
        ['Does not cover', 'a verifier stolen too'],
        ['Still required', 'TLS, exact redirects'],
        ['Stolen code here', stolen],
      ],
      { at: [-7.55, -4.25, 7.55, -0.1], fontSize: 0.32 },
    );
    await scope.mark('PKCE answers');
  }
}
