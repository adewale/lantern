#!/usr/bin/env node
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { EXPLAINERS, PRODUCT } from '../scenes/explainers/catalog.ts';
import { collectProject, defaultVariant, ROOT, baseReceipt, sceneInputs } from './lib/explain-project.ts';
import { describeProject } from './lib/explain-site-describe.ts';
import { restingTime, htmlEscape, pictureSummary, stepWords } from '../explain/trace.ts';
import { buildExplainer, buildLoader } from './lib/explain-build.ts';
import { contactSheet, stillPng, cardPng } from './lib/explain-shots.ts';
import { checkProject } from './lib/explain-check.ts';
import { shareable } from './lib/explain-share.ts';
import { useProjectLettering } from './lib/explain-lettering.ts';
import { galleryTile } from './lib/explain-gallery.ts';
import { builtOutputHashes } from './lib/explain-built-files.ts';
import type { ShareManifest } from './lib/explain-share.ts';

const directory = join(ROOT, 'out/explainers');
await mkdir(directory, { recursive: true });
// An interrupted rebuild must not leave an old output pin vouching for changed bytes.
await rm(join(directory, 'output-hashes.json'), { force: true });
const { check } = parseArgs({
  options: { check: { type: 'boolean' } },
}).values;
// What the gallery and docs point at, with source and snapshot fingerprints.
const evidence: {
  id: string;
  title: string;
  lang: string;
  cases: Record<string, string>[];
  diagrams: number;
  styles: string[];
  families: string[];
  sourceHash: string;
  engineHash: string;
  snapshotHashes: string[];
}[] = [];
for (const item of EXPLAINERS) {
  // Remove the record of what this explainer's files were built from now and write it last (below),
  // so a build that stops part way leaves no record for site:export to trust.
  await rm(join(directory, item.id, 'inputs.json'), { force: true });
  const project = await collectProject(join(ROOT, 'scenes/explainers', item.id));
  // For agents: what site:export publishes as <id>.json, described right after the run, as
  // `rayner describe` does.
  const described = await describeProject(project);
  await buildExplainer(project, join(directory, item.id + '.html'));
  // The poster uses a representative step of the default case; tile links start at step one.
  const variant = defaultVariant(project),
    step = variant.trace.steps.find((s) => s.step === item.step) ?? variant.trace.steps[0]!;
  await writeFile(join(directory, item.id + '.png'), await stillPng(variant.Scene, restingTime(step, variant.trace.fps), 960));
  await contactSheet(project, join(directory, item.id + '.steps.png'));
  // Share pages (tools/lib/explain-share.ts): a picture and the words for every step of the default
  // case, so site:export can give each step a URL whose link preview is that step.
  await mkdir(join(directory, item.id), { recursive: true });
  const pictured = variant.trace.steps.filter((x) => shareable(x.step));
  const share: ShareManifest = {
    id: item.id,
    title: project.Scene.meta?.title ?? item.id,
    lang: project.Scene.meta?.lang ?? 'en',
    // The explainer's own page previews as its gallery tile's step.
    cover: (pictured.find((x) => x.step === step.step) ?? pictured[0])?.step ?? '',
    steps: [],
  };
  // The pictures draw with the project's lettering, as its page and contact sheet do.
  await useProjectLettering(project);
  for (const s of pictured) {
    await writeFile(join(directory, item.id, s.step + '.png'), await cardPng(variant.Scene, restingTime(s, variant.trace.fps)));
    share.steps.push({ step: s.step, title: stepWords(s).title, caption: stepWords(s).caption, picture: pictureSummary(s.after) });
  }
  await writeFile(join(directory, item.id, 'steps.json'), JSON.stringify(share, null, 2) + '\n');
  await writeFile(join(directory, item.id, 'describe.json'), described);
  if (check) await checkProject(project, join(ROOT, 'out/checks', item.id));
  // Last, after the checks, so it vouches for every file above: what they were built from, which
  // site:export compares with the checkout.
  await writeFile(join(directory, item.id, 'inputs.json'), JSON.stringify(await sceneInputs(project), null, 2) + '\n');
  evidence.push({
    id: item.id,
    title: project.Scene.meta?.title ?? item.id,
    lang: project.Scene.meta?.lang ?? 'en',
    cases: project.variants.map((v) => v.values),
    diagrams: Object.keys(project.store).length,
    styles: [...new Set(Object.values(project.store).map((s) => s.spec.style ?? 'default'))],
    families: [...new Set(Object.values(project.store).map((s) => s.family))],
    sourceHash: project.sourceHash,
    engineHash: project.engineHash,
    snapshotHashes: baseReceipt(project).snapshotHashes,
  });
  console.log(
    `${item.id}: ${project.variants.length} cases · ${Object.keys(project.store).length} diagrams${check ? ' · checks passed' : ''}`,
  );
}
await buildLoader(join(directory, 'loader.js'));
const cases = evidence.reduce((n, s) => n + s.cases.length, 0),
  diagrams = evidence.reduce((n, s) => n + s.diagrams, 0),
  styles = new Set(evidence.flatMap((s) => s.styles)),
  families = new Set(evidence.flatMap((s) => s.families));
const totals = {
  explainers: evidence.length,
  cases,
  diagrams,
  styles: styles.size,
  families: families.size,
};
await writeFile(
  join(directory, 'evidence.json'),
  // A failing check throws before this is written, so `checked` means every case passed.
  JSON.stringify({ version: 2, checked: !!check, totals, scenes: evidence }, null, 2) + '\n',
);
await writeFile(join(directory, 'catalog.json'), JSON.stringify({
  version: 1, product: PRODUCT, totals,
  scenes: EXPLAINERS.map(item => {
    const data = evidence.find(scene => scene.id === item.id)!;
    return { ...item, title: data.title, lang: data.lang, cases: data.cases.length };
  }),
}, null, 2) + '\n');
const tile = (item: (typeof EXPLAINERS)[number], lead = false) => {
  const data = evidence.find((s) => s.id === item.id)!;
  return galleryTile({ id: item.id, title: data.title, lang: data.lang }, lead);
};
const topics = EXPLAINERS.filter((e) => e.group === 'topic'),
  toolchain = EXPLAINERS.filter((e) => e.group === 'toolchain');
const entryUrl = `${PRODUCT.entry.id}.html?${new URLSearchParams({step: PRODUCT.entry.step, ...PRODUCT.entry.settings})}`;
// The embed's colour tokens, type and resets (everything before its body rule), so the gallery matches the pages.
const css = await readFile(join(ROOT, 'app/embed.css'), 'utf8'),
  tokens = css.slice(0, css.indexOf('\nbody{'));
// Experience surface: the pictures lead, each tile is a picture and the claim it makes.
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rayner</title><style>
${tokens}
:root{--outline:rgb(0 0 0/.1)}
@media(prefers-color-scheme:dark){:root{--outline:rgb(255 255 255/.1)}}
body{margin:0;background:var(--bg);color:var(--fg)}
main{max-width:1180px;margin:0 auto;padding:40px 16px 64px}
.intro{max-width:68ch;line-height:1.6;margin:0 0 16px}.intro a{color:var(--accent);text-underline-offset:.2em}h1{font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.15;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin:0 0 32px;padding-bottom:12px;border-bottom:4px solid var(--fg);text-wrap:balance}
.start a{color:var(--select);font-size:.8125rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-underline-offset:.35em}
h2{font-size:1.125rem;font-weight:650;margin:64px 0 16px;padding-top:24px;border-top:1px solid var(--line)}
ul.tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:32px 24px}
ul.tiles .lead{grid-column:1/-1}
@media(min-width:760px){ul.tiles .lead{grid-column:span 2;grid-row:span 2}}
.tiles a{display:block;color:inherit;text-decoration:none}
.tiles img{display:block;width:100%;height:auto;aspect-ratio:16/9;outline:1px solid var(--outline);outline-offset:-1px;transition:transform 200ms cubic-bezier(.23,1,.32,1)}
.tiles span{display:block;margin-top:12px;font-weight:600;line-height:1.35;text-wrap:balance}
.tiles .lead span{font-size:1.25rem}
.tiles a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
@media(hover:hover) and (pointer:fine){.tiles a:hover img{transform:scale(1.01)}.tiles a:hover span{color:var(--accent)}}
.more{display:flex;flex-wrap:wrap;gap:8px 24px;margin:24px 0 0;padding:0;list-style:none}
.more a{color:var(--accent);text-underline-offset:.2em}
footer{margin-top:64px;font-size:.875rem;color:var(--muted)}
footer a{color:inherit}
@media(prefers-reduced-motion:reduce){.tiles img{transition:none}}
</style></head><body><main><h1>Rayner</h1><p class="intro">${htmlEscape(PRODUCT.summary)} ${htmlEscape(PRODUCT.description)}</p><p class="intro">${htmlEscape(PRODUCT.audience)} <a href="${PRODUCT.tutorial}">Write your first explainer</a>, use the <a href="${PRODUCT.reference}">authoring reference</a>, or follow the <a href="${PRODUCT.skill}">agent authoring skill</a>.</p><p class="start"><a href="${htmlEscape(entryUrl)}">${htmlEscape(PRODUCT.entry.label)}</a></p><ul class="tiles">${topics.map((t, i) => tile(t, i === 0)).join('')}</ul><h2>How these are made</h2><ul class="tiles">${toolchain.map((t) => tile(t)).join('')}</ul><ul class="more"><li><a href="embed-lab.html">Two embeds on one host page</a></li><li><a href="evidence.json">Build evidence</a></li></ul><footer>Built on <a href="https://github.com/ivarvong/lantern">Lantern</a> by Ivar Vong (MIT) and <a href="https://github.com/adewale/agentic-mermaid">Agentic Mermaid</a>.</footer></main></body></html>`;
await writeFile(join(directory, 'index.html'), html);
await writeFile(
  join(directory, 'embed-lab.html'),
  `<!doctype html><html lang="en" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Two embeds on one host page</title><style>${tokens}body{max-width:1200px;margin:0 auto;padding:32px 16px 64px;background:#eceff3;color:var(--fg)}h1{font-size:1.5rem;font-weight:650;letter-spacing:-.015em;margin:0 0 8px;text-wrap:balance}a{color:var(--accent);text-underline-offset:.2em}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;align-items:start}section{min-width:0;background:#fff;border-radius:12px;box-shadow:0 1px 2px rgb(0 0 0/.06),0 0 0 1px rgb(0 0 0/.06);overflow:hidden}@media(max-width:850px){main{grid-template-columns:1fr}}</style><h1>Two embeds, each sized to its own content</h1><a href="index.html">All explainers</a><main><section id="git"></section><section id="cache"></section></main><script src="loader.js" data-src="exgit.html" data-target="git" data-title="Git object ids"></script><script src="loader.js" data-src="mr-cache.html?request=miss" data-target="cache" data-title="Cache request"></script></html>`,
);
await writeFile(join(directory, 'output-hashes.json'), JSON.stringify(await builtOutputHashes(directory, EXPLAINERS.map(e => e.id)), null, 2) + '\n');
console.log(`Gallery: ${join(directory, 'index.html')}\n${JSON.stringify(totals)}`);
