# Backport validation

Local environment: Linux x64, Node 24.22.1, Chromium 154.0.8037.57, pinned fonts, fonttools/Python environment and resvg 2.6.2. The production implementation is `12bc635d5a2ef03a8ea1a1c8e53c25c61e90041c`; later commits separate actual capture manifests, the corrected display-math expectation, page pins and evidence.

| Check | Result |
| --- | --- |
| `npm run check` | Pass, including the installed consumer type check. |
| `npm test` after source and pin refresh | 860 tests: 802 passed, 58 explicit optional skips, no failures. |
| Affected engine/font/SVG/layout/gate/story owners | 92 passed. |
| `FULL=1 FC_SEED=20261028` core/fonts/SVG/layout | 40 passed. The final constructor property additionally draws all positive finite size magnitudes, bounds Float32 materialization, and varies normal/bold; its final 5,000-case run passes and still rejects the old constructor. |
| `EXPLAIN_LETTERING=1 node --test test/lettering*.test.ts` | 89 tests: 83 passed, six explicit skips. Five need browser playback; one needs a separate upstream glyph checkout. |
| Browser checks | 42 non-math cases passed. The initial full command also passed seven math cases but loaded the old display-origin assertion before its correction, producing one assertion failure and two optional skips. Rerunning the complete math file with browser and Python enabled passed nine cases, with only the external glyph checkout skipped. Thus all 51 distinct enabled cases pass across these runs; this is scoped follow-up evidence, not a claim of a second full browser command. |
| Offline outline pages | The browser-only outline check omitted by `test:embeds` passed separately. All five browser-only lettering checks skipped above have actual browser evidence. |
| `npm run demos:check` | All 27 explainers and 142 settings cases passed: 160 pinned diagrams, eight styles and 15 diagram families. The actual builders regenerated HTML, contact sheets and share cards. [Catalog receipt](catalog.json). |
| `npm run demos:review` | All 142 served cases passed at 390 × 844 and 1180 × 980, with no page errors or external runtime connections. Headers, both embeds and 208 link-preview pages passed. This visits each case's selected gallery step, not every step. [Served-case receipt](served-review.json). |
| Installed archive, browser and lettering capture enabled | Pass. `out/release/rayner-0.1.0.tgz` was packed and installed from clean commit `2fb7676450ca321b82ce497e5d129f6fcb10b539`; its manifest records `dirty: false`. Diagram/PNG authoring, installed consumer, bin, native author, Arabic/math capture and playback passed. |

Archive integrity: `sha512-MH3y2VP0RWv3jm2eCL32PjT4pJUZ4l63m+spgsUC+YfUJ+JimcI15VpgHYn61EnI4Bfq62L2Gch1W5rxEsyY/w==`.

The final standard run replays all 27 page/header/receipt pins without update mode. Actual capture refreshed seven lettering manifests through the normal pipeline; their units/runs remain unchanged. The Seasons source manifest was restamped by the normal builder. Source and generated pins are separate commits.

No production files changed after the tested archive was packed. The subsequent constructor-generator and test-guidance changes have their own focused follow-up above.

[Failing controls](controls.json) and the linked logs establish that the repaired tests reject the intended defects. No test was disabled to obtain these results. An initial run exposed the display-math assertion that encoded the old origin and the expected stale page pins; both were corrected and rerun.

These are local correctness results. They do not establish a speed improvement or hosted CI success. GitHub Actions is still disabled (#9), macOS/Safari have not run in this environment, and the external pinned-glyph-checkout oracle remains unrun. No package was published or release tag created.
