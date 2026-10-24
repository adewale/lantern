# A clean demo of Lantern Explainers

## The one-sentence description

**Lantern turns one native TypeScript explanation into a reader-paced website embed and a silent captioned video—with real diagram styles, meaningful alternative cases and checks that the animation follows the program.**

The pitch is not “an easier diagram editor,” “shorter scene code” or “a hosted AI video generator.” The author controls the lesson; the reader controls the pace. The same source drives the embed and film.

## Start it

```sh
npm ci
npm run demos:check
npm run demos:render
npm run demos:serve
```

Open **http://127.0.0.1:5174/explainers/**. Checked-in snapshots make this path independent of Chromium; install Chromium for fresh capture and the separate browser gates. FFmpeg is needed for video. The collection's `evidence.json` and each artifact receipt report the build, rather than relying on marketing numbers in this document. After rendering, `npm run demos:review` opens every served case at desktop/mobile widths, checks captions and artwork, rejects console errors/external connections, checks response headers and video byte ranges, and saves screenshots under `out/review/`.

## A three-minute tour

### 1. A different case should change the lesson

Open **Seasons**, chapter “A computed year.” Change London to Tromsø, then Sydney, then Quito. The curve changes because the executable daylight model changes. Tromsø reaches 24/0-hour extremes, Sydney reverses the hemispheric story and Quito stays near twelve hours. The authored style stays fixed.

Say: “The setting is another complete explanation, not a palette switch or a free input sent to a server.” The caption states the astronomical approximation and its limits.

### 2. Explain why a security check exists

Open **OAuth with PKCE** with the attacker enabled. Visit “A stolen code fails without the verifier.” The computed RFC 7636 challenge is independently checked against the RFC vector and Node crypto. Turn the attacker off: that chapter disappears, and the player announces its first-step fallback. Use Back to restore the same case and chapter.

Say: “The case can change the sequence of ideas, not just a number in a picture.” Do not imply PKCE replaces the rest of OAuth security.

### 3. Bridge code and architecture

Open **KV-cache code review**. Show the diff, then animate the architecture change. Follow a hit, switch to a miss and replay the request. Tokens travel captured real links; invalid hops throw. The cache mutation is replayed through the actual diagram model at build time.

Say: “This is an ordinary Scene. Native code, a styled diagram and its checks are in one authoring model.”

### 4. The publishing contract matters

Open **Two real embeds** from the gallery. Expand one transcript; only that iframe grows. Collapse it; it shrinks. Switch a case without resetting the other explanation. Open either page standalone.

Then follow a **Captioned MP4** link. It has the same stages and captions, not a manually reproduced video. Show its chapters, subtitle track, adjacent VTT and receipt. No audio is expected.

Say: “The file is portable. The loader is optional. The explanation needs no runtime network, account or storage.” Serve through HTTP to demonstrate auto-sizing; file-origin auto-sizing is intentionally unsupported.

## More evidence-rich examples

| Example | What to notice |
| --- | --- |
| Personal Agent Protocol | Four diagram families; three sign-in cases; explicit trust/secret boundaries |
| Lantern | A native Scene explaining objects, animations, deterministic time, sinks and its own publishing pipeline |
| Agentic Mermaid | Real verifier findings, typed repair operations and their replay check |
| State machine | Both histories use the reducer, not hand-selected “next state” labels |
| Token bucket | Three rates, the same request schedule, actual responses and computed balance chart |
| Ring buffer | Native geometry; wrapping is visible; rejected pushes preserve all state |
| Git | Real typed-object SHA-1 encodings; both cases checked against `git hash-object` |
| JustBash | An explicitly scoped interpreter model; the old shell really remains unchanged |
| Cooperative limits | A smaller step budget changes which first-match clause wins; readable focus views |
| Glyphs | Actual font advances and outlines; Inter and JetBrains Mono differ measurably |
| 2password | An explicitly labeled offline fixture of metadata search and environment hygiene—not a claim to have ported unavailable code |

## What we can honestly claim

- Fourteen local explanations, 31 built cases, 43 diagrams, eight families and twelve authored diagram styles.
- Same-scene HTML and video; prebuilt cases; no runtime diagram renderer or layout service.
- Real-link walk traces, replayed edits, exact sampled seek comparisons, full-run motion checks and bare-runtime execution for all cases.
- Twelve-style non-text raster comparisons against the real renderer, within a stated 1/255 mean channel-error tolerance for path quantization. This is not a pixel-identical typography claim.
- Real cross-origin browser tests, generated CSP, mobile/offline/no-JavaScript checks, and decoded default-case videos.

## What not to claim

- That these local files have been deployed, publicly released or reviewed by an outside author.
- That the historical prototype's 49-diagram/110-test numbers describe this checkout.
- That all Mermaid families, style-specific fonts or arbitrary SVG features are supported.
- That a 9 px label at a 1280-pixel stage is necessarily readable on a phone. Use authored focus views and the transcript.
- That the models execute every external implementation, or that an attractive caption is proof of a security or scientific claim.
- That video bytes match across FFmpeg builds. Exact SVG seeking is the stronger deterministic contract.
