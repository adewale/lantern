// A lettered page in Chromium, served with its header recipe: the player puts the requested
// faces in place before it draws, so the live stage draws the same Greek outlines as the
// poster the build drew in Node. Without them its Greek would be the faces' empty glyph.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { launch } from '../tools/lib/browser.ts';
import { collectProject, defaultVariant, ROOT } from '../tools/lib/explain-project.ts';
import type { Project } from '../tools/lib/explain-project.ts';
import { SnapshotSink, renderAt, renderElements } from '../src/index.ts';
import { restingTime } from '../explain/trace.ts';
import { buildExplainer } from '../tools/lib/explain-build.ts';
import { serve } from '../tools/lib/explain-serve.ts';

const enabled = !!process.env.EXPLAIN_BROWSER,
  options = { skip: enabled ? false : 'set EXPLAIN_BROWSER=1 for the lettered page in Chromium' };
let browser: Browser, folder: string, server: { url: string; close(): void }, project: Project;
before(async () => {
  if (!enabled) return;
  folder = await mkdtemp(join(tmpdir(), 'rayner-lettering-browser-'));
  project = await collectProject(join(ROOT, 'test/fixtures/lettering'), { write: false });
  await buildExplainer(project, join(folder, 'lettered.html'));
  server = await serve(folder, 0, 'lettered.html');
  browser = await launch();
});
after(async () => {
  if (!enabled) return;
  await browser?.close();
  server?.close();
  await rm(folder, { recursive: true, force: true });
});

test('the live stage of a lettered page draws the Greek outlines the build draws in Node', options, async () => {
  for (const word of ['logos', 'phos']) {
    // The first step's resting picture as the build draws it, with the lettering in place
    const v = defaultVariant(project, { word });
    const scene = await renderAt(v.Scene, restingTime(v.trace.steps[0]!, v.trace.fps), new SnapshotSink());
    // As the player's DomSink draws it: absolute path data, a line of text one path
    const expected = renderElements(scene, { relative: false })
      .filter((r) => r.tag === 'path')
      .map((r) => String(r.attrs.d))
      .sort();
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('console', (m) => void (m.type() === 'error' && errors.push(m.text())));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${server.url}/lettered.html?word=${word}`);
    await page.waitForSelector('[data-ready=true]');
    const live = () => page.locator('.stage').evaluate((s) => [...s.querySelectorAll('path')].map((p) => p.getAttribute('d')!).sort());
    await page.waitForFunction(
      (n) => document.querySelectorAll('.stage path').length === n,
      expected.length,
    );
    assert.ok(expected.length > 4, `${word}: the picture has the card and its words`);
    assert.deepEqual(await live(), expected, `${word}: the live stage draws what Node drew`);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
