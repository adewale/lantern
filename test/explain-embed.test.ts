import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Page, Frame } from 'playwright-core';
import { launch } from '../tools/lib/browser.ts';
import { collectProject } from '../tools/lib/explain-project.ts';
import type { Project } from '../tools/lib/explain-project.ts';
import { buildExplainer, buildLoader } from '../tools/lib/explain-build.ts';
import { serve } from '../tools/lib/explain-serve.ts';
import { publishedPage } from '../tools/lib/explain-share.ts';
import { fc, params } from './lib/pbt.ts';
import { resolveSettings } from '../explain/index.ts';
import type { Settings } from '../explain/index.ts';
import { pictureHtml, pictureSummary, stepWords } from '../explain/trace.ts';
import { NARROW_PX, READ_PX, closeUps, labelsToRead, stageScale, stepLayouts, toView, viewBox } from '../app/embed-closeup.ts';
import type { StepLayout } from '../app/embed-closeup.ts';
import { labelOf } from '../explain/diagrams.ts';
import { labelsSaying, restingBox, wordsOutsideCards } from './lib/scenes.ts';
import type { Box } from '../src/index.ts';

const enabled = !!process.env.EXPLAIN_BROWSER,
  options = { skip: enabled ? false : 'set EXPLAIN_BROWSER=1 for real cross-origin browser checks' };
let browser: Browser, folder: string, host: string, embed: string;
// The host page is whatever a test sets; the explainers are served as published, with their header recipe.
let hostBody = '';
const hostServer = createServer((_, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(hostBody);
});
let embedServer: { url: string; close(): void } | undefined;
const projects = new Map<string, Project>();
before(async () => {
  if (!enabled) return;
  folder = await mkdtemp(join(tmpdir(), 'rayner-embed-test-'));
  browser = await launch();
  await new Promise<void>((r) => hostServer.listen(0, '127.0.0.1', r));
  host = `http://127.0.0.1:${(hostServer.address() as { port: number }).port}`;
  for (const name of ['mr-cache', 'oauth-pkce', 'exgit', 'lantern', 'send-sync']) {
    const project = await collectProject(`scenes/explainers/${name}`, { write: false });
    projects.set(name, project);
    await buildExplainer(project, join(folder, name + '.html'));
  }
  await buildLoader(join(folder, 'loader.js'));
  embedServer = await serve(folder, 0, 'mr-cache.html');
  embed = embedServer.url;
});
after(async () => {
  if (!enabled) return;
  await browser?.close();
  hostServer.close();
  embedServer?.close();
  if (folder) await rm(folder, { recursive: true, force: true });
});
function loader(id: string, scene: string) {
  return `<div id="${id}"></div><script src="${embed}/loader.js" data-src="${embed}/${scene}.html" data-target="${id}" data-title="${scene}"></script>`;
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
    (height) => parent.postMessage({ type: 'rayner:resize', version: 1, height }, '*'),
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
      await a.locator('.transcript > summary').click();
      const grown = await assertHeight(page, 'a', a);
      assert.ok(grown > ah);
      await assertHeight(page, 'b', b);
      await a.locator('.transcript > summary').click();
      assert.equal(await assertHeight(page, 'a', a), ah);
      // Same origin, wrong window: a's valid message must never resize b.
      await deliver(page, a, 7777);
      assert.equal(
        await page.locator('#b iframe').evaluate((el) => (el as HTMLIFrameElement).style.height),
        bh + 'px',
      );
      // Restore a through a genuine content change.
      await a.locator('.transcript > summary').click();
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
// The rest of URL cases, step fallback, history, copy link and reduced motion is the player
// model's (below), including the fixed fallback scenario.
test('?theme=dark, light and auto (following the reader\'s colour scheme) set the page colours', options, async () => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  try {
    const background = async (theme: string) => {
      await page.goto(`${embed}/oauth-pkce.html?theme=${theme}`);
      await page.waitForSelector('[data-ready=true]');
      return {
        theme: await page.locator('html').getAttribute('data-theme'),
        background: await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor),
      };
    };
    assert.deepEqual(await background('dark'), { theme: 'dark', background: 'rgb(15, 22, 29)' });
    assert.deepEqual(await background('light'), { theme: 'light', background: 'rgb(246, 247, 249)' });
    assert.deepEqual(await background('auto'), { theme: 'auto', background: 'rgb(15, 22, 29)' });
  } finally {
    await context.close();
  }
});
// site:export --origin gives each step of the default case a share page, <path>/<id>/<step>, and
// marks the player; Copy link then gives that page, whose link preview is the step. Any other case,
// a step whose name is not path-safe, or a page published without share pages copies ?step=.
test('Copy link gives the step\'s share page when site:export published one, else the player URL', options, async () => {
  const site = join(folder, 'site');
  await mkdir(site, { recursive: true });
  // As site:export --origin publishes a page: publishedPage, from the steps demos:build lists.
  const publish = async (id: string, from: string, steps: string[]) => {
    const manifest = { id, title: id, lang: 'en', cover: steps[0]!, steps: steps.map((step) => ({ step, title: step, caption: '', picture: '' })) };
    await writeFile(join(site, id + '.html'), publishedPage(await readFile(from + '.html', 'utf8'), manifest, 'https://example.org', '/projects/rayner'));
    await copyFile(from + '.html.headers.json', join(site, id + '.html.headers.json'));
  };
  await publish('mr-cache', join(folder, 'mr-cache'), ['before', 'diff', 'after', 'request']);
  // A scene whose second step has a name no share page can have.
  const odd = join(folder, 'odd-steps');
  await mkdir(odd, { recursive: true });
  await writeFile(
    join(odd, 'scene.ts'),
    `import{Scene,Text,FadeIn}from'rayner';export default class Odd extends Scene{static meta={title:'Odd steps'};async construct(){` +
      `await this.step('one',{title:'One',caption:'A word.'});await this.play(new FadeIn(new Text('one')));` +
      `await this.step('two words',{title:'Two',caption:'Two words.'});await this.play(new FadeIn(new Text('two').moveTo([0,-2])));}}`,
  );
  await buildExplainer(await collectProject(odd, { write: false }), join(folder, 'odd-steps.html'));
  await publish('odd-steps', join(folder, 'odd-steps'), ['one']);
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  const copied = async () => {
    await page.evaluate(() => {
      document.querySelector('.notice')!.textContent = '';
      return navigator.clipboard.writeText('');
    });
    await page.locator('button[aria-label="Copy link"]').click();
    await page.waitForFunction(() => document.querySelector('.notice')?.textContent === 'Link copied.');
    return page.evaluate(() => navigator.clipboard.readText());
  };
  const open = async (url: string) => {
    await page.goto(url);
    await page.waitForSelector('[data-ready=true]');
  };
  try {
    await open(`${embed}/site/mr-cache.html?step=diff`);
    assert.equal(await copied(), 'https://example.org/projects/rayner/mr-cache/diff');
    // The share page sends readers to the default case, so another case keeps the player URL.
    const pick = (value: string) => page.locator(`input[name="request"][value="${value}"]`).locator('xpath=..').click();
    await pick('miss');
    await page.waitForURL(/request=miss/);
    assert.equal(await copied(), `${embed}/site/mr-cache.html?step=diff&request=miss`);
    await pick('hit');
    await page.waitForURL(/request=hit/);
    assert.equal(await copied(), 'https://example.org/projects/rayner/mr-cache/diff');
    await open(`${embed}/site/odd-steps.html?step=one`);
    assert.equal(await copied(), 'https://example.org/projects/rayner/odd-steps/one');
    await page.locator('button[aria-label="Next step"]').click();
    await page.waitForURL(/step=two/);
    assert.equal(await copied(), `${embed}/site/odd-steps.html?step=two+words`);
    // Built without site:export: no share pages, so the player URL, as before.
    await open(`${embed}/mr-cache.html?step=diff`);
    assert.equal(await copied(), `${embed}/mr-cache.html?step=diff&request=hit`);
  } finally {
    await context.close();
  }
});
test('stepping keeps the phone’s heading line, Next, steps list and transcript in place', options, async () => {
  // Captions run from one line to four, and on a phone send-sync's first step opens on a
  // close-up and shows Fit; neither may push the page down mid-explainer.
  for (const [width, height] of [[1180, 800], [390, 844]] as const)
    for (const scene of ['exgit', 'mr-cache', 'send-sync']) {
      const page = await browser.newPage({ viewport: { width, height } });
      try {
        await page.addInitScript(() => {
          (window as unknown as { __layoutSettles: number }).__layoutSettles = 0;
          document.addEventListener('rayner:step', (event) => {
            const w = window as unknown as { __layoutSettles: number; __layoutStep: string };
            w.__layoutSettles++;
            w.__layoutStep = (event as CustomEvent<{ step: string }>).detail.step;
          });
        });
        await page.goto(`${embed}/${scene}.html`);
        await page.waitForSelector('[data-ready=true]');
        const places = new Set<string>(), linePlaces = new Set<string>();
        const n = await page.locator('.steps button').count();
        for (let i = 0; i < n; i++) {
          const before = await page.evaluate(() => (window as unknown as { __layoutSettles: number }).__layoutSettles);
          const step = await page.locator('.steps button').nth(i).getAttribute('data-step');
          assert.ok(step, 'the clicked step button identifies its target');
          await page.locator('.steps button').nth(i).evaluate((b: HTMLElement) => b.click());
          await page.waitForFunction(({ before, step, i }) => {
            const w = window as unknown as { __layoutSettles: number; __layoutStep: string };
            return w.__layoutSettles > before && w.__layoutStep === step &&
              document.querySelectorAll('.steps button')[i]?.getAttribute('aria-current') === 'step';
          }, { before, step, i });
          await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
          if (width < 600 && await page.locator('.lede span').isVisible())
            linePlaces.add(await page.locator('.lede span').evaluate((line) => (line.getBoundingClientRect().top + scrollY).toFixed(1)));
          places.add(
            await page.evaluate(() =>
              ['.controls', '.steps', '.transcript'].map((s) => (document.querySelector(s)!.getBoundingClientRect().top + scrollY).toFixed(1)).join(' '),
            ),
          );
        }
        assert.equal(places.size, 1, `${scene} at ${width} px: controls, steps and transcript tops per step ${[...places].join(' | ')}`);
        if (width < 600) assert.equal(linePlaces.size, 1, `${scene}: the line below the phone title stays at one height`);
      } finally {
        await page.close();
      }
    }
});
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
      await page.goto(embed + '/mr-cache.html?request=miss&step=request');
      await page.waitForSelector('[data-ready=true]');
      assert.match(await page.locator('.caption').innerText(), /KV has no entry/);
      // The first Tab stop is the case picker; the page's main region is not one (WCAG 2.4.7).
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('type')), 'radio');
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
      // Clip paths are SVG elements in stage units, and every clip-path reference resolves to one.
      assert.ok(viewport.rects.length > 0);
      for (const rect of viewport.rects) {
        assert.equal(rect.namespace, 'http://www.w3.org/2000/svg');
        assert.equal(rect.units, 'userSpaceOnUse');
        assert.ok(Number(rect.width) > 0 && Number(rect.height) > 0, JSON.stringify(rect));
      }
      assert.equal(viewport.references, true);
      // A phone opens the step on its close-up: the labels near what the step changed read at
      // 12 px or more, and the overview over the stage's corner steps through the rest of the change.
      const project = projects.get('mr-cache')!,
        values = resolveSettings(project.Scene, { request: 'miss' });
      const size = await page.locator('.stage').evaluate((s) => ({ w: s.clientWidth, h: s.clientHeight }));
      const layout = (await stepLayouts(project.variants.find((v) => v.values.request === values.request)!.Scene)).get('request')!;
      const tour = closeUps(layout, size.w, size.h);
      const painted = () => settledZoom(page);
      const near = (a: ReturnType<typeof zoomOf>, b: { k: number; x: number; y: number }) =>
        !!a && Math.abs(a.k - b.k) < 1e-4 * b.k && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
      assert.ok(tour[0]!.k > 1 && tour.length > 1, `mr-cache's request step needs a close-up tour: ${JSON.stringify(tour)}`);
      assert.ok(near(await painted(), tour[0]!), `opens on the first close-up ${JSON.stringify(tour[0])}`);
      const smallest = Math.min(...labelsToRead(layout).map((l) => l.size));
      assert.ok(smallest * stageScale(size.w, size.h).s * tour[0]!.k >= READ_PX - 1e-6, 'labels near the change read at 12 px');
      for (let i = 1; i <= tour.length; i++) {
        await page.locator('.overview').click();
        const want = tour[i % tour.length]!;
        await until(async () => near(zoomOf(await paintedView(page)), want), `close-up ${i}`);
      }
      // Fit shows the whole picture, and keeps it for the next steps; Close-up brings the close-ups back.
      await page.getByRole('button', { name: 'Fit stage' }).click();
      await until(async () => zoomOf(await paintedView(page)) === null, 'Fit');
      assert.equal(await page.getByRole('button', { name: 'Close-up of each step' }).isVisible(), true);
      assert.equal(await page.locator('.overview').isHidden(), true, 'no overview of the whole picture');
      // Zoom: a phone reader can still enlarge the vector stage and pan it, without page overflow.
      // It narrows the viewBox over the author's camera, the way the camera itself zooms, so the
      // element keeps its size (no layout shift) and Fit is the author's frame.
      const rect = (v: string) => v.split(' ').map(Number);
      const view = async () => rect((await paintedView(page)).view);
      const width = () => page.locator('.stage svg').evaluate((svg) => svg.getBoundingClientRect().width);
      const [fit, fitWidth] = [await view(), await width()];
      assert.deepEqual(fit, rect((await paintedView(page)).camera), 'Fit shows the author\'s frame');
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.getByRole('button', { name: 'Zoom in' }).click();
      // Button zoom glides for 220 ms; wait for it to settle at 2.56×.
      await until(async () => Math.abs(fit[2]! / (await view())[2]! - 1.6 * 1.6) < 0.01, 'two zoom steps');
      assert.ok(Math.abs((await width()) - fitWidth) < 0.5, 'the stage keeps its size');
      const box = (await page.locator('.stage').boundingBox())!;
      const before = (await view())[0]!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
      await page.mouse.up();
      assert.ok((await view())[0]! < before, 'drag pans: dragging right shows what is to the left');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      // The zoom holds across step changes, over each step's own camera, and while Next plays.
      const zoomed = (await view())[2]!;
      const replaced = async (click: () => Promise<void>) => {
        await page.locator('.stage svg:not(.leaving)').evaluate((svg) => svg.setAttribute('data-old', ''));
        await click();
        await page.waitForFunction(() => !document.querySelector('.stage svg[data-old]'));
      };
      await replaced(() => page.getByRole('button', { name: 'Previous step' }).click());
      await quiet(page);
      assert.ok(Math.abs(zoomed / (await view())[2]! - 1) < 1e-6, 'zoom kept across steps');
      await replaced(() => page.getByRole('button', { name: 'Next step' }).click());
      assert.ok(Math.abs(zoomed / (await view())[2]! - 1) < 1e-6, 'zoom kept while the step plays');
      await quiet(page);
      assert.ok(Math.abs(zoomed / (await view())[2]! - 1) < 1e-6, 'zoom kept through an animated step');
      await page.getByRole('button', { name: 'Fit stage' }).click();
      await until(async () => zoomOf(await paintedView(page)) === null, 'Fit');
      assert.deepEqual(await view(), fit, 'Fit is the author frame');
      assert.equal(await page.getByRole('button', { name: 'Fit stage' }).isHidden(), true, 'Fit appears only when zoomed');
      await page.getByRole('button', { name: 'Close-up of each step' }).click();
      await until(async () => zoomOf(await paintedView(page)) !== null, 'Close-up');
      assert.ok(near(await painted(), tour[0]!), 'Close-up returns to the step\'s first close-up');
      assert.equal(await page.getByRole('button', { name: 'Close-up of each step' }).isHidden(), true);
      await page.getByRole('button', { name: 'Fit stage' }).click();
      await until(async () => zoomOf(await paintedView(page)) === null, 'Fit');
      await page.locator('.transcript > summary').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('#content').focus();
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(
        () => document.querySelector('[aria-current=step]')?.getAttribute('data-step') === 'after',
      );
      // The first Tab reaches the case picker; its focus ring is drawn on the segment around the radio.
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('type')), 'radio');
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.activeElement!.closest('label')!).outlineWidth),
        '2px',
      );
      // Further Tabs reach the step controls, which show the same ring.
      for (let i = 0; i < 6 && (await page.evaluate(() => document.activeElement?.tagName)) !== 'BUTTON'; i++)
        await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth), '2px');
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
    } finally {
      await page.close();
    }
  },
);
// The author's camera (lantern's 'points' step focuses the camera on Mobject) and the reader's
// zoom compose: Fit is the author's frame, a zoom narrows it, and the camera's glide home in the
// next step plays under a held zoom.
test(
  "reader zoom composes with the author's camera: Fit is the author frame, and a camera glide plays under a held zoom",
  options,
  async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(embed + '/lantern.html?step=points');
      await page.waitForSelector('[data-ready=true]');
      await quiet(page);
      const rect = (v: string) => v.split(' ').map(Number);
      const home = '-8000 -4500 16000 9000';
      const author = await paintedView(page);
      assert.notEqual(author.camera, home, 'the step frames part of the stage');
      assert.equal(author.view, author.camera, 'Fit shows the author frame');
      await page.locator('.stage').focus();
      await page.keyboard.press('+');
      await page.keyboard.press('+');
      const zoomed = await paintedView(page);
      assert.equal(zoomed.camera, author.camera, 'the author frame is unchanged under a reader zoom');
      assert.ok(Math.abs(rect(zoomed.camera)[2]! / rect(zoomed.view)[2]! - 2.56) < 1e-3, 'two zoom steps narrow the author frame 2.56 times');
      const [cx, cy, cw, ch] = rect(zoomed.camera) as [number, number, number, number],
        [vx, vy, vw, vh] = rect(zoomed.view) as [number, number, number, number];
      assert.ok(vx >= cx - 1e-3 && vy >= cy - 1e-3 && vx + vw <= cx + cw + 1e-3 && vy + vh <= cy + ch + 1e-3, 'the view stays inside the author frame');
      // Next plays 'clock', whose s.clear() glides the camera home: every frame keeps the reader's 2.56×.
      const seen: Painted[] = [];
      await page.getByRole('button', { name: 'Next step' }).click();
      const end = Date.now() + 3000;
      while (Date.now() < end) {
        const p = await paintedView(page).catch(() => null);
        if (p && (!seen.length || seen.at(-1)!.view !== p.view)) seen.push(p);
        if (p?.camera === home && seen.length > 3) break;
      }
      const gliding = seen.filter((p) => p.camera !== author.camera && p.camera !== home);
      assert.ok(gliding.length > 0, `the camera glide was seen under the zoom: ${seen.map((p) => p.camera).join(' | ')}`);
      for (const p of seen)
        assert.ok(Math.abs(rect(p.camera)[2]! / rect(p.view)[2]! - 2.56) < 1e-3, `zoom held through the glide: ${p.camera} -> ${p.view}`);
      await quiet(page);
      assert.equal((await paintedView(page)).camera, home, 'the camera is home after clear()');
      await page.locator('.stage').focus();
      await page.keyboard.press('0');
      const fit = await paintedView(page);
      assert.equal(fit.view, fit.camera, 'Fit returns to the author frame');
      // On a phone the step's close-up is a reader zoom over that author frame, worked out in its units.
      const phone = await context.browser()!.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      try {
        const small = await phone.newPage();
        small.on('pageerror', (e) => errors.push(e.message));
        await small.goto(embed + '/lantern.html?step=points');
        await small.waitForSelector('[data-ready=true]');
        await quiet(small);
        const p = await paintedView(small);
        assert.equal(p.camera, author.camera, 'the phone shows the same author frame');
        const layout = (await stepLayouts(projects.get('lantern')!.variants[0]!.Scene)).get('points');
        const want = closeUps(layout, p.w, p.h)[0]!,
          got = zoomOf(p);
        if (want.k === 1) assert.equal(got, null);
        else
          assert.ok(
            got && Math.abs(got.k - want.k) < 1e-4 * want.k && Math.abs(got.x - want.x) < 0.01 && Math.abs(got.y - want.y) < 0.01,
            `close-up over the camera: painted ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`,
          );
      } finally {
        await phone.close();
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
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
      await page.goto(embed + '/mr-cache.html');
      assert.ok((await page.locator('.poster path').count()) > 10);
      assert.match(await page.locator('.transcript').innerText(), /Follow a request: Cache hit/);
      assert.match(await page.locator('.transcript').innerText(), /Follow a request: Cache miss/);
      hostBody = `<!doctype html><iframe title="Raw explanation" src="${embed}/mr-cache.html" style="width:390px;height:640px"></iframe><a href="${embed}/mr-cache.html">Open standalone</a>`;
      await page.goto(host);
      const frame = page.frames().find((f) => f.url().startsWith(embed));
      assert.ok(frame);
      assert.ok((await frame.locator('.poster path').count()) > 10);
    } finally {
      await context.close();
    }
  },
);

// ---------------------------------------------------------------------------
// Property tests. The player is a state machine: fast-check generates command
// sequences (fc.commands), runs them against a real page, and after every
// command compares the page with a model built in Node from each case's trace.
// Browser runs are expensive, so counts are modest (test/lib/pbt.ts; FC_RUNS
// sets them all). A failure prints seed, path and the commands' replayPath;
// replay with FC_SEED=<seed> FC_PATH=<path> FC_REPLAY_PATH=<replayPath>.
//
// Reduced motion: the model runs under prefers-reduced-motion: reduce, where
// Next and Replay show the finished step at once. With motion on, Next plays an
// animation in wall-clock time for an unpredictable number of frames, so the
// model's per-command assertions would race it; the motion-on path has its own
// property further down (Next ends on the step's resting picture), which waits
// for each animation to settle. Commands that land while a case is still loading
// are covered by the racing property, which checks consistency, not a model.
// size 'max' spreads sequence lengths up to maxCommands (the default size keeps them under ~10).
const commandOptions = (maxCommands: number) => ({
  maxCommands,
  size: 'max' as const,
  ...(process.env.FC_REPLAY_PATH ? { replayPath: process.env.FC_REPLAY_PATH } : {}),
});

interface StepSpec {
  step: string;
  caption: string;
  title: string;
  line: string;
  summary: string;
  picture: string;
}
interface Entry {
  values: Settings;
  step: string;
}
interface PlayerModel {
  project: Project;
  entries: Entry[];
  index: number;
  notice: string;
  k: number;
  transcript: boolean;
  settles: number;
  /** On a narrow stage, each step opens on its close-up (docs/REFERENCE.md); Fit turns this off, Close-up on. */
  follow: boolean;
  /** The scale of the step's close-ups, worked out when it settled on a narrow stage; the overview goes to them. */
  tourK: number | null;
}
interface PlayerReal {
  page: Page;
  errors: string[];
  /** history.length before the player's first entry. */
  base: number;
  /** Stage insertions made by the HTML parser (the poster), before the player ran. */
  parsed: number;
}
const settingsOfProject = (p: Project) => p.Scene.settings ?? [];
const sameCase = (p: Project, a: Settings, b: Settings) => settingsOfProject(p).every((s) => a[s.id] === b[s.id]);
function stepsOf(p: Project, values: Settings): StepSpec[] {
  const v = p.variants.find((v) => sameCase(p, v.values, values));
  assert.ok(v, `no prebuilt case ${JSON.stringify(values)}`);
  return v.trace.steps.map((s) => ({
    step: s.step,
    caption: stepWords(s).caption,
    title: stepWords(s).title,
    line: stepWords(s).line,
    summary: pictureSummary(s.after),
    picture: pictureHtml(s.after),
  }));
}
const current = (m: PlayerModel) => m.entries[m.index]!;
const steps = (m: PlayerModel) => stepsOf(m.project, current(m).values);
const selected = (m: PlayerModel) => steps(m).findIndex((s) => s.step === current(m).step);
/** Zoom goes from 1× (fit) up to 6× (docs/REFERENCE.md); a zoom by `factor` lands inside that range. */
const ZOOM_MAX = 6;
const kAfter = (k: number, factor: number) => Math.min(ZOOM_MAX, Math.max(1, k * factor));
function push(m: PlayerModel, entry: Entry) {
  m.entries = [...m.entries.slice(0, m.index + 1), entry];
  m.index = m.entries.length - 1;
}
/** What the documented load does: resolve the case, keep the step by name or fall back to the first with a notice. */
function resolveLoad(p: Project, request: Record<string, string>, step: string | undefined) {
  let values: Settings;
  const notices: string[] = [];
  try {
    values = resolveSettings(p.Scene, request);
  } catch (error) {
    values = resolveSettings(p.Scene);
    notices.push(`${(error as Error).message}. Showing the default case.`);
  }
  const list = stepsOf(p, values);
  let found = step ? list.findIndex((s) => s.step === step) : 0;
  // Both fallbacks are announced when both apply.
  if (found < 0) {
    found = 0;
    notices.push(`This case has no “${step}” step, so it opens at the first step.`);
  }
  return { entry: { values, step: list[found]!.step }, notice: notices.join(' ') };
}

/** Everything the reader can see or the host can read, in one snapshot. */
function observe(ids: string[]) {
  const q = new URL(location.href).searchParams;
  const w = window as unknown as {
    __settles: number;
    __attaches: number;
    __last: { step: string; settings: Record<string, string> } | null;
  };
  const button = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  const stage = document.querySelector<HTMLElement>('.stage')!;
  return {
    settles: w.__settles,
    attaches: w.__attaches,
    last: w.__last,
    loading: document.getElementById('content')!.classList.contains('loading'),
    url: location.href,
    urlStep: q.get('step'),
    urlCase: Object.fromEntries(ids.map((id) => [id, q.get(id)])),
    current: [...document.querySelectorAll<HTMLElement>('.steps [aria-current=step]')].map((b) => b.dataset.step),
    list: [...document.querySelectorAll<HTMLElement>('.steps button')].map((b) => b.dataset.step),
    caption: document.querySelector('.caption')!.textContent,
    lede: [...document.querySelectorAll('.lede > *')].map((e) => ((e as HTMLElement).hidden ? null : e.textContent)),
    stageLabel: stage.getAttribute('aria-label'),
    // The resting picture in words: a summary as the stage's description, the full list under a disclosure.
    summary: document.getElementById(stage.getAttribute('aria-describedby') ?? '')?.textContent,
    picture: document.querySelector('.described > div')?.innerHTML,
    title: document.querySelector('h1')!.textContent,
    prevDisabled: button('Previous step')!.disabled,
    nextDisabled: button('Next step')!.disabled,
    notice: document.querySelector('.notice')!.textContent,
    checked: Object.fromEntries(
      ids.map((id) => [id, document.querySelector<HTMLInputElement>(`input[name="${id}"]:checked`)?.value ?? null]),
    ),
    history: history.length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    painted: (() => {
      const svg = stage.querySelector('svg');
      return svg && { view: svg.getAttribute('viewBox')!, camera: svg.getAttribute('data-camera') ?? svg.getAttribute('viewBox')! };
    })(),
    stageW: stage.clientWidth,
    stageH: stage.clientHeight,
    zoomOutDisabled: button('Zoom out')!.disabled,
    zoomInDisabled: button('Zoom in')!.disabled,
    // Unseen, whether removed or holding its place (Fit keeps its place so the controls do not wrap).
    fitHidden: ((b) => b.hidden || getComputedStyle(b).visibility === 'hidden')(button('Fit stage')!),
    closeUpHidden: button('Close-up of each step')!.hidden,
    overviewHidden: document.querySelector<HTMLButtonElement>('.overview')!.hidden,
    transcriptOpen: (document.querySelector('details.transcript') as HTMLDetailsElement).open,
    transcriptLinks: [...document.querySelectorAll<HTMLAnchorElement>('.transcript section:not([hidden]) a')].map((a) => a.href),
  };
}
/** The stage's accessible description as Chromium computes it for assistive technology. */
async function stageDescription(page: Page): Promise<string> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.stage' });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    return String(nodes[0]?.description?.value ?? '');
  } finally {
    await cdp.detach();
  }
}
const twoFrames = (page: Page) =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
/**
 * What the stage paints. The reader's zoom narrows the SVG's viewBox over the author's frame,
 * which the SVG keeps as `data-camera` (app/embed-zoom.ts); with the stage's size, that reads
 * back as the zoom painted.
 */
interface Painted {
  view: string;
  camera: string;
  w: number;
  h: number;
}
const paintedView = (page: Page | Frame): Promise<Painted> =>
  page.locator('.stage svg:not(.leaving)').evaluate((svg) => ({
    view: svg.getAttribute('viewBox')!,
    camera: svg.getAttribute('data-camera') ?? svg.getAttribute('viewBox')!,
    w: svg.parentElement!.clientWidth,
    h: svg.parentElement!.clientHeight,
  }));
/** The reader's zoom painted over the author's frame; null when the stage shows the author's frame (Fit). */
function zoomOf(p: Painted | null) {
  if (!p || p.view === p.camera) return null;
  // Read the world interval under the stage independently of the painter.
  const [ax, ay, aw, ah] = p.camera.trim().split(/[\s,]+/).map(Number);
  const [left, top, width] = p.view.trim().split(/[\s,]+/).map(Number);
  const pixels = Math.min(p.w / aw!, p.h / ah!);
  const k = p.w / width! / pixels;
  return { k, x: -((left! - ax!) * pixels + (p.w - aw! * pixels) / 2) * k,
    y: -((top! - ay!) * pixels + (p.h - ah! * pixels) / 2) * k };
}
/** The zoom painted once any glide (220 ms) has landed: two reads a frame apart agree. */
async function settledZoom(page: Page | Frame) {
  for (let i = 0; ; i++) {
    const a = await paintedView(page);
    await (page as Page).evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const b = await paintedView(page);
    if (a.view === b.view || i > 60) return zoomOf(b);
  }
}
/** Poll until `ok` holds, for up to `ms`. */
async function until(ok: () => Promise<boolean>, what: string, ms = 5000) {
  const end = Date.now() + ms;
  while (!(await ok())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function verify(m: PlayerModel, r: PlayerReal, what: string) {
  const ids = settingsOfProject(m.project).map((s) => s.id);
  await r.page
    .waitForFunction(
      (n) =>
        (window as unknown as { __settles: number }).__settles >= n &&
        !document.getElementById('content')!.classList.contains('loading'),
      m.settles,
      { timeout: 10_000 },
    )
    .catch(() => {});
  await twoFrames(r.page);
  await settledZoom(r.page);
  const seen = await r.page.evaluate(observe, ids);
  const entry = current(m),
    list = steps(m),
    i = selected(m),
    spec = list[i]!;
  const problems: string[] = [];
  const expect = (ok: boolean, label: string, actual: unknown, expected: unknown) => {
    if (!ok) problems.push(`${label}: got ${JSON.stringify(actual)}, model says ${JSON.stringify(expected)}`);
  };
  const eq = (label: string, actual: unknown, expected: unknown) =>
    expect(JSON.stringify(actual) === JSON.stringify(expected), label, actual, expected);
  eq('page errors', r.errors, []);
  eq('settled steps (rayner:step events)', seen.settles, m.settles);
  // Reduced motion: the only pictures ever attached are the resting frames shown on settling.
  eq('pictures attached to the stage', seen.attaches - r.parsed, m.settles);
  eq('URL step', seen.urlStep, entry.step);
  eq('URL case', seen.urlCase, Object.fromEntries(ids.map((id) => [id, entry.values[id]])));
  eq('checked case', seen.checked, Object.fromEntries(ids.map((id) => [id, entry.values[id]])));
  eq('last settled step', seen.last && { step: seen.last.step, settings: seen.last.settings }, {
    step: entry.step,
    settings: Object.fromEntries(ids.map((id) => [id, entry.values[id]])),
  });
  eq('step list', seen.list, list.map((s) => s.step));
  eq('aria-current', seen.current, [entry.step]);
  eq('caption', seen.caption, spec.caption);
  eq('stage label', seen.stageLabel, `${seen.title}: ${spec.title}${spec.line ? ` — ${spec.line}` : ''}`);
  eq('lede', seen.lede, [`${i + 1}. ${spec.title}`, spec.line || null]);
  eq('stage description', seen.summary, spec.summary);
  eq('computed stage description', await stageDescription(r.page), spec.summary.replace(/\s+/g, ' ').trim());
  // Compared as the browser serializes it, which writes &quot; in text as a plain quote.
  const parsed = await r.page.evaluate((html) => Object.assign(document.createElement('div'), { innerHTML: html }).innerHTML, spec.picture);
  eq('picture disclosure', seen.picture, parsed);
  eq('Previous disabled', seen.prevDisabled, i === 0);
  eq('Next disabled', seen.nextDisabled, i === list.length - 1);
  eq('notice', seen.notice, m.notice);
  eq('history length', seen.history, r.base + m.entries.length);
  eq('horizontal overflow', seen.overflow, false);
  eq('transcript open', seen.transcriptOpen, m.transcript);
  eq(
    'transcript links',
    seen.transcriptLinks.map((h) => {
      const q = new URL(h).searchParams;
      return [q.get('step'), ...ids.map((id) => q.get(id))];
    }),
    list.map((s) => [s.step, ...ids.map((id) => entry.values[id])]),
  );
  // Zoom: the scale the model predicts, painted so the drawing covers the stage.
  eq('Zoom out disabled', seen.zoomOutDisabled, m.k <= 1);
  eq('Zoom in disabled', seen.zoomInDisabled, m.k >= ZOOM_MAX);
  eq('Fit hidden', seen.fitHidden, m.k <= 1);
  const narrow = seen.stageW > 0 && seen.stageW < NARROW_PX;
  eq('Close-up hidden', seen.closeUpHidden, !(narrow && !m.follow));
  eq('overview hidden', seen.overviewHidden, !(narrow && m.k > 1));
  // The zoom is painted as a viewBox over the author's frame (data-camera); at k = 1 it is that frame.
  const t = zoomOf(seen.painted && { ...seen.painted, w: seen.stageW, h: seen.stageH });
  if (m.k === 1) eq('viewBox at k=1 (the author frame)', seen.painted?.view, seen.painted?.camera);
  else if (!t) problems.push(`viewBox: the author frame painted, model k=${m.k}`);
  else {
    // The viewBox is written to a thousandth of a user unit, so the zoom reads back to well
    // under a millionth of its scale and a thousandth of a pixel of its pan.
    const eps = 1e-3;
    expect(Math.abs(t.k - m.k) <= 1e-6 * m.k, 'painted scale', seen.painted, m.k);
    expect(
      t.x <= eps && t.y <= eps && t.x + seen.stageW * t.k >= seen.stageW - eps && t.y + seen.stageH * t.k >= seen.stageH - eps,
      'drawing covers stage',
      { painted: seen.painted, zoom: t, w: seen.stageW, h: seen.stageH },
      'covered',
    );
  }
  if (problems.length) throw new Error(`after ${what}:\n  ${problems.join('\n  ')}\n  at ${seen.url}`);
}

type Cmd = fc.AsyncCommand<PlayerModel, PlayerReal>;
/** A command: `act` drives the page and updates the model; every command then verifies the whole page. */
const command = (
  name: string,
  check: (m: PlayerModel) => boolean,
  act: (m: PlayerModel, r: PlayerReal) => Promise<void>,
): Cmd => ({
  check: (m) => check(m as PlayerModel),
  async run(m, r) {
    const settles = m.settles;
    await act(m, r);
    if (m.settles > settles) await reframe(m, r);
    await verify(m, r, name);
  },
  toString: () => name,
});
/** The stage's size now, and whether it is narrow enough for close-ups. */
async function stageSize(r: PlayerReal) {
  const { w, h } = await r.page.locator('.stage').evaluate((s) => ({ w: s.clientWidth, h: s.clientHeight }));
  return { w, h, narrow: w > 0 && w < NARROW_PX };
}
const layoutCache = new Map<string, Promise<Map<string, StepLayout>>>();
/** A case's step layouts, worked out in Node as the page works them out. */
function layoutsOf(p: Project, values: Settings) {
  const key = JSON.stringify([p.file, values]);
  if (!layoutCache.has(key)) layoutCache.set(key, stepLayouts(p.variants.find((v) => sameCase(p, v.values, values))!.Scene));
  return layoutCache.get(key)!;
}
/** The close-ups of the current step on this stage. */
async function tourOf(m: PlayerModel, w: number, h: number) {
  return closeUps((await layoutsOf(m.project, current(m).values)).get(current(m).step), w, h);
}
/** A step settled: on a narrow stage with close-ups on, the zoom is the step's close-up; otherwise it keeps its place. */
async function reframe(m: PlayerModel, r: PlayerReal) {
  const { w, h, narrow } = await stageSize(r);
  m.tourK = narrow ? (await tourOf(m, w, h))[0]!.k : null;
  if (narrow && m.follow) m.k = m.tourK!;
}
const button = (r: PlayerReal, name: string) => r.page.locator(`button[aria-label="${name}"]`);
/** Show a step of this case: a history entry when the step changes, a fresh resting picture always. */
function goTo(m: PlayerModel, index: number) {
  const step = steps(m)[index]!.step;
  if (step !== current(m).step) push(m, { values: current(m).values, step });
  m.settles++;
}
const always = () => true;
const Next = command(
  'Next',
  (m) => selected(m) < steps(m).length - 1,
  async (m, r) => {
    await button(r, 'Next step').click();
    goTo(m, selected(m) + 1);
  },
);
const Previous = command(
  'Previous',
  (m) => selected(m) > 0,
  async (m, r) => {
    await button(r, 'Previous step').click();
    goTo(m, selected(m) - 1);
  },
);
const ClickStep = (i: number) =>
  command(
    `ClickStep(${i})`,
    (m) => i < steps(m).length,
    async (m, r) => {
      await r.page.locator('.steps button').nth(i).click();
      goTo(m, i);
    },
  );
const TranscriptLink = (i: number) =>
  command(
    `TranscriptLink(${i})`,
    (m) => m.transcript && i < steps(m).length,
    async (m, r) => {
      await r.page.locator('.transcript section:not([hidden]) a').nth(i).click();
      goTo(m, i);
    },
  );
const ChooseCase = (setting: number, option: number) =>
  command(
    `ChooseCase(${setting}, ${option})`,
    (m) => {
      const s = settingsOfProject(m.project)[setting];
      return !!s && option < s.options.length;
    },
    async (m, r) => {
      const s = settingsOfProject(m.project)[setting]!,
        value = s.options[option]!.value;
      await r.page.locator(`input[name="${s.id}"][value="${value}"]`).locator('xpath=..').click();
      // Choosing the case already shown changes nothing.
      if (current(m).values[s.id] === value) return;
      // A new case keeps the step by name, or falls back to the first with a notice; zoom resets.
      const { entry, notice } = resolveLoad(m.project, { ...current(m).values, [s.id]: value }, current(m).step);
      push(m, entry);
      m.notice = notice;
      m.k = 1;
      m.settles++;
    },
  );
/** Back/Forward restore case and step; zoom keeps its place across steps and resets when the case changes (docs/REFERENCE.md). */
function traverse(m: PlayerModel, by: number) {
  const was = current(m).values;
  m.index += by;
  m.notice = '';
  if (!sameCase(m.project, was, current(m).values)) m.k = 1;
  m.settles++;
}
const Back = command(
  'Back',
  (m) => m.index > 0,
  async (m, r) => {
    await r.page.goBack({ waitUntil: 'commit' });
    traverse(m, -1);
  },
);
const Forward = command(
  'Forward',
  (m) => m.index < m.entries.length - 1,
  async (m, r) => {
    await r.page.goForward({ waitUntil: 'commit' });
    traverse(m, 1);
  },
);
const ZoomButton = (which: 'Zoom in' | 'Zoom out' | 'Fit stage') =>
  command(
    `ZoomButton(${which})`,
    (m) => (which === 'Zoom in' ? m.k < ZOOM_MAX : m.k > 1),
    async (m, r) => {
      const { narrow } = await stageSize(r);
      await button(r, which).click();
      m.k = which === 'Fit stage' ? 1 : kAfter(m.k, which === 'Zoom in' ? 1.6 : 1 / 1.6);
      // On a narrow stage, Fit keeps the whole picture for the steps that follow.
      if (which === 'Fit stage' && narrow) m.follow = false;
    },
  );
/** Close-up: shown on a narrow stage once Fit has turned close-ups off; it turns them on and frames this step. */
const CloseUpButton = command('CloseUpButton', (m) => !m.follow, async (m, r) => {
  const { w, h, narrow } = await stageSize(r);
  if (!narrow) return; // hidden, so there is nothing to press
  await button(r, 'Close-up of each step').click();
  m.follow = true;
  m.k = m.tourK = (await tourOf(m, w, h))[0]!.k;
});
/** The overview: shown on a narrow zoomed stage; it moves to the step's next close-up, at the close-ups' scale. */
const OverviewButton = command('OverviewButton', always, async (m, r) => {
  const overview = r.page.locator('.overview');
  if (!(await overview.isVisible()) || (await overview.isDisabled())) return;
  await overview.click();
  m.k = m.tourK!;
});
const Replay = command('Replay', always, async (m, r) => {
  await button(r, 'Replay step').click();
  m.notice = 'Reduced motion is on, so the finished step is shown.';
  m.settles++;
});
const CopyLink: Cmd = {
  check: always,
  async run(m, r) {
    await r.page.evaluate(() => navigator.clipboard.writeText(''));
    await button(r, 'Copy link').click();
    m.notice = 'Link copied.';
    await verify(m, r, 'CopyLink');
    const copied = new URL(await r.page.evaluate(() => navigator.clipboard.readText()));
    const here = new URL(r.page.url());
    here.searchParams.delete('parentOrigin');
    assert.equal(copied.href, here.href, 'the copied link is this page without parentOrigin');
    assert.equal(copied.searchParams.get('step'), current(m).step);
    for (const s of settingsOfProject(m.project)) assert.equal(copied.searchParams.get(s.id), current(m).values[s.id]);
  },
  toString: () => 'CopyLink',
};
/** A key pressed on the page, or on the focused stage: only the stage takes zoom keys, and once zoomed its arrows pan. */
const Key = (key: string, onStage = false) =>
  command(`Key(${JSON.stringify(key)}${onStage ? ', stage' : ''})`, always, async (m, r) => {
    await r.page.locator(onStage ? '.stage' : '#content').focus();
    await r.page.keyboard.press(key);
    const i = selected(m),
      stepping = !(onStage && m.k > 1);
    if (stepping && key === 'ArrowRight' && i < steps(m).length - 1) goTo(m, i + 1);
    // ArrowLeft mirrors Previous, which is disabled on the first step.
    if (stepping && key === 'ArrowLeft' && i > 0) goTo(m, i - 1);
    if (!onStage) return;
    if (key === '+' || key === '=') m.k = kAfter(m.k, 1.6);
    if (key === '-') m.k = kAfter(m.k, 1 / 1.6);
    if (key === '0') {
      m.k = 1;
      if ((await stageSize(r)).narrow) m.follow = false;
    }
  });
/** A point on the stage. The stage has 12 px rounded corners, outside which a pointer is not on it. */
async function stagePoint(r: PlayerReal, u: number, v: number) {
  // Earlier clicks scroll the page; a pointer off the viewport reaches nothing.
  await r.page.locator('.stage').evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  const box = (await r.page.locator('.stage').boundingBox())!,
    view = r.page.viewportSize()!,
    inset = 12;
  // The part of the stage on screen (a short viewport shows only part of it), inside the corners.
  const left = Math.max(box.x, 0) + inset,
    top = Math.max(box.y, 0) + inset,
    right = Math.min(box.x + box.width, view.width) - inset,
    bottom = Math.min(box.y + box.height, view.height) - inset;
  return { x: left + u * (right - left), y: top + v * (bottom - top) };
}
const DoubleClick = (u: number, v: number) =>
  command(`DoubleClick(${u}, ${v})`, always, async (m, r) => {
    const p = await stagePoint(r, u, v);
    await r.page.mouse.dblclick(p.x, p.y);
    m.k = m.k > 1 ? 1 : kAfter(m.k, 2.5);
  });
const CtrlWheel = (dy: number) =>
  command(`CtrlWheel(${dy})`, always, async (m, r) => {
    const p = await stagePoint(r, 0.5, 0.5);
    await r.page.mouse.move(p.x, p.y);
    await r.page.keyboard.down('Control');
    await r.page.mouse.wheel(0, dy);
    await r.page.keyboard.up('Control');
    m.k = kAfter(m.k, Math.exp(-dy / 100));
  });
const Drag = (dx: number, dy: number) =>
  command(`Drag(${dx}, ${dy})`, always, async (_m, r) => {
    const p = await stagePoint(r, 0.5, 0.5);
    await r.page.mouse.move(p.x, p.y);
    await r.page.mouse.down();
    await r.page.mouse.move(p.x + dx, p.y + dy, { steps: 3 });
    await r.page.mouse.up();
  });
const ToggleTranscript = command('ToggleTranscript', always, async (m, r) => {
  await r.page.locator('.transcript > summary').click();
  m.transcript = !m.transcript;
});
const Resize = (width: number, height: number) =>
  command(`Resize(${width}, ${height})`, always, async (_m, r) => {
    await r.page.setViewportSize({ width, height });
  });

// Narrower than 200 CSS px a single unbreakable word (a step title) is wider than the column.
const viewportArb = fc.record({ width: fc.integer({ min: 200, max: 1600 }), height: fc.integer({ min: 400, max: 1200 }) });
/** URL text: any code point, plus lone surrogates and the characters URLs treat specially. */
const urlText = fc.string({
  unit: fc.oneof(
    fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }),
    fc.constantFrom('\uD800', '\uDC00', '\0', '&', '=', '#', '%', '+', ' ', '?', '“', '”'),
  ),
});
function initialArb(p: Project) {
  const names = [...new Set(p.variants.flatMap((v) => v.trace.steps.map((s) => s.step)))];
  return fc.record({
    values: fc.tuple(
      ...settingsOfProject(p).map((s) =>
        fc.option(fc.oneof(fc.constantFrom(...s.options.map((o) => o.value)), urlText), { nil: undefined }),
      ),
    ),
    step: fc.option(fc.oneof(fc.constantFrom(...names), urlText), { nil: undefined }),
    viewport: viewportArb,
  });
}
function commandArbs(p: Project): fc.Arbitrary<Cmd>[] {
  const settings = settingsOfProject(p);
  return [
    fc.constant(Next),
    fc.constant(Previous),
    fc.nat({ max: 7 }).map(ClickStep),
    fc.nat({ max: 7 }).map(TranscriptLink),
    ...(settings.length
      ? [fc.tuple(fc.nat({ max: settings.length - 1 }), fc.nat({ max: 2 })).map(([s, o]) => ChooseCase(s, o))]
      : []),
    fc.constant(Back),
    fc.constant(Forward),
    fc.constantFrom('Zoom in', 'Zoom out', 'Fit stage').map((w) => ZoomButton(w as 'Zoom in')),
    fc.constant(Replay),
    fc.constant(CopyLink),
    fc.tuple(fc.constantFrom('ArrowRight', 'ArrowLeft', 'ArrowUp', '+', '=', '-', '0'), fc.boolean()).map(([k, onStage]) => Key(k, onStage)),
    fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })).map(
      ([u, v]) => DoubleClick(u, v),
    ),
    fc.integer({ min: -5000, max: 5000 }).map(CtrlWheel),
    fc.tuple(fc.integer({ min: -400, max: 400 }), fc.integer({ min: -400, max: 400 })).map(([x, y]) => Drag(x, y)),
    fc.constant(ToggleTranscript),
    viewportArb.map((v) => Resize(v.width, v.height)),
    fc.constant(CloseUpButton),
    fc.constant(OverviewButton),
  ];
}
async function openPlayer(name: string, initial: { values: (string | undefined)[]; step?: string; viewport: { width: number; height: number } }) {
  const p = projects.get(name)!;
  const query = new URLSearchParams();
  settingsOfProject(p).forEach((s, i) => {
    if (initial.values[i] !== undefined) query.set(s.id, initial.values[i]!);
  });
  if (initial.step !== undefined) query.set('step', initial.step);
  // The model reads the URL the way the page does: WHATWG decoding of the same query.
  const q = new URLSearchParams(query.toString()),
    request: Record<string, string> = {};
  for (const s of settingsOfProject(p)) if (q.has(s.id)) request[s.id] = q.get(s.id)!;
  const { entry, notice } = resolveLoad(p, request, q.get('step') ?? undefined);
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    reducedMotion: 'reduce',
    viewport: initial.viewport,
  });
  context.setDefaultTimeout(5000);
  await context.addInitScript(() => {
    const w = window as unknown as { __settles: number; __attaches: number; __last: unknown };
    w.__settles = 0;
    w.__attaches = 0;
    w.__last = null;
    document.addEventListener('rayner:step', (e) => {
      w.__settles++;
      w.__last = (e as CustomEvent).detail;
    });
    new MutationObserver((records) => {
      for (const r of records)
        if ((r.target as Element).classList?.contains('stage') && r.addedNodes.length) w.__attaches++;
    }).observe(document, { childList: true, subtree: true });
  });
  // A failed opening closes its context too: shrinking reruns failing cases, and each would leave one open.
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${embed}/${name}.html${query.size ? '?' + query : ''}`);
    await page.waitForSelector('[data-ready=true]');
    const base = (await page.evaluate(() => history.length)) - 1;
    const parsed = (await page.evaluate(() => (window as unknown as { __attaches: number }).__attaches)) - 1;
    const model: PlayerModel = { project: p, entries: [entry], index: 0, notice, k: 1, transcript: false, settles: 1, follow: true, tourK: null };
    const real: PlayerReal = { page, errors, base, parsed };
    await reframe(model, real);
    await verify(model, real, `opening ${page.url()}`);
    return { context, model, real };
  } catch (error) {
    await context.close();
    throw error;
  }
}
// oauth-pkce's cases have different step lists (only "yes" has an attack), the case the player finds hardest.
for (const [name, runs, maxCommands] of [['oauth-pkce', 10, 40]] as const)
  test(
    `player (${name}): any sequence of reader actions keeps the URL, step list, caption, controls, zoom and history in step with the model`,
    options,
    async () => {
      const p = projects.get(name)!;
      await fc.assert(
        fc.asyncProperty(initialArb(p), fc.commands(commandArbs(p), commandOptions(maxCommands)), async (initial, cmds) => {
          const { context, model, real } = await openPlayer(name, initial);
          try {
            await fc.asyncModelRun(() => ({ model, real }), cmds);
          } finally {
            await context.close();
          }
          // Each case leaves the browser as it found it, so a leak fails here rather than crashing a later case.
          assert.equal(browser.contexts().length, 0, 'browser contexts left open after a case');
        }),
        params(runs),
      );
    },
  );

test(
  'player: from ?attacker=yes&step=attack, choosing "no" falls back to the first step with a notice; Back restores the attack step',
  options,
  async () => {
    const { context, model, real } = await openPlayer('oauth-pkce', { values: ['yes'], step: 'attack', viewport: { width: 700, height: 900 } });
    try {
      await fc.asyncModelRun(() => ({ model, real }), [ChooseCase(0, 1), Back, CopyLink, Replay]);
      // Every command ran (a command whose precondition fails is skipped silently), and verify() held after each.
      const first = stepsOf(model.project, { attacker: 'no' })[0]!.step;
      assert.deepEqual(model.entries.map((e) => [e.values.attacker, e.step]), [['yes', 'attack'], ['no', first]]);
      assert.equal(model.index, 0, 'Back returned to the first entry');
      assert.equal(model.notice, 'Reduced motion is on, so the finished step is shown.');
    } finally {
      await context.close();
    }
  },
);

/** Open a player page with the settle and attach counters installed. */
async function counted(context: import('playwright-core').BrowserContext, url: string) {
  await context.addInitScript(() => {
    const w = window as unknown as { __settles: number; __attaches: number; __last: unknown };
    w.__settles = 0;
    w.__attaches = 0;
    w.__last = null;
    document.addEventListener('rayner:step', (e) => {
      w.__settles++;
      w.__last = (e as CustomEvent).detail;
    });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('[data-ready=true]');
  return { page, errors };
}
/** Quiet: nothing loading, no animation playing, and no step settled for `ms`. */
async function quiet(page: Page, ms = 300) {
  const deadline = Date.now() + 30_000;
  for (;;) {
    assert.ok(Date.now() < deadline, `reader did not become quiet within 30 seconds: ${page.url()}`);
    const n = await page.evaluate(() => (window as unknown as { __settles: number }).__settles);
    await page.waitForFunction(
      () =>
        !document.getElementById('content')!.classList.contains('loading') &&
        !!document.querySelector('button[aria-label="Replay step"]'),
      undefined,
      { timeout: Math.max(1, deadline - Date.now()) },
    );
    await page.waitForTimeout(ms);
    if ((await page.evaluate(() => (window as unknown as { __settles: number }).__settles)) === n) return;
  }
}
// The picture on the stage, not one still fading out under reduced motion.
const stagePicture = (page: Page) => page.locator('.stage').evaluate((s) => s.querySelector('svg:not(.leaving)')?.outerHTML);
const caseQuery = (p: Project, values: Settings, step: string) => {
  const q = new URLSearchParams();
  for (const s of settingsOfProject(p)) q.set(s.id, values[s.id]!);
  q.set('step', step);
  return q.toString();
};

// Phone close-ups (app/embed-closeup.ts). On a 390 px page each step opens on the close-up
// Node works out for it, whether reached by a link or by Next with motion on, and the two
// rest on the same picture; on a desktop page no step is zoomed.
test(
  'phone close-ups: at 390 × 844 every step opens on its close-up, by link or by Next with motion; at 1280 × 900 none is zoomed',
  options,
  async () => {
    for (const name of ['mr-cache', 'exgit', 'oauth-pkce']) {
      const p = projects.get(name)!;
      // mr-cache's two cases, exgit's first and PKCE's with the attacker (issue #21): diagram, code and card changes.
      const cases = name === 'mr-cache' ? p.variants : name === 'exgit' ? p.variants.slice(0, 1) : p.variants.filter((v) => v.values.attacker === 'yes');
      for (const v of cases) {
        const list = v.trace.steps,
          layouts = await stepLayouts(v.Scene);
        const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
        const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
        try {
          const a = await counted(phone, `${embed}/${name}.html?${caseQuery(p, v.values, list[0]!.step)}`);
          const d = await counted(desk, `${embed}/${name}.html?${caseQuery(p, v.values, list[0]!.step)}`);
          for (let i = 0; i < list.length; i++) {
            const step = list[i]!.step;
            if (i > 0) {
              await a.page.locator('button[aria-label="Next step"]').click();
              await d.page.locator('button[aria-label="Next step"]').click();
            }
            await quiet(a.page);
            await quiet(d.page);
            const size = await a.page.locator('.stage').evaluate((s) => ({ w: s.clientWidth, h: s.clientHeight }));
            assert.ok(size.w < NARROW_PX);
            const want = closeUps(layouts.get(step), size.w, size.h)[0]!;
            const t = await settledZoom(a.page);
            const where = `${name} ${JSON.stringify(v.values)} ${step}`;
            if (want.k === 1) assert.equal(t, null, where);
            else
              assert.ok(
                t && Math.abs(t.k - want.k) < 1e-4 * want.k && Math.abs(t.x - want.x) < 0.01 && Math.abs(t.y - want.y) < 0.01,
                `${where}: painted ${JSON.stringify(t)}, close-up ${JSON.stringify(want)}`,
              );
            assert.equal(await a.page.locator('.overview').isVisible(), want.k > 1, `${where}: overview`);
            // Hold still: the picture Next rests on is the picture a link to the step shows, close-up and all.
            const rested = await stagePicture(a.page);
            const b = await phone.newPage();
            await b.goto(`${embed}/${name}.html?${caseQuery(p, v.values, step)}`);
            await b.waitForSelector('[data-ready=true]');
            await quiet(b);
            assert.equal(await stagePicture(b), rested, `${where}: Next and a link rest on different pictures`);
            await b.close();
            // Desktop: unchanged, the whole picture at every step, no overview, no close-up control.
            assert.equal(zoomOf(await paintedView(d.page)), null, where);
            assert.equal(await d.page.locator('.overview').isHidden(), true);
            assert.equal(await d.page.locator('button[aria-label="Close-up of each step"]').isHidden(), true);
          }
          assert.deepEqual([...a.errors, ...d.errors], []);
        } finally {
          await phone.close();
          await desk.close();
        }
      }
    }
  },
);

// Issue #21: at 390 × 844, PKCE's `authorize` caption says the verifier stays with the client
// and is not sent, as the note under the request says, and the first step's caption describes deriving the
// challenge; both were close-ups the reader had to hunt for (7th of 7, 4th of 6). Next view
// now goes first to what the step emphasised, so one press, by touch or by keyboard, shows each.
test('phone: one press of Next view shows what PKCE\'s captions point at, emphasised close-ups first', options, async () => {
  const p = projects.get('oauth-pkce')!,
    v = p.variants.find((c) => c.values.attacker === 'yes')!,
    layouts = await stepLayouts(v.Scene);
  const evidence: Record<string, Box> = {
    secret: await restingBox(v.Scene, 'secret', (scene) => wordsOutsideCards(scene, 'code_verifier', 'SHA-256')),
    authorize: await restingBox(v.Scene, 'authorize', (scene) => labelsSaying(scene, 'verifier not sent')),
  };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'no-preference' });
  try {
    const { page, errors } = await counted(context, `${embed}/oauth-pkce.html`);
    await quiet(page);
    const { w, h } = await page.locator('.stage').evaluate((s) => ({ w: s.clientWidth, h: s.clientHeight }));
    const count = page.locator('.view-controls>span'),
      nextView = page.getByRole('button', { name: 'Next view', exact: true });
    const near = (a: ReturnType<typeof zoomOf>, b: { k: number; x: number; y: number }) =>
      !!a && Math.abs(a.k - b.k) < 1e-4 * b.k && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    const shows = async (box: Box) => {
      const z = await settledZoom(page),
        view = z && viewBox(z, w, h);
      return !!view && box[0] >= view[0] - 1e-3 && box[2] <= view[2] + 1e-3 && box[1] >= view[1] - 1e-3 && box[3] <= view[3] + 1e-3;
    };
    for (const [i, step] of ['secret', 'authorize'].entries()) {
      if (i > 0) {
        // Next, with motion: it moves to the next step, as before.
        await page.getByRole('button', { name: 'Next step', exact: true }).click();
        await page.waitForURL(/step=authorize/);
        await quiet(page);
      }
      const tour = closeUps(layouts.get(step), w, h);
      assert.ok(near(await settledZoom(page), tour[0]!), `${step} opens on its first close-up`);
      assert.equal(await count.innerText(), `View 1 of ${tour.length}`);
      // What the caption points at is in the opening close-up, or one press away.
      const atOnce = await shows(evidence[step]!);
      // One press, a tap on the first step and the keyboard on the second, moves to the next close-up.
      if (i === 0) await nextView.tap();
      else {
        await nextView.focus();
        await page.keyboard.press('Enter');
      }
      await until(async () => near(zoomOf(await paintedView(page)), tour[1]!), `${step}: view 2`);
      assert.equal(await count.innerText(), `View 2 of ${tour.length}`);
      assert.equal(new URL(page.url()).searchParams.get('step'), step, 'Next view keeps the step');
      assert.ok(atOnce || (await shows(evidence[step]!)), `${step}: view 1 or 2 shows ${JSON.stringify(evidence[step])}`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

// Regression (ledger P5): Next used to stop the animation where the caption hold
// begins, before anything a step adds after its last play(), so the picture the
// reader rested on differed from the one a link to that step shows.
test(
  'player, motion on: after Next settles, the stage shows exactly the picture a link to that step shows',
  options,
  async () => {
    const all = ['oauth-pkce', 'exgit', 'mr-cache'].flatMap((name) =>
      projects.get(name)!.variants.flatMap((v) =>
        v.trace.steps.slice(0, -1).map((_, i) => ({ name, values: v.values, i })),
      ),
    );
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...all), async ({ name, values, i }) => {
        const p = projects.get(name)!,
          list = stepsOf(p, values);
        const context = await browser.newContext({ reducedMotion: 'no-preference' });
        try {
          const a = await counted(context, `${embed}/${name}.html?${caseQuery(p, values, list[i]!.step)}`);
          await a.page.locator('button[aria-label="Next step"]').click();
          await a.page.waitForFunction(() => (window as unknown as { __settles: number }).__settles >= 2, undefined, {
            timeout: 30_000,
          });
          await quiet(a.page);
          const b = await counted(context, `${embed}/${name}.html?${caseQuery(p, values, list[i + 1]!.step)}`);
          assert.equal(new URL(a.page.url()).searchParams.get('step'), list[i + 1]!.step);
          assert.equal(await stagePicture(a.page), await stagePicture(b.page), `${name} ${JSON.stringify(values)} ${list[i]!.step} → Next`);
          assert.deepEqual([...a.errors, ...b.errors], []);
        } finally {
          await context.close();
        }
      }),
      params(5),
    );
  },
);

// Next pressed while a step plays sends the playing run on to the next step, undrawn,
// instead of replaying the scene from its start; it must still rest on the link's picture.
test(
  'player, motion on: Next pressed mid-motion rests on exactly the picture a link to the step after shows',
  options,
  async () => {
    const all = ['oauth-pkce', 'exgit'].flatMap((name) =>
      projects.get(name)!.variants.slice(0, 1).flatMap((v) =>
        v.trace.steps.slice(0, -2).map((_, i) => ({ name, values: v.values, i })),
      ),
    );
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...all), fc.constantFrom(60, 250, 600), async ({ name, values, i }, after) => {
        const p = projects.get(name)!,
          list = stepsOf(p, values);
        const context = await browser.newContext({ reducedMotion: 'no-preference' });
        try {
          const a = await counted(context, `${embed}/${name}.html?${caseQuery(p, values, list[i]!.step)}`);
          await quiet(a.page);
          await a.page.locator('button[aria-label="Next step"]').click();
          await a.page.waitForTimeout(after);
          await a.page.locator('button[aria-label="Next step"]').click();
          await a.page.waitForFunction((step) => (window as unknown as { __last: { step: string } | null }).__last?.step === step, list[i + 2]!.step, {
            timeout: 30_000,
          });
          await quiet(a.page);
          const b = await counted(context, `${embed}/${name}.html?${caseQuery(p, values, list[i + 2]!.step)}`);
          const where = `${name} ${list[i]!.step} → Next, ${after} ms, Next`;
          assert.equal(new URL(a.page.url()).searchParams.get('step'), list[i + 2]!.step, where);
          assert.equal(await stagePicture(a.page), await stagePicture(b.page), where);
          assert.deepEqual([...a.errors, ...b.errors], []);
        } finally {
          await context.close();
        }
      }),
      params(6),
    );
  },
);

// Every scene run draws into an SVG root the page creates, and a kept picture is a copy
// (cloneNode creates nothing). So when a stage picture was created tells whether the
// player re-ran the scene for it: Next should play a run prepared while the reader was
// on the previous step, and a step seen before should come back as a copy.
test(
  'player, motion on: Next plays a run prepared before the tap, and a revisited step is a copy, not a re-run',
  options,
  async () => {
    const name = 'oauth-pkce',
      p = projects.get(name)!,
      v = p.variants[0]!,
      list = v.trace.steps;
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    try {
      await context.addInitScript(() => {
        const born = new WeakMap<Node, number>(),
          w = window as unknown as { __shown: Array<{ at: number; born: number | null }> };
        w.__shown = [];
        const create = Document.prototype.createElementNS;
        Document.prototype.createElementNS = function (this: Document, ...args: Parameters<typeof create>) {
          const node = create.apply(this, args);
          born.set(node, performance.now());
          return node;
        } as typeof create;
        new MutationObserver((records) => {
          for (const r of records)
            if ((r.target as Element).matches?.('.player .stage'))
              for (const n of r.addedNodes) if (n.nodeName === 'svg') w.__shown.push({ at: performance.now(), born: born.get(n) ?? null });
        }).observe(document, { childList: true, subtree: true });
      });
      const { page, errors } = await counted(context, `${embed}/${name}.html?${caseQuery(p, v.values, list[0]!.step)}`);
      /** Run `act`, wait for the player to settle, and return the stage pictures shown meanwhile. */
      const shownDuring = async (act: () => Promise<void>) => {
        await quiet(page);
        const [t, n] = await page.evaluate(() => [performance.now(), (window as unknown as { __settles: number }).__settles]);
        await act();
        await page.waitForFunction((n) => (window as unknown as { __settles: number }).__settles > n, n, { timeout: 30_000 });
        const shown = await page.evaluate((t) => (window as unknown as { __shown: Array<{ at: number; born: number | null }> }).__shown.filter((s) => s.at > t), t);
        return { t, shown };
      };
      const next = await shownDuring(() => page.locator('button[aria-label="Next step"]').click());
      assert.ok(next.shown.length >= 1, 'Next showed a picture');
      assert.ok(next.shown[0]!.born !== null && next.shown[0]!.born < next.t, `Next's first picture was drawn after the tap: ${JSON.stringify(next)}`);
      for (const i of [0, 1]) {
        const back = await shownDuring(() => page.locator('.steps button').nth(i).click());
        assert.ok(back.shown.length >= 1, `step ${list[i]!.step} showed a picture`);
        assert.equal(back.shown.at(-1)!.born, null, `step ${list[i]!.step} was drawn again, not copied: ${JSON.stringify(back)}`);
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  },
);

// Commands fired in a burst, without waiting for the player: case changes race
// navigation while a new case's trace is still being computed.
type Burst = { kind: 'case'; setting: number; option: number } | { kind: 'next' | 'prev' | 'back' | 'forward' | 'left' | 'right' } | { kind: 'step'; i: number };
const burstArb = (p: Project) =>
  fc.array(
    fc.record({
      action: fc.oneof(
        fc.record({ kind: fc.constant('case' as const), setting: fc.nat({ max: Math.max(0, settingsOfProject(p).length - 1) }), option: fc.nat({ max: 2 }) }),
        fc.record({ kind: fc.constantFrom('next' as const, 'prev' as const, 'back' as const, 'forward' as const, 'left' as const, 'right' as const) }),
        fc.record({ kind: fc.constant('step' as const), i: fc.nat({ max: 7 }) }),
      ),
      // Same task, next microtask-free turn, or a short pause.
      gap: fc.constantFrom(0, 1, 5, 20, 60),
    }),
    { minLength: 1, maxLength: 12 },
  );
for (const name of ['oauth-pkce'] as const)
  test(
    `player (${name}): any burst of case changes and navigation, unawaited, ends with the URL, choice, list, caption and picture all on one case and step`,
    options,
    async () => {
      const p = projects.get(name)!,
        ids = settingsOfProject(p).map((s) => s.id);
      await fc.assert(
        fc.asyncProperty(burstArb(p), async (burst) => {
          const context = await browser.newContext({ reducedMotion: 'reduce' });
          try {
            const { page, errors } = await counted(context, `${embed}/${name}.html`);
            await page.evaluate(
              async ({ burst, settings }) => {
                const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
                const button = (n: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${n}"]`)!;
                const key = (k: string) =>
                  document.getElementById('content')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
                // Back must not leave the player's document: count Backs not yet committed.
                const nav = (window as unknown as { navigation: { currentEntry: { index: number } } }).navigation;
                let queued = 0,
                  seenIndex = nav.currentEntry.index;
                for (const { action: a, gap } of burst) {
                  if (nav.currentEntry.index !== seenIndex) [queued, seenIndex] = [0, nav.currentEntry.index];
                  if (a.kind === 'case') {
                    const s = settings[a.setting];
                    const input = s && document.querySelector<HTMLInputElement>(`input[name="${s.id}"][value="${s.options[a.option % s.options.length]}"]`);
                    input?.click();
                  } else if (a.kind === 'next') button('Next step').click();
                  else if (a.kind === 'prev') button('Previous step').click();
                  else if (a.kind === 'back') {
                    if (nav.currentEntry.index - queued > 0) {
                      queued++;
                      history.back();
                    }
                  }
                  else if (a.kind === 'forward') history.forward();
                  else if (a.kind === 'left') key('ArrowLeft');
                  else if (a.kind === 'right') key('ArrowRight');
                  else if (a.kind === 'step') document.querySelectorAll<HTMLButtonElement>('.steps button')[a.i]?.click();
                  if (gap) await pause(gap);
                }
              },
              {
                burst: burst as { action: Burst; gap: number }[],
                settings: settingsOfProject(p).map((s) => ({ id: s.id, options: s.options.map((o) => o.value) })),
              },
            );
            await quiet(page);
            const seen = await page.evaluate(observe, ids);
            const values = Object.fromEntries(ids.map((id) => [id, seen.urlCase[id]!])) as Settings;
            const list = stepsOf(p, values),
              at = list.findIndex((s) => s.step === seen.urlStep);
            assert.ok(at >= 0, `URL step ${seen.urlStep} is not a step of ${JSON.stringify(values)}`);
            assert.deepEqual(
              {
                checked: seen.checked,
                list: seen.list,
                current: seen.current,
                caption: seen.caption,
                last: seen.last,
                errors,
              },
              {
                checked: seen.urlCase,
                list: list.map((s) => s.step),
                current: [seen.urlStep],
                caption: list[at]!.caption,
                last: { step: seen.urlStep, settings: seen.urlCase },
                errors: [],
              },
            );
            // The picture is that step's resting frame: what a fresh link to it shows.
            const fresh = await counted(context, `${embed}/${name}.html?${caseQuery(p, values, seen.urlStep!)}`);
            assert.equal(await stagePicture(page), await stagePicture(fresh.page), 'stage picture');
          } finally {
            await context.close();
          }
        }),
        params(12),
      );
    },
  );

test(
  'player: controls and keys used before the first case has loaded raise no errors and leave the requested step showing',
  options,
  async () => {
    const name = 'oauth-pkce',
      p = projects.get(name)!;
    const early = fc.array(fc.constantFrom('Next step', 'Previous step', 'Replay step', 'Copy link', 'Zoom in', 'Zoom out', 'ArrowRight', 'ArrowLeft', '+', '0'), {
      minLength: 1,
      maxLength: 8,
    });
    await fc.assert(
      fc.asyncProperty(early, fc.constantFrom(...stepsOf(p, resolveSettings(p.Scene)).map((s) => s.step)), async (actions, step) => {
        const context = await browser.newContext({ reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
        try {
          // As soon as the controls exist, before the first trace is ready, use them.
          await context.addInitScript((actions: string[]) => {
            const w = window as unknown as { __early: number };
            w.__early = 0;
            const observer = new MutationObserver(() => {
              if (!document.querySelector('button[aria-label="Next step"]')) return;
              observer.disconnect();
              for (const a of actions) {
                const b = document.querySelector<HTMLButtonElement>(`button[aria-label="${a}"]`);
                if (b) b.click();
                else document.getElementById('content')!.dispatchEvent(new KeyboardEvent('keydown', { key: a, bubbles: true }));
                w.__early++;
              }
            });
            observer.observe(document, { childList: true, subtree: true });
          }, actions);
          const { page, errors } = await counted(context, `${embed}/${name}.html?step=${step}`);
          await quiet(page);
          assert.equal(await page.evaluate(() => (window as unknown as { __early: number }).__early), actions.length);
          assert.deepEqual(errors, []);
          // Nothing could move before the trace existed, so the deep link's step is showing.
          assert.equal(new URL(page.url()).searchParams.get('step'), step);
        } finally {
          await context.close();
        }
      }),
      params(10),
    );
  },
);

// ---------------------------------------------------------------------------
// reportHeight, in real cross-origin frames. Each frame's `parent` is wrapped
// (it is a [Replaceable] window attribute) so every postMessage the child makes
// is recorded with its target origin, including any the browser would drop.
interface Post {
  msg: { type?: unknown; version?: unknown; height?: unknown };
  origin: string;
}
async function recordPosts(context: import('playwright-core').BrowserContext) {
  await context.addInitScript(() => {
    if (window.parent === window) return;
    const real = window.parent,
      posts: { msg: unknown; origin: string }[] = [];
    (window as unknown as { __posts: typeof posts }).__posts = posts;
    (window as unknown as { parent: unknown }).parent = {
      postMessage(msg: unknown, origin: string) {
        posts.push({ msg: JSON.parse(JSON.stringify(msg)), origin });
        real.postMessage(msg, origin);
      },
    };
  });
}
const postsOf = (frame: Frame) => frame.evaluate(() => (window as unknown as { __posts: Post[] }).__posts);
type HeightAction =
  | { kind: 'transcript' | 'next' | 'prev' | 'away' | 'back' }
  | { kind: 'case'; option: number }
  | { kind: 'resize'; width: number; height: number };
const heightActions = fc.array(
  fc.oneof(
    fc.record({ kind: fc.constantFrom('transcript' as const, 'next' as const, 'prev' as const, 'away' as const, 'back' as const) }),
    fc.record({ kind: fc.constant('case' as const), option: fc.nat({ max: 2 }) }),
    fc.record({ kind: fc.constant('resize' as const), width: fc.integer({ min: 200, max: 1600 }), height: fc.integer({ min: 300, max: 1200 }) }),
  ),
  { minLength: 1, maxLength: 10 },
);
/** Act inside the frame through the DOM, so nothing scrolls the host as a Playwright click would. */
async function heightAct(page: Page, frame: Frame, a: HeightAction) {
  if (a.kind === 'resize') return page.setViewportSize({ width: a.width, height: a.height });
  if (a.kind === 'away') return page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  if (a.kind === 'back') return page.evaluate(() => scrollTo(0, 0));
  await frame.evaluate((a) => {
    if (a.kind === 'transcript') document.querySelector<HTMLElement>('.transcript > summary')!.click();
    else if (a.kind === 'next') document.querySelector<HTMLButtonElement>('button[aria-label="Next step"]')!.click();
    else if (a.kind === 'prev') document.querySelector<HTMLButtonElement>('button[aria-label="Previous step"]')!.click();
    else if (a.kind === 'case') {
      const inputs = document.querySelectorAll<HTMLInputElement>('.case input');
      inputs[a.option % inputs.length]?.click();
    }
  }, a);
}
/** The frame's last posted height, its content root's height and the host's iframe height, once they agree (or after 5 s). */
async function heightsSettle(page: Page, frame: Frame) {
  let last: { posted: unknown; content: number; iframe: string } | undefined;
  for (const until = Date.now() + 5000; Date.now() < until; await page.waitForTimeout(50)) {
    const { posted, content } = await frame.evaluate(() => ({
      posted: (window as unknown as { __posts: Post[] }).__posts.at(-1)?.msg.height,
      content: Math.ceil(document.getElementById('content')!.getBoundingClientRect().height),
    }));
    const iframe = await page.locator('iframe').evaluate((f) => (f as HTMLIFrameElement).style.height);
    last = { posted, content, iframe };
    if (posted === content && iframe === content + 'px') return last;
  }
  return last!;
}
test(
  'reportHeight: after any mix of transcript, case, step, viewport and scroll changes, the last posted height equals the content root\'s height, and every message is a new height the host accepts',
  options,
  async () => {
    const { resizeHeight } = await import('../app/embed-protocol.ts');
    await fc.assert(
      fc.asyncProperty(heightActions, async (actions) => {
        hostBody = `<!doctype html><style>body{margin:0}</style>${loader('a', 'oauth-pkce')}<div style="height:4000px"></div>`;
        const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 700, height: 800 } });
        try {
          await recordPosts(context);
          const page = await context.newPage();
          await page.goto(host);
          const frame = await readyFrame(page, 'oauth-pkce');
          for (const a of actions) {
            await heightAct(page, frame, a);
            // An offscreen cross-origin frame may not render, so it can only be held to this once visible.
            const visible = await page.locator('iframe').evaluate((f) => {
              const r = f.getBoundingClientRect();
              return r.bottom > 0 && r.top < innerHeight;
            });
            if (visible) {
              const h = await heightsSettle(page, frame);
              assert.deepEqual(h, { posted: h.content, content: h.content, iframe: h.content + 'px' }, `after ${JSON.stringify(a)}`);
            }
          }
          await heightAct(page, frame, { kind: 'back' });
          const h = await heightsSettle(page, frame);
          assert.deepEqual(h, { posted: h.content, content: h.content, iframe: h.content + 'px' }, 'back in view');
          const posts = await postsOf(frame),
            source = {} as MessageEventSource;
          for (const [i, p] of posts.entries()) {
            assert.equal(resizeHeight({ origin: host, source, data: p.msg }, host, source), p.msg.height, JSON.stringify(p));
            if (i) assert.notEqual(p.msg.height, posts[i - 1]!.msg.height, `posts ${i - 1} and ${i} repeat a height`);
          }
        } finally {
          await context.close();
        }
      }),
      params(10),
    );
  },
);

/**
 * parentOrigin values labelled by construction, not by the page's own check: exact origins (the
 * host's, others as URL gives them, an IPv6 one), near misses the docs reject, arbitrary text that
 * cannot be an HTTP(S) origin, and no parentOrigin at all.
 */
const parentOriginArb = (hostOrigin: string) =>
  fc.oneof(
    fc.oneof(fc.constant(hostOrigin), fc.webUrl().map((u) => new URL(u).origin), fc.constant('http://[::1]')).map((value) => ({ value, exact: true })),
    fc
      .oneof(
        fc.constantFrom(
          '*',
          'null',
          '',
          ' ',
          hostOrigin + '/',
          hostOrigin + '/path',
          hostOrigin + '?q',
          hostOrigin + '#h',
          ' ' + hostOrigin,
          hostOrigin + ' ',
          hostOrigin.toUpperCase(),
          hostOrigin.replace('http:', 'HTTP:'),
          hostOrigin.replace('http://', 'http://user:pw@'),
          'http://127.0.0.1:80',
          'https://example.com:443',
          'file://',
          'data:text/html,x',
          'javascript:alert(1)',
          'ws://127.0.0.1',
        ),
        fc.string({ unit: 'binary' }).filter((v) => !/^https?:/i.test(v)),
      )
      .map((value) => ({ value, exact: false })),
    fc.constant({ value: undefined, exact: false }),
  );
test(
  'framed with any parentOrigin: messages go to exactly that origin when it is an exact HTTP(S) origin and nowhere otherwise; the player\'s own "Open in a new tab" link shows only when no parentOrigin is set',
  options,
  async () => {
    await fc.assert(
      fc.asyncProperty(parentOriginArb(host), fc.boolean(), async ({ value, exact }, toggle) => {
        const src = `${embed}/oauth-pkce.html${value === undefined ? '' : '?' + new URLSearchParams({ parentOrigin: value })}`;
        hostBody = `<!doctype html><iframe title="t" src="${src.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" style="width:600px;height:640px;border:0"></iframe>`;
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        try {
          await recordPosts(context);
          const page = await context.newPage();
          await page.goto(host);
          const frame = await readyFrame(page, 'oauth-pkce');
          if (toggle) await frame.evaluate(() => document.querySelector<HTMLElement>('.transcript > summary')!.click());
          await page.waitForTimeout(100);
          const posts = await postsOf(frame);
          assert.deepEqual([...new Set(posts.map((p) => p.origin))], exact ? [value] : [], `parentOrigin ${JSON.stringify(value)}`);
          // The loader, which sets parentOrigin, puts its own link beside the frame.
          assert.equal(await frame.locator('a.standalone').count(), value === undefined ? 1 : 0, `parentOrigin ${JSON.stringify(value)}`);
        } finally {
          await context.close();
        }
      }),
      {
        ...params(16),
        // Always: the host itself, its nearest miss (a trailing slash), and no parentOrigin.
        examples: [
          [{ value: host, exact: true }, false],
          [{ value: host + '/', exact: false }, false],
          [{ value: undefined, exact: false }, false],
        ],
      },
    );
  },
);

// #21: readable labels are insufficient when a caption's evidence is in another view.
// Exercise the visible route to that evidence, rather than only asserting the zoom scale.
test('PKCE mobile views expose the derivation and the unsent verifier without advancing the step', options, async () => {
  const project = projects.get('oauth-pkce')!;
  for (const variant of project.variants) {
    const targets = new Map<string, number[][]>();
    await new variant.Scene({
      async frame() {},
      async stepEnd(scene, step) {
        if (!['secret', 'authorize'].includes(step.name)) return;
        const found: number[][] = [];
        const walk = (m: import('../src/index.ts').Mobject) => {
          const label = labelOf(m);
          // The unsent verifier is said in the authorize message's note ("verifier not sent").
          if (label && (step.name === 'secret' ? ['code_verifier', 'code_challenge'].includes(label.text) : label.text.includes('not sent'))) {
            const box = m.box();
            if (box) found.push(toView(box, scene.frame.box()!));
          }
          for (const child of m.children) walk(child);
        };
        for (const m of scene.mobjects) walk(m);
        targets.set(step.name, found);
      },
    }, { skipUntil: Infinity }).run();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: variant.values.attacker === 'yes' ? 'no-preference' : 'reduce' });
    try {
      const page = await context.newPage();
      await page.goto(`${embed}/oauth-pkce.html?attacker=${variant.values.attacker}`);
      await page.waitForSelector('[data-ready=true]');
      for (const step of ['secret', 'authorize']) {
        if (step === 'authorize') await page.getByRole('button', { name: 'Next step', exact: true }).click();
        await quiet(page);
        assert.equal(new URL(page.url()).searchParams.get('step'), step);
        assert.ok(await page.locator('.view-help').isVisible());
        assert.match(await page.locator('.view-help').innerText(), /Next below advances the step/);
        const size = await page.locator('.stage').evaluate((s) => ({ w: s.clientWidth, h: s.clientHeight }));
        const count = Number((await page.locator('.view-controls>span').innerText()).match(/of (\d+)/)![1]);
        assert.ok(count > 1);
        const evidence = targets.get(step)!;
        assert.ok(evidence.length > 0, `${step}: the fixture must contain the named evidence`);
        const seen = new Set<number>();
        for (let i = 0; i < count; i++) {
          assert.equal(await page.locator('.view-controls>span').innerText(), `View ${i + 1} of ${count}`);
          const zoom = await settledZoom(page);
          assert.ok(zoom, 'the view is zoomed');
          const visible = viewBox(zoom, size.w, size.h);
          for (const [j, box] of evidence.entries()) {
            // Include the full referenced label, not only its centre. The viewBox
            // serializer rounds by 0.001 SVG units (0.000001 scene units).
            const slack = 1e-6;
            if (box[0]! >= visible[0] - slack && box[2]! <= visible[2] + slack &&
                box[1]! >= visible[1] - slack && box[3]! <= visible[3] + slack) seen.add(j);
          }
          const control = page.getByRole('button', { name: 'Next view', exact: true });
          const rect = await control.boundingBox();
          assert.ok(rect && rect.height >= 44, 'touch target is at least 44 px tall');
          await control.focus();
          await page.keyboard.press('Enter');
          await settledZoom(page);
          assert.equal(new URL(page.url()).searchParams.get('step'), step, 'view navigation keeps the step');
        }
        assert.equal(seen.size, evidence.length, `${step}: every referenced label is reachable`);
      }
      await page.getByRole('button', { name: 'Whole picture', exact: true }).click();
      await settledZoom(page);
      assert.ok(await page.locator('.view-controls').isVisible());
      assert.ok(await page.getByRole('button', { name: 'Whole picture', exact: true }).isDisabled());
      assert.equal(zoomOf(await paintedView(page)), null);
    } finally { await context.close(); }
  }
});


test('the PKCE attack opens with the stolen-code, guessed-verifier and rejection arrows visible on a phone', options, async () => {
  const variant = projects.get('oauth-pkce')!.variants.find((v) => v.values.attacker === 'yes')!;
  const ids = ['message:S->X#0', 'message:X->S#0', 'message:S->X#1'];
  const boxes = await restingBox(variant.Scene, 'attack', (scene) => {
    const arrows = scene.familyMembers().filter((m) => ids.includes(m.key ?? ''));
    assert.equal(arrows.length, 3, 'all three narrative arrows must exist');
    return arrows;
  });
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    try {
      await page.goto(`${embed}/oauth-pkce.html?attacker=yes&step=attack`);
      await page.waitForSelector('[data-ready=true]');
      await quiet(page);
      const seen = await page.locator('.stage svg:not(.leaving)').evaluate((svg, b) => {
        const matrix = (svg as SVGSVGElement).getScreenCTM()!;
        const stage = svg.parentElement!.getBoundingClientRect();
        const a = new DOMPoint(b[0] * 1000, -b[3] * 1000).matrixTransform(matrix);
        const z = new DOMPoint(b[2] * 1000, -b[1] * 1000).matrixTransform(matrix);
        return { actual: [a.x, a.y, z.x, z.y], viewport: [stage.left, stage.top, stage.right, stage.bottom] };
      }, boxes);
      const [l, t, r, b] = seen.actual, [vl, vt, vr, vb] = seen.viewport;
      assert.ok(l! >= vl! - 1 && t! >= vt! - 1 && r! <= vr! + 1 && b! <= vb! + 1,
        `width ${width}: opening must contain the complete attack, not an unrelated card: ${JSON.stringify(seen)}`);
      assert.equal(await page.locator('[aria-current=step]').getAttribute('data-step'), 'attack');
    } finally { await page.close(); }
  }
});
