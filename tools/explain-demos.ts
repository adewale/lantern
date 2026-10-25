#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { SnapshotSink, renderAt } from '../src/index.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { collectProject, defaultVariant, ROOT, hash, baseReceipt } from './lib/explain-project.ts';
import { restingTime, htmlEscape } from '../explain/trace.ts';
import { buildExplainer, buildLoader } from './lib/explain-build.ts';
import { contactSheet } from './lib/explain-shots.ts';
import { rasterize } from './lib/explain-video.ts';
import { checkProject } from './lib/explain-check.ts';

const directory = join(ROOT, 'out/explainers');
await mkdir(directory, { recursive: true });
const { check, render, force } = parseArgs({
  options: { check: { type: 'boolean' }, render: { type: 'boolean' }, force: { type: 'boolean' } },
}).values;
const evidence: {
  id: string;
  title: string;
  variants: number;
  diagrams: number;
  styles: string[];
  families: string[];
  bytes: number;
  sourceHash: string;
  engineHash: string;
  snapshotHashes: string[];
  checks?: unknown;
}[] = [];
for (const item of EXPLAINERS) {
  const project = await collectProject(join(ROOT, 'scenes/explainers', item.id));
  const built = await buildExplainer(project, join(directory, item.id + '.html'));
  const query = new URLSearchParams(item.query ?? '');
  const variant =
      project.variants.find((v) => [...query].every(([k, value]) => v.values[k] === value)) ??
      defaultVariant(project),
    step = variant.trace.steps.find((s) => s.step === item.step) ?? variant.trace.steps[0]!;
  const sink = new SnapshotSink({ width: 960 });
  await renderAt(variant.Scene, restingTime(step, variant.trace.fps), sink);
  await writeFile(join(directory, item.id + '.png'), (await rasterize(sink.svg)).asPng());
  await contactSheet(project, join(directory, item.id + '.steps.png'));
  const checks = check ? await checkProject(project) : undefined;
  evidence.push({
    id: item.id,
    title: project.Scene.meta?.title ?? item.id,
    variants: project.variants.length,
    diagrams: Object.keys(project.store).length,
    styles: [...new Set(Object.values(project.store).map((s) => s.spec.style ?? 'default'))],
    families: [...new Set(Object.values(project.store).map((s) => s.family))],
    bytes: Buffer.byteLength(built.html),
    sourceHash: project.sourceHash,
    engineHash: project.engineHash,
    snapshotHashes: baseReceipt(project).snapshotHashes,
    ...(checks ? { checks } : {}),
  });
  console.log(
    `${item.id}: ${project.variants.length} cases · ${Object.keys(project.store).length} diagrams${check ? ' · checks passed' : ''}`,
  );
}
await buildLoader(join(directory, 'loader.js'));
const variants = evidence.reduce((n, s) => n + s.variants, 0),
  diagrams = evidence.reduce((n, s) => n + s.diagrams, 0),
  styles = new Set(evidence.flatMap((s) => s.styles)),
  families = new Set(evidence.flatMap((s) => s.families));
const totals = {
  explainers: evidence.length,
  variants,
  diagrams,
  styles: styles.size,
  families: families.size,
};
await writeFile(
  join(directory, 'evidence.json'),
  JSON.stringify({ version: 1, totals, scenes: evidence }, null, 2) + '\n',
);
const tile = (item: (typeof EXPLAINERS)[number], lead = false) => {
  const data = evidence.find((s) => s.id === item.id)!;
  const href = `${item.id}.html?step=${item.step}${item.query ? '&' + item.query : ''}`;
  return `<li${lead ? ' class="lead"' : ''}><a href="${htmlEscape(href)}"><img src="${item.id}.png" width="960" height="540" alt="" loading="${lead ? 'eager' : 'lazy'}"><span>${htmlEscape(data.title)}</span></a></li>`;
};
const topics = EXPLAINERS.filter((e) => e.group === 'topic'),
  toolchain = EXPLAINERS.filter((e) => e.group === 'toolchain');
// The embed's colour tokens, type and resets (everything before its body rule), so the gallery matches the pages.
const css = await readFile(join(ROOT, 'app/embed.css'), 'utf8'),
  tokens = css.slice(0, css.indexOf('\nbody{'));
// Experience surface: the pictures lead, each tile is a picture and the claim it makes.
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lantern Explainers</title><style>
${tokens}
:root{--outline:rgb(0 0 0/.1)}
@media(prefers-color-scheme:dark){:root{--outline:rgb(255 255 255/.1)}}
body{margin:0;background:var(--bg);color:var(--fg)}
main{max-width:1180px;margin:0 auto;padding:40px 16px 64px}
h1{font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.15;letter-spacing:-.02em;font-weight:650;margin:0 0 32px;text-wrap:balance}
h2{font-size:1.125rem;font-weight:650;margin:64px 0 16px;padding-top:24px;border-top:1px solid var(--line)}
ul.tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:32px 24px}
ul.tiles .lead{grid-column:1/-1}
@media(min-width:760px){ul.tiles .lead{grid-column:span 2;grid-row:span 2}}
.tiles a{display:block;color:inherit;text-decoration:none;border-radius:12px}
.tiles img{display:block;width:100%;height:auto;aspect-ratio:16/9;border-radius:10px;outline:1px solid var(--outline);outline-offset:-1px;transition:transform 200ms cubic-bezier(.23,1,.32,1)}
.tiles span{display:block;margin-top:12px;font-weight:600;line-height:1.35;text-wrap:balance}
.tiles .lead span{font-size:1.25rem}
.tiles a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
@media(hover:hover) and (pointer:fine){.tiles a:hover img{transform:scale(1.01)}.tiles a:hover span{color:var(--accent)}}
.more{display:flex;flex-wrap:wrap;gap:8px 24px;margin:24px 0 0;padding:0;list-style:none}
.more a{color:var(--accent);text-underline-offset:.2em}
footer{margin-top:64px;font-size:.875rem;color:var(--muted)}
footer a{color:inherit}
@media(prefers-reduced-motion:reduce){.tiles img{transition:none}}
</style></head><body><main><h1>Lantern Explainers</h1><ul class="tiles">${topics.map((t, i) => tile(t, i === 0)).join('')}</ul><h2>How these are made</h2><ul class="tiles">${toolchain.map((t) => tile(t)).join('')}</ul><ul class="more"><li><a href="embed-lab.html">Two embeds on one host page</a></li><li><a href="evidence.json">Build evidence</a></li></ul><footer>Built on <a href="https://github.com/ivarvong/lantern">Lantern</a> by Ivar Vong (MIT) and <a href="https://github.com/adewale/agentic-mermaid">Agentic Mermaid</a>.</footer></main></body></html>`;
await writeFile(join(directory, 'index.html'), html);
await writeFile(
  join(directory, 'embed-lab.html'),
  `<!doctype html><html lang="en" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Two embeds on one host page</title><style>${tokens}body{max-width:1200px;margin:0 auto;padding:32px 16px 64px;background:#eceff3;color:var(--fg)}h1{font-size:1.5rem;font-weight:650;letter-spacing:-.015em;margin:0 0 8px;text-wrap:balance}a{color:var(--accent);text-underline-offset:.2em}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;align-items:start}section{min-width:0;background:#fff;border-radius:12px;box-shadow:0 1px 2px rgb(0 0 0/.06),0 0 0 1px rgb(0 0 0/.06);overflow:hidden}@media(max-width:850px){main{grid-template-columns:1fr}}</style><h1>Two embeds, each sized to its own content</h1><a href="index.html">All explainers</a><main><section id="protocol"></section><section id="cache"></section></main><script src="loader.js" data-src="pap.html?step=sign-in" data-target="protocol" data-title="Personal Agent Protocol"></script><script src="loader.js" data-src="mr-cache.html?request=miss&step=request" data-target="cache" data-title="Cache request"></script></html>`,
);
console.log(`Gallery: ${join(directory, 'index.html')}\n${JSON.stringify(totals)}`);

if (render) {
  const exporterHash = hash(await readFile(new URL('./lib/explain-video.ts', import.meta.url)));
  const queue = [...EXPLAINERS];
  let failed = false;
  async function worker() {
    while (queue.length) {
      const item = queue.shift()!,
        entry = evidence.find((s) => s.id === item.id)!,
        out = join(ROOT, 'out/videos', item.id + '.mp4');
      let fresh = false;
      if (!force) {
        try {
          const receipt = JSON.parse(await readFile(out + '.receipt.json', 'utf8'));
          fresh =
            receipt.sourceHash === entry.sourceHash &&
            receipt.exporterHash === exporterHash &&
            receipt.engineHash === entry.engineHash &&
            JSON.stringify(receipt.snapshotHashes) === JSON.stringify(entry.snapshotHashes) &&
            receipt.fps === 30 &&
            receipt.preset === 'caption-footer';
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      if (fresh) {
        console.log(`Video unchanged: ${item.id}`);
        continue;
      }
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            join(ROOT, 'tools/explain.ts'),
            'render',
            join(ROOT, 'scenes/explainers', item.id),
            '--footer',
            '--out',
            out,
          ],
          { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
        );
        let log = '';
        child.stdout.on('data', (c) => {
          log += c.toString();
        });
        child.stderr.on('data', (c) => {
          process.stderr.write(`[${item.id}] ${c}`);
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) console.error(log);
          resolve(code);
        });
      });
      if (code !== 0) {
        failed = true;
        continue;
      }
      const probe = JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_chapters', '-of', 'json', out], {
          encoding: 'utf8',
        }),
      );
      if (
        probe.streams.some((s: { codec_type: string }) => s.codec_type === 'audio') ||
        !probe.streams.some((s: { codec_name: string }) => s.codec_name === 'h264') ||
        !probe.streams.some((s: { codec_name: string }) => s.codec_name === 'mov_text')
      )
        throw new Error(`Invalid streams: ${item.id}`);
      const receipt = JSON.parse(await readFile(out + '.receipt.json', 'utf8'));
      const video = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
      if (
        video.width !== 1280 ||
        video.height !== 960 ||
        Number(video.nb_frames) !== receipt.frames ||
        probe.chapters.length !== receipt.chapters.length
      )
        throw new Error(`Video metadata mismatch: ${item.id}`);
      execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-f', 'null', '-'], { stdio: 'pipe' });
      console.log(`Video verified: ${item.id} · ${receipt.frames} frames`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (failed) throw new Error('One or more videos failed; see output above');
}
