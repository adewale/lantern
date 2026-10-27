Evidence images for the issue #21 PR (Next view visits what the step emphasised first). Not part of the project; safe to delete once the PR is merged.

Before: adewale/rayner a4a80d03963a86d804e2b3465ee8a7e9eb68ba6d. After: bed012db9c4ec5d3cc66ddafaffd255000d1426f. Each built from `git archive <sha>` with `collectProject` + `buildExplainer` and captured by `capture.ts` (Chromium via the repo's `tools/lib/browser.ts`, 390 × 844, deviceScaleFactor 2, touch, motion on). Steps: open oauth-pkce (attacker=yes), wait for rest, press Next view once; reload; press Next, wait for authorize to rest, press Next view once.

```
d950727ff84c89e67f5539ccf49783f015e5da2df4ad2448061105a2742d2428  after-authorize-2.png
293b08b48582cd61d5803594d8486de415e8279635e11b4d14ef93da0d2c179c  after-authorize.png
3c7f4be2f4f26d05df27988c6f0e5fb0e1eaeb0623c600eaba59629c21bfacb5  after-secret-2.png
28c288e638a7ed160ac2a97df88162e49f2113a38437ed4c4f8bdbd3eef7d653  after-secret.png
e540693c7146d6cdc6d7aa76265d16506d26241df5efd1161158ec00756354a0  before-authorize-2.png
293b08b48582cd61d5803594d8486de415e8279635e11b4d14ef93da0d2c179c  before-authorize.png
6da5edc954f43db2b4ee55e854ea47fff4cd63933406eabac13d56cd48f628a0  before-secret-2.png
28c288e638a7ed160ac2a97df88162e49f2113a38437ed4c4f8bdbd3eef7d653  before-secret.png
```
