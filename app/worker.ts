// Cloudflare Worker: the explainers as an API, plus the player as a static asset.
//
//   GET /                                  player (asset) for browsers; the /llms.txt guide
//                                          for clients whose Accept lacks text/html (curl, agents)
//   GET /llms.txt                          plain-text guide: endpoints, params, scenes and steps
//   GET /index.json                        scene catalog (no scene) | ?scene=x steps and duration
//   GET /trace.json?scene=x                structured trace (state at every step)
//   GET /frame.svg?scene=x&step=s | &t=1.5 one frame as image/svg+xml (&w= width in px)
//   GET /text?scene=x&step=s   | &t=1.5    the same frame as monospace text
//
// The library is runtime-agnostic; this file is the only Workers-specific code.
// Seeking re-runs the scene to the requested time (~10ms), so nothing is
// cached here; add Cache API or KV in front if you want. wrangler.toml runs
// this Worker first for "/" so it can negotiate; other asset paths skip it.
//
// Typed against the standard fetch API (lib.dom), not @cloudflare/workers-types:
// this file uses nothing Workers-specific beyond the ASSETS binding, and the
// workers-types globals conflict with lib.dom, which the library needs for DomSink.
import { SnapshotSink, indexScene, stepTime, renderAt, traceScene, renderText } from '../src/index.ts';
import type { SceneClass } from '../src/index.ts';
import { SCENES } from '../scenes/index.ts';

/** The static-assets binding (wrangler.toml [assets]); absent in tests that don't need it. */
export interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

const CORS = { 'access-control-allow-origin': '*' };
const json = (o: unknown, status = 200): Response => Response.json(o, { status, headers: CORS });
/** End the request with a JSON error: the Response is thrown and returned by fetch(). */
function fail(status: number, o: Record<string, unknown>): never { throw json({ ...o, help: '/llms.txt' }, status); }
const sceneList = () => Object.entries(SCENES).map(([name, { label }]) => ({ name, label }));

async function resolveTime(Scene: SceneClass, url: URL): Promise<number> {
  if (url.searchParams.has('t')) {
    const t = Number(url.searchParams.get('t'));
    if (Number.isNaN(t)) fail(400, { error: 't must be a number of seconds' });
    return t;
  }
  const step = url.searchParams.get('step');
  if (!step) return Infinity; // final frame
  const ix = await indexScene(Scene);
  const t = stepTime(ix, step);
  if (t == null) fail(404, { error: `unknown step ${step}`, steps: ix.steps.map((s) => s.name) });
  return t;
}

// Step names come from running every scene once (~150 ms), so the guide is built
// on first request and kept for the isolate's lifetime; scenes are deterministic.
let guide: Promise<string> | null = null;
async function llmsTxt(origin: string): Promise<string> {
  guide ??= Promise.all(Object.entries(SCENES).map(async ([name, { label, Scene }]) => {
    const ix = await indexScene(Scene);
    return `- ${name}: ${label} (${ix.duration.toFixed(1)} s)\n  steps: ${ix.steps.map((s) => s.name).join(', ')}`;
  })).then((rows) => rows.join('\n'));
  const scenes = await guide;
  const [ex, exStep] = await firstExample();
  return `# lantern

> Animated, steppable code explainers rendered to SVG. Every step of every scene
> has a URL, an SVG frame, a plain-text frame and a JSON trace of the state it explains.

Base URL: ${origin}
Browsers get the interactive player at /. Any client whose Accept header lacks
text/html (curl, agents) gets this text at / ; it is also always at /llms.txt.

## Endpoints

All GET, no auth, CORS open (access-control-allow-origin: *).

- /index.json                    scene catalog: { scenes: [{ name, label }], help }
- /index.json?scene=NAME         { fps, duration, frames, steps: [{ name, path, t0, t1, frame0, frame1, meta }] }
- /trace.json?scene=NAME         { fps, duration, frames, steps: [{ step, t0, t1, meta, before, after, ... }] }
                                 before/after: the scene's state at each step boundary
- /frame.svg?scene=NAME[&step=STEP | &t=SECONDS][&w=PX]
                                 one frame as image/svg+xml; w = width in px (default 1280)
- /text?scene=NAME[&step=STEP | &t=SECONDS]
                                 the same frame as monospace text (text/plain)
- /?scene=NAME&step=STEP         the player, deep-linked (open in a browser; ?t=SECONDS also works)

Params:
- scene  required except on /index.json; one of the names below
- step   a step name from /index.json; the frame at the moment that step begins
- t      seconds from the start; wins over step
- (none) neither step nor t: the final frame

## Examples

curl '${origin}/index.json'
curl '${origin}/index.json?scene=${ex}'
curl '${origin}/text?scene=${ex}&step=${exStep}'
curl '${origin}/frame.svg?scene=${ex}&step=${exStep}&w=640' -o frame.svg
curl '${origin}/frame.svg?scene=${ex}&t=3' -o frame.svg
curl '${origin}/trace.json?scene=${ex}'

## Errors

JSON bodies, always with "error" and "help": "/llms.txt".
- 404 unknown or missing scene: { "error": "unknown or missing scene", "scenes": [...names] }
- 404 unknown step:             { "error": "unknown step NAME", "steps": [...names] }
- 400 bad t:                    { "error": "t must be a number of seconds" }
- 400 bad w:                    { "error": "w must be a positive number of pixels" }

## Scenes

${scenes}

## Authoring (clone https://github.com/ivarvong/lantern; Node >= 22.18)

A scene is a class extending Scene with an async construct(); await this.step(name, meta)
marks steps, and this.state is what traces record. A scene can also be data: a JSON doc
of nodes, edges, code and step ops, played by sceneFromDoc(doc) (docs/DOC-FORMAT.md).
Register it in scenes/index.ts, then:

  npm run dev                       live player at http://localhost:5173/?scene=NAME
  npm run see -- NAME STEP          a frame as text, plus the step's state diff
  npm run shot -- NAME              contact sheet PNG: the end of every step
  npm run verify:motion -- NAME     teleports, pops, cuts, flicker
`;
}

// The example scene and step for the guides: the first scene's second step (its first is often an intro)
async function firstExample(): Promise<[scene: string, step: string]> {
  // The registry is never empty
  const [name, { Scene }] = Object.entries(SCENES)[0]!;
  const { steps } = await indexScene(Scene);
  return [name, (steps[1] ?? steps[0]!).name];
}

const text = (body: string): Response => new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', vary: 'Accept', ...CORS } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = url.pathname;
    try {
      if (route === '/llms.txt') return text(await llmsTxt(url.origin));
      if (route === '/' && !/text\/html|application\/xhtml\+xml/.test(request.headers.get('accept') ?? '')) {
        return text(await llmsTxt(url.origin));
      }
      if (!['/index.json', '/trace.json', '/frame.svg', '/text'].includes(route)) {
        if (!env.ASSETS) return json({ error: 'no assets bound' }, 404);
        const res = await env.ASSETS.fetch(request);
        if (route !== '/') return res;
        const page = new Response(res.body, res); // "/" varies by Accept; tell caches
        page.headers.set('vary', 'Accept');
        return page;
      }
      const name = url.searchParams.get('scene');
      if (route === '/index.json' && !name) return json({ scenes: sceneList(), help: '/llms.txt' });
      const entry = name == null ? undefined : SCENES[name];
      if (!entry) return fail(404, { error: 'unknown or missing scene', scenes: Object.keys(SCENES) });
      const { Scene } = entry;
      if (route === '/index.json') return json(await indexScene(Scene));
      if (route === '/trace.json') return json(await traceScene(Scene));
      const t = await resolveTime(Scene, url);
      if (route === '/frame.svg') {
        const width = Number(url.searchParams.get('w') ?? 1280);
        if (!(width > 0 && Number.isFinite(width))) fail(400, { error: 'w must be a positive number of pixels' });
        const sink = new SnapshotSink({ width });
        await renderAt(Scene, t, sink);
        return new Response(sink.svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600', ...CORS } });
      }
      const scene = await renderAt(Scene, t, { async frame() {} });
      return new Response(renderText(scene), { headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS } });
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  },
};
