# Publishing

How to put a built page on a website, and how to export the same scene as a video. The contracts behind both (URL parameters, the resize message, header and video formats) are in [the reference](REFERENCE.md).

## Publish a page

1. Build it:

   ```sh
   explain build scene.ts --out public/cache.html
   ```

   In a checkout, use `npm run explain -- build ...`. The HTML file is the whole explainer: every case, poster, transcript, sources and licence notices. It makes no network requests at runtime.

2. Upload `cache.html` to any static host, with `loader.js` if you will use the loader.

3. Send the headers in `cache.html.headers.json` as HTTP response headers for that file. The CSP pins the page's inline script and style by hash, so a CDN that rewrites or minifies the HTML breaks it; rebuild instead.
   - `frame-ancestors` works only as a response header, never from a `<meta>` tag. The recipe allows any site to frame the page (`frame-ancestors *`); replace `*` with your own origins to restrict it.
   - Do not send `X-Frame-Options: DENY` or `SAMEORIGIN` for a page other sites embed. CORS headers do not grant framing.
   - The page that embeds it needs the artifact's origin in its own `frame-src`, and the loader's in `script-src` if it uses the loader.
   - The recipe's `Cache-Control` revalidates on every load. Long-lived caching is safe only for a URL that changes when the content does, such as one with the receipt's `artifactHash` in it.

   For the demo collection, `npm run demos:build && npm run site:export -- <site-root>` copies every page, poster, video and the loader into a site and writes the matching `_headers` block to `out/site-headers.txt`.

4. Embed it with a plain iframe:

   ```html
   <iframe src="/explainers/cache.html?step=request&request=miss"
           title="Why a cache changes the request path"
           style="width:100%;height:640px;border:0;display:block"
           allow="fullscreen"
           loading="lazy"></iframe>
   ```

   The iframe keeps its height and scrolls when the content is taller; captions and the steps list make the page taller on phones. `allow="fullscreen"` lets the reader's Enlarge button work; without it the button is hidden. The page adds an "Open in a new tab" link inside the iframe.

   Or let the loader size the iframe to its content:

   ```html
   <div id="cache-explainer"></div>
   <script src="/explainers/loader.js"
           data-src="/explainers/cache.html?step=request&request=miss"
           data-target="cache-explainer"
           data-title="Why a cache changes the request path"></script>
   ```

   The loader starts the iframe at 640 px, then follows the page's height messages, accepting them only from that iframe's window and the page's origin, so several embeds on one page size independently. It adds the "Open in a new tab" link beside the iframe, in English or French: `data-lang`, or the `lang` option of `mountExplainer`, sets the language, which is otherwise the host page's `lang`. `data-theme="light"` or `"dark"` fixes the player's colours. An application can mount and remove embeds itself:

   ```js
   const dispose = LanternEmbed.mountExplainer(target, '/explainers/cache.html', { title: 'Cache', height: 640, theme: 'auto' });
   dispose(); // removes the iframe, the link and the message listener
   ```

   The loader needs the page on HTTP(S): for a `file:` URL it throws and mounts nothing.

5. Check what the host actually serves; the repository's tests run against local files.
   - `curl -sI https://your.site/explainers/cache.html` shows the CSP and `Cache-Control` from the recipe.
   - The page opens at the step and case in its URL, Next plays, and the transcript opens.
   - With two embeds on one page, opening one transcript resizes only that iframe.
   - Record the `artifactHash` from the receipt beside the URL you published.

## Export a video

Video is optional; the page is the main output. A video of a scene has the same steps as the page, paced by their motion rather than by reading time, with a chapter per step, the captions as subtitles, and a transcript. It is silent.

You need FFmpeg on `PATH` and `@resvg/resvg-js` (`npm i @resvg/resvg-js@^2.6.2`; a checkout's `npm ci` already has it). `check` and `build` need neither.

```sh
explain render scene.ts --out cache.mp4                                # 1280 × 720
explain render scene.ts --out cache-miss.mp4 --case request=miss
explain render scene.ts --out cache.mp4 --all                         # one file per case
explain render scene.ts --out cache.webm --width 1920                 # VP9
explain filmstrip scene.ts --out cache.film.png --every 0.5           # review it first
```

Each step plays its motion under its heading (number, title and the step's `line`), then rests on its picture for up to 2 s while the view pushes in slightly. Write a `line` for every step: it is all the video says on screen besides the title. Look at the filmstrip before publishing: it samples the film mid-motion, where collisions, clipping and stray marks show that a resting picture hides.

Publish `cache.transcript.html` beside the video: it is the text alternative, with each step's title, line, caption and what its picture shows.

`render` stops with an error, naming the step and case, when a line is too wide for the heading or has a character the fonts cannot draw, or when the picture changes during a caption hold. Shorten the line, or finish every change before the step's last `play()` ends. `check` fails a film that stands still too long ([pacing](REFERENCE.md#checks)).

Check a file before publishing it:

```sh
ffprobe -v error -show_streams -show_chapters -of json cache.mp4
ffmpeg -v error -i cache.mp4 -f null -
```

Expect one H.264 video stream at the size asked for, one `mov_text` subtitle stream, a data stream that carries the chapters, no audio, one chapter per step, a frame count equal to `frames` in `cache.mp4.receipt.json`, and a decode with no errors. `npm run demos:render` runs these checks for the demo collection. Video bytes can differ between FFmpeg and resvg builds; the receipt records both versions.
