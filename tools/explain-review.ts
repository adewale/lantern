// Review the built collection as served, not just its source. Run demos:build (or demos:check) first;
// if demos:render has made videos, their byte ranges are checked too.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { launch } from './lib/browser.ts';
import { collectProject, defaultVariant, ROOT } from './lib/explain-project.ts';
import { serve } from './lib/explain-serve.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';

const server = await serve(join(ROOT, 'out'), 0, 'explainers/'),
  base = server.url;
let browser: Browser | undefined;
try {
  browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 980 } });
  const errors: string[] = [],
    connections: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (new URL(url).origin === base) return route.continue();
    connections.push(url);
    return route.abort();
  });
  const review = join(ROOT, 'out/review');
  await mkdir(review, { recursive: true });
  await page.goto(base + '/explainers/');
  await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map((image) => image.decode()));
  });
  await page.screenshot({ path: join(review, 'gallery.png'), fullPage: true, animations: 'disabled' });
  const cases = [];
  for (const entry of EXPLAINERS) {
    const project = await collectProject(join(ROOT, 'scenes/explainers', entry.id), { write: false }),
      defaults = defaultVariant(project);
    for (const variant of project.variants) {
      // The gallery tile's step, or the first, as the player falls back.
      const step = variant.trace.steps.find((s) => s.step === entry.step) ?? variant.trace.steps[0]!;
      const query = new URLSearchParams({ ...variant.values, step: step.step });
      await page.goto(`${base}/explainers/${entry.id}.html?${query}`);
      await page.waitForSelector('[data-ready=true]').catch((error: Error) => {
        throw new Error(`${entry.id}?${query} never became ready (${errors.join('; ') || 'no page errors'})`, {
          cause: error,
        });
      });
      assert.equal(await page.locator('[aria-current=step]').getAttribute('data-step'), step.step);
      assert.equal(await page.locator('.caption').innerText(), String(step.meta?.caption ?? ''));
      assert.ok((await page.locator('.stage path').count()) > 0, entry.id + ' has no stage artwork');
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 1180, height: 980 },
      ]) {
        await page.setViewportSize(viewport);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          entry.id + ' overflows',
        );
        if (variant === defaults)
          await page.screenshot({
            path: join(review, entry.id + (viewport.width === 390 ? '.mobile.png' : '.desktop.png')),
            fullPage: true,
            animations: 'disabled',
          });
      }
      cases.push({ scene: entry.id, settings: variant.values, step: step.step });
    }
  }
  const headers = await fetch(base + '/explainers/exgit.html', { method: 'HEAD' });
  assert.match(headers.headers.get('content-security-policy') ?? '', /connect-src 'none'/);
  assert.equal(headers.headers.get('x-frame-options'), null);
  // Videos are made apart from the pages (npm run videos); check their delivery when there are any.
  const video = await fetch(base + '/videos/exgit.mp4', { method: 'HEAD' });
  const videos = video.status === 200;
  if (videos) {
    const range = await fetch(base + '/videos/exgit.mp4', { headers: { range: 'bytes=0-31' } });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 32);
  }
  await page.goto(base + '/explainers/embed-lab.html');
  await page.waitForFunction(() => document.querySelectorAll('iframe').length === 2);
  for (const frame of page.frames().filter((frame) => frame !== page.mainFrame()))
    await frame.waitForSelector('[data-ready=true]');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('iframe')].every((frame) => {
      const root = frame.contentDocument?.querySelector('#content');
      return root && Math.abs(frame.clientHeight - Math.ceil(root.getBoundingClientRect().height)) <= 1;
    }),
  );
  await page.screenshot({ path: join(review, 'embed-lab.png'), fullPage: true, animations: 'disabled' });
  await mkdir(join(ROOT, 'out/validation'), { recursive: true });
  await writeFile(
    join(ROOT, 'out/validation/browser-review.json'),
    JSON.stringify(
      {
        cases: cases.length,
        results: cases,
        consoleErrors: errors,
        runtimeConnections: connections,
      },
      null,
      2,
    ) + '\n',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(connections, []);
  console.log(
    `${cases.length} served cases passed desktop/mobile, caption, artwork, no-error and no-external-connection checks. Response headers${videos ? ', video byte ranges' : ''} and the two-embed host page passed${videos ? '' : '; no videos were built, so their delivery was not checked'}. Screenshots: ${review}`,
  );
} finally {
  await browser?.close();
  server.close();
}
