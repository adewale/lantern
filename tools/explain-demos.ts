#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { SnapshotSink, renderAt } from '../src/index.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { collectProject, defaultVariant, ROOT, htmlEscape, hash } from './lib/explain-project.ts';
import { buildExplainer, buildLoader } from './lib/explain-build.ts';
import { contactSheet } from './lib/explain-shots.ts';
import { checkProject } from './lib/explain-check.ts';

const directory = join(ROOT, 'out/explainers');
await mkdir(directory, { recursive: true });
const check = process.argv.includes('--check'),
  render = process.argv.includes('--render'),
  force = process.argv.includes('--force');
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
  const query = 'query' in item ? new URLSearchParams(item.query) : new URLSearchParams();
  const variant =
      project.variants.find((v) => [...query].every(([k, value]) => v.values[k] === value)) ??
      defaultVariant(project),
    step = variant.trace.steps.find((s) => s.step === item.step) ?? variant.trace.steps[0]!;
  const sink = new SnapshotSink({ width: 960 });
  await renderAt(variant.Scene, Math.max(step.t0, (step.t1 ?? step.t0) - 1 / variant.trace.fps), sink);
  await writeFile(join(directory, item.id + '.png'), new Resvg(sink.svg,{font:{loadSystemFonts:false}}).render().asPng());
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
    snapshotHashes: Object.values(project.store).map((s) => hash(JSON.stringify(s))),
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
const cards = EXPLAINERS.map((item, i) => {
  const data = evidence.find((s) => s.id === item.id)!;
  const query = 'query' in item ? item.query : '';
  const href = `${item.id}.html?step=${item.step}${query ? '&' + query : ''}`;
  return `<article class="card${i < 4 ? ' featured' : ''}"><a href="${htmlEscape(href)}"><img src="${item.id}.png" width="960" height="540" loading="${i < 2 ? 'eager' : 'lazy'}" alt="${htmlEscape(data.title)} — a frame from the explanation"><div class="card-body"><span class="tag">${htmlEscape(item.tag)}</span><h2>${htmlEscape(data.title)}</h2><p>${htmlEscape(item.description)}</p><span class="open">Explore ${data.variants === 1 ? 'the explanation' : data.variants + ' cases'} ↗</span></div></a><div class="card-links"><a href="${item.id}.steps.png">Step contact sheet</a><a href="../videos/${item.id}.mp4">Captioned MP4</a><a href="${item.id}.html.receipt.json">Build receipt</a></div></article>`;
}).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lantern Explainers — one scene, every output</title><style>
:root{color-scheme:dark;--bg:#0c151c;--panel:#15232d;--fg:#e9f1f5;--muted:#a0b3bf;--line:#2b414d;--accent:#8ee0cb;font:16px/1.6 system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}main{max-width:1180px;margin:auto;padding:clamp(20px,4vw,56px)}.eyebrow,.tag{font-size:.73rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(2.5rem,7vw,5.2rem);line-height:1.04;letter-spacing:-.06em;max-width:900px;margin:22px 0}h1 em{font-style:normal;color:var(--accent)}.intro{font-size:1.18rem;color:var(--muted);max-width:690px}.stats{display:flex;gap:28px;flex-wrap:wrap;padding:24px 0;margin:26px 0;border-block:1px solid var(--line)}.stats strong{display:block;font-size:1.6rem;color:var(--fg)}.stats span{font-size:.8rem;color:var(--muted)}nav{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:34px}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel)}.card>a{display:block;color:inherit}.card>a:hover{text-decoration:none}.card:hover{border-color:var(--accent)}img{display:block;width:100%;height:auto;aspect-ratio:16/9}.card-body{padding:22px}h2{font-size:1.35rem;line-height:1.25;letter-spacing:-.025em;margin:10px 0}p{color:var(--muted)}.open{color:var(--accent);font-weight:600;font-size:.85rem}.card-links{display:flex;flex-wrap:wrap;gap:16px;padding:0 22px 20px;font-size:.75rem}footer{margin-top:48px;color:var(--muted);font-size:.85rem;border-top:1px solid var(--line);padding-top:20px}code{background:var(--panel);padding:3px 6px;border-radius:4px}:focus-visible{outline:3px solid var(--accent);outline-offset:4px}@media(max-width:700px){.grid{grid-template-columns:1fr}.stats{gap:18px}}
</style></head><body><main><span class="eyebrow">Lantern · native, inspectable explanations</span><h1>Explain once.<br><em>Let the reader lead.</em></h1><p class="intro">Write a native TypeScript scene. Publish reader-paced steps and meaningful alternative cases. Export the same scene as a silent, captioned film.</p><div class="stats"><span><strong>${totals.explainers}</strong>explanations</span><span><strong>${variants}</strong>complete cases</span><span><strong>${families.size}</strong>diagram families</span><span><strong>${styles.size}</strong>authored diagram styles</span></div><nav><a href="pap.html">Start with a protocol ↗</a><a href="embed-lab.html">See two real embeds ↗</a><a href="evidence.json">Inspect build evidence ↗</a></nav><section class="grid">${cards}</section><footer><p>Each page loads one explanation, not this whole catalogue. Scenes use embedded glyph outlines and build-time diagram snapshots; readers need no account, storage or runtime network access.</p><p>Built on Lantern by Ivar Vong (MIT), with Agentic Mermaid 0.4.1 at build time. Diagram lettering uses embedded Inter rather than style-specific fonts. The 2password example is an explicitly scoped offline fixture. No endorsement is implied.</p><p>Rebuild locally: <code>npm run demos:check</code> · <code>npm run demos:render</code></p></footer></main></body></html>`;
await writeFile(join(directory, 'index.html'), html);
await writeFile(
  join(directory, 'embed-lab.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Two independent Lantern embeds</title><style>body{font:16px/1.5 system-ui;max-width:1200px;margin:auto;padding:20px;background:#eef2f5;color:#17232d}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}section{min-width:0;background:white;border-radius:12px}a{color:#196469}@media(max-width:850px){main{grid-template-columns:1fr}}</style><h1>Two explanations. One host page.</h1><p>Open each transcript, change cases and move between steps. Each iframe sizes only itself. <a href="index.html">Back to the collection</a>.</p><main><section id="protocol"></section><section id="cache"></section></main><script src="loader.js" data-src="pap.html?step=sign-in" data-target="protocol" data-title="Personal Agent Protocol"></script><script src="loader.js" data-src="mr-cache.html?request=miss&step=request" data-target="cache" data-title="Cache request"></script></html>`,
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
        video.height !== 880 ||
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
