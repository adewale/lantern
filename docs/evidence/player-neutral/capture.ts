// Reuses Rayner's build, CSP server and Chromium launcher; no alternate rendering path.
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { launch } from '../../../tools/lib/browser.ts';
import { serve } from '../../../tools/lib/explain-serve.ts';

const args = process.argv.slice(2);
const option = (key: string) => args[args.indexOf(key) + 1];
if (!args.includes('--base') || !args.includes('--head')) throw new Error('Pass --base <worktree> --head <worktree> [--out <directory>]');
const roots = { before: resolve(option('--base')), after: resolve(option('--head')) };
const out = resolve(args.includes('--out') ? option('--out') : 'docs/evidence/player-neutral');
await mkdir(out, { recursive: true });
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const folder = await mkdtemp(join(tmpdir(), 'rayner-player-evidence-'));
const browser = await launch();
const receipt: Record<string, unknown> = {
  generator: 'docs/evidence/player-neutral/capture.ts',
  browser: browser.version(), platform: process.platform, node: process.version,
  viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce',
  fixture: 'scenes/explainers/mr-cache/scene.ts',
  forcedColourActions: ['open request=hit&step=diff', 'select request=miss', 'focus stage', 'capture after loading and transitions settle'],
  revisions: {}, captures: [],
};
const captures: { file: string; sha256: string; revision: string; theme: string; forcedColors: string; request: string }[] = [];
try {
  for (const [revision, root] of Object.entries(roots)) {
    const sha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    (receipt.revisions as Record<string, unknown>)[revision] = {
      sha, fixtureSha256: hash(await readFile(join(root, 'scenes/explainers/mr-cache/scene.ts'))),
    };
    const { collectProject } = await import(pathToFileURL(join(root, 'tools/lib/explain-project.ts')).href);
    const { buildExplainer } = await import(pathToFileURL(join(root, 'tools/lib/explain-build.ts')).href);
    const built = join(folder, revision);
    await mkdir(built, { recursive: true });
    await buildExplainer(await collectProject(join(root, 'scenes/explainers/mr-cache'), { write: false }), join(built, 'mr-cache.html'));
    // Palette/casing fixture from the served test, with explicit stage text ink for readable captures.
    const fixture = `import {Scene,Text} from '${root}/src/index.ts';
import {stage,settingsOf} from '${root}/explain/index.ts';
export default class Demo extends Scene {
static meta={title:'Arc<T>',player:{accent:true,paper:true,corners:'square',minStageWidth:880}};
static settings=[{id:'mode',label:'isdigit()',default:'a',options:[{value:'a',label:'-m'},{value:'b',label:'-M'}]}];
async construct(){stage(this,{palette:settingsOf(this).mode==='a' ? {paper:'#fff7ed',ink:'#202020',muted:'#595959',accent:'#9a3412'} : {paper:'#888888',ink:'#202020',muted:'#595959',accent:'#777777'}});this.add(new Text('Hello',{color:'#202020'}));for(const name of ['first','middle','last']){await this.step(name,{title:name,caption:'Hello'});await this.wait(.1)}}}`;
    (receipt.revisions as Record<string, Record<string, unknown>>)[revision]!.cueFixtureSha256 = hash(fixture.replaceAll(root, '<ROOT>'));
    await writeFile(join(built, 'fixture.ts'), fixture);
    await buildExplainer(await collectProject(join(built, 'fixture.ts'), { write: false }), join(built, 'cued.html'));
    const server = await serve(built, 0, 'mr-cache.html');
    try {
      for (const theme of ['light', 'dark'] as const) {
        for (const state of ['normal', 'forced', 'cued'] as const) {
          const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: theme, reducedMotion: 'reduce', forcedColors: state === 'forced' ? 'active' : 'none' });
          try {
            await page.goto(`${server.url}/${state === 'cued' ? 'cued.html?step=middle' : 'mr-cache.html?request=hit&step=diff'}&theme=${theme}`);
            await page.waitForSelector('[data-ready=true]');
            if (state === 'forced') {
              await page.locator('input[value=miss]').check();
              await page.waitForFunction(() => !document.querySelector('#content.loading'));
            }
            await page.locator('.stage').evaluate(e => { (e as HTMLElement).tabIndex = -1; (e as HTMLElement).focus(); });
            await page.waitForTimeout(350);
            const file = `${revision}-${state}-${theme}.png`;
            await page.locator('.tile').screenshot({ path: join(out, file), animations: 'disabled' });
            captures.push({ file, sha256: hash(await readFile(join(out, file))), revision: sha, theme, forcedColors: state === 'forced' ? 'active' : 'none', request: state === 'forced' ? 'miss' : state === 'normal' ? 'hit' : 'mode=a' });
            if (state === 'forced') for (const [part, selector] of [['case', '.case'], ['bar', '.stepper'], ['steps', '.rail .steps']] as const) {
              const detail = `${revision}-forced-${theme}-${part}.png`;
              await page.locator(selector).screenshot({ path: join(out, detail), animations: 'disabled' });
              captures.push({ file: detail, sha256: hash(await readFile(join(out, detail))), revision: sha, theme, forcedColors: 'active', request: 'miss' });
            }
          } finally { await page.close(); }
        }
      }
    } finally { server.close(); }
  }
  // A contact sheet presents unaltered browser captures with captions; originals remain alongside it.
  for (const [state, title, cue] of [
    ['normal', 'Neutral chrome', 'Compare Next, the step bar and the page around the drawing.'],
    ['forced', 'Forced colours after a case change and focus moved to the stage', 'Inspect Cache miss, step 2 in the list, and done/current/later segments.'],
    ['cued', 'Explicit palette cues on the same fixture', 'Light: warm paper, brown Next and square corners. Dark: rejected colours fall back to neutral.'],
  ] as const) {
    const images = await Promise.all(['light', 'dark'].map(async theme => {
      const cells = await Promise.all(['before', 'after'].map(async revision => {
        const filename = `${revision}-${state}-${theme}.png`;
        const content = state === 'forced' ? (await Promise.all(['case', 'bar', 'steps'].map(async part => `<div class="detail"><p>${part === 'case' ? 'Selected case' : part === 'bar' ? 'Step bar' : 'Steps list'}</p><img class="${part}" alt="${revision} ${theme} ${part}" src="data:image/png;base64,${(await readFile(join(out, `${revision}-forced-${theme}-${part}.png`))).toString('base64')}"></div>`))).join('') : `<img alt="${revision} ${state} ${theme}" src="data:image/png;base64,${(await readFile(join(out, filename))).toString('base64')}">`;
        return `<figure><figcaption>${revision === 'before' ? 'Base' : 'Fixed'} · ${theme}</figcaption>${content}</figure>`;
      }));
      return cells.join('');
    }));
    const board = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    try {
      await board.setContent(`<html><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#e8e8e8;color:#202020;font:18px/1.4 system-ui}h1{font-size:26px;margin:0 0 8px}p{margin:0 0 18px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;min-width:0}figcaption{font-weight:600;margin-bottom:8px}img{display:block;width:100%;height:auto}.detail{padding:12px;background:#fff;margin-bottom:10px}.detail p{font-size:15px;margin:0 0 8px}.detail img.case,.detail img.steps{width:auto;max-width:100%}</style><h1>${title}</h1><p>${cue}</p><main>${images.join('')}</main></html>`);
      await board.evaluate(async () => { await Promise.all([...document.images].map(i => i.decode())); });
      const file = `${state}-comparison.png`;
      await board.screenshot({ path: join(out, file), fullPage: true });
      (receipt as Record<string, unknown>)[`${state}ContactSheet`] = { file, sha256: hash(await readFile(join(out, file))) };
    } finally { await board.close(); }
  }
  receipt.captures = captures;
  receipt.limitation = 'Chromium on Linux at one desktop viewport. Forced colours are emulated; these images do not establish native Windows high-contrast or every phone layout.';
  await writeFile(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
} finally { await browser.close(); await rm(folder, { recursive: true, force: true }); }
