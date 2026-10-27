// Screenshots of the oauth-pkce explainer at 390 × 844 (touch), built from the worktree in argv[2], into argv[3] with prefix argv[4].
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [root, out, tag] = process.argv.slice(2) as [string, string, string];
process.chdir(root);
const { collectProject } = await import(join(root, 'tools/lib/explain-project.ts'));
const { buildExplainer } = await import(join(root, 'tools/lib/explain-build.ts'));
const { serve } = await import(join(root, 'tools/lib/explain-serve.ts'));
const { launch } = await import(join(root, 'tools/lib/browser.ts'));
const folder = await mkdtemp(join(tmpdir(), 'pkce-shots-'));
await buildExplainer(await collectProject('scenes/explainers/oauth-pkce', { write: false }), join(folder, 'oauth-pkce.html'));
const server = await serve(folder, 0, 'oauth-pkce.html');
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const still = async () => {
  // Rested: the replay control is back and two reads of the view agree.
  await page.waitForSelector('button[aria-label="Replay step"]');
  for (let last = ''; ; ) {
    await page.waitForTimeout(400);
    const now = await page.locator('.stage svg:not(.leaving)').getAttribute('viewBox');
    if (now === last) break;
    last = now!;
  }
};
const nextView = page.getByRole('button', { name: 'Next view', exact: true });
const press = async () => {
  await nextView.click();
  await page.waitForTimeout(800);
};
const describe = async (name: string) => {
  const info = {
    name,
    step: new URL(page.url()).searchParams.get('step'),
    view: await page.locator('.view-controls>span').innerText(),
    viewBox: await page.locator('.stage svg:not(.leaving)').getAttribute('viewBox'),
  };
  await page.screenshot({ path: join(out, `${tag}-${name}.png`) });
  console.log(JSON.stringify(info));
};
await page.goto(`${server.url}/oauth-pkce.html`);
await page.waitForSelector('[data-ready=true]');
await still();
await describe('secret');
await press();
await describe('secret-2');
await page.goto(`${server.url}/oauth-pkce.html`);
await page.waitForSelector('[data-ready=true]');
await still();
await page.locator('button[aria-label="Next step"]').click();
await page.waitForURL(/step=authorize/);
await still();
await describe('authorize');
await press();
await describe('authorize-2');
await browser.close();
server.close();
