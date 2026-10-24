# Video and still export

Video runs the same native scene as the page at a fixed frame rate. Every declared case is collected before export; the default case is selected unless requested otherwise. The exporter does not use a browser recording or a second animation implementation.

## Commands

```sh
explain render scene.ts --out explanation.mp4 --footer
explain render scene.ts --out stage-only.mp4 --width 1920 --fps 30
explain render scene.ts --out explanation.webm --width 1280
explain render scene.ts --out explanation.mp4 --all --footer
explain render scene.ts --out miss.mp4 --case request=miss --footer
explain shots scene.ts --out steps.png
```

In a checkout, use `npm run explain -- ...`. FFmpeg and ffprobe must be on PATH. `@resvg/resvg-js` is a pinned optional tool dependency; install it if your environment omitted optional packages. Native scenes need no diagram renderer or Chromium to export. A fresh diagram capture requires those build tools; an existing cache can be reused.

## Output contract

| Output | Details |
| --- | --- |
| `.mp4` | Silent H.264, `yuv420p`, no audio stream; subtitle track uses `mov_text` |
| `.webm` | Silent VP9, `yuv420p`; WebVTT subtitle track |
| `.vtt` | Adjacent caption file, one cue per captioned step |
| `.chapters.ffmeta` | Inspectable FFmpeg chapter input, named with stable step ids |
| `.receipt.json` | Source/engine/exporter hashes, settings, snapshot hashes, versions, dimensions, fps, frames, chapter ids |

**Caption footer:** exactly 1280 × 880: a 1280 × 720 stage with a 160-pixel footer. The footer holds step number, title and up to three measured caption lines. Stage and footer are separately drawn with Lantern's embedded outlines, rasterized separately and stacked; no installed font is used. Captions that cannot fit fail with an actionable error instead of being silently truncated.

**Stage only:** 16:9. Any positive even width is accepted. The canvas height rounds to the nearest positive even number for the encoder; the 16:9 viewBox is preserved with fractional-pixel letterboxing when the dimensions cannot express that ratio exactly. FPS must be an integer from 1 to 120. The default is 30.

There is no audio stream or narration. Each `--all` variant receives an encoded setting/value suffix, for example `explanation-request=miss.mp4`. Including ids prevents different combinations such as `a-b`/`c` and `a`/`b-c` from overwriting one another. Settings change the source case, not an in-video menu. Caption reading holds remain in the video; the interactive page instead waits for the reader.

## Determinism and performance

The fixed-dt scene advances every output frame. SVG is generated for each frame, but unchanged SVG during reading holds reuses the previous raster. The footer raster is cached per step. This optimization does not skip simulation or reduce the promised frame count. Resvg explicitly disables system-font loading because all lettering is already geometry.

The receipt distinguishes `frames` from `rasterizedFrames`. Demo batch exports are limited to three processes; unchanged videos are skipped only when scene, engine, exporter and snapshot hashes plus preset/frame rate match. Use `npm run demos:render -- --force` to regenerate them.

Exact SVG/seek agreement is tested. Byte-identical video across different FFmpeg builds, platform encoders or resvg releases is **not** promised. Receipts report the actual FFmpeg version and pinned resvg version so differences can be investigated.

## Validate a file

```sh
ffprobe -v error -show_streams -show_chapters -of json explanation.mp4
ffmpeg -v error -i explanation.mp4 -f null -
npm run test:video
```

Require the expected codec/dimensions, no audio, a caption track, a chapter per step, matching receipt/frame count and a full decode with no errors. The integration test exercises real H.264 footer and VP9 stage-only exports; it does not mock FFmpeg.

Fourteen default-case demo videos are generated and checked by `npm run demos:render`. Browse them through `npm run demos:serve`; the local host supports byte ranges for seeking. Files under `out/` are generated artifacts, not source-control or public-hosting guarantees.
