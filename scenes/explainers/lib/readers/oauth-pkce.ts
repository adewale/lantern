import { Group, Arrow } from '../../../../src/index.ts';
import { pkceChallenge } from '../models.ts';
import { label, tile, flow, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  guess = 'attacker-does-not-know-the-original-verifier';
export function frames(attacker: boolean): ReaderFrame[] {
  const challenge = pkceChallenge(verifier),
    matches = pkceChallenge(guess) === challenge;
  return [
    {
      id: 'reader-bind',
      title: 'What is the code bound to?',
      line: 'The client keeps a random verifier and sends its S256 challenge.',
      caption:
        'The server records the challenge alongside the authorization code. To redeem that code, the caller must later supply a verifier whose S256 challenge matches. The verifier is fresh per authorization; it is not a client secret embedded in a public application. The long RFC example values are available in the walkthrough.',
      values: { challenge, verifierKept: true },
      draw: (s) =>
        new Group(
          flow(s, ['Client', 'Auth server', 'Code issued']),
          label('challenge →', -2.6, 2.3, s.emphasis, 0.7),
          label('verifier kept', -5.15, -1.4, s.palette.ink, 0.65),
          label('challenge saved with code', 2.2, -2.8, s.palette.ink, 0.65),
        ),
    },
    {
      id: 'reader-redeem',
      title: attacker ? 'Can the thief redeem the stolen code?' : 'Why does the client’s verifier work?',
      line: 'Same code; compare the submitted verifiers.',
      caption: attacker
        ? 'The attacker has the code but not the verifier. Hashing a guess does not match the saved challenge, so the token request fails with invalid_grant. The legitimate client submits its verifier and matches. PKCE protects this exchange; it is not a defence against an attacker that has also stolen the verifier.'
        : 'The legitimate client submits the code and its verifier. The server hashes the verifier, matches the saved challenge and issues the token. Sending only the challenge at authorization kept the verifier out of that earlier redirect path.',
      values: { attacker, legitimate: true, guessMatches: matches },
      draw: (s) =>
        table(
          ['Caller', 'S256 matches?', 'Result'],
          [['Client', 'yes', 'token'], ...(attacker ? [['Attacker', matches ? 'yes' : 'no', 'invalid_grant']] : [])],
          s,
          { xs: [-5.2, 0, 5.2], y: 2, gap: 1.6 },
        ),
    },
  ];
}
