# A three-minute demo of Lantern Explainers

## What it does, in one sentence

**Each explanation is one TypeScript `Scene`: the page steps through it at the reader's pace, and the same scene renders a silent, captioned MP4.**

Two properties make the demo worth watching. Every value on screen is computed by a small model the scene calls, and every case a reader can choose is built and checked before anyone opens the page.

## Start it

```sh
npm ci
npm run demos:check
npm run demos:render
npm run demos:serve
```

Open **http://127.0.0.1:5174/explainers/**. The committed diagram snapshots mean this path needs no Chromium; fresh diagram capture and the browser tests do. Video needs FFmpeg. For numbers, read the collection's `evidence.json` and each page's build receipt rather than this document. `npm run demos:review` then opens every served case at 390 px and 1180 px wide, checks captions, artwork, console errors, external connections, response headers and video byte ranges, and saves screenshots under `out/review/`.

## The tour

### 1. A setting changes the lesson

Open **Seasons** (the card "Why June brings polar day to Tromsø and winter to Sydney") at "A computed year of daylight in London". Switch the place to Tromsø, Sydney and Quito. The curve, the June and December dots and the card all change, because `daylightYear()` runs again for each latitude: Tromsø reaches 24 and 0 hours, Sydney's longest day falls in December, and Quito stays near twelve hours all year. With Sydney selected, step back to "June: Sydney's noon Sun at 32.7°" to see the same number drawn as the angle of the noon ray in the side view.

What to say: the reader chose another case, and the scene ran the model again for it when the page was built. No server takes free input.

### 2. Show why a security check exists

Open **OAuth with PKCE** ("Why stealing an authorization code is not enough") with the attacker on, at "A stolen code fails without the verifier". The card puts S256 of the attacker's guessed verifier next to the challenge bound to the code, and the server's reply is `invalid_grant`. The RFC 7636 vector in the first step is computed with SHA-256 and checked against the RFC and Node's crypto in the tests.

Turn the attacker off. That step disappears, so the player announces that it fell back to the first step; Back restores the attacker case and the step. Do not say PKCE replaces the rest of OAuth; the last step lists what it leaves to TLS and exact redirects.

### 3. Connect a diff to the architecture

Open **KV-cache merge request** ("Five added lines put a KV cache in front of D1"). Press Next through the steps: the diff marks the five added lines, the diagram morphs to add the KV cache, and the request step leaves its path lit. Switch between a hit and a miss: on a hit the database is dimmed and its note reads "0 reads"; on a miss the token goes through D1 and the code panel marks the lines that run. The morph is the merge request's edit replayed through Agentic Mermaid's `mutate()` at build time, and a walk on a link the diagram lacks throws.

### 4. Publish it

Open **Two embeds on one host page** from the gallery. Open one transcript: only that iframe grows, and closing it shrinks the iframe again. Change a case in one embed; the other keeps its state. Each page also opens standalone. On a phone, double-tap a part of the stage or use the zoom buttons beside **Next** to read small labels, and **Enlarge** shows the stage, caption and controls full screen.

Then open a video from `out/videos/`, such as `mr-cache.mp4`. It has the same steps and captions as the page, with one chapter per step, a subtitle track, a WebVTT file beside it and a build receipt. It has no audio track.

What to say: the HTML file is the product. It needs no runtime network, account or storage, and the loader script that sizes the iframe is optional. Serve the page over HTTP to show auto-sizing; pages opened from `file:` do not auto-size.

## What else to open

| Explanation | What to look at |
| --- | --- |
| Personal Agent Protocol | Each sign-in method marks the messages that differ from the others in the sequence diagram |
| Lantern | The seek step runs a small scene twice, played and seeked, and shows both frames with the same SVG fingerprint |
| Agentic Mermaid | The two unlabelled edges marked beside `verify(flow)`'s findings, then the two `set_label` operations, and the findings panel morphing to zero warnings |
| State machine | Each event moves the marked state and the bar in the reducer's table; OPENED after closed throws `InvalidTransition` |
| Token bucket | Request chips turn green or red as `allow()` returns; the final chart marks the 429 columns |
| Ring buffer | Native drawing only: the tail wraps into freed slots, or push 6 and 7 are refused with the ring unchanged |
| Git | Each node shows its object's real 7-character id; the add case reuses blob ce01362, the edit case creates three new objects |
| JustBash | The old and returned shells side by side: only the returned shell has `shout.txt` |
| Cooperative limits | With 9 steps the memory clause fires first, with 3 the step clause; the caller receives `LimitError` |
| Glyphs | Ruled advances for Inter and JetBrains Mono, and a text diff morphing glyph by glyph |
| 2password | An offline fixture: per-term search scores, one approval per command or none, and the service token removed from the child environment |

## Claims the evidence supports

- Fourteen explanations, 31 cases, 52 captured diagrams in eight Mermaid families and twelve Agentic Mermaid styles, built from this checkout.
- The page and the video come from the same scene; cases are built ahead; the browser runs no diagram renderer or layout.
- For every case, `explain check` compares played and seeked frames, runs the scene in a bare JavaScript context, analyses motion, fails steps that end on the same picture as the step before, fails colliding or cut-off text and labels under 14 px at a 1280 px stage, and checks that captions fit the video footer. Walks are recorded and checked against real diagram links, and morph edits are replayed.
- Non-text artwork for twelve styles matches Agentic Mermaid's own renderer within a 1/255 mean channel error; lettering is embedded Inter, so typography is excluded from that claim.
- Browser tests cover two cross-origin embeds, origin and source checks, history and fallback, mobile layout, offline use, storage blocked and reading without JavaScript.

## Claims to avoid

- That anything here has been deployed, released or tried by an outside author.
- That the historical prototype's 49-diagram and 110-test numbers describe this checkout.
- That all Mermaid families, style-specific fonts or arbitrary SVG are supported.
- That a 14 px label on a 1280 px stage is readable on a phone before the reader zooms.
- That the models are complete implementations of the systems they explain, or that a caption is proof of a security or scientific claim.
- That video bytes are identical across FFmpeg builds. Seeked SVG frames are the deterministic contract.
