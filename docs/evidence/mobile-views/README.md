# Mobile views and gallery evidence

Before source: `af83c9a807e24700c85f2d36b8209e5e84311a88`. After source: `e51744a` (player implementation at `3c16f326742cb9253cc7c03105f304b6b7feae08`; the later commit updates only expected page hashes).

Both use the production `npm run demos:build` output, served with `tools/lib/explain-serve.ts`. Before was built from an isolated archive of main; after was built in the working checkout. No screenshots were composited or edited.

Capture: Linux, Node 26.12.1, Chromium 154.0.8037.57 via Playwright 1.64.1, reduced motion, viewports 390 × 844 and 1280 × 900.

To reproduce, build and serve the gallery at each revision. Capture `index.html`, then `oauth-pkce.html` with Show an attacker = Yes. Capture the initial `secret` step and press Next for `authorize`. Wait for the replay control to return and the previous SVG crossfade (`.leaving`) to be removed. On the after revision, use Next view six times to reach view 7, where `code_verifier: not sent` is fully visible. View navigation preserves `step=authorize`.

Review cues: the gallery now states its purpose and links to authoring docs; mobile controls name the current view and distinguish Next view from Next step; authorize view 7 exposes the exact card row named in the unchanged caption. The desktop stage composition remains the same.

Independent checks: the PKCE mobile regression in `test/explain-embed.test.ts` visits the actual label boxes for both attacker cases at 390 × 844, with normal and reduced motion, uses Enter on Next view, and checks touch target height and unchanged step. It fails on the base. The existing stable-layout and desktop/phone playback checks cover the surrounding contract.

Limits: these screenshots cover PKCE’s default case and gallery entry, not every explainer or a full accessibility audit. Mobile still uses several close-ups; this change makes that route visible rather than fitting all relationships into one small view. No deployed-site check is claimed.

## SHA-256

- `after-authorize-1280.png`: `2e4720aca6c1b910a3158155ee8ffba13116e19312f240fa293ebfefc8ac0d7e`
- `after-authorize-390.png`: `f2b7ec2a8018da99867a8a4212aa0c34e7be7c59a949baccc8738e13717ae20e`
- `after-authorize-view-7.png`: `5ed5ffc5b81da873bd41846513623021e1a4b70784216976a4dfa0f984399b34`
- `after-gallery-1280.png`: `9afc0ca9e8e52ea0ae5981267fa1db34f557c233e2956cd302f5e5162dce254c`
- `after-gallery-390.png`: `0fe075e0559a5c4b1c0c970c91170e6c7e7f8f6517a7230f2eae732eba22ac29`
- `after-secret-390.png`: `aa5bd06172bb7a0592f7914e7222e10020d5d6e406a0ce91c8392e7067bc38bd`
- `before-authorize-1280.png`: `2e4720aca6c1b910a3158155ee8ffba13116e19312f240fa293ebfefc8ac0d7e`
- `before-authorize-390.png`: `ba220b6c46d7c4ee9c2185868bdcce02a2d68e9b1abfaa0a140a6792e579c6e4`
- `before-gallery-1280.png`: `3e1bb31407d9d8937b205123f5f53cafc3e43a96b71eb4ca88697100cd225d2c`
- `before-gallery-390.png`: `ac84a7c972060b529d6d9c9f9cde50803c4d6c9aa677eacf494fcb8b73cb79eb`
- `before-secret-390.png`: `8029c605055178a6cf03d9524a3a1eb212d4d3021cc2ba8d25bafc109701abc6`
