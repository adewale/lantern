# Publishing

How to put a built page on a website. The contracts (URL parameters, the resize message and headers) are in [the reference](REFERENCE.md).

## Publish a page

1. Review every case, then build it:

   ```sh
   rayner review scene.ts
   ```

   Review runs the checks and served-reader audit; `build` writes files without repeating validation. Test the model and inspect the screenshots too. Then build:

   ```sh
   rayner build scene.ts --out public/cache.html
   ```

   In a checkout, use `npm run rayner -- build ...`. The HTML file is the whole explainer: every case, poster, transcript, sources and licence notices. It makes no network requests at runtime.

2. Upload `cache.html` to any static host, with `loader.js` if you will use the loader.

3. Send the headers in `cache.html.headers.json` as HTTP response headers for that file. The CSP pins the page's inline script and style by hash, so a CDN that rewrites or minifies the HTML breaks it; rebuild instead.
   - `frame-ancestors` works only as a response header, never from a `<meta>` tag. The recipe allows any site to frame the page (`frame-ancestors *`); replace `*` with your own origins to restrict it.
   - Do not send `X-Frame-Options: DENY` or `SAMEORIGIN` for a page other sites embed. CORS headers do not grant framing.
   - The page that embeds it needs the artifact's origin in its own `frame-src`, and the loader's in `script-src` if it uses the loader.
   - The recipe's `Cache-Control` revalidates on every load. Long-lived caching is safe only for a URL that changes when the content does, such as one with the receipt's `artifactHash` in it.

   For the demo collection, `npm run demos:build && npm run site:export -- <site-root>` copies every page, poster, the generated gallery and the loader into a site, updates its `_headers`, and writes a copy of the response-header recipe to `out/site-headers.txt`. For agents it also writes each explainer's [`describeExplainer`](REFERENCE.md#describe) object as `<id>.json` beside its page, and `llms.txt` at the site root listing every page and its JSON. `demos:build` writes that object as `out/explainers/<id>/describe.json`, and `site:export` copies it. Before it writes anything, `site:export` checks each explainer's `out/explainers/<id>/inputs.json`, where `demos:build` records the scene's code hash, the engine hash and a hash of the scene's folder. If any of them changed since the build, it fails and says to run `demos:build`. The versioned build fingerprint also covers the player, CSS, tools, dependencies and notices. Changes to those inputs require a rebuild. Export validates a staging directory before replacing the Rayner subtree, writes a deployment manifest with each file's SHA-256, and replaces the collection's existing `_headers` rules while preserving other host rules. It includes `index.html`, the generated gallery, and `evidence.json`; use those as the catalog's source of truth instead of maintaining a second list of counts and titles.

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
   const dispose = RaynerEmbed.mountExplainer(target, '/explainers/cache.html', { title: 'Cache', height: 640, theme: 'auto' });
   dispose(); // removes the iframe, the link and the message listener
   ```

   The loader needs the page on HTTP(S): for a `file:` URL it throws and mounts nothing.

5. Check what the host actually serves; the repository's tests run against local files.
   - `curl -sI https://your.site/explainers/cache.html` shows the CSP and `Cache-Control` from the recipe.
   - The page opens at the step and case in its URL, Next plays, and the transcript opens.
   - With two embeds on one page, opening one transcript resizes only that iframe.
   - Record the `artifactHash` from the receipt beside the URL you published. For the collection, compare the served bytes with `deployment.json`; valid CSP hashes alone do not prove that the latest reviewed page was deployed.

The exported `catalog.json` contains the product copy, authoring links, titles, groups and counts used by the generated gallery. A host with its own page design can render that data into its template. Regenerate that page as part of the host build, so a new explainer or a changed requirement cannot leave a second catalog behind.
