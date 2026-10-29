// Render the same checked-in scene inputs through each revision's production
// collector, HTML builder and server. See README.md for the archived-base overlay.
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {launch} from '../../../tools/lib/browser.ts';

const {values} = parseArgs({options: {
  source: {type: 'string'}, out: {type: 'string'}, ref: {type: 'string'},
  'unsupported-direction': {type: 'boolean'},
}});
assert.match(values.ref ?? '', /^[a-f0-9]{40}$/, '--ref must name the immutable production revision');
assert.ok(values.source && values.out, '--source and --out are required');
const source = resolve(values.source), out = resolve(values.out);
const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const {collectProject} = await import(pathToFileURL(join(source, 'tools/lib/explain-project.ts')).href);
const {buildExplainer} = await import(pathToFileURL(join(source, 'tools/lib/explain-build.ts')).href);
const {serve} = await import(pathToFileURL(join(source, 'tools/lib/explain-serve.ts')).href);
await mkdir(out, {recursive: true});
const browser = await launch(), server = await serve(out, 0, 'font-metrics.html');
const rows = [];
try {
  for (const [id, step] of [['font-metrics', 'diagram'], ['layout-direction', 'updates']]) {
    const file = join(source, 'scenes/explainers', id!, 'scene.ts');
    const inputSha256 = sha256(await readFile(file));
    let built;
    try {
      built = await buildExplainer(await collectProject(file, {write: false}), join(out, id + '.html'));
    } catch (error) {
      if (!values['unsupported-direction'] || id !== 'layout-direction') throw error;
      // Preserve the actual refusal; an unsupported surface has no before image.
      const message = String(error);
      assert.match(message, /undefined|region|start|end/i);
      await writeFile(join(out, id + '.txt'), message + '\n');
      rows.push({id, step, inputSha256, unsupported: message});
      continue;
    }
    for (const width of [390, 1180]) {
      const context = await browser.newContext({viewport: {width, height: 960}, reducedMotion: 'reduce'});
      const page = await context.newPage(), errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${server.url}/${id}.html?step=${step}`);
      await page.waitForSelector('[data-ready=true]');
      await page.locator('.leaving').waitFor({state: 'detached'});
      const png = await page.screenshot({path: join(out, `${id}-${width}.png`)});
      assert.deepEqual(errors, []);
      rows.push({id, step, width, inputSha256, htmlSha256: sha256(built.html), pngSha256: sha256(png), caption: await page.locator('.caption').innerText()});
      await context.close();
    }
  }
  const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  await writeFile(join(out, 'capture.json'), JSON.stringify({sourceRef: values.ref, agenticMermaid: pkg.dependencies['agentic-mermaid'], browser: browser.version(), rows}, null, 2) + '\n');
} finally {await browser.close(); server.close();}
