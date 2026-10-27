import { prepareLettering as prepareOutlineLettering } from './lettering.ts';
import { usesOutlineLettering, withSceneLettering } from '../../src/lettering-outlines.ts';
import type { LetteringSnapshot } from '../../src/lettering-outlines.ts';
import { build } from 'esbuild';
import type { Plugin } from 'esbuild';
import { readFile, writeFile, mkdir, stat, readdir, rm } from 'node:fs/promises';
import { dirname, resolve, join, basename, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Scene, NullSink, traceScene, shaperFor } from '../../src/index.ts';
import { takeMissingGlyphs } from '../../src/lettering.ts';
import type { Trace } from '../../src/index.ts';
import { variantsOf, withSettings, bindSnapshots, caseName, resolveSettings } from '../../explain/index.ts';
import type { ExplainerClass, SnapshotStore, Settings } from '../../explain/index.ts';
import type { DiagramResolver } from '../../integrations/agentic-mermaid/snapshot.ts';
import { diagramKey, RENDERER } from '../../integrations/agentic-mermaid/snapshot.ts';
import { lostLabelWarnings } from './explain-warnings.ts';
import { letteringRequest, prepareLettering, useProjectLettering } from './explain-lettering.ts';
import type { Lettering } from './explain-lettering.ts';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
/**
 * Make bundled JavaScript safe inside an inline <script>. The HTML parser only
 * reacts to `</script` and `<!--`, so only those change. Escaping every `</`
 * broke code such as the regex `/</g`, which became `/<\/g`. `<!--` becomes
 * `<\x21--`, an escape that strings, templates and regexes (with or without
 * the `u` and `v` flags) all read as `!`; `<\!--` is a SyntaxError in `/…/u`.
 */
export const scriptEscape = (value: string) =>
  value
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\x21--')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
async function scenePath(input: string): Promise<string> {
  let file = resolve(input);
  if ((await stat(file)).isDirectory()) file = join(file, 'scene.ts');
  return file;
}

/** Force author, helper and player imports onto one engine, including compiled-scene reuse. */
const legacySource = (source: string) => source
  .replace("import type { LetteringRequest } from '../src/lettering-outlines.ts';\n", '')
  .replace('; lettering?: LetteringRequest', '')
  .replace(/\n\/\/ Optional lettering: tree-shaken[\s\S]*?\/\/ End optional lettering\.\n/, '');
export function engineAlias(node = false, outlines = false): Plugin {
  return {
    name: 'one-rayner-engine',
    setup(b) {
      if (!outlines) b.onLoad({ filter: /[/\\]src[/\\]index\.ts$/ }, async (args) => ({
        contents: legacySource(await readFile(args.path, 'utf8')), loader: 'ts',
      }));
      b.onResolve({ filter: /.*/ }, (args) => {
        let file: string | undefined;
        if (args.path === 'rayner') file = join(ROOT, 'src/index.ts');
        else if (args.path === 'rayner/explain') file = join(ROOT, 'explain/index.ts');
        else if (args.path === 'rayner/lettering') file = join(ROOT, 'src/lettering.ts');
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
/**
 * The engine's fingerprint. src/lettering.ts counts only for an explainer that asks
 * for lettering: no other page carries it, and leaving it out keeps every other
 * explainer's receipts, and its video's freshness, as they were.
 */
async function engineHash(lettered: boolean): Promise<string> {
  const inputs: string[] = [];
  for (const folder of ['src', 'explain', 'integrations/agentic-mermaid'])
    for (const name of (await readdir(join(ROOT, folder)))
      .filter((n) => n.endsWith('.ts') && !['lettering-outlines.ts', 'math.ts'].includes(n) && (lettered || folder + '/' + n !== 'src/lettering.ts'))
      .sort())
      inputs.push(folder + '/' + name + '\n' + legacySource(await readFile(join(ROOT, folder, name), 'utf8')));
  inputs.push(await readFile(join(ROOT, 'vendor/glyph.js'), 'utf8'));
  return hash(inputs.join('\n'));
}
async function loadScene(
  file: string,
): Promise<{ Scene: ExplainerClass; exportName: string; file: string; sourceHash: string; engineHash: string }> {
  file = await scenePath(file);
  const result = await build({
    entryPoints: [file],
    absWorkingDir: dirname(file),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node26',
    write: false,
    plugins: [engineAlias(true)],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0]!.text,
    sourceHash = hash(
      code.replaceAll(pathToFileURL(ROOT).href, 'rayner:/').replaceAll(dirname(file), '<author>'),
    );
  const folder = join(tmpdir(), 'rayner-explain');
  await mkdir(folder, { recursive: true });
  const output = join(folder, hash(code) + '.mjs');
  await writeFile(output, code);
  const module = await import(pathToFileURL(output).href);
  const choices = Object.values(module).filter(
    (value): value is ExplainerClass => typeof value === 'function' && value.prototype instanceof Scene,
  );
  // The one rule for which export is the scene; check and build import exactly this name.
  const exportName =
    typeof module.default === 'function' && module.default.prototype instanceof Scene
      ? 'default'
      : choices.length === 1
        ? Object.keys(module).find((k) => module[k] === choices[0])!
        : null;
  if (!exportName) throw new Error('Export one Scene subclass (or a default Scene export)');
  const Explainer = module[exportName] as ExplainerClass;
  const outlines = usesOutlineLettering(Explainer);
  // A captured run must survive installing the package: the same engine imports
  // resolve to src/*.ts in a checkout and dist/src/*.js in the compiled CLI.
  // Preserve the historical fingerprint exactly for every existing plain scene.
  const portableSourceHash = outlines ? hash(
    code.replaceAll(pathToFileURL(ROOT).href, 'lantern:/').replaceAll(dirname(file), '<author>')
      .replace(/lantern:\/dist\/(src|explain|integrations)\//g, 'lantern:/$1/')
      .replace(/(lantern:\/(?:src|explain|integrations)\/[^"'\n]+)\.js(?=["'])/g, '$1.ts'),
  ) : sourceHash;
  return { Scene: Explainer, exportName, file, sourceHash: portableSourceHash, engineHash: await engineHash(outlines || letteringRequest(Explainer) !== undefined) };
}
export interface Project {
  Scene: ExplainerClass;
  /** The module export that is the scene ('default' or a name). */
  exportName: string;
  file: string;
  sourceHash: string;
  engineHash: string;
  store: SnapshotStore;
  variants: { values: Settings; Scene: ExplainerClass; trace: Trace }[];
  edits: number;
  /** The faces cut for `static meta.lettering`; absent when the scene asks for none. */
  lettering?: Lettering;
  outlineLettering?: LetteringSnapshot;
}

/**
 * The capture code's fingerprint. Snapshots record it, so changing how diagrams
 * are captured or lowered (integrations/agentic-mermaid/build/) invalidates
 * every cached snapshot instead of silently serving old ones.
 */
export const IMPORTER = await (async () => {
  const dir = join(ROOT, 'integrations/agentic-mermaid/build');
  const files = (await readdir(dir)).filter((n) => n.endsWith('.ts')).sort();
  return hash((await Promise.all(files.map(async (n) => n + '\n' + (await readFile(join(dir, n), 'utf8'))))).join('\n')).slice(0, 16);
})();
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
 * one file.
 */
export async function readSnapshots(base: string): Promise<SnapshotStore> {
  const index = await readJson(join(base + '.snapshots', 'index.json'));
  const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const store: SnapshotStore = {};
  // Own data properties, so a key such as `__proto__` is a key like any other.
  const put = (key: string, value: unknown) =>
    Object.defineProperty(store, key, { value, enumerable: true, writable: true, configurable: true });
  if (index?.version === 2 && index.importer === IMPORTER) {
    for (const [key, name] of Object.entries(isObject(index.diagrams) ? index.diagrams : {})) {
      // Only the file this key's name hashes to: an index entry cannot point outside the folder.
      if (name !== snapshotFileName(key)) continue;
      const snapshot = await readJson(join(base + '.snapshots', name));
      if (snapshot) put(key, snapshot);
    }
  }
  return store;
}
/** Write the store and delete files no diagram uses. */
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
  // Files only: a folder someone put here is theirs, not a stale snapshot.
  for (const entry of await readdir(folder, { withFileTypes: true }))
    if (entry.isFile() && !keep.has(entry.name)) await rm(join(folder, entry.name));
  const index = json({
    version: 2,
    importer: IMPORTER,
    renderer: RENDERER,
    sourceHash,
    diagrams: names,
  });
  if ((await readFile(join(folder, 'index.json'), 'utf8').catch(() => null)) !== index)
    await writeFile(join(folder, 'index.json'), index);
}
export async function collectProject(
  input: string,
  { refresh = false, write = true, captureLettering = refresh }: { refresh?: boolean; write?: boolean; captureLettering?: boolean } = {},
): Promise<Project> {
  const loaded = await loadScene(input);
  const { file } = loaded;
  const outlineRequested = usesOutlineLettering(loaded.Scene);
  const outline = outlineRequested
    ? await prepareOutlineLettering(loaded.Scene, file, loaded.sourceHash, captureLettering, write) : undefined;
  const Source = outline?.Scene ?? loaded.Scene;
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
      for (const warning of lostLabelWarnings(snapshot)) console.warn('rayner: ' + warning);
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
  const undrawable: string[] = [];
  const request = outlineRequested ? undefined : letteringRequest(Source);
  let lettering: Lettering | undefined;
  try {
    // Only a scene that asks for lettering runs this: once per case with the whole
    // source faces, to learn which letters to cut them to (explain-lettering.ts).
    if (request) {
      lettering = await prepareLettering(
        base,
        request,
        async () => {
          const counted = edits;
          for (const values of variantsOf(Source)) {
            const scene = await new (withSettings(bindSnapshots(Source, resolver), values))(new NullSink(), {
              skipUntil: Infinity,
            }).run();
            // The video footer draws each step's title and caption as outlines too
            for (const s of scene.steps)
              for (const t of [s.meta.title ?? s.name, s.meta.caption ?? '']) shaperFor('sans')(String(t), 1);
          }
          edits = counted;
          takeMissingGlyphs();
        },
        { write },
      );
      // Diagrams captured on that run are pinned for this one
      for (const key of Object.keys(store))
        Object.defineProperty(previous, key, { value: store[key], enumerable: true, writable: true, configurable: true });
    }
    await useProjectLettering({ lettering });
    for (const values of variantsOf(Source)) {
      const collect = new (withSettings(bindSnapshots(Source, resolver), values))(new NullSink(), { skipUntil: Infinity });
      // Text the embedded fonts cannot draw shows as nothing: name it by case and step, then fail.
      let step = '(before the first step)';
      const blanks = () => {
        for (const [text, chars] of takeMissingGlyphs())
          undrawable.push(
            `${caseName(Source, values) || 'The scene'}, step ${step}: "${text}" has ${[...chars].map((c) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}`,
          );
      };
      takeMissingGlyphs();
      collect.onStep((s) => {
        blanks();
        step = s.name;
      });
      await collect.run();
      blanks();
      const Bound = withSettings(bindSnapshots(Source, store), values);
      const trace = await traceScene(Bound),
        names = trace.steps.map((s) => s.step);
      if (!names.length || names.some((name) => !name.trim()))
        throw new Error(`Each case needs non-empty named steps: ${JSON.stringify(values)}`);
      if (new Set(names).size !== names.length)
        throw new Error(`Duplicate step names prevent stable links: ${JSON.stringify(values)}`);
      if (outline) await withSceneLettering(Bound, async () => {
        const { Text } = await import('../../src/index.ts');
        const { wrapCaption, FOOTER_TEXT_WIDTH } = await import('./explain-video.ts');
        for (const [i, s] of trace.steps.entries()) {
          step = s.step;
          // Contact sheets draw this numbered title outside the authored scene.
          new Text(`${i + 1}. ${String(s.meta.title ?? s.step)}`);
          for (const text of [s.meta.title ?? s.step, s.meta.caption ?? '']) {
            new Text(String(text));
            try { wrapCaption(String(text), FOOTER_TEXT_WIDTH); }
            catch (error) {
              // Long captions may still be valid on a page. Video reports its own
              // footer limits; script/face/snapshot errors must always fail closed.
              if (!/^Caption (word exceeds|exceeds four)/.test((error as Error).message)) throw error;
            }
            blanks();
          }
        }
      });
      variants.push({ values, Scene: Bound, trace });
    }
    if (undrawable.length)
      throw new Error(`The embedded fonts cannot draw these characters:\n${[...new Set(undrawable)].join('\n')}`);
    await outline?.finish();
    if (write) await writeSnapshots(base, store, loaded.sourceHash);
    return { ...loaded, Scene: Source, store, variants, edits, ...(lettering ? { lettering } : {}), ...(outline ? { outlineLettering: outline.snapshot } : {}) };
  } finally {
    await builder?.close();
  }
}
/** The default case, or the case these values choose with every other setting at its default, as a URL does. */
export function defaultVariant(project: Project, values: Settings = {}) {
  const want = resolveSettings(project.Scene, values);
  return project.variants.find((v) => Object.keys(want).every((key) => v.values[key] === want[key]))!;
}
export const sceneSlug = (p: Project) => p.Scene.meta?.id ?? basename(p.file).replace(/\.[^.]+$/, '');
/** The fields every receipt (page or video) carries: what was built, from which sources. */
export const baseReceipt = (p: Project) => ({
  version: 1,
  scene: sceneSlug(p),
  sourceHash: p.sourceHash,
  engineHash: p.engineHash,
  engine: 'lantern@2c7bad5+explainer',
  agenticMermaid: RENDERER.split('@')[1],
  snapshotHashes: Object.values(p.store).map((s) => hash(JSON.stringify(s))),
  ...(p.outlineLettering ? { letteringHash: hash(JSON.stringify(p.outlineLettering)) } : {}),
});
