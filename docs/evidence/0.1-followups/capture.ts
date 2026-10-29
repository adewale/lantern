// Run against an archived base tree or the current checkout; use each tree's
// production collector, builder and HTTP header recipe, with the same browser.
import {parseArgs} from 'node:util';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {launch} from '../../../tools/lib/browser.ts';
const {values} = parseArgs({options: {source: {type: 'string'}, out: {type: 'string'}, ref: {type: 'string'}, face: {type: 'boolean'}}});
const source = resolve(values.source ?? '.'), out = resolve(values.out!);
const {collectProject} = await import(pathToFileURL(join(source, 'tools/lib/explain-project.ts')).href);
const {buildExplainer} = await import(pathToFileURL(join(source, 'tools/lib/explain-build.ts')).href);
const {serve} = await import(pathToFileURL(join(source, 'tools/lib/explain-serve.ts')).href);
await mkdir(out, {recursive: true});
const browser = await launch();
const server = await serve(out, 0, 'mr-cache.html');
const built = new Map();
const shots = [
  ['cache', 'mr-cache', 'step=request&request=hit', 390],
  ['bucket', 'token-bucket', 'step=trace&rate=2', 390],
  ['oauth', 'oauth-pkce', 'step=attack&attacker=yes', 320],
  ...(values.face ? [['font', 'font-metrics', 'step=cuts', 390]] : []),
];
const rows = [];
try {
  for (const [name, id, query, width] of shots) {
    if (!built.has(id)) {
      const project = await collectProject(join(source, 'scenes/explainers', id), {write: false});
      built.set(id, await buildExplainer(project, join(out, id + '.html')));
    }
    const context = await browser.newContext({viewport: {width, height: 960}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${server.url}/${id}.html?${query}`);
    await page.waitForSelector('[data-ready=true]');
    await page.locator('.leaving').waitFor({state: 'detached'});
    const png = await page.screenshot({path: join(out, name + '.png')});
    const html = built.get(id).html;
    rows.push({name, id, query, width, errors, pngSha256: createHash('sha256').update(png).digest('hex'), htmlSha256: createHash('sha256').update(html).digest('hex'), bytes: Buffer.byteLength(html), gzipBytes: gzipSync(html).byteLength, caption: await page.locator('.caption').innerText(), tour: await page.locator('.view-controls>span').textContent(), viewHelpVisible: await page.locator('.view-help').isVisible()});
    await context.close();
  }
  await writeFile(join(out, 'capture.json'), JSON.stringify({sourceRef: values.ref, browser: browser.version(), rows}, null, 2) + '\n');
} finally {await browser.close(); server.close();}
