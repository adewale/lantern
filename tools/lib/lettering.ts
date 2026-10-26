// Node-only preparation. Optional dependencies are needed only to refresh a
// lettering snapshot; check/build/video from a fresh snapshot need none of them.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadFont } from '../../vendor/glyph.js';
import { SANS, MONO, FALLBACK } from '../../src/font-data.ts';
import { bindLettering, letteringOf, runKey, scaledRun, snapshotProvider, usesLettering } from '../../src/lettering.ts';
import type { LetteringSnapshot, LetteringProvider, LetteringRequest } from '../../src/lettering.ts';
import type { ExplainerClass } from '../../explain/settings.ts';
import type { Run } from '../../vendor/glyph.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const json = (x: unknown) => JSON.stringify(x, null, 2) + '\n';
const registry: Record<string, { folder: string; file: string }> = {
  'noto-naskh-arabic': { folder: 'fontsource-noto-naskh-arabic-5.3.0', file: 'noto-naskh-arabic-arabic-400-normal.woff2' },
  'noto-sans-devanagari': { folder: 'fontsource-noto-sans-devanagari-5.3.0', file: 'noto-sans-devanagari-devanagari-400-normal.woff2' },
  'noto-sans-hebrew': { folder: 'fontsource-noto-sans-hebrew-5.3.0', file: 'noto-sans-hebrew-hebrew-400-normal.woff2' },
  'inter': { folder: 'inter-ui-4.1.1', file: 'Inter-Regular.woff2' },
  'noto-sans-sc': { folder: '', file: '' },
  'eb-garamond': { folder: 'fontsource-eb-garamond-5.3.0', file: 'eb-garamond-latin-400-normal.woff2' },
};
const scriptFaces: Record<string, string> = { Arab: 'noto-naskh-arabic', Deva: 'noto-sans-devanagari', Hebr: 'noto-sans-hebrew', Hani: 'noto-sans-sc', Grek: 'inter', Cyrl: 'inter', Latn: 'inter' };
export function validateLettering(request: LetteringRequest): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('lettering must be an object');
  for (const k of Object.keys(request)) if (!['faces', 'scripts', 'math'].includes(k)) throw new Error(`Unknown lettering option: ${k}`);
  if (request.math !== undefined && typeof request.math !== 'boolean') throw new Error('lettering.math must be boolean');
  if (request.faces && (typeof request.faces !== 'object' || Array.isArray(request.faces))) throw new Error('lettering.faces must be an object');
  for (const [key, name] of Object.entries(request.faces ?? {})) {
    if (!['sans', 'mono'].includes(key) || !Object.hasOwn(registry, name)) throw new Error(`Unknown lettering face: ${key}=${name}`);
  }
  if (request.scripts !== undefined && !Array.isArray(request.scripts)) throw new Error('lettering.scripts must be an array');
  for (const script of request.scripts ?? []) {
    if (typeof script !== 'string' || !/^[A-Z][a-z]{3}$/.test(script)) throw new Error(`Invalid ISO 15924 script: ${script}`);
    try { new RegExp(`\\p{Script=${script}}`, 'u'); } catch { throw new Error(`Unknown script: ${script}`); }
    if (!scriptFaces[script] && !request.faces?.sans) throw new Error(`Script ${script} requires a supported face in lettering.faces.sans`);
  }
}
function python(request: object): unknown {
  try {
    return JSON.parse(execFileSync(process.env.RAYNER_LETTERING_PYTHON ?? 'python3', [join(root, 'tools/lettering.py')], {
      input: JSON.stringify(request), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    }));
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr;
    throw new Error(`Lettering needs fonttools, brotli, uharfbuzz and python-bidi when refreshing snapshots. ${stderr ?? String(error)}`);
  }
}
export interface PreparedLettering {
  Scene: ExplainerClass;
  snapshot: LetteringSnapshot;
  finish(): Promise<void>;
}
export async function prepareLettering(Source: ExplainerClass, file: string, sourceHash: string, capture: boolean, persist = true): Promise<PreparedLettering | undefined> {
  const request = letteringOf(Source);
  if (!request) return undefined;
  validateLettering(request);
  if (!Object.keys(request.faces ?? {}).length && !request.scripts?.length && !request.math) return undefined;
  const builderHash = hash((await Promise.all(['src/lettering.ts', 'src/math.ts', 'tools/lib/lettering.ts', 'tools/lettering.py', 'tools/lettering-requirements.txt', 'vendor/glyph-math.js'].map((name) => readFile(join(root, name), 'utf8')))).join('\n'));
  const path = file.replace(/\.[^.]+$/, '') + '.lettering.json';
  if (!capture) {
    const snapshot: LetteringSnapshot | undefined = await readFile(path, 'utf8').then(JSON.parse).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') return undefined;
      throw e;
    });
    if (!snapshot || snapshot.version !== 1 || snapshot.sourceHash !== sourceHash || snapshot.builderHash !== builderHash || json(snapshot.request) !== json(request))
      throw new Error('Missing or stale lettering snapshot; run explain snapshots ' + file);
    return { Scene: bindLettering(Source, snapshot), snapshot, async finish() {} };
  }
  const folder = resolve(process.env.RAYNER_LETTERING_FONTS ?? join(root, 'out/lettering-fonts'));
  await mkdir(folder, { recursive: true });
  const fonts = new Map<string, { file: string; license: string; hash: string }>();
  const addFace = async (name: string) => {
    if (fonts.has(name)) return;
    const info = registry[name];
    if (!info) throw new Error(`Unknown lettering face: ${name}`);
    const base = join(folder, info.folder, 'package');
    const file = name === 'noto-sans-sc' ? join(folder, 'noto-sans-sc.ttf')
      : name === 'inter' ? join(base, 'web/Inter-Regular.woff2') : join(base, 'files', info.file);
    try {
      const bytes = await readFile(file), license = await readFile(name === 'noto-sans-sc' ? join(folder, 'Noto-CJK-OFL.txt') : join(base, name === 'inter' ? 'LICENSE.txt' : 'LICENSE'), 'utf8');
      if (!license.includes('SIL OPEN FONT LICENSE')) throw new Error('Only OFL registry faces may be embedded');
      fonts.set(name, { file, license, hash: hash(bytes) });
    } catch (e) { throw new Error(`Install requested lettering fonts with tools/lettering-fonts.sh: ${String(e)}`); }
  };
  for (const name of [...Object.values(request.faces ?? {}), ...(request.scripts ?? []).flatMap((s) => scriptFaces[s] ?? [])]) await addFace(name);
  // The old, already subset faces are the final fallback, unchanged. Write
  // them into an ignored cache only for the build-time HarfBuzz process.
  for (const [name, data] of [['sans', SANS], ['mono', MONO], ...FALLBACK]) {
    const file = join(folder, name + '.woff2');
    await writeFile(file, Buffer.from(data!, 'base64'));
    fonts.set(name!, { file, license: '', hash: hash(Buffer.from(data!, 'base64')) });
  }
  const coverage = await Promise.all([SANS, MONO, ...FALLBACK.map(([, data]) => data)].map(async (data) => {
    const result = await loadFont(Buffer.from(data, 'base64'));
    if (result.tag !== 'Ok') throw new Error('Cannot decode existing font coverage');
    return result.value;
  }));
  const snapshot: LetteringSnapshot = { version: 1, sourceHash, builderHash, request, runs: {}, faces: {}, shaper: 'uharfbuzz+python-bidi/fonttools; glyph-math@6398654' };
  const used = new Set<number>();
  const usedMath = new Set<number>();
  let mathFont: Awaited<ReturnType<typeof loadFont>> | undefined;
  if (request.math) {
    const file = process.env.RAYNER_MATH_FONT ?? '/usr/share/texmf/fonts/opentype/public/lm-math/latinmodern-math.otf';
    const bytes = await readFile(file).catch(() => { throw new Error('Set RAYNER_MATH_FONT to Latin Modern Math 1.959 (OpenType MATH font)'); });
    if (hash(bytes) !== '6075562b771f8b82f0c179e363389684f2dd09de30038269e2628e504bd7be0f') throw new Error('Latin Modern Math checksum mismatch');
    mathFont = await loadFont(bytes);
    if (mathFont.tag !== 'Ok') throw new Error('Cannot load Latin Modern Math: ' + JSON.stringify(mathFont.error));
    fonts.set('latin-modern-math', { file, hash: hash(bytes), license: await readFile(join(root, 'vendor/licenses/LatinModernMath-GUST.txt'), 'utf8') });
  }
  const { typeset } = request.math ? await import('../../vendor/glyph-math.js') : { typeset: undefined };
  let finished = false;
  const provider: LetteringProvider = {
    shape(font, text, size, fallback) {
      if (finished) return snapshotProvider(snapshot).shape(font, text, size, fallback);
      if (!request.faces?.[font] && !request.scripts?.length) return fallback(text, size);
      const key = runKey(font, text);
      let r = snapshot.runs[key];
      if (!r) {
        for (const ch of text) {
          // Existing coverage remains free, including the existing numeral faces.
          if (!coverage.some((f) => f.glyphOf(ch.codePointAt(0)!) !== 0) && !/\p{Cc}|\p{Cf}/u.test(ch) &&
            !(request.scripts ?? []).some((s) => new RegExp(`\\p{Script_Extensions=${s}}`, 'u').test(ch)))
            throw new Error(`Script not requested in meta.lettering.scripts: ${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()})`);
          used.add(ch.codePointAt(0)!);
        }
        if (!usesLettering(request, font, text)) return fallback(text, size);
        const chain = [...new Set([request.faces?.[font] ?? font, ...(request.scripts ?? []).flatMap((s) => scriptFaces[s] ?? []), font, 'sans', ...FALLBACK.map(([name]) => name)])];
        r = python({ command: 'shape', fonts: chain.map((n) => fonts.get(n)!.file), text, mono: font === 'mono', preferred: Object.fromEntries((request.scripts ?? []).filter((s) => scriptFaces[s]).map((s) => [s, chain.indexOf(scriptFaces[s]!)])) }) as Run;
        Object.defineProperty(snapshot.runs, key, { value: r, enumerable: true });
      }
      return scaledRun(r, size);
    },
    math(text, size, display) {
      if (finished) return snapshotProvider(snapshot).math(text, size, display);
      if (!request.math || !typeset || mathFont?.tag !== 'Ok') throw new Error('Math requires meta.lettering.math: true');
      const key = runKey('math', text, display);
      let run = snapshot.runs[key];
      if (!run) {
        const result = typeset(mathFont.value, 'latin-modern-math', text, { size: 1, display });
        if (result.tag !== 'Ok') throw new Error('Math: ' + JSON.stringify(result.error));
        const r = result.value;
        run = { width: r.width, ascent: r.ascent, descent: r.descent, s: r.s,
          glyphs: r.glyphs.map((g) => {
            usedMath.add(g.gid);
            return { gid: g.gid, cluster: 0, x: g.x * r.s, dx: 0, dy: g.y * r.s, ax: 0, s: g.k * r.s, path: g.path };
          }) };
        for (const rule of r.rules) {
          const { x, y, w, h } = rule;
          run.glyphs.push({ gid: -1, cluster: 0, x: 0, dx: 0, dy: 0, ax: 0, s: r.s,
            path: [{ tag: 'MoveTo', x, y }, { tag: 'LineTo', x: x + w, y }, { tag: 'LineTo', x: x + w, y: y + h }, { tag: 'LineTo', x, y: y + h }, { tag: 'Close' }] });
        }
        Object.defineProperty(snapshot.runs, key, { value: run, enumerable: true });
      }
      return scaledRun(run, size);
    },
  };
  return { Scene: bindLettering(Source, provider), snapshot,
    async finish() {
      for (const [name, face] of fonts) if (face.license) {
        const data = python({ command: 'subset', font: face.file, codepoints: [...used].sort((a, b) => a - b), gids: name === 'latin-modern-math' ? [...usedMath] : [] }) as string;
        snapshot.faces[name] = { hash: face.hash, data, license: face.license };
      }
      // Stable run order, regardless of which case first visits a string.
      snapshot.runs = Object.fromEntries(Object.entries(snapshot.runs).sort(([a], [b]) => a.localeCompare(b)));
      finished = true;
      if (persist) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, json(snapshot));
      }
    },
  };
}
export function letteringWeight(snapshot: LetteringSnapshot) {
  return {
    bytes: Buffer.byteLength(JSON.stringify(snapshot)),
    faceBytes: Object.fromEntries(Object.entries(snapshot.faces).map(([name, face]) => [name, Buffer.from(face.data, 'base64').length])),
    runs: Object.keys(snapshot.runs).length,
  };
}
