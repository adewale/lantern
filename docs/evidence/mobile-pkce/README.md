# Mobile PKCE close-up evidence

Source revision: bd6f4d980f68d1a0b59f5f17fd16c5b955e9f824
Environment: Chromium 154.0.8037.57 on Linux; 390 × 844 CSS pixels; mobile/touch context.

Both captures show resting states, not animation frames. The source was built from a git archive of that revision using collectProject and buildExplainer. Initial uses the default attacker=yes case. Authorize follows one Next step action and waits until the Replay step control returns.

Initial shows a cropped values card. Authorize shows the Client/Auth server exchange while the caption refers to the card's last row, outside this view. The initial close-up navigation exposes six views within the step.

Reproduce with Node 26+, npm ci, and npm run explain -- preview scenes/explainers/oauth-pkce/scene.ts. Open the printed URL at 390 × 844, keep Show an attacker = Yes, inspect the first step, then press Next and wait for the animation to finish.

PNG SHA-256 hashes:
{
  "docs/evidence/mobile-pkce/initial.png": "c42e4c53ef0de1447829fae98feb70612619e6c3938bad42029c5eaaf7be6ecd",
  "docs/evidence/mobile-pkce/authorize.png": "9b352ae4e3b85098912b28886b6251a54b4360bb7de5b26c17af81c75ff1048e"
}
