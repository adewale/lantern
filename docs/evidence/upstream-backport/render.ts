// Run from the Rayner checkout: node docs/evidence/upstream-backport/render.ts <source-checkout> <output-directory>
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const source = resolve(process.argv[2]!), out = resolve(process.argv[3]!);
const moduleAt = (name: string) => pathToFileURL(join(source, name)).href;
const { Scene, NullSink, Rectangle, Group, Text, loadFonts, toSvgString } = await import(moduleAt('src/index.ts'));
const { collectProject } = await import(moduleAt('tools/lib/explain-project.ts'));
const { buildExplainer } = await import(moduleAt('tools/lib/explain-build.ts'));
const { launch } = await import(moduleAt('tools/lib/browser.ts'));
const { serve } = await import(moduleAt('tools/lib/explain-serve.ts'));
await mkdir(out, { recursive: true });
await loadFonts();
const scene = new Scene(new NullSink());
scene.frame.scale(0.23);
scene.add(new Group(new Rectangle({ width: 2.4, height: 1.2, stroke: '#333333', fill: '#eeeeee' }), new Text('Label', { fontSize: 0.4, color: '#111111' })));
const svg = toSvgString(scene, { width: 640, background: '#ffffff' });
await writeFile(join(out, 'text-origin.svg'), svg);
await writeFile(join(out, 'text-origin.png'), new Resvg(svg).render().asPng());
const project = await collectProject(join(source, 'scenes/explainers/seasons'), { write: false });
await buildExplainer(project, join(out, 'seasons.html'));
const server = await serve(out, 0, 'seasons.html'), browser = await launch();
try {
  for (const step of ['year', 'distance']) {
    const page = await browser.newPage({ viewport: { width: 1180, height: 980 }, reducedMotion: 'reduce' });
    await page.goto(`${server.url}/seasons.html?place=tromso&step=${step}`);
    await page.waitForSelector('[data-ready=true]');
    await page.locator('.leaving').waitFor({ state: 'detached' });
    await page.screenshot({ path: join(out, `seasons-${step}.png`), fullPage: true });
    await page.close();
  }
} finally { await browser.close(); server.close(); }
