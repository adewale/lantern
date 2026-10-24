import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Page, Frame } from 'playwright-core';
import { launch } from '../tools/lib/browser.ts';
import { collectProject } from '../tools/lib/explain-project.ts';
import { buildExplainer, buildLoader } from '../tools/lib/explain-build.ts';

const enabled = !!process.env.EXPLAIN_BROWSER,
  options = { skip: enabled ? false : 'set EXPLAIN_BROWSER=1 for real cross-origin browser checks' };
let browser: Browser, folder: string, host: string, embed: string;
const servers: Server[] = [],
  assets = new Map<string, { body: string; headers?: Record<string, string> }>();
let hostBody = '';
async function serve(isHost: boolean): Promise<string> {
  const server = createServer((req, res) => {
    if (isHost) {
      res.setHeader('content-type', 'text/html');
      res.end(hostBody);
      return;
    }
    const asset = assets.get(req.url!.split('?')[0]!);
    if (!asset) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('content-type', req.url!.startsWith('/loader') ? 'text/javascript' : 'text/html');
    for (const [k, v] of Object.entries(asset.headers ?? {})) res.setHeader(k, v);
    res.end(asset.body);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
before(async () => {
  if (!enabled) return;
  folder = await mkdtemp(join(tmpdir(), 'lantern-embed-test-'));
  browser = await launch();
  host = await serve(true);
  embed = await serve(false);
  for (const name of ['mr-cache', 'oauth-pkce']) {
    const project = await collectProject(`scenes/explainers/${name}`);
    const built = await buildExplainer(project, join(folder, name + '.html'));
    assets.set('/' + name, {
      body: built.html,
      headers: (built.receipt as { headers: Record<string, string> }).headers,
    });
  }
  await buildLoader(join(folder, 'loader.js'));
  assets.set('/loader.js', { body: await readFile(join(folder, 'loader.js'), 'utf8') });
});
after(async () => {
  if (!enabled) return;
  await browser?.close();
  for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
  if (folder) await rm(folder, { recursive: true, force: true });
});
function loader(id: string, scene: string) {
  return `<div id="${id}"></div><script src="${embed}/loader.js" data-src="${embed}/${scene}" data-target="${id}" data-title="${scene}"></script>`;
}
async function readyFrame(page: Page, scene: string): Promise<Frame> {
  await page.waitForFunction(() => document.querySelectorAll('iframe').length > 0);
  const matches = (f: Frame) => f.url().startsWith(embed + '/' + scene);
  const frame =
    page.frames().find(matches) ?? (await page.waitForEvent('framenavigated', { predicate: matches }));
  assert.ok(frame);
  await frame.waitForSelector('[data-ready=true]');
  return frame;
}
async function assertHeight(page: Page, id: string, frame: Frame) {
  const expected = await frame
    .locator('#content')
    .evaluate((r) => Math.ceil(r.getBoundingClientRect().height));
  await page.waitForFunction(
    ({ id, expected }) =>
      (document.querySelector(`#${id} iframe`) as HTMLIFrameElement)?.style.height === expected + 'px',
    { id, expected },
  );
  return expected;
}
async function deliver(page: Page, frame: Frame, height: number) {
  await page.evaluate((height) => {
    (window as unknown as { received: boolean }).received = false;
    window.addEventListener('message', function seen(event) {
      if (event.data?.height === height) {
        (window as unknown as { received: boolean }).received = true;
        window.removeEventListener('message', seen);
      }
    });
  }, height);
  await frame.evaluate(
    (height) => parent.postMessage({ type: 'lantern:resize', version: 1, height }, '*'),
    height,
  );
  await page.waitForFunction(() => (window as unknown as { received: boolean }).received);
}

test(
  'two real cross-origin embeds resize independently, grow, shrink and reject wrong-window messages',
  options,
  async () => {
    hostBody = `<!doctype html><style>body{margin:0;max-width:700px}</style>${loader('a', 'mr-cache')}${loader('b', 'oauth-pkce')}`;
    const page = await browser.newPage();
    try {
      await page.goto(host);
      const a = await readyFrame(page, 'mr-cache'),
        b = await readyFrame(page, 'oauth-pkce');
      const ah = await assertHeight(page, 'a', a),
        bh = await assertHeight(page, 'b', b);
      await a.locator('summary').click();
      const grown = await assertHeight(page, 'a', a);
      assert.ok(grown > ah);
      await assertHeight(page, 'b', b);
      await a.locator('summary').click();
      assert.equal(await assertHeight(page, 'a', a), ah);
      // Same origin, wrong window: a's valid message must never resize b.
      await deliver(page, a, 7777);
      assert.equal(
        await page.locator('#b iframe').evaluate((el) => (el as HTMLIFrameElement).style.height),
        bh + 'px',
      );
      // Restore a through a genuine content change.
      await a.locator('summary').click();
      await assertHeight(page, 'a', a);
      // Correct WindowProxy after navigation, wrong origin: origin check remains necessary.
      await page.route('http://localhost:43219/**', (r) =>
        r.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Other origin</p>' }),
      );
      await b.goto('http://localhost:43219/forger');
      await deliver(page, b, 8888);
      assert.equal(
        await page.locator('#b iframe').evaluate((el) => (el as HTMLIFrameElement).style.height),
        bh + 'px',
      );
    } finally {
      await page.close();
    }
  },
);
test(
  'URL cases, missing-step fallback, browser history, copy link and reduced motion behave as documented',
  options,
  async () => {
    const context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    try {
      await page.goto(embed + '/oauth-pkce?attacker=yes&step=attack&theme=dark');
      await page.waitForSelector('[data-ready=true]');
      assert.match(await page.locator('.caption').innerText(), /has the code but has to guess a verifier/);
      assert.equal(await page.locator('select[name=attacker]').inputValue(), 'yes');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal(
        await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor),
        'rgb(16, 23, 31)',
      );
      await page.locator('select[name=attacker]').selectOption('no');
      await page.waitForFunction(() => new URL(location.href).searchParams.get('attacker') === 'no');
      assert.match(await page.locator('[role=status]').innerText(), /no “attack” step/);
      await page.goBack();
      await page.waitForFunction(
        () => document.querySelector('[aria-current=step]')?.getAttribute('data-step') === 'attack',
      );
      assert.equal(await page.locator('select[name=attacker]').inputValue(), 'yes');
      assert.equal(await page.locator('[role=status]').innerText(), '');
      await page.getByRole('button', { name: 'Copy link', exact: true }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(new URL(copied).searchParams.get('attacker'), 'yes');
      assert.equal(new URL(copied).searchParams.get('step'), 'attack');
      assert.equal(new URL(copied).searchParams.get('parentOrigin'), null);
      await page.getByRole('button', { name: 'Replay step', exact: true }).click();
      assert.match(await page.locator('[role=status]').innerText(), /Reduced motion/);
      await page.goto(embed + '/oauth-pkce?theme=light');
      await page.waitForSelector('[data-ready=true]');
      assert.equal(
        await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor),
        'rgb(247, 248, 250)',
      );
      await page.goto(embed + '/oauth-pkce?theme=auto');
      await page.waitForSelector('[data-ready=true]');
      assert.equal(
        await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor),
        'rgb(16, 23, 31)',
      );
    } finally {
      await context.close();
    }
  },
);
test(
  'mobile controls and transcript work offline with storage disabled and no page errors',
  options,
  async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [],
      requests: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => {
      if (new URL(r.request().url()).origin === embed) return r.continue();
      requests.push(r.request().url());
      return r.abort();
    });
    await page.addInitScript(() => {
      for (const key of ['localStorage', 'sessionStorage'])
        Object.defineProperty(window, key, {
          get() {
            throw new Error('Storage disabled');
          },
        });
    });
    try {
      await page.goto(embed + '/mr-cache?request=miss&step=request');
      await page.waitForSelector('[data-ready=true]');
      assert.match(await page.locator('.caption').innerText(), /KV has no entry/);
      const viewport = await page.locator('.stage svg').evaluate((svg) => {
        const clips = [...svg.querySelectorAll('clipPath')];
        return {
          rects: clips.map((c) => ({
            namespace: c.namespaceURI,
            units: c.getAttribute('clipPathUnits'),
            width: c.querySelector('rect')?.getAttribute('width'),
            height: c.querySelector('rect')?.getAttribute('height'),
          })),
          references:
            svg.querySelectorAll('[clip-path]').length > 0 &&
            [...svg.querySelectorAll('[clip-path]')]
              .map((p) => p.getAttribute('clip-path'))
              .every((value) => clips.some((c) => value === `url(#${c.id})`)),
        };
      });
      assert.deepEqual(viewport, {
        rects: [
          {
            namespace: 'http://www.w3.org/2000/svg',
            units: 'userSpaceOnUse',
            width: '15100', // the stage's 'top' region, in SVG units
            height: '3600',
          },
        ],
        references: true,
      });
      await page.locator('summary').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('#content').focus();
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(
        () => document.querySelector('[aria-current=step]')?.getAttribute('data-step') === 'after',
      );
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON');
      assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth), '3px');
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
    } finally {
      await page.close();
    }
  },
);
test(
  'raw iframe and standalone artifact contain a useful poster and all-case transcript without JavaScript',
  options,
  async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(embed + '/mr-cache');
      assert.ok((await page.locator('.poster path').count()) > 10);
      assert.match(await page.locator('.transcript').innerText(), /request: hit/);
      assert.match(await page.locator('.transcript').innerText(), /request: miss/);
      hostBody = `<!doctype html><iframe title="Raw explanation" src="${embed}/mr-cache" style="width:390px;height:640px"></iframe><a href="${embed}/mr-cache">Open standalone</a>`;
      await page.goto(host);
      const frame = page.frames().find((f) => f.url().startsWith(embed));
      assert.ok(frame);
      assert.ok((await frame.locator('.poster path').count()) > 10);
    } finally {
      await context.close();
    }
  },
);
