# Kyle delivery status

**The local workflow and the fourteen-explainer collection are built and checked. Nothing has been publicly released or deployed.**

Each explanation is one native TypeScript `Scene`. The page steps through it at the reader's pace, and the same scene renders a silent, captioned MP4. Settings such as a sign-in method or a city are finite cases, each built and checked before anyone reads it. Agentic Mermaid 0.4.1 draws the diagrams at build time; the browser receives resolved geometry and never runs it.

This implements the first-release scope of [the proposal](../specs/kyle.md). The proposal's prototype numbers (49 diagrams, 110 tests) describe that prototype, not this checkout.

## Second pass: what readers see

The first local build passed its mechanical checks while teaching poorly. A reader looks at a step's last frame while reading the caption, and in nine of the fourteen explainers some steps ended exactly like the step before. Tokens walked and vanished, highlights pulsed and faded, cards replaced the diagram they described, and the stage heading never changed. Diagrams often filled a thin strip of the stage. The second pass changed the helpers, the checks, the player and every scene.

- **Helpers** (`explain/`): the stage heading follows step titles; content goes into named regions (`main`, `side`, `top`, `bottom`…). Diagrams gain `mark`, `dim`, `note` and walk trails that stay on screen until removed. `s.card()` returns a card whose values `set()` updates and whose rows `mark()` lights. `s.code()` keeps a focus bar on the lines under discussion. In styles whose accent is grey or near-black, emphasis is orange.
- **Checks** (`explain check`, every case): a step fails if its last frame, ignoring the heading, matches the previous step's. Native text that overlaps other text or is cut off by the frame fails, labels must reach 14 px at a 1280 px stage (up from 9 px; diagram labels in some step's last frame), and every caption must fit three lines of the video footer. The checks sample a step's true last frame; the contact sheets and the player's paused view used to show the frame before it.
- **Player**: **Next** plays the step's animation and stops on its last frame instead of jumping there. **Replay step** runs it again, **Enlarge** shows the stage full screen, and the stage zooms and pans (buttons, pinch, double-tap, Ctrl-scroll) so a phone reader can enlarge any label.
- **Scenes**: all fourteen were rewritten against those checks, with values on screen taken from each scene's model. Their titles, captions and on-stage text were then edited with [anti-slop-writing](https://github.com/adewale/anti-slop-writing); that pass also corrected the day-length formula (missing its 24/π factor), a seasons title that was wrong for Sydney, and a glyph caption that misdescribed where label widths come from.

The pass also fixed three bugs that the earlier checks missed:

- **Resizing:** the embed's height reports went through `requestAnimationFrame`, which browsers throttle in offscreen cross-origin frames, so an embed below the fold could stop resizing. It now measures in the `ResizeObserver` callback. The two-embed browser test, which had passed 1 run in 3, passed 5 of 5.
- **Script escaping:** the page builder escaped every `</` in the inlined script, which broke any bundle containing the regex `/</g`; the Lantern page failed to start in the served review. Only `</script` and `<!--` are escaped now, with a regression test.
- **Chromium lookup:** capture looked for Chromium only in the Linux Playwright cache and could pick an incomplete install. It now checks the macOS cache and requires Playwright's `INSTALLATION_COMPLETE` marker.

## Follow-up fixes

- **Phones:** the stage zooms and pans, so small labels can be read on a 390 px screen (see Limits for the numbers).
- **Verifier warnings:** Agentic Mermaid names an edge by its position among all edges (`A->C#1`), while snapshot parts number edges per endpoint pair (`edge:A->C#0`). `findingsOf(snapshot)`, also available as `d.findings()`, resolves each warning to its part through the verifier's own edge order, including parallel edges. The Agentic Mermaid explainer uses it instead of guessing by endpoints. Upstream could still add the part id to each finding.
- **Smallest labels:** the git explainer's "parent" edge label (14.0 px) became a note on the link, and the KV-cache diagram's shorter node names let its "hit" and "miss" labels grow.
- **Reading holds:** a step's caption-reading hold is part of its scene time, so after **Next** the player kept "playing" a still frame for up to about 10 s. Each step now records when its hold begins (`hold` in the trace); the player stops there, and video still plays to `t1`. The three inherited golden traces changed only by gaining that field.
- **Node 26** is the supported runtime in `package.json`, the lockfile, CI and the docs.

## Evidence from this checkout (25 October 2026, Node 26.12.1, macOS, after the follow-up fixes)

| Gate | Result | Command |
| --- | --- | --- |
| TypeScript, declarations, consumer compile | passed | `npm run check` |
| Full suite with browser, video and FULL flags and both oracles | **114 tests: 114 passed, 0 failed, 0 skipped**; Manim at the CI-pinned commit with numpy, and Mermaid 11.4.1 | `MANIM_DIR=… MERMAID_JS=… EXPLAIN_BROWSER=1 EXPLAIN_VIDEO=1 FULL=1 node --expose-gc --test test/*.test.ts` |
| Leak test outside the runner, motion over every inherited scene | passed | `node --expose-gc test/leak.test.ts`, `npm run verify:motion` |
| Every case of every explainer | **31 cases** passed seek, motion, bare runtime, skipped-trace, step-change, text-collision, 14 px label and footer-fit checks; reports keep full program-state traces | `npm run demos:check`, `out/checks/*/report.json` |
| Model fidelity | each case's step-boundary state equals its model; RFC 7636/Node crypto, `git hash-object` and scoped-model oracles | `test/explain-fidelity.test.ts`, `test/explain-models.test.ts` |
| Style fidelity | twelve styles' non-text artwork within 1/255 mean channel error of Agentic Mermaid's renderer; typography excluded | `test/explain-capture.test.ts` |
| Served collection | all **31 cases** at 390 px and 1180 px: captions, artwork, no console errors, no external connections; response headers, video byte ranges and the two-embed page | `npm run demos:review`, `out/review/` |
| Films | all **14** default-case MP4s rebuilt and verified: silent H.264, 1280 × 880, footer, subtitle track, chapters, WebVTT, receipts | `npm run demos:render`, `out/videos/` |
| Installed package | archive install, executable bin, an outside scene with settings, check, build, notices, one compiled engine | `npm run pack:smoke` |
| Inherited application | built | `npm run build` |

The collection has 14 explanations, 31 cases, 52 captured diagrams, eight Mermaid families and twelve styles. Node 26 is the supported runtime, in `package.json` and in CI. Generated artifacts and logs live under `out/` and are not committed.

### Open the demos

```sh
npm run demos:serve
# http://127.0.0.1:5174/explainers/
```

[The demo tour](DEMO-TOUR.md) is a three-minute path through Seasons, OAuth with PKCE, the KV-cache merge request and the two-embed page. To regenerate everything: `npm run demos:check`, `npm run demos:render`, `npm run demos:review`. Fresh diagram capture and the browser tests need Playwright's Chromium (`npx playwright-core install chromium`) or `CHROMIUM_EXECUTABLE_PATH`; video needs FFmpeg and ffprobe.

## Limits and gates still open

- Diagram lettering is embedded Inter, stretched to the width Agentic Mermaid writes into each label's `textLength`, so styles with their own fonts (hand-drawn, pen-and-ink) differ in letterforms.
- The evidence covers eight diagram families and twelve styles. Unsupported SVG features fail the build rather than disappearing.
- A 14 px label at a 1280 px stage is about 4 px on a 390 px phone until the reader zooms; at 4× it is about 17 px.
- The models are scoped and cited, not complete implementations. Seasons is an astronomical approximation. 2password is an offline fixture with made-up items, not a port of its source or an audit of a vault.
- Owner decisions remain: the public name and package (the inherited npm name is still `manim-js`), an accountable maintainer, acceptance by an outside author on a clean machine, and production hosting with checks on the bytes and headers actually served.

Foundation: [ivarvong/lantern](https://github.com/ivarvong/lantern) at `2c7bad533be25fbd56d26a9a2b6c5651743f011e`. Keep the MIT and font notices; see [upstream boundaries](UPSTREAM.md).
