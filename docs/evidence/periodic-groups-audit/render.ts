// Run from any checkout. The first argument selects the production source to render.
// node docs/evidence/periodic-groups-audit/render.ts <checkout> <output-dir> <label> [main|bugs]
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const [checkout, destination, label, selection] = process.argv.slice(2);
if (!checkout || !destination || !label) throw new Error('Expected checkout, output directory and revision label');
const root = resolve(checkout), output = resolve(destination);
const source = (file: string) => import(pathToFileURL(join(root, file)).href);
const {collectProject} = await source('tools/lib/explain-project.ts');
const {buildExplainer} = await source('tools/lib/explain-build.ts');
const {serve} = await source('tools/lib/explain-serve.ts');
const {launch} = await source('tools/lib/browser.ts');
const inputs = [
  {id: 'mr-cache', query: '?step=after&request=hit', name: 'player', width: 1280, height: 800},
  {id: 'mr-cache', query: '?step=after&request=hit', name: 'forced-colors', width: 1280, height: 800, forcedColors: 'active'},
  {id: 'ext4-space', query: '', name: 'command-casing', width: 1280, height: 800},
  {id: 'periodic-groups', query: '?element=na&step=blocks', name: 'blocks', width: 1280, height: 800},
  {id: 'periodic-groups', query: '?element=cl&step=count', name: 'phone-count', width: 390, height: 844},
  {id: 'periodic-groups', query: '?element=fe&step=family&theme=dark', name: 'dark-family', width: 1280, height: 800},
].filter(input => selection === 'main' ? input.name === 'player' : selection !== 'bugs' || ['forced-colors', 'command-casing'].includes(input.name));
const pages = await mkdtemp(join(tmpdir(), 'rayner-periodic-evidence-'));
await mkdir(output, {recursive: true});
let browser: any, server: any;
const images: unknown[] = [];
try {
  for (const id of new Set(inputs.map(input => input.id))) {
    const project = await collectProject(join(root, 'scenes/explainers', id), {write: false});
    await buildExplainer(project, join(pages, `${id}.html`));
  }
  server = await serve(pages, 0, 'mr-cache.html');
  browser = await launch();
  for (const input of inputs) {
    const page = await browser.newPage({viewport: {width: input.width, height: input.height}, reducedMotion: 'reduce', forcedColors: input.forcedColors ?? 'none'});
    const errors: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(String(error)));
    page.on('console', (message: any) => {if (message.type() === 'error') errors.push(message.text());});
    await page.goto(`${server.url}/${input.id}.html${input.query}`);
    await page.waitForSelector('[data-ready=true]');
    await page.waitForFunction(() => !document.querySelector('#content.loading') && !document.querySelector('svg.leaving'));
    await page.evaluate(() => document.fonts.ready);
    const file = `${label}-${input.name}.png`;
    const image = await page.screenshot({path: join(output, file)});
    const observed = await page.evaluate(() => ({
      title: document.querySelector('h1')?.textContent,
      titleCase: document.querySelector('h1') && getComputedStyle(document.querySelector('h1')!).textTransform,
      cases: [...document.querySelectorAll('.segments label')].map(label => ({
        text: label.textContent, checked: label.querySelector('input')?.checked,
        transform: getComputedStyle(label).textTransform,
        color: getComputedStyle(label).color, background: getComputedStyle(label).backgroundColor,
        weight: getComputedStyle(label).fontWeight,
      })),
      next: document.querySelector('button[aria-label="Next step"]')?.getBoundingClientRect().toJSON(),
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (errors.length) throw new Error(`${input.name}: ${errors.join('; ')}`);
    images.push({...input, file, sha256: createHash('sha256').update(image).digest('hex'), observed, errors});
    await page.close();
  }
  await writeFile(join(output, `${label}-receipt.json`), JSON.stringify({
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    sourceDiff: execFileSync('git', ['diff', '--stat', 'HEAD', '--', 'app', 'scenes', 'tools'], {cwd: root, encoding: 'utf8'}).trim(),
    renderer: 'buildExplainer + served response headers + Playwright Chromium',
    browser: browser.version(), reducedMotion: 'reduce', images,
  }, null, 2) + '\n');
} finally {
  await browser?.close(); server?.close(); await rm(pages, {recursive: true, force: true});
}
