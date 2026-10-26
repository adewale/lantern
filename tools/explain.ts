#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync, existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { serve } from './lib/explain-serve.ts';
import { collectProject, defaultVariant, sceneSlug, ROOT } from './lib/explain-project.ts';
import { buildExplainer, buildLoader } from './lib/explain-build.ts';

// Optional peer packages, by what needs them; package.json pins their versions.
const CAPTURE = ['agentic-mermaid', 'playwright-core', 'svgpath'],
  RASTER = ['@resvg/resvg-js'];
const peers: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).peerDependencies;
const install = (names: string[]) => 'npm i ' + names.map((n) => `${n}@${peers[n]}`).join(' ');
const HELP = `Lantern Explainers (Node 26+)

Usage: explain <command> <scene.ts | directory> [options]

Commands:
  init <directory>    Write a scene with one setting
  preview <scene>     Build, print step contact sheet, serve on localhost
  snapshots <scene>   Run every case, capture/verify diagrams and replay morph edits
  check <scene>       Every case: seek, motion, skipped trace, bare runtime, step
                      change, still after the caption hold, text collision,
                      legibility, words for every drawing, film pacing, catch lint
  build <scene>       HTML, receipt, header recipe, loader.js
  render <scene>      Silent MP4 (or .webm), captions, chapters and receipt
  shots <scene>       Step contact sheet as SVG and PNG
  filmstrip <scene>   Frames sampled across the video, mid-motion included, as PNG

Every command fails on text the embedded fonts cannot draw.

Options:
  --out <path>        Artifact destination
  --refresh           Re-render snapshots instead of using the pinned cache
  --width <even>      Video width (default 1280)
  --fps <1–120>       Video frame rate (default 30)
  --all               Export videos for every declared case
  --case id=value     Export (render) or show (shots, filmstrip) one case; repeat for multiple settings
  --every <seconds>   Filmstrip: one frame every this many seconds of film (default 1)
  --port <integer>    Preview server port (default 5174)
  --watch             Preview: rebuild the page and contact sheet on save

A default install leaves out what diagrams, PNGs and video need:
  Diagram capture     ${install(CAPTURE)}
                      and Chromium: npx playwright-core install chromium,
                      or set CHROMIUM_EXECUTABLE_PATH
  PNG and video       ${install(RASTER)}; render also needs ffmpeg on PATH
`;
export async function main(args = process.argv.slice(2)): Promise<void> {
  if (!args.length || args.includes('--help') || args[0] === 'help') {
    console.log(HELP);
    return;
  }
  const { values: flags, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      width: { type: 'string', default: '1280' },
      fps: { type: 'string', default: '30' },
      case: { type: 'string', multiple: true },
      port: { type: 'string', default: '5174' },
      refresh: { type: 'boolean' },
      footer: { type: 'boolean' },
      every: { type: 'string', default: '1' },
      all: { type: 'boolean' },
      watch: { type: 'boolean' },
    },
  });
  const [command, input, ...extra] = positionals;
  if (!input) throw new Error('Supply a scene file or directory. Use --help for usage.');
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

    await this.step('architecture', { title: 'A cache in front of storage', caption: 'A request checks the cache first and reads the database only on a miss.' });
    const d = await s.show({ source: FLOW }, { box: 'top' });

    await this.step('request', { title: which === 'hit' ? 'A cache hit' : 'A cache miss', caption: which === 'hit' ? 'The value is already cached, so the request returns without reading the database.' : 'The value is absent, so the request reads the database once and then returns.' });
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
  if (!['preview', 'snapshots', 'check', 'build', 'render', 'shots', 'filmstrip'].includes(command!))
    throw new Error(`Unknown command: ${command}`);
  if (flags.footer)
    throw new Error(
      '--footer is gone: a video shows each step\'s title and line on the picture, and its full caption in the subtitles and transcript',
    );
  const project = await collectProject(input, { refresh: flags.refresh });
  const slug = sceneSlug(project);
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
  if (command === 'check') {
    const { checkProject } = await import('./lib/explain-check.ts');
    console.log(
      JSON.stringify(await checkProject(project, flags.out ?? resolve('out/checks', slug)), null, 2),
    );
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
  if (command === 'render') {
    const { renderVideo } = await import('./lib/explain-video.ts');
    const variants = flags.all ? project.variants : [selectedVariant()];
    const output = flags.out ?? resolve('out/videos', slug + '.mp4');
    for (const v of variants) {
      const suffix = Object.entries(v.values)
        .map(([id, value]) => `${encodeURIComponent(id)}=${encodeURIComponent(value)}`)
        .join('__');
      const out = variants.length > 1 ? output.replace(/(\.[^.]+)$/, `-${suffix}$1`) : output;
      console.log(
        JSON.stringify(
          await renderVideo(project, v, out, {
            width: Number(flags.width),
            fps: Number(flags.fps),
          }),
          null,
          2,
        ),
      );
    }
    return;
  }
  if (command === 'filmstrip') {
    const { filmstrip } = await import('./lib/explain-shots.ts');
    console.log(
      await filmstrip(project, flags.out ?? resolve('out/shots', slug + '.film.png'), selectedVariant(), Number(flags.every)),
    );
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
  const result = await buildExplainer(project, out);
  await buildLoader(join(dirname(resolve(out)), 'loader.js'));
  console.log(
    `Built ${out} (${Math.round(Buffer.byteLength(result.html) / 1024)} KiB; ${project.variants.length} cases)`,
  );
  if (command === 'preview') {
    const { contactSheet } = await import('./lib/explain-shots.ts');
    const shots = out.replace(/\.html$/, '.steps.png');
    await contactSheet(project, shots);
    console.log(`Step contact sheet: ${shots}`);
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
        if ([out, shots].includes(resolve(dirname(project.file), name))) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          running = running.then(async () => {
            try {
              const next = await collectProject(input!);
              await buildExplainer(next, out);
              await contactSheet(next, shots);
              console.log(`Rebuilt ${slug}: ${next.variants.length} cases`);
            } catch (error) {
              console.error(`explain: ${(error as Error).message} (still serving the last good build)`);
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
    // Capture uses optional packages a default install leaves out; name what to install.
    const missing = error.code === 'ERR_MODULE_NOT_FOUND' && /Cannot find package '([^']+)'/.exec(error.message)?.[1];
    const group = missing && [CAPTURE, RASTER].find((g) => g.includes(missing));
    console.error(
      missing
        ? `explain: this command needs ${missing}${group ? `. Install: ${install(group)}` : ''}`
        : `explain: ${error.message}`,
    );
    process.exitCode = 1;
  });
