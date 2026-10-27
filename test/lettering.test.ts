// Lettering on request (src/lettering.ts, tools/lib/explain-lettering.ts): an explainer pays only
// for the lettering it asks for. One that asks for nothing builds what it built before lettering
// existed, byte for byte; one that asks gets its letters, cut to what it draws; and a letter in a
// script nobody asked for still fails the build.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { collectProject, defaultVariant, ROOT } from '../tools/lib/explain-project.ts';
import type { Project } from '../tools/lib/explain-project.ts';
import { buildExplainer } from '../tools/lib/explain-build.ts';
import { checkProject } from '../tools/lib/explain-check.ts';
import { SCRIPTS, letteringRequest, useProjectLettering } from '../tools/lib/explain-lettering.ts';
import type { LetteringFace } from '../tools/lib/explain-lettering.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { loadFonts, shaperFor, SnapshotSink, renderAt } from '../src/index.ts';
import { useLettering, takeMissingGlyphs } from '../src/lettering.ts';
import { takeMissingGlyphs as takeEmbeddedMissing } from '../src/index.ts';
import { footerLines } from '../tools/lib/explain-video.ts';
import { loadFont } from '../vendor/glyph.js';
import { restingTime } from '../explain/trace.ts';

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const folder = await mkdtemp(join(tmpdir(), 'rayner-lettering-'));
after(() => rm(folder, { recursive: true, force: true }));
const FIXTURE = join(ROOT, 'test/fixtures/lettering');
// The fixture's cut faces are pinned in scene.lettering.json: a build that needed fonttools
// would mean the pins are stale, so make any call to it fail.
process.env.PYFTSUBSET = join(folder, 'no-fonttools-here');

await loadFonts();
const embedded = { sans: shaperFor('sans'), mono: shaperFor('mono') };

/** What a build of `project` gives a reader and a host: the page, its header recipe and its receipt. */
async function built(project: Project, name: string) {
  const { html, receipt } = await buildExplainer(project, join(folder, name + '.html'));
  return { html, receipt, headers: await readFile(join(folder, name + '.html.headers.json'), 'utf8') };
}

// The pins began as what main built at 6b90d83, before lettering on request; `git log
// test/lettering-baseline.json` gives each deliberate re-pin since. They change only when an
// explainer, the engine or the player changes on purpose: re-pin with UPDATE_GOLDEN=1 (FULL=1 for
// all of them), in a commit that touches no lettering code, so a lettering change cannot hide in a
// re-pin. The engine hash is checked by rule below instead of pinned: any edit under src/ moves it.
// exgit and gnome-files are in the short list because each changed when a first draft added an
// unused export to src/fonts.ts or a type to explain/settings.ts: esbuild's minifier names
// identifiers by character counts over each bundled file's whole source.
const PINS = new URL('./lettering-baseline.json', import.meta.url);
const SHORT = ['exgit', 'gnome-files', 'glyph'];
test('explainers that ask for no lettering build the page, headers and receipt they built before it existed', async () => {
  const pins: Record<string, { html: string; bytes: number; headers: string; receipt: string }> = JSON.parse(
    readFileSync(PINS, 'utf8'),
  );
  const ids = process.env.FULL || process.env.UPDATE_GOLDEN === '1' ? EXPLAINERS.map((e) => e.id) : SHORT;
  const now: typeof pins = {};
  for (const id of ids) {
    const project = await collectProject(join(ROOT, 'scenes/explainers', id), { write: false });
    assert.equal(project.lettering, undefined, id);
    const { html, receipt, headers } = await built(project, id);
    assert.equal('lettering' in receipt, false, `${id}: only a lettered page reports lettering`);
    const { engineHash: _, ...rest } = receipt;
    now[id] = { html: sha256(html), bytes: receipt.bytes as number, headers: sha256(headers), receipt: sha256(JSON.stringify(rest)) };
  }
  if (process.env.UPDATE_GOLDEN === '1') writeFileSync(PINS, JSON.stringify(now, null, 2) + '\n');
  for (const id of ids) assert.deepEqual(now[id], pins[id], `${id} no longer builds what it built before lettering on request`);
});

/** The engine hash as loadScene computes it, with or without src/lettering.ts. */
async function engineHashOf(lettered: boolean) {
  const inputs: string[] = [];
  for (const dir of ['src', 'explain', 'integrations/agentic-mermaid'])
    for (const name of (await readdir(join(ROOT, dir))).filter((n) => n.endsWith('.ts') && !['lettering-outlines.ts', 'math.ts', 'italic.ts'].includes(n)).sort())
      if (lettered || dir + '/' + name !== 'src/lettering.ts')
        inputs.push(dir + '/' + name + '\n' + (await readFile(join(ROOT, dir, name), 'utf8')).replace("import type { LetteringRequest } from '../src/lettering-outlines.ts';\n", '').replace('; lettering?: LetteringRequest', '').replace(/\n\/\/ Optional lettering: tree-shaken[\s\S]*?\/\/ End optional lettering\.\n/, ''));
  inputs.push(await readFile(join(ROOT, 'vendor/glyph.js'), 'utf8'));
  return sha256(inputs.join('\n'));
}

test('the engine hash counts src/lettering.ts only for an explainer that asks for lettering', async () => {
  const plain = await collectProject(join(ROOT, 'scenes/explainers/seasons'), { write: false });
  assert.equal(plain.engineHash, await engineHashOf(false));
  const lettered = await collectProject(FIXTURE, { write: false });
  assert.equal(lettered.engineHash, await engineHashOf(true));
  assert.notEqual(plain.engineHash, lettered.engineHash);
});

test('a page that asks for nothing carries no lettering code, and building a lettered one first leaks nothing into it', async () => {
  const lettered = await collectProject(FIXTURE, { write: false });
  await built(lettered, 'lettered-first');
  assert.notEqual(shaperFor('sans'), embedded.sans, 'the lettered build swapped the shapers');
  const plain = await collectProject(join(ROOT, 'scenes/explainers/seasons'), { write: false });
  // Collecting a plain project put the embedded shapers back, the very same functions
  assert.equal(shaperFor('sans'), embedded.sans);
  assert.equal(shaperFor('mono'), embedded.mono);
  const { html } = await built(plain, 'seasons');
  // Strings from src/lettering.ts survive minification; none may reach a page that asked for nothing
  assert.ok(!html.includes('lettering for sans') && !html.includes('lettering for mono'));
  for (const face of Object.values(lettered.lettering!.faces)) assert.ok(!html.includes(face.woff2));
});

test('useLettering with the faces in place, or none in place, does nothing', async () => {
  await useLettering(null);
  assert.equal(shaperFor('sans'), embedded.sans);
  const project = await collectProject(FIXTURE, { write: false });
  const lettered = shaperFor('sans');
  await useProjectLettering(project);
  assert.equal(shaperFor('sans'), lettered);
  await useLettering(null);
  await useLettering(null);
  assert.equal(shaperFor('sans'), embedded.sans);
});

// Fail closed: a script nobody asked for fails every command, as it did before lettering existed.
const scene = (meta: string, text: string) =>
  `import{Scene,Text}from'rayner';import{stage}from'rayner/explain';export default class L extends Scene{static meta={${meta}};async construct(){stage(this);await this.step('one',{title:'One'});this.add(new Text(${JSON.stringify(text)}));}}`;
async function collectSource(name: string, source: string) {
  const file = join(folder, name + '.ts');
  await writeFile(file, source);
  return collectProject(file, { write: false });
}

test('an explainer that asks for nothing still fails on a Greek letter, naming it', async () => {
  await assert.rejects(collectSource('plain-greek', scene(`id:'plain-greek'`, 'λόγος')), /cannot draw[\s\S]*λ \(U\+03BB\)/);
});

test('an explainer that asks for Greek still fails on a Cyrillic letter, naming it', async () => {
  await assert.rejects(
    collectSource('greek-cyrillic', scene(`id:'greek-cyrillic',lettering:{scripts:['Grek']}`, 'жук')),
    /cannot draw[\s\S]*ж \(U\+0436\)/,
  );
  // And after that failure the embedded faces are back for whatever builds next
  await collectProject(join(ROOT, 'scenes/explainers/seasons'), { write: false });
  shaperFor('sans')('ж', 1);
  assert.deepEqual([...takeMissingGlyphs()], [['ж', 'ж']]);
});

test('a request Rayner cannot serve fails with what it can', () => {
  const ask = (lettering: unknown) => () => letteringRequest({ meta: { lettering } });
  assert.throws(ask({ scripts: ['Arab'] }), /unknown script "Arab".*Latn, Grek, Cyrl/);
  assert.throws(ask({ scripts: [] }), /non-empty scripts/);
  assert.throws(ask({ scripts: ['Grek', 'Grek'] }), /twice/);
  assert.throws(ask({ scripts: ['Grek'], math: true }), /math, which Rayner does not support yet/);
  assert.equal(letteringRequest({ meta: { id: 'x' } }), undefined);
  assert.deepEqual(letteringRequest({ meta: { lettering: { scripts: ['Cyrl', 'Latn'] } } }), { scripts: ['Cyrl', 'Latn'] });
});

// The fixture asks for Greek and draws it in Inter (a card's title, free text, the captions the
// video footer draws) and in JetBrains Mono (a card's values and code). JetBrains Mono has no ῶ,
// so code's ῶ comes from the Inter cut: the mono chain tries mono's cut, then sans's.
const greek = (s: string) => [...new Set([...s].filter((c) => SCRIPTS.Grek.some(([a, b]) => c.codePointAt(0)! >= a && c.codePointAt(0)! <= b)))];
const cps = (chars: string[]) => chars.map((c) => c.codePointAt(0)!).sort((a, b) => a - b);
const EXPECTED = {
  sans: cps(greek('Αλφάβητο Ελληνικά λόγος φῶς')),
  mono: cps(greek('λόγος φς αβγ')),
};

test('a lettered page embeds only the requested faces, cut to the letters it draws', async () => {
  const project = await collectProject(FIXTURE, { write: false });
  assert.deepEqual(project.lettering?.scripts, ['Grek']);
  const { html, receipt } = await built(project, 'lettered');
  const pinned = JSON.parse(await readFile(join(FIXTURE, 'scene.lettering.json'), 'utf8'));
  const sources = {
    sans: (await readFile(join(ROOT, 'vendor/lettering/inter.woff2'))).toString('base64'),
    mono: (await readFile(join(ROOT, 'vendor/lettering/jetbrains-mono.woff2'))).toString('base64'),
  };
  for (const family of ['sans', 'mono'] as const) {
    const face: LetteringFace = project.lettering!.faces[family]!;
    assert.equal(face.woff2, pinned.faces[family].woff2, `${family}: the pinned cut`);
    assert.ok(html.includes(face.woff2), `${family}: the page carries the cut`);
    assert.ok(!html.includes(sources[family]), `${family}: and not the whole source face`);
    // Every character the cut maps, read from its own cmap
    const font = await loadFont(Buffer.from(face.woff2, 'base64'));
    assert.equal(font.tag, 'Ok');
    if (font.tag !== 'Ok') return;
    const mapped: number[] = [];
    for (let cp = 0; cp < 0x30000; cp++) if (font.value.glyphOf(cp) !== 0) mapped.push(cp);
    assert.deepEqual(mapped, EXPECTED[family], `${family}: exactly the Greek it draws`);
    assert.deepEqual(face.codePoints, EXPECTED[family]);
  }
  // The size report, on the receipt of a lettered page only
  const report = receipt.lettering as { scripts: string[]; faces: Record<string, { characters: number; bytes: number }>; pageBytes: number };
  assert.deepEqual(report.scripts, ['Grek']);
  assert.equal(report.faces.sans!.characters, EXPECTED.sans.length);
  assert.equal(report.faces.mono!.characters, EXPECTED.mono.length);
  assert.equal(
    report.pageBytes,
    project.lettering!.faces.sans!.woff2.length + project.lettering!.faces.mono!.woff2.length,
  );
  assert.ok(report.pageBytes < 12_000, `${report.pageBytes} bytes for two dozen letters`);
});

test('a lettered explainer draws its Greek as outlines, and without its faces the same Greek is missing', async () => {
  const project = await collectProject(FIXTURE, { write: false });
  await useProjectLettering(project);
  takeMissingGlyphs();
  for (const [font, text] of [
    ['sans', 'Ελληνικά'],
    ['mono', 'αβγ'],
    ['mono', 'φῶς'],
  ] as const) {
    const run = shaperFor(font)(text, 1);
    assert.equal(run.glyphs.length, [...text].length, text);
    for (const g of run.glyphs) {
      assert.notEqual(g.gid, 0, `${font} ${text}`);
      assert.ok(g.path.length > 2, `${font} ${text}: an outline`);
    }
  }
  assert.deepEqual([...takeMissingGlyphs()], []);
  // The poster is the resting picture of the first step, drawn with those outlines
  const v = defaultVariant(project, { word: 'phos' });
  const step = v.trace.steps.find((s) => s.step === 'code')!;
  const sink = new SnapshotSink();
  await renderAt(v.Scene, restingTime(step, v.trace.fps), sink);
  const lettered = sink.svg;
  await useLettering(null);
  assert.ok(shaperFor('mono')('αβγ', 1).glyphs.every((g) => g.gid === 0));
  assert.deepEqual([...takeMissingGlyphs()], [['αβγ', 'αβγ']]);
  const bare = new SnapshotSink();
  await renderAt(v.Scene, restingTime(step, v.trace.fps), bare);
  assert.notEqual(bare.svg, lettered, 'the Greek outlines are what the lettering added');
});

test('a lettered explainer passes every check, its bare runtime included, and reports what its lettering weighs', async () => {
  const project = await collectProject(FIXTURE, { write: false });
  const report = await checkProject(project, join(folder, 'checks'));
  assert.deepEqual((report.lettering as { scripts: string[] }).scripts, ['Grek']);
  const plain = await checkProject(await collectSource('plain-check', scene(`id:'plain-check'`, 'Plain')), join(folder, 'plain-checks'));
  assert.equal('lettering' in plain, false);
});

test('the video footer of a lettered explainer draws its Greek and still fails on a letter nobody asked for', async () => {
  const project = await collectProject(FIXTURE, { write: false });
  const v = defaultVariant(project);
  const captioned = (caption: string) => ({ ...v.trace, steps: v.trace.steps.map((s) => ({ ...s, meta: { ...s.meta, caption } })) });
  // Its own titles and captions: the cuts hold their letters
  assert.equal((await footerLines(v.trace, v.values))[0]![1]!.join(' '), 'The word λόγος means word.');
  // A Greek letter the explainer never drew is not in the cut, so it fails like any other. The
  // footer reads the engine's record, which names every letter of the string the embedded faces lack.
  await assert.rejects(footerLines(captioned('λέξη'), v.values), /cannot draw: λ έ ξ η/);
  // tools/lib/explain-video.ts reads the engine's record, which a lettered string with a missing letter reaches too
  await assert.rejects(footerLines(captioned('λόγος жук'), v.values), /cannot draw: ж у к/);
  takeMissingGlyphs();
  shaperFor('sans')('λж', 1);
  assert.deepEqual([...takeEmbeddedMissing()], [['λж', 'λж']], 'the engine names all the embedded faces lack');
  shaperFor('sans')('λж', 1);
  assert.deepEqual([...takeMissingGlyphs()], [['λж', 'ж']], 'lettering names only what no face has');
});
