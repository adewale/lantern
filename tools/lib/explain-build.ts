import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { SnapshotSink, renderAt } from '../../src/index.ts';
import {
  ROOT,
  engineAlias,
  defaultVariant,
  hash,
  scriptEscape,
  htmlEscape,
  sceneSlug,
} from './explain-project.ts';
import type { Project } from './explain-project.ts';

export async function buildExplainer(
  project: Project,
  out: string,
): Promise<{ html: string; receipt: Record<string, unknown> }> {
  const v = defaultVariant(project),
    first = v.trace.steps[0];
  if (!first) throw new Error('A published explanation must have at least one named step');
  const sink = new SnapshotSink();
  await renderAt(v.Scene, Math.max(first.t0, (first.t1 ?? first.t0) - 1 / v.trace.fps), sink);
  // Raw per-mark SVG stays in the author cache; the page only needs resolved artwork.
  const runtimeStore = Object.fromEntries(
    Object.entries(project.store).map(([key, s]) => [
      key,
      { ...s, svg: '', parts: s.parts.map((p) => ({ ...p, svg: '' })) },
    ]),
  );
  const entry = `import Source from 'virtual:author';import{mountEmbed}from ${JSON.stringify(join(ROOT, 'app/embed.ts'))};const root=document.getElementById('content');mountEmbed(root,Source,${JSON.stringify(runtimeStore)}).then(()=>{root.dataset.ready='true'}).catch(error=>{console.error(error);const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='The interactive player could not start. The transcript is available below.';root.append(p)});`;
  const bundled = await build({
    stdin: { contents: entry, resolveDir: ROOT, sourcefile: 'explainer-entry.ts', loader: 'ts' },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
    minify: true,
    metafile: true,
    plugins: [
      {
        name: 'author-scene',
        setup(b) {
          b.onResolve({ filter: /^virtual:author$/ }, () => ({ path: 'author', namespace: 'author' }));
          b.onLoad({ filter: /.*/, namespace: 'author' }, () => ({
            contents: `import * as exports from ${JSON.stringify(project.file)};const Source=exports.default??Object.values(exports).find(v=>typeof v==='function'&&v.prototype&&'construct'in v.prototype);export default Source;`,
            resolveDir: dirname(project.file),
            loader: 'ts',
          }));
        },
      },
      engineAlias(),
    ],
    logLevel: 'silent',
  });
  if (
    Object.keys(bundled.metafile!.inputs).some(
      (p) => p.includes('node_modules/agentic-mermaid') || p.includes('integrations/agentic-mermaid/build/'),
    )
  )
    throw new Error('Build-time diagram renderer leaked into browser artifact');
  const js = scriptEscape(bundled.outputFiles[0]!.text),
    css = await readFile(join(ROOT, 'app/embed.css'), 'utf8');
  const title = project.Scene.meta?.title ?? sceneSlug(project);
  const transcript = project.variants
    .map(
      (variant) =>
        `<section><h2>${htmlEscape(
          Object.entries(variant.values)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ') || title,
        )}</h2><ol>${variant.trace.steps.map((s) => `<li id="${htmlEscape(hash(JSON.stringify(variant.values)).slice(0, 8) + '-' + s.step)}"><strong>${htmlEscape(s.meta.title ?? s.step)}</strong><p>${htmlEscape(s.meta.caption ?? '')}</p></li>`).join('')}</ol></section>`,
    )
    .join('');
  const sources = (project.Scene.meta?.sources ?? [])
    .map((url) => `<li><a href="${htmlEscape(url)}" rel="noopener">${htmlEscape(url)}</a></li>`)
    .join('');
  const licenses = (
    await Promise.all(
      ['LICENSE', 'vendor/licenses/Inter-OFL.txt', 'vendor/licenses/JetBrainsMono-OFL.txt'].map((file) =>
        readFile(join(ROOT, file), 'utf8'),
      ),
    )
  ).join('\n\n');
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="generator" content="Lantern Explainers"><style>${css}</style></head><body><main id="content"><h1>${htmlEscape(title)}</h1><div class="stage poster">${sink.svg}</div><p>${htmlEscape(first.meta.caption ?? '')}</p><details class="transcript" open><summary>Read the transcript</summary>${transcript}${sources ? `<h2>Sources</h2><ul>${sources}</ul>` : ''}</details><noscript><p>This explanation is readable without JavaScript. Enable it to step through the animation and try another case.</p></noscript></main><template id="licenses"><pre>${htmlEscape(licenses)}</pre></template><script>${js}</script></body></html>\n`;
  const sri = (value: string) => "'sha256-" + createHash('sha256').update(value).digest('base64') + "'";
  const policy = `default-src 'none'; script-src ${sri(js)}; style-src ${sri(css)}; img-src data:; connect-src 'none'; font-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors *`;
  const receipt = {
    version: 1,
    scene: sceneSlug(project),
    title,
    sourceHash: project.sourceHash,
    engineHash: project.engineHash,
    engine: 'lantern@2c7bad5+explainer',
    agenticMermaid: '0.4.1',
    artifactHash: hash(html),
    snapshotHashes: Object.values(project.store).map((s) => hash(JSON.stringify(s))),
    variants: project.variants.map((v) => ({
      settings: v.values,
      steps: v.trace.steps.length,
      duration: v.trace.duration,
    })),
    bytes: Buffer.byteLength(html),
    headers: { 'Content-Security-Policy': policy, 'Cache-Control': 'public, max-age=0, must-revalidate' },
  };
  out = resolve(out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  await writeFile(out + '.receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  // Sidecar deployment recipe: static hosts must apply these as response headers.
  await writeFile(out + '.headers.json', JSON.stringify(receipt.headers, null, 2) + '\n');
  return { html, receipt };
}
export async function buildLoader(out: string): Promise<void> {
  const result = await build({
    entryPoints: [join(ROOT, 'app/loader.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'LanternEmbed',
    platform: 'browser',
    target: 'es2022',
    write: false,
    minify: true,
  });
  await mkdir(dirname(resolve(out)), { recursive: true });
  await writeFile(out, result.outputFiles[0]!.text);
}
