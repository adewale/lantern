import { build } from 'esbuild';
import type { Plugin } from 'esbuild';
import { readFile, writeFile, mkdir, stat, readdir, rm } from 'node:fs/promises';
import { dirname, resolve, join, basename, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Scene, NullSink, traceScene } from '../../src/index.ts';
import { variantsOf, withSettings, bindSnapshots, useDiagrams } from '../../explain/index.ts';
import type { ExplainerClass, SnapshotStore, Settings } from '../../explain/index.ts';
import type { DiagramResolver } from '../../integrations/agentic-mermaid/snapshot.ts';
import { diagramKey } from '../../integrations/agentic-mermaid/snapshot.ts';
import type { Trace } from '../../src/index.ts';
import { lostLabelWarnings } from './explain-warnings.ts';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
/**
 * Make bundled JavaScript safe inside an inline <script>. The HTML parser only
 * reacts to `</script` and `<!--`, so only those change. Escaping every `</`
 * broke code such as the regex `/</g`, which became `/<\/g`.
 */
export const scriptEscape = (value: string) =>
  value
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
export const htmlEscape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export async function scenePath(input: string): Promise<string> {
  let file = resolve(input);
  if ((await stat(file)).isDirectory()) file = join(file, 'scene.ts');
  return file;
}

/** Force author, helper and player imports onto one engine, including compiled-scene reuse. */
export function engineAlias(node = false): Plugin {
  return {
    name: 'one-lantern-engine',
    setup(b) {
      b.onResolve({ filter: /.*/ }, (args) => {
        let file: string | undefined;
        if (args.path === 'manim-js') file = join(ROOT, 'src/index.ts');
        else if (args.path === 'manim-js/explain') file = join(ROOT, 'explain/index.ts');
        else if (args.path.startsWith('.') || args.path.startsWith('/')) {
          const absolute = resolve(args.resolveDir, args.path);
          const compiled = absolute.match(/\/dist\/(src|explain|integrations\/agentic-mermaid)\/(.+)\.js$/);
          if (compiled) file = join(ROOT, compiled[1]!, compiled[2]! + '.ts');
          else if (
            absolute.startsWith(join(ROOT, 'src') + '/') ||
            absolute.startsWith(join(ROOT, 'explain') + '/') ||
            absolute === join(ROOT, 'integrations/agentic-mermaid/snapshot.ts')
          )
            file = absolute;
        }
        if (file) {
          if (!node) return { path: file };
          // The checkout runs source; the installed JavaScript CLI shares the compiled runtime.
          const canonical = import.meta.url.endsWith('.js')
            ? join(ROOT, 'dist', relative(ROOT, file).replace(/\.ts$/, '.js'))
            : file;
          return { path: pathToFileURL(canonical).href, external: true };
        }
        return undefined;
      });
    },
  };
}
async function engineHash(): Promise<string> {
  const inputs: string[] = [];
  for (const folder of ['src', 'explain', 'integrations/agentic-mermaid'])
    for (const name of (await readdir(join(ROOT, folder))).filter((n) => n.endsWith('.ts')).sort())
      inputs.push(folder + '/' + name + '\n' + (await readFile(join(ROOT, folder, name), 'utf8')));
  inputs.push(await readFile(join(ROOT, 'vendor/glyph.js'), 'utf8'));
  return hash(inputs.join('\n'));
}
export async function loadScene(
  file: string,
): Promise<{ Scene: ExplainerClass; file: string; sourceHash: string; engineHash: string }> {
  file = await scenePath(file);
  const result = await build({
    entryPoints: [file],
    absWorkingDir: dirname(file),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    write: false,
    plugins: [engineAlias(true)],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0]!.text,
    sourceHash = hash(
      code.replaceAll(pathToFileURL(ROOT).href, 'lantern:/').replaceAll(dirname(file), '<author>'),
    );
  const folder = join(tmpdir(), 'lantern-explain');
  await mkdir(folder, { recursive: true });
  const output = join(folder, hash(code) + '.mjs');
  await writeFile(output, code);
  const module = await import(pathToFileURL(output).href);
  const choices = Object.values(module).filter(
    (value): value is ExplainerClass => typeof value === 'function' && value.prototype instanceof Scene,
  );
  const Source =
    typeof module.default === 'function' && module.default.prototype instanceof Scene
      ? module.default
      : choices.length === 1
        ? choices[0]
        : null;
  if (!Source) throw new Error('Export one Scene subclass (or a default Scene export)');
  return { Scene: Source, file, sourceHash, engineHash: await engineHash() };
}
export interface Project {
  Scene: ExplainerClass;
  file: string;
  sourceHash: string;
  engineHash: string;
  store: SnapshotStore;
  variants: { values: Settings; Scene: ExplainerClass; trace: Trace }[];
  edits: number;
}

const IMPORTER = 4;
/** File name for one diagram's snapshot: a short hash of its cache key. */
export const snapshotFileName = (key: string) => hash(key).slice(0, 16) + '.json';
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
/**
 * Snapshots live in `scene.snapshots/`: `index.json` maps each diagram key to
 * a file, and each diagram has its own file, so changing one diagram changes
 * one file. The older single `scene.snapshots.json` is still read.
 */
export async function readSnapshots(base: string): Promise<SnapshotStore> {
  const index = await readJson(join(base + '.snapshots', 'index.json'));
  if (index?.version === 2 && index.importer === IMPORTER) {
    const store: SnapshotStore = {};
    for (const [key, name] of Object.entries(index.diagrams as Record<string, string>)) {
      const snapshot = await readJson(join(base + '.snapshots', name));
      if (snapshot) store[key] = snapshot as unknown as SnapshotStore[string];
    }
    return store;
  }
  const legacy = await readJson(base + '.snapshots.json');
  return legacy?.version === 1 && legacy.importer === IMPORTER ? (legacy.diagrams as SnapshotStore) : {};
}
/** Write the store, delete files no diagram uses, and retire the single-file cache. */
export async function writeSnapshots(base: string, store: SnapshotStore, sourceHash: string): Promise<void> {
  const folder = base + '.snapshots';
  await mkdir(folder, { recursive: true });
  const keys = Object.keys(store).sort();
  const names = Object.fromEntries(keys.map((key) => [key, snapshotFileName(key)]));
  for (const key of keys) {
    const path = join(folder, names[key]!),
      body = json(store[key]);
    if ((await readFile(path, 'utf8').catch(() => null)) !== body) await writeFile(path, body);
  }
  const keep = new Set([...Object.values(names), 'index.json']);
  for (const name of await readdir(folder)) if (!keep.has(name)) await rm(join(folder, name));
  const index = json({
    version: 2,
    importer: IMPORTER,
    renderer: 'agentic-mermaid@0.4.1',
    sourceHash,
    diagrams: names,
  });
  if ((await readFile(join(folder, 'index.json'), 'utf8').catch(() => null)) !== index)
    await writeFile(join(folder, 'index.json'), index);
  await rm(base + '.snapshots.json', { force: true });
}
export async function collectProject(
  input: string,
  { refresh = false, write = true }: { refresh?: boolean; write?: boolean } = {},
): Promise<Project> {
  const loaded = await loadScene(input);
  const { Scene: Source, file } = loaded;
  const base = file.replace(/\.[^.]+$/, '');
  const previous: SnapshotStore = refresh ? {} : await readSnapshots(base);
  // Lazy: native scenes never require Agentic Mermaid or Chromium.
  let builder:
    | Awaited<ReturnType<typeof import('../../integrations/agentic-mermaid/build/index.ts').snapshotBuilder>>
    | undefined;
  const store: SnapshotStore = {};
  let edits = 0;
  const warned = new Set<string>();
  const inspect = (snapshot: SnapshotStore[string]) => {
    const key = diagramKey(snapshot.spec);
    if (!warned.has(key)) {
      warned.add(key);
      for (const warning of lostLabelWarnings(snapshot)) console.warn('explain: ' + warning);
    }
    return snapshot;
  };
  const resolver: DiagramResolver = {
    async diagram(spec) {
      const key = diagramKey(spec);
      if (previous[key]) {
        store[key] = previous[key];
        return inspect(previous[key]);
      }
      if (!builder) {
        const { snapshotBuilder } = await import('../../integrations/agentic-mermaid/build/index.ts');
        builder = await snapshotBuilder(previous);
      }
      const result = await builder.diagram(spec);
      store[key] = result;
      return inspect(result);
    },
    async morph(before, after, ops) {
      const { replayMorph } = await import('../../integrations/agentic-mermaid/build/index.ts');
      replayMorph(before, after, ops);
      edits++;
    },
  };
  const variants: Project['variants'] = [];
  try {
    for (const values of variantsOf(Source)) {
      const Selected = withSettings(Source, values);
      class Collect extends Selected {
        constructor(...args: ConstructorParameters<typeof Scene>) {
          super(...args);
          useDiagrams(this, resolver);
        }
      }
      await new Collect(new NullSink(), { skipUntil: Infinity }).run();
      const Bound = withSettings(bindSnapshots(Source, store), values);
      const trace = await traceScene(Bound),
        names = trace.steps.map((s) => s.step);
      if (!names.length || names.some((name) => !name.trim()))
        throw new Error(`Each case needs non-empty named steps: ${JSON.stringify(values)}`);
      if (new Set(names).size !== names.length)
        throw new Error(`Duplicate step names prevent stable links: ${JSON.stringify(values)}`);
      variants.push({ values, Scene: Bound, trace });
    }
    if (write) await writeSnapshots(base, store, loaded.sourceHash);
    return { ...loaded, store, variants, edits };
  } finally {
    await builder?.close();
  }
}
export function defaultVariant(project: Project) {
  const defaults = Object.fromEntries((project.Scene.settings ?? []).map((s) => [s.id, s.default]));
  return project.variants.find((v) =>
    Object.entries(defaults).every(([key, value]) => v.values[key] === value),
  )!;
}
export const sceneSlug = (p: Project) => p.Scene.meta?.id ?? basename(p.file).replace(/\.[^.]+$/, '');
