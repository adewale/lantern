# Embedding contract

The generated HTML is the product. Host it anywhere that can serve a static file; no Lantern service is required. It contains one explanation, all its built cases, a poster, an all-case HTML transcript, source links and license notices. It needs no runtime fetch, external font, storage, account or third-party cookie.

## Raw iframe

```html
<iframe src="/explainers/pap.html?step=sign-in&signin=device"
        title="Personal Agent Protocol: device sign-in"
        style="width:100%;height:640px;border:0;display:block"
        allow="fullscreen"
        loading="lazy"></iframe>
<a href="/explainers/pap.html?step=sign-in&signin=device">Open explanation in a new page</a>
```

`allow="fullscreen"` lets the reader's **Enlarge** control show the stage full screen (and sideways on phones that allow it); without it the control is hidden inside the frame (standalone pages always have it). The loader sets it.

The 16:9 stage is not the document's aspect ratio. Captions, chapters and settings change the required height, especially on phones. A raw iframe uses its reserved height and normal scrolling. It does not require messaging. `file:` artifacts also remain readable directly, but opaque-origin auto-sizing is not supported.

## Optional self-hostable loader

Each `build` writes `loader.js` beside the HTML:

```html
<div id="protocol"></div>
<script src="/explainers/loader.js"
        data-src="/explainers/pap.html?step=sign-in&signin=device"
        data-target="protocol"
        data-title="Personal Agent Protocol"
        data-theme="light"></script>
```

The loader installs its listener before adding the iframe, sets width/title/lazy loading and reserves 640 pixels initially. It adds a standalone link. The artifact URL determines the trusted child origin; message contents cannot change that authority. Multiple loader tags work independently. Loading third-party JavaScript in a host page is an extra trust decision; self-host the tiny loader or use the raw iframe if you do not want it.

The built script also exposes an explicit lifecycle API for application hosts:

```js
const dispose = LanternEmbed.mountExplainer(target, artifactURL, {
  title: 'Personal Agent Protocol', height: 640, theme: 'auto',
});
// When the host removes this instance:
dispose(); // removes its frame, standalone link and message listener
```

## URL semantics

| Parameter | Behaviour |
| --- | --- |
| `step` | Stable named step; initially show that step's completed frame |
| Declared setting ids | Choose a complete prebuilt case; missing values use defaults |
| `theme=light\|dark\|auto` | Player chrome only; default `auto` |
| `parentOrigin` | Exact HTTP(S) host origin supplied by the loader; resize transport only |

Copy-link retains the resolved case and step but removes `parentOrigin`. Case switching keeps the current step by name, or selects and announces the first-step fallback. Browser back/forward restores case and step. Invalid known values fall back with a visible status notice. Unknown URL parameters are not free-form scene inputs.

The page starts paused, never auto-advances, and offers Previous, Next, chapters and an optional Animate Step button. Reduced-motion preference leaves the completed frame in place. Settings sit below the stepper. Keyboard focus is visible; step changes do not deliberately focus or scroll the host page. A collapsible transcript remains available; without JavaScript it is already open and includes every case.

## Resize protocol v1

```ts
{ type: 'lantern:resize', version: 1, height: 742 }
```

- The child observes the natural-height `#content` root, not a viewport-sized element. It measures initially, then measures in each `ResizeObserver` callback (which browsers deliver at most once per rendering update), rounds up and sends only changed heights. It deliberately does not defer to `requestAnimationFrame`: browsers throttle that in offscreen cross-origin frames, and an embed below the fold would stop resizing. Both growth and shrinkage work without a viewport feedback loop.
- The child sends only while framed, to an exact `parentOrigin`. Wildcards, URL paths and opaque `null` origins are rejected. With no valid target, resizing is disabled; ordinary reading still works.
- The parent requires **both** `event.origin === configuredArtifactOrigin` and `event.source === iframe.contentWindow`. An origin check alone lets one sibling embed resize another. A source check alone trusts that frame after it navigates to a different origin.
- Only the exact type/version and a finite integer height from 1 through 100,000 CSS pixels are accepted. Everything else is ignored. No navigation, secrets, commands or player state are carried by this protocol.

## Hosting headers

`explanation.html.headers.json` is a deployment recipe, not a header that the file can set itself. Apply it through your host. `npm run demos:serve` applies these sidecars locally.

The generated CSP authorizes the exact inline script/style bytes with SHA-256 hashes and disables runtime connections, external fonts, base URLs and object embeds. It deliberately allows public framing with `frame-ancestors *`. Publishers may replace that with their parent-origin allowlist. If a CDN rewrites/minifies the file, the script/style hashes must be regenerated.

Important distinctions:
- `frame-ancestors` belongs in an HTTP CSP response header. It does not work from an HTML meta tag.
- Do not attach `X-Frame-Options: DENY` or `SAMEORIGIN` to cross-origin embeds. `ALLOWALL` is not a supported replacement.
- CORS does not grant framing permission.
- The **host page** must permit the artifact in its own `frame-src`, and authorize the optional loader in `script-src` if it uses one.
- The unversioned filename is mutable and defaults to revalidation. A content-hashed or versioned release URL may use immutable caching; retain its receipt and artifact hash. Do not label a moving alias immutable.

## Evidence, not source-string checks

```sh
npm run test:embeds
npm run demos:check
```

The browser suite serves real artifacts under their generated CSP on an origin distinct from the host. It tests independent sizing, growth/shrinkage, wrong-window and wrong-origin messages, URL history/case fallback, copy-link, mobile overflow, keyboard navigation, reduced motion, blocked external requests/storage, raw iframes and no-JavaScript reading. Style tests compare actual non-text raster output with the real renderer, with a stated path-quantization tolerance.

After deployment, rerun the checks against the **served artifacts and loader**, record their hashes and check actual response headers. Repository tests cannot prove which bytes reached production. Local tests here are not production deployment evidence or a cross-platform screenshot certification.
