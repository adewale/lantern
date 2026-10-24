#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { realpathSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { collectProject, defaultVariant, sceneSlug } from './lib/explain-project.ts';
import { buildExplainer, buildLoader } from './lib/explain-build.ts';

const HELP = `Lantern Explainers (Node 26+)\n\nUsage: explain <command> <scene.ts | directory> [options]\n\nCommands:\n  init <directory>    Create a native Scene with helpers and a meaningful setting\n  preview <scene>     Build, print step contact sheet, serve on localhost\n  snapshots <scene>   Run every case, capture/verify diagrams and replay morph edits\n  check <scene>       All cases: seek, motion, bare runtime, legibility, catch lint\n  build <scene>       Self-contained stepper-first HTML, transcript, poster, receipts\n  render <scene>      Silent MP4 (or .webm), captions, chapters and receipt\n  shots <scene>       Step contact sheet as SVG and PNG\n\nOptions:\n  --out <path>        Artifact destination\n  --refresh           Re-render snapshots instead of using the pinned cache\n  --footer            1280 × 880 caption-footer video preset\n  --width <even>      Stage-only video width (default 1280)\n  --fps <integer>     Video frame rate (default 30)\n  --all               Export videos for every declared case\n  --case id=value     Export (render) or show (shots) one case; repeat for multiple settings\n  --port <integer>    Preview server port (default 5174)\n\nDiagram capture requires Chromium: npx playwright-core install chromium\nOr set CHROMIUM_EXECUTABLE_PATH. Video requires ffmpeg on PATH.\n`;
export async function main(args = process.argv.slice(2)): Promise<void> {
  if (!args.length || args.includes('--help') || args[0] === 'help') {
    console.log(HELP);
    return;
  }
  const [command, input, ...rest] = args;
  if (!input) throw new Error('Supply a scene file or directory. Use --help for usage.');
  const flags = new Map<string, string[]>();
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i]!;
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const bool = ['--refresh', '--footer', '--all'].includes(key);
    if (!['--out', '--width', '--fps', '--case', '--port', '--refresh', '--footer', '--all'].includes(key))
      throw new Error(`Unknown option: ${key}`);
    const value = bool ? 'true' : rest[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    flags.set(key, [...(flags.get(key) ?? []), value]);
  }
  const option = (key: string, fallback: string) => flags.get(key)?.at(-1) ?? fallback;
  if (command === 'init') {
    const dir = resolve(input);
    await mkdir(dirname(dir), { recursive: true });
    await mkdir(dir, { recursive: false });
    const template = `import { Scene } from 'manim-js';\nimport { stage, settingsOf } from 'manim-js/explain';\n\nconst FLOW = 'graph LR\\nRequest[Request] --> Cache[Cache]\\nCache -->|hit| Reply[Reply]\\nCache -->|miss| Store[Database]\\nStore --> Reply';\nconst PATH = {\n  hit: [['Request', 'Cache'], ['Cache', 'Reply']],\n  miss: [['Request', 'Cache'], ['Cache', 'Store'], ['Store', 'Reply']],\n} as const;\n\nexport default class MyExplanation extends Scene {\n  static meta = { id: 'my-explanation', title: 'Why a cache changes the request path' };\n  static settings = [{ id: 'request', label: 'Follow a request', default: 'hit', options: [{ value: 'hit', label: 'Cache hit' }, { value: 'miss', label: 'Cache miss' }] }];\n  override async construct() {\n    // The stage heading follows each step title; the palette comes from the first diagram.\n    const s = stage(this);\n    const which = settingsOf(this).request as 'hit' | 'miss';\n\n    await this.step('architecture', { title: 'A cache in front of storage', caption: 'A request checks the cache before it reaches the database. The cache does not replace the source of truth.' });\n    const d = await s.show({ source: FLOW, style: 'nord' }, { box: 'top' });\n    await d.note('Store', 'source of truth', { side: 'below' });\n\n    await this.step('request', { title: which === 'hit' ? 'A cache hit' : 'A cache miss', caption: which === 'hit' ? 'The value is already cached. The request returns without reading the database.' : 'The value is absent. Read the database, then return the result. This request still pays for a storage read.' });\n    // Ask the program, then show its answer: here the path and the read count.\n    const reads = which === 'hit' ? 0 : 1;\n    await d.clearNotes();\n    await d.dim([...new Set(PATH[which].flat())]);\n    await d.walk(PATH[which], { trail: true });\n    await s.card([['Database reads', reads], ['Path', which]], { at: 'bottom', title: 'This request' });\n    this.state.reads = reads;\n  }\n}\n`;
    await writeFile(join(dir, 'scene.ts'), template);
    await writeFile(
      join(dir, 'README.md'),
      '# My explanation\n\nRun `explain preview scene.ts`, `explain check scene.ts`, then `explain build scene.ts --out explanation.html`.\n',
    );
    console.log(`Created ${join(dir, 'scene.ts')}`);
    return;
  }
  if (!['preview', 'snapshots', 'check', 'build', 'render', 'shots'].includes(command!))
    throw new Error(`Unknown command: ${command}`);
  const project = await collectProject(input, { refresh: flags.has('--refresh') });
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
      JSON.stringify(await checkProject(project, option('--out', resolve('out/checks', slug))), null, 2),
    );
    return;
  }
  /** The default case, or the cases matching every --case id=value. */
  function selectedVariants() {
    if (!flags.has('--case')) return [defaultVariant(project)];
    const values = { ...defaultVariant(project).values };
    for (const assignment of flags.get('--case')!) {
      const at = assignment.indexOf('=');
      if (at < 1) throw new Error('--case requires id=value');
      values[assignment.slice(0, at)] = assignment.slice(at + 1);
    }
    const variants = project.variants.filter((v) =>
      Object.entries(values).every(([k, value]) => v.values[k] === value),
    );
    if (!variants.length) throw new Error('No built variant matches --case');
    return variants;
  }
  if (command === 'render') {
    const { renderVideo } = await import('./lib/explain-video.ts');
    const variants = flags.has('--all') ? project.variants : selectedVariants();
    const output = option('--out', resolve('out/videos', slug + '.mp4'));
    for (const v of variants) {
      const suffix = Object.entries(v.values)
        .map(([id, value]) => `${encodeURIComponent(id)}=${encodeURIComponent(value)}`)
        .join('__');
      const out = variants.length > 1 ? output.replace(/(\.[^.]+)$/, `-${suffix}$1`) : output;
      console.log(
        JSON.stringify(
          await renderVideo(project, v, out, {
            footer: flags.has('--footer'),
            width: Number(option('--width', '1280')),
            fps: Number(option('--fps', '30')),
          }),
          null,
          2,
        ),
      );
    }
    return;
  }
  if (command === 'shots') {
    const { contactSheet } = await import('./lib/explain-shots.ts');
    console.log(
      await contactSheet(project, option('--out', resolve('out/shots', slug + '.png')), selectedVariants()[0]),
    );
    return;
  }
  const out = option('--out', resolve('out/explainers', slug + '.html'));
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
    const html = result.html,
      port = Number(option('--port', '5174'));
    const server = createServer(async (req, res) => {
      if (req.url?.split('?')[0] === '/steps.png') {
        res.setHeader('content-type', 'image/png');
        res.end(await readFile(shots));
      } else {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(html);
      }
    });
    server.listen(port, '127.0.0.1', () =>
      console.log(`Preview http://127.0.0.1:${port}/ (Ctrl-C to stop; rerun after edits)`),
    );
  }
}
if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href
)
  main().catch((error) => {
    console.error(`explain: ${error.message}`);
    process.exitCode = 1;
  });
