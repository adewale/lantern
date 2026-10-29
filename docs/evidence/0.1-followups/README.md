# Phone reader and release follow-ups

The cache result now shows both paths together. The rate result shows all thirty outcomes together. Their captions follow the picture before any navigation controls. The OAuth attack step exposes no tour instruction when it has one view.

Base source: `2a3228a48fcdca990819d27e6272dda5a8865f3d` (`v0.1.0`). Head source: `c1c50c70266743c88086ade8e1d78f4f7b244e61`. The captures use each revision’s production collector, HTML builder and response headers, with Chromium 154.0.8037.57, reduced motion, a 960-pixel viewport height and the same named case/step. JSON receipts alongside the images record the source, configuration, HTML and image hashes, byte counts and browser errors. Later commits refresh derived snapshot indexes, strict output pins, test ownership and documentation; they do not change the captured scene or player code.

| Input | Before | After | Inspect |
| --- | --- | --- | --- |
| `mr-cache`, `request=hit`, `step=request`, 390px | [Base](base/cache.png) | [Head](head/cache.png) | Both paths, zero versus one D1 read and the 300-second TTL share one picture. |
| `token-bucket`, `rate=2`, `step=trace`, 390px | [Base](base/bucket.png) | [Head](head/bucket.png) | All three rows and ten request outcomes remain visible together. |
| `oauth-pkce`, `attacker=yes`, `step=attack`, 320px | [Base](base/oauth.png) | [Head](head/oauth.png) | The attack arrows remain visible; the caption is next to them and no impossible Next view instruction appears. |
| `font-metrics`, `step=cuts`, 390px | Absent from the 0.1.0 catalog | [Head](head/font.png) | The same phrase uses real regular, bold and italic EB Garamond cuts, with each advance displayed. |

To regenerate, extract the base with `git archive <base SHA>` into a temporary directory, provide its dependencies, then run the checked-in capture helper twice:

```sh
node docs/evidence/0.1-followups/capture.ts --source /path/to/base --out out/base --ref 2a3228a48fcdca990819d27e6272dda5a8865f3d
node docs/evidence/0.1-followups/capture.ts --source . --out out/head --ref c1c50c70266743c88086ade8e1d78f4f7b244e61 --face
```

`test/explain-phone-summary.test.ts` checks both cache cases and all three rates at 320px and 390px, retaining the 12px reading floor and requiring exactly one opening view. `test/view-readouts.test.ts` owns all thirty outcome marks against an independently fixed schedule and retains the full traced-value readouts on the four detailed steps. Served story claims additionally require actual visible labels and rejected-request strokes. The detailed cache `after` step retains offline, clipping, tour, pan, keyboard and zoom checks in `test/explain-embed.test.ts`. Its stable-navigation assertion caught the first toolbar implementation and passes after the reserved toolbar space was restored.

The new caption/tour tests failed on the original player and scenes. A same-length vendor-byte change failed the glyph checksum assertion. Removing the publication date guard made the undated-release regression fail. Each deliberate defect was restored before continuing. Path compaction is checked against float32 buffer bytes through JSON, including signed underflow, and against byte-identical resting SVGs from real flowchart, timeline and XY snapshots.

The independent font measurements are in [font-metrics-source-vectors.json](font-metrics-source-vectors.json), from HarfBuzz over the original Fontsource WOFF2 files. [The upstream review](upstream-review.md) records the Lantern PR and branch inventory and the backport decisions.

The [0.1.0 archive job](https://github.com/adewale/rayner/actions/runs/40876218823) passed installed-package, Chromium and real lettering-capture validation against the existing tag. Its [GitHub Release](https://github.com/adewale/rayner/releases/tag/v0.1.0) preserves the actual npm tarball, registry integrity and retrospective validation log. It does not claim original publishing-workflow provenance.

These screenshots establish the selected Chromium openings. Automated WebKit emulation and native macOS Safari have separate CI owners. They do not verify physical iPhone hardware, VoiceOver or low-end-phone performance. Startup measurements use three fresh samples at 390×844 with 4× CPU slowdown on localhost; the eight-second median budget is a repeatable surrogate, not a device-performance claim.

The first Mac WebKit run rejected thirteen ResizeObserver delivery-loop errors. Deferring the caption/zoom layout writes to the next frame fixed them; the [Mac browser job](https://github.com/adewale/rayner/actions/runs/40878531545/job/123464227003) then passed both WebKit and native Safari. All four final Chromium PNG hashes also match the earlier captures exactly, so the scheduling repair changes no captured pixels.

The reader property also exposed stale tour metadata after desktop-to-phone resizing. Its minimal regression (632px viewport → 200px → zoom) failed before the repair. The reverse direction with Replay, the fixed regression and the full ten-case property at seed 1 then passed on Node 24.0.0. Resize now refreshes tour choices from cached layouts without changing the active zoom or step. Final captures retain the same four PNG hashes.
