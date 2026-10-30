#!/usr/bin/env node
// For every catalog explainer: the full page's bytes, a stills page's bytes, and the check
// report's density figures, as one JSON table (out/impact.json) and a Markdown table on stdout.
// Reads out/explainers/<id>.html.receipt.json and out/checks/<id>/report.json from a prior
// `npm run demos:check`; builds the stills pages itself.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { collectProject, ROOT } from './lib/explain-project.ts';
import { buildStills } from './lib/explain-stills.ts';

const rows = [];
for (const item of EXPLAINERS) {
  const receipt = JSON.parse(await readFile(join(ROOT, 'out/explainers', item.id + '.html.receipt.json'), 'utf8'));
  const report = JSON.parse(await readFile(join(ROOT, 'out/checks', item.id, 'report.json'), 'utf8'));
  const project = await collectProject(join(ROOT, 'scenes/explainers', item.id), { write: false });
  const stills = await buildStills(project, join(ROOT, 'out/stills', item.id + '.html'));
  const variants = report.variants as { density: { maxLabels: number; maxCaptionWords: number; maxCaptionNumerals: number; steps: Record<string, { labels: number; captionNumerals: number }> }; legibility: { minLabelPx390: number | null } }[];
  const max = (pick: (v: (typeof variants)[number]) => number) => Math.max(0, ...variants.map(pick));
  const densest = variants.flatMap((v) => Object.entries(v.density.steps)).sort((a, b) => b[1].labels - a[1].labels)[0];
  rows.push({
    id: item.id,
    cases: project.variants.length,
    sweeps: project.sweeps.length,
    steps: project.variants[0]!.trace.steps.length,
    pageBytes: receipt.bytes,
    pageGzip: receipt.gzipBytes,
    stillsBytes: stills.bytes,
    stillsGzip: stills.gzipBytes,
    stills: stills.stills,
    maxLabels: max((v) => v.density.maxLabels),
    densestStep: densest?.[0] ?? '',
    maxCaptionNumerals: max((v) => v.density.maxCaptionNumerals),
    maxCaptionWords: max((v) => v.density.maxCaptionWords),
    pivots: report.pivots ?? 0,
  });
  console.error(`${item.id}: page ${Math.round(receipt.gzipBytes / 1024)} KiB gz, stills ${Math.round(stills.gzipBytes / 1024)} KiB gz, up to ${rows.at(-1)!.maxLabels} labels at rest`);
}
await writeFile(join(ROOT, 'out/impact.json'), JSON.stringify(rows, null, 2) + '\n');
const k = (n: number) => Math.round(n / 1024);
console.log('| Explainer | Cases | Steps | Page KiB (gzip) | Stills KiB (gzip) | Most labels at rest (step) | Most numerals in a caption | Pivots |');
console.log('| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |');
for (const r of rows)
  console.log(`| \`${r.id}\` | ${r.cases}${r.sweeps !== r.cases ? ` (${r.sweeps} checked)` : ''} | ${r.steps} | ${k(r.pageBytes)} (${k(r.pageGzip)}) | ${k(r.stillsBytes)} (${k(r.stillsGzip)}) | ${r.maxLabels} (${r.densestStep}) | ${r.maxCaptionNumerals} | ${r.pivots} |`);
