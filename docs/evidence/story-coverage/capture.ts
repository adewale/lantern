// Capture the served production page; pass its build directory and output PNG.
import assert from 'node:assert/strict';
import { launch } from '../../../tools/lib/browser.ts';
import { serve } from '../../../tools/lib/explain-serve.ts';
const [directory, output] = process.argv.slice(2);
assert.ok(directory && output, 'usage: node docs/evidence/story-coverage/capture.ts <build-directory> <output.png>');
const server = await serve(directory, 0, 'wcag-map.html');
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(server.url + '/wcag-map.html?level=AA&guideline=2.4&step=focus-visible');
  await page.waitForSelector('[data-ready=true]');
  await page.locator('.leaving').waitFor({ state: 'detached' });
  await page.screenshot({ path: output, fullPage: true });
} finally {
  await browser.close();
  server.close();
}
