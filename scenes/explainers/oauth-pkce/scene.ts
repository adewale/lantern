import { Scene, Code, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { pkceChallenge } from '../lib/models.ts';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
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
    const attacker = settingsOf(this).attacker === 'yes',
      challenge = pkceChallenge(VERIFIER),
      s = stage(this, {
        palette: palette('github-light'),
        title: 'OAuth + PKCE · bind this code to this client instance',
      });
    await this.step('secret', {
      title: 'Make a verifier; send only its challenge',
      caption:
        'The client generates a high-entropy verifier. With S256, its challenge is base64url of SHA-256 of the verifier. This scene computes the RFC’s example rather than pasting the answer.',
    });
    await s.card(
      [
        ['Verifier', VERIFIER],
        ['S256 challenge', challenge],
      ],
      { at: [0, 0], width: 14 },
    );
    this.state = { verifier: VERIFIER, challenge };
    await this.step('authorize', {
      title: 'Bind the authorization request',
      caption:
        'The client sends the challenge and S256 method with the authorization request. The verifier stays with the client. The user signs in and grants consent at the authorization server.',
    });
    await s.clearOverlays();
    const seq = await s.show(
      {
        source:
          'sequenceDiagram\n participant C as Client\n participant U as User browser\n participant S as Authorization server\n C->>U: Open authorization with challenge\n U->>S: Sign in and grant consent\n S-->>U: Redirect with code\n U-->>C: Deliver authorization code',
        style: 'github-light',
      },
      { build: 'frame' },
    );
    await seq.reveal('rest');
    await this.step('code', {
      title: 'The redirect carries a code, not the verifier',
      caption:
        'The short-lived code records the authorization grant. It is not itself an access token. This separation matters when an attacker can intercept a redirect.',
    });
    await seq.hide();
    const flow = await s.show({
      source:
        'graph LR\nGrant[Authorization grant] --> Code[Short-lived code]\nCode --> Exchange[Token endpoint]\nVerifier[Private verifier] --> Exchange\nExchange --> Token[Access token]',
      style: 'github-light',
    });
    await flow.walk([
      ['Grant', 'Code'],
      ['Code', 'Exchange'],
    ]);
    if (attacker) {
      await this.step('attack', {
        title: 'A stolen code fails without the verifier',
        caption:
          'The attacker tries a different verifier. Its S256 challenge does not match the one bound to the code. The server rejects the exchange. PKCE does not protect a client whose verifier is also stolen.',
      });
      const bad = pkceChallenge('attacker-does-not-know-the-original-verifier');
      this.state.attackerChallenge = bad;
      this.state.attackerAccepted = bad === challenge;
      await flow.hide();
      await s.card(
        [
          ['Attacker challenge', bad],
          ['Matches bound challenge', String(bad === challenge)],
          ['Result', 'Reject exchange'],
        ],
        { at: [0, 0], width: 14 },
      );
      await s.clearOverlays();
      await flow.build();
    }
    await this.step('exchange', {
      title: 'Prove possession at the token endpoint',
      caption:
        'The legitimate client sends the code and original verifier. The server hashes the verifier and compares it to the stored challenge, alongside its other code and client checks.',
    });
    await flow.walk([
      ['Verifier', 'Exchange'],
      ['Exchange', 'Token'],
    ]);
    this.state.accepted = pkceChallenge(VERIFIER) === challenge;
    await this.step('lifetime', {
      title: 'Different values, different lifetimes',
      caption:
        'This illustrative timeline is not a required timeout policy. It shows that the verifier spans the authorization transaction, the code is brief and single-use, and a token may outlive both.',
    });
    await flow.hide();
    await s.show({
      source:
        'gantt\n dateFormat YYYY-MM-DD\n axisFormat %d\n section Authorization\n Verifier retained :v, 2026-01-01, 3d\n Code issued and exchanged :c, 2026-01-02, 1d\n section API\n Access token :t, 2026-01-03, 4d',
      style: 'github-light',
    });
    await this.step('limits', {
      title: 'PKCE is one defence, not all of OAuth',
      caption:
        'Use TLS, exact redirect validation and the rest of OAuth’s security requirements. PKCE answers a specific question: can this exchanger prove possession of the verifier bound to this code?',
    });
    await s.chip('code + verifier → checked exchange');
  }
}
