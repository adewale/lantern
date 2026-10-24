// Review the built collection as served, not just its source. Run demos:render first.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { launch } from './lib/browser.ts';
import { collectProject, defaultVariant, ROOT } from './lib/explain-project.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';

const server = spawn(process.execPath, [join(ROOT, 'tools/explain-serve.ts')], {
  cwd: ROOT,
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let browser: Browser | undefined;
try {
  const base = await new Promise<string>((resolve, reject) => {
    let output = '',
      errors = '';
    const timer = setTimeout(() => reject(new Error(`Demo server did not become ready: ${errors}`)), 15000);
    timer.unref();
    server.stderr.on('data', (chunk) => {
      errors += chunk;
    });
    server.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    server.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Demo server exited ${code}: ${errors}`));
    });
  });
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
      const step =
        variant.trace.steps.find((s) => s.step === entry.step) ??
        variant.trace.steps[Math.floor(variant.trace.steps.length / 2)]!;
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
      cases.push({
        scene: entry.id,
        settings: variant.values,
        step: step.step,
        caption: true,
        paths: true,
        mobileOverflow: false,
      });
    }
  }
  const headers = await fetch(base + '/explainers/pap.html', { method: 'HEAD' });
  assert.match(headers.headers.get('content-security-policy') ?? '', /connect-src 'none'/);
  assert.equal(headers.headers.get('x-frame-options'), null);
  const range = await fetch(base + '/videos/pap.mp4', { headers: { range: 'bytes=0-31' } });
  assert.equal(range.status, 206, 'Run npm run demos:render before reviewing video delivery');
  assert.equal((await range.arrayBuffer()).byteLength, 32);
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
        headers: true,
        videoByteRanges: true,
      },
      null,
      2,
    ) + '\n',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(connections, []);
  console.log(
    `${cases.length} served cases passed desktop/mobile, caption, artwork, no-error and no-external-connection checks. Response headers, video byte ranges and the two-embed host page passed. Screenshots: ${review}`,
  );
} finally {
  await browser?.close();
  if (server.pid && server.exitCode === null && server.signalCode === null) {
    const closed = once(server, 'exit');
    server.kill('SIGTERM');
    await closed;
  }
}
