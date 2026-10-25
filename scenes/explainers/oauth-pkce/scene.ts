import { Scene } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
import { pkceChallenge, sha256 } from '../lib/models.ts';
const STYLE = 'github-light';
// RFC 7636 appendix B's example verifier; everything derived from it is computed below.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const GUESS = 'attacker-does-not-know-the-original-verifier';
// One colour per value, so the reader can follow each across the flow (outcomes use the stage's good and bad).
const CHALLENGE = '#0969da',
  CODE = '#bc4c00';
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const short = (s: string, n = 12) => (s.length > n ? s.slice(0, n) + '…' : s);
function sequence(attacker: boolean): string {
  return [
    'sequenceDiagram',
    ' participant C as Client',
    ' participant S as Auth server',
    ...(attacker ? [' participant X as Malicious app'] : []),
    ' C->>S: Authorize request + code_challenge',
    ' S-->>C: Redirect with code',
    ...(attacker
      ? [' S-->>X: Redirect via the shared URI scheme', ' X->>S: Token request: code + a guess', ' S-->>X: invalid_grant']
      : []),
    ' C->>S: Token request: code + code_verifier',
    ' S-->>C: Access token',
  ].join('\n');
}
export default class OAuthExplainer extends Scene {
  static meta = {
    id: 'oauth-pkce',
    title: 'Why stealing an authorization code is not enough',
    sources: ['https://www.rfc-editor.org/rfc/rfc7636', 'https://www.rfc-editor.org/rfc/rfc6749'],
  };
  static settings = [
    {
      id: 'attacker',
      label: 'Show an attacker',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ];
  override async construct() {
    const attacker = settingsOf(this).attacker === 'yes';
    const digest = sha256(VERIFIER),
      challenge = pkceChallenge(VERIFIER),
      s = stage(this, { style: STYLE });

    await this.step('secret', {
      title: 'The client keeps the verifier and sends only its challenge',
      caption:
        'PKCE protects public clients, such as mobile and desktop apps, which cannot keep a client secret. The client generates a random verifier, and the S256 challenge is the base64url SHA-256 of it. The card starts from RFC 7636’s example verifier.',
    });
    const derive = await s.show(
      {
        source:
          'graph LR\nV[code_verifier] -->|SHA-256| H[32-byte digest]\nH -->|base64url| C[code_challenge]',
      },
      { box: regionBox('full', { bottom: 0, top: 3.15 }) },
    );
    const values = await s.card(
      [
        ['code_verifier', VERIFIER],
        ['SHA-256 (hex)', hex(digest)],
        ['code_challenge', challenge],
      ],
      { at: regionBox('full', { bottom: -3.9, top: -0.4 }), fontSize: 0.27 },
    );
    await derive.walk(
      [
        ['V', 'H'],
        ['H', 'C'],
      ],
      { trail: true },
    );
    await derive.mark(['C'], { color: CHALLENGE });
    await values.mark('code_challenge');
    this.state = { verifier: VERIFIER, challenge };

    await this.step('authorize', {
      title: 'The authorization request carries the challenge and S256',
      caption:
        'The client sends the challenge and the S256 method in the authorization request, through the user’s browser, while the verifier stays with the client, as the card’s last row shows. The user then signs in and consents at the auth server.',
    });
    await s.clear();
    const seq = await s.show({ source: sequence(attacker) }, { box: 'main', build: 'frame' });
    const request = await s.card(
      [
        ['code_challenge', short(challenge)],
        ['method', 'S256'],
        ['code_verifier', 'not sent'],
      ],
      { at: 'side', fontSize: 0.26 },
    );
    await seq.reveal(['message:C->S#0']);
    await seq.mark(['message:C->S#0'], { color: CHALLENGE, as: 'carries the challenge' });
    await request.mark('code_challenge');

    await this.step('code', {
      title: 'The redirect carries a short-lived code bound to the challenge',
      caption:
        'The server stores the challenge with a short-lived code and redirects the browser back to the client. Because the verifier never travelled, anyone who intercepts this redirect gets only the code, which must still be exchanged for an access token.',
    });
    await s.clearOverlays();
    await seq.reveal(['message:S->C#0']);
    await seq.mark(['message:S->C#0'], { color: CODE, as: 'carries the code' });
    const redirect = await s.card(
      [
        ['bound challenge', short(challenge)],
        ['code_verifier', 'not in it'],
      ],
      { at: 'side', fontSize: 0.26 },
    );
    await redirect.mark('bound challenge');

    if (attacker) {
      await this.step('attack', {
        title: 'A stolen code fails without the verifier',
        caption:
          'Another app on the device registered the client’s custom URI scheme, so the operating system handed it the redirect and its code (RFC 7636 §1). It has to guess the verifier; S256 of the guess does not match the bound challenge, so the server answers invalid_grant.',
      });
      const bad = pkceChallenge(GUESS);
      this.state.attackerChallenge = bad;
      this.state.attackerAccepted = bad === challenge;
      await s.clearOverlays();
      await seq.reveal(['message:S->X#0', 'message:X->S#0', 'message:S->X#1']);
      await seq.mark(['message:S->X#0', 'message:X->S#0', 'message:S->X#1'], { color: s.bad, as: 'attack' });
      const check = await s.card(
        [
          ['guessed verifier', short(GUESS)],
          ['S256(guess)', short(bad)],
          ['bound challenge', short(challenge)],
          ['match', String(bad === challenge)],
        ],
        { at: 'side', fontSize: 0.26 },
      );
      await check.mark('match');
    }

    await this.step('exchange', {
      title: 'The token endpoint returns a token only when S256(verifier) matches',
      caption:
        'The real client sends the code with the original verifier. The server computes S256 of the verifier, finds that it matches the challenge stored with the code, and returns an access token once its usual code and client checks also pass.',
    });
    await s.clearOverlays();
    await seq.reveal(['message:C->S#1', 'message:S->C#1']);
    await seq.mark(['message:C->S#1', 'message:S->C#1'], { color: s.good, as: 'accepted' });
    const recomputed = pkceChallenge(VERIFIER);
    const accepted = recomputed === challenge;
    const verify = await s.card(
      [
        ['code_verifier', short(VERIFIER)],
        ['S256(verifier)', short(recomputed)],
        ['bound challenge', short(challenge)],
        ['match', String(accepted)],
      ],
      { at: 'side', fontSize: 0.26 },
    );
    await verify.mark('match');
    this.state.accepted = accepted;

    await this.step('channels', {
      title: 'The verifier never travels where the code does',
      caption:
        'The challenge and the code pass through the browser and the operating system, where another app can read them. The verifier, 32 random bytes, goes only in the client’s own TLS request to the token endpoint. S256 cannot be reversed, so the challenge and the code alone cannot be exchanged.',
    });
    await s.clearOverlays();
    await seq.unmark();
    await seq.mark(['message:C->S#0', 'message:S->C#0', ...(attacker ? ['message:S->X#0'] : [])], {
      color: s.bad,
      as: 'readable on the device',
    });
    await seq.mark(['message:C->S#1'], { color: s.good, as: 'direct TLS' });
    const paths = await s.card(
      [
        ['Via browser', 'challenge, code'],
        ['Direct, TLS', 'verifier'],
        ['Verifier', '32 random bytes'],
      ],
      { at: 'side', fontSize: 0.26 },
    );
    await paths.mark('Direct, TLS');
  }
}
