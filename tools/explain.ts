#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync, existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { serve } from './lib/explain-serve.ts';
import { collectProject, defaultVariant, sceneSlug, ROOT } from './lib/explain-project.ts';
import { buildExplainer, buildLoader } from './lib/explain-build.ts';

// Authoring packages, grouped for installation error messages.
const CAPTURE = ['agentic-mermaid', 'playwright-core', 'svgpath'],
  RASTER = ['@resvg/resvg-js'];
const pkg: { version: string; dependencies: Record<string, string> } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const peers = pkg.dependencies;
const install = (names: string[]) => 'npm i ' + names.map((n) => `${n}@${peers[n]}`).join(' ');
const HELP = `Rayner ${pkg.version} (Node 22.22+)

Usage: rayner <command> <scene.ts | directory> [options]

Commands:
  init <directory>    Write a scene with one setting
  preview <scene>     Build and serve on localhost
  snapshots <scene>   Run every case, capture/verify diagrams and replay morph edits
  check <scene>       Every case: seek, motion, skipped trace, bare runtime, step
                      change, still after the caption hold, text collision,
                      legibility, words for every drawing, catch lint
  review <scene>      Check every case, then review its served reader at phone
                      and desktop widths; optional <scene>.review.json claims
  build <scene>       HTML, receipt, header recipe, loader.js
  shots <scene>       Step contact sheet as SVG and PNG
  describe <scene>    Every case and step as JSON for agents: words, state, what
                      changed, the picture in words and drawn as text
  see <scene> [step]  One step's resting picture as text, with its caption, its
                      picture in words and what it changed in scene.state
                      (the last step by default; --out file.svg also writes it)
  version             Print the version (also --version)

Every command fails on text the embedded fonts cannot draw, unless the scene
asks for that script with meta.lettering.

Options:
  --out <path>        Artifact destination
  --refresh           Re-render snapshots instead of using the pinned cache
  --case id=value     Show (shots, see) one case; repeat for multiple settings
  --port <integer>    Preview server port (default 5174)
  --watch             Preview: rebuild the page on save
  --claims <path>     Review: use this JSON file instead of <scene>.review.json
  --json              Check: print the whole report (by default, a summary; the
                      report is written to the --out directory either way)
  --artifact          Build: also write <page>.artifact.html, the page without its
                      document skeleton, for a host that supplies one (claude.ai)
  --stills            Build: also write <page>.stills.html, every step's resting
                      picture as SVG with its words and a stepper, and no engine;
                      its receipt reports its size
  --version           Print the version

Diagram capture is included. Install Chromium once:
  npx playwright-core install chromium
  or set CHROMIUM_EXECUTABLE_PATH, or PLAYWRIGHT_BROWSERS_PATH to a folder of
  Playwright builds (every layout Playwright has used is recognised)
PNG output is included.
`;
/** A passing check in a few lines: what was checked, the smallest labels, the densest steps, and where the report is. */
export function checkSummary(report: Record<string, unknown>, file: string): string {
  type Variant = {
    steps: number; frames: number; motionEvents: number;
    legibility: { minLabelPx1280: number | null; minLabelPx390: number | null; labelsUnder12PxAt390: number; labels: number };
    density: { maxLabels: number; maxCaptionWords: number; maxCaptionNumerals: number; steps: Record<string, { labels: number; captionNumerals: number }> };
  };
  const variants = report.variants as Variant[];
  const least = (pick: (v: Variant) => number | null) => {
    const values = variants.map(pick).filter((n): n is number => n != null);
    return values.length ? Math.min(...values) : null;
  };
  const most = (pick: (v: Variant) => number) => Math.max(0, ...variants.map(pick));
  const steps = [...new Set(variants.map((v) => v.steps))].join(' or ');
  const under = most((v) => v.legibility.labelsUnder12PxAt390);
  const densest = variants.flatMap((v) => Object.entries(v.density.steps)).sort((a, b) => b[1].labels - a[1].labels)[0];
  const px = (n: number | null) => (n == null ? 'none' : `${n} px`);
  return [
    `rayner check: ${report.scene} passed`,
    `  ${variants.length} case${variants.length === 1 ? '' : 's'} · ${steps} steps · ${report.diagrams} diagram${report.diagrams === 1 ? '' : 's'} · ${most((v) => v.frames)} frames at most · 0 motion events`,
    `  labels: smallest ${px(least((v) => v.legibility.minLabelPx1280))} at 1280 px, ${px(least((v) => v.legibility.minLabelPx390))} in a phone close-up` +
      (under ? ` (${under} under 12 px)` : ''),
    `  density: up to ${most((v) => v.density.maxLabels)} labels at rest${densest ? ` (${densest[0]})` : ''}, up to ${most((v) => v.density.maxCaptionNumerals)} numerals and ${most((v) => v.density.maxCaptionWords)} words in a caption`,
    `  report: ${file}`,
  ].join('\n');
}
export async function main(args = process.argv.slice(2)): Promise<void> {
  if (!args.length || args.includes('--help') || args[0] === 'help') {
    console.log(HELP);
    return;
  }
  if (args[0] === '--version' || args[0] === 'version') {
    console.log(pkg.version);
    return;
  }
  const { values: flags, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      case: { type: 'string', multiple: true },
      port: { type: 'string', default: '5174' },
      refresh: { type: 'boolean' },
      watch: { type: 'boolean' },
      claims: { type: 'string' },
      json: { type: 'boolean' },
      artifact: { type: 'boolean' },
      stills: { type: 'boolean' },
    },
  });
  const [command, input, ...extra] = positionals;
  if (!input) throw new Error('Supply a scene file or directory. Use --help for usage.');
  // `see` takes the step to show as a second argument.
  const step = command === 'see' ? extra.shift() : undefined;
  if (extra.length) throw new Error(`Unexpected argument: ${extra[0]}`);
  if (command === 'init') {
    const dir = resolve(input);
    await mkdir(dirname(dir), { recursive: true });
    await mkdir(dir, { recursive: false });
    const template = `import { Scene } from 'rayner';
import { stage, settingsOf } from 'rayner/explain';

const FLOW = 'graph LR\\nRequest[Request] --> Cache[Cache]\\nCache -->|hit| Reply[Reply]\\nCache -->|miss| Store[Database]\\nStore --> Reply';
const PATH = {
  hit: [['Request', 'Cache'], ['Cache', 'Reply']],
  miss: [['Request', 'Cache'], ['Cache', 'Store'], ['Store', 'Reply']],
} as const;

export default class MyExplainer extends Scene {
  static meta = { id: 'my-explainer', title: 'Why a cache changes the request path' };
  static settings = [{ id: 'request', label: 'Follow a request', default: 'hit', options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }] }];
  override async construct() {
    // The heading follows each step title; the style sets the palette and every diagram's look.
    const s = stage(this, { style: 'nord' });
    const which = settingsOf(this).request as 'hit' | 'miss';

    await this.step('architecture', { title: 'A cache in front of storage', line: 'The cache sits between the request and the database.', caption: 'A request checks the cache first and reads the database only on a miss.' });
    const d = await s.show({ source: FLOW }, { box: 'top' });

    await this.step('request', { title: which === 'hit' ? 'A cache hit' : 'A cache miss', line: which === 'hit' ? 'The reply comes from the cache: no database read.' : 'The cache misses, so the database is read once.', caption: which === 'hit' ? 'The value is already cached, so the request returns without reading the database.' : 'The value is absent, so the request reads the database once and then returns.' });
    // Ask the program, then show its answer: here the path and the read count.
    const reads = which === 'hit' ? 0 : 1;
    await d.dim([...new Set(PATH[which].flat())]);
    await d.walk(PATH[which], { trail: true });
    await s.card([['Database reads', reads]], { at: 'bottom' });
    this.state.reads = reads;
  }
}
`;
    await writeFile(join(dir, 'scene.ts'), template);
    console.log(`Created ${join(dir, 'scene.ts')}`);
    return;
  }
  if (!['preview', 'snapshots', 'check', 'review', 'build', 'shots', 'describe', 'see'].includes(command!))
    throw new Error(`Unknown command: ${command}`);
  const collection = { refresh: flags.refresh, captureLettering: command === 'snapshots' || command === 'preview' };
  const project = await collectProject(input, collection);
  const slug = sceneSlug(project);
  if (command === 'review') {
    const { reviewScene } = await import('./lib/explain-review-scene.ts');
    console.log(JSON.stringify(await reviewScene(project, flags.out ?? resolve('out/review', slug), flags.claims), null, 2));
    return;
  }
  if (command === 'snapshots') {
    console.log(
      JSON.stringify(
        {
          scene: slug,
          variants: project.variants.length,
          diagrams: Object.keys(project.store).length,
          replayedEdits: project.edits,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === 'describe') {
    const { describeExplainer } = await import('../explain/describe.ts');
    const json = JSON.stringify(await describeExplainer(project.Scene, { snapshots: project.store }), null, 2) + '\n';
    if (flags.out) await writeFile(flags.out, json);
    else process.stdout.write(json);
    return;
  }
  if (command === 'check') {
    const { checkProject } = await import('./lib/explain-check.ts');
    const directory = flags.out ?? resolve('out/checks', slug);
    const report = await checkProject(project, directory);
    if (flags.json) console.log(JSON.stringify(report, null, 2));
    else console.log(checkSummary(report, join(directory, 'report.json')));
    return;
  }
  /** The case every --case id=value chooses, other settings at their defaults. */
  function selectedVariant() {
    const values: Record<string, string> = {};
    for (const assignment of flags.case ?? []) {
      const at = assignment.indexOf('=');
      if (at < 1) throw new Error('--case requires id=value');
      values[assignment.slice(0, at)] = assignment.slice(at + 1);
    }
    return defaultVariant(project, values);
  }
  if (command === 'see') {
    const { see } = await import('./lib/explain-see.ts');
    console.log(await see(project, selectedVariant(), step, flags.out));
    return;
  }
  if (command === 'shots') {
    const { contactSheet } = await import('./lib/explain-shots.ts');
    console.log(
      await contactSheet(project, flags.out ?? resolve('out/shots', slug + '.png'), selectedVariant()),
    );
    return;
  }
  const out = flags.out ?? resolve('out/explainers', slug + '.html');
  if (flags.stills) {
    const { buildStills } = await import('./lib/explain-stills.ts');
    const stills = await buildStills(project, out);
    console.log(
      `Built ${stills.out} (${Math.round(stills.bytes / 1024)} KiB, ${Math.round(stills.gzipBytes / 1024)} KiB gzip; ${project.variants.length} cases, ${stills.stills} stills, no engine)`,
    );
  }
  const result = await buildExplainer(project, out, { artifact: flags.artifact });
  await buildLoader(join(dirname(resolve(out)), 'loader.js'));
  console.log(
    `Built ${out} (${Math.round(Buffer.byteLength(result.html) / 1024)} KiB; ${project.variants.length} cases)` +
      (result.artifact ? `\n      ${result.artifact} (the page without its document skeleton, for hosts that supply one)` : ''),
  );
  if (command === 'preview') {
    // The page is served from disk with its header recipe, so a rebuild shows on reload.
    const { url } = await serve(dirname(out), Number(flags.port), basename(out));
    console.log(
      `Preview ${url}/ (Ctrl-C to stop; ${flags.watch ? 'rebuilds on save' : 'rerun after edits, or pass --watch'})`,
    );
    if (flags.watch) {
      // Rebuild when anything beside the scene changes; keep serving the last good build on error.
      const { watch } = await import('node:fs');
      let timer: ReturnType<typeof setTimeout> | undefined,
        running = Promise.resolve();
      watch(dirname(project.file), { recursive: true }, (_, name) => {
        // Source edits only: the rebuild's own outputs (page, sheet, snapshots) must not retrigger it.
        if (!name || !/\.(ts|mts|js|mjs)$/.test(name) || /\.snapshots(\/|\.json$)/.test(name)) return;
        if (resolve(dirname(project.file), name) === resolve(out)) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          running = running.then(async () => {
            try {
              const next = await collectProject(input!, collection);
              await buildExplainer(next, out);
              console.log(`Rebuilt ${slug}: ${next.variants.length} cases`);
            } catch (error) {
              console.error(`rayner: ${(error as Error).message} (still serving the last good build)`);
            }
          });
        }, 200);
      });
    }
  }
}
if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href
)
  main().catch((error) => {
    // Diagnose an incomplete authoring install with the pinned dependency versions.
    const missing = error.code === 'ERR_MODULE_NOT_FOUND' && /Cannot find package '([^']+)'/.exec(error.message)?.[1];
    const group = missing && [CAPTURE, RASTER].find((g) => g.includes(missing));
    console.error(
      missing
        ? `rayner: this command needs ${missing}${group ? `. Install: ${install(group)}` : ''}`
        : `rayner: ${error.message}`,
    );
    process.exitCode = 1;
  });
