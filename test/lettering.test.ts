import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Scene, Text, NullSink, toSvgString } from '../src/index.ts';
import { runKey, bindLettering, snapshotProvider } from '../src/lettering.ts';
import type { LetteringSnapshot } from '../src/lettering.ts';
import { collectProject, hash, ROOT } from '../tools/lib/explain-project.ts';
import { buildExplainer } from '../tools/lib/explain-build.ts';
import { checkProject } from '../tools/lib/explain-check.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { launch } from '../tools/lib/browser.ts';

const fixtures = join(ROOT, 'test/lettering');
const ids = ['arabic', 'devanagari', 'math', 'style'] as const;
const snapshot = async (id: string): Promise<LetteringSnapshot> => JSON.parse(await readFile(join(fixtures, id, 'scene.lettering.json'), 'utf8'));

test('all 26 unrequested explainers keep their original page bytes and receipt hashes', async () => {
  const expected = JSON.parse(await readFile(join(fixtures, 'legacy-builds.json'), 'utf8'));
  const out = await mkdtemp(join(tmpdir(), 'lettering-cost-'));
  try {
    assert.equal(EXPLAINERS.length, Object.keys(expected).length);
    for (const { id } of EXPLAINERS) {
      const project = await collectProject(join(ROOT, 'scenes/explainers', id), { write: false });
      const { html, receipt } = await buildExplainer(project, join(out, id + '.html'));
      assert.equal(hash(html), expected[id].page, id + ' page');
      assert.equal(hash(JSON.stringify(receipt, null, 2) + '\n'), expected[id].receipt, id + ' receipt');
      assert.equal(project.lettering, undefined);
    }
  } finally { await rm(out, { recursive: true, force: true }); }
});

for (const id of ids) test(`${id}: fresh snapshots pass seek, motion, bare runtime and readability gates without build-time dependencies`, async () => {
  const out = await mkdtemp(join(tmpdir(), 'lettering-check-'));
  try {
    const project = await collectProject(join(fixtures, id), { write: false });
    const report = await checkProject(project, out);
    assert.ok((report.lettering as { bytes: number }).bytes > 0);
    const { html, receipt } = await buildExplainer(project, join(out, 'page.html'));
    assert.ok(html.includes('<path'));
    assert.ok(receipt.letteringHash);
    assert.ok(!html.includes('function typeset('));
    for (const f of Object.values(project.lettering!.faces)) assert.ok(html.includes(f.license.slice(0, 50).replace(/&/g, '&amp;').replace(/</g, '&lt;')));
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('caption edits invalidate lettering snapshots before drawing; absent runs fail closed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lettering-stale-'));
  try {
    const source = await readFile(join(fixtures, 'arabic/scene.ts'), 'utf8');
    await writeFile(join(dir, 'scene.ts'), source.replace('caption: "Arabic"', 'caption: "Changed caption"'));
    await copyFile(join(fixtures, 'arabic/scene.lettering.json'), join(dir, 'scene.lettering.json'));
    await assert.rejects(collectProject(dir, { write: false }), /stale lettering snapshot/);
    const s = await snapshot('arabic');
    assert.throws(() => snapshotProvider(s).shape('sans', 'مرحبا', 1, () => { throw new Error('fallback bypassed'); }), /no run/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('overlapping requested and ordinary scenes restore fonts, including when a scene throws', async () => {
  const s = await snapshot('arabic');
  const key = Object.keys(s.runs).find((k) => JSON.parse(k)[1].startsWith('الس'))!;
  const text = JSON.parse(key)[1] as string;
  class Arabic extends Scene {
    override async construct() { await Promise.resolve(); this.add(new Text(text)); await this.wait(0.1); }
  }
  class Ordinary extends Scene {
    override async construct() { this.add(new Text('ordinary')); await this.wait(0.1); }
  }
  const Bound = bindLettering(Arabic, s);
  const alone = await new Bound(new NullSink()).run();
  const [a, b] = await Promise.all([new Bound(new NullSink()).run(), new Ordinary(new NullSink()).run()]);
  assert.equal(toSvgString(a), toSvgString(alone));
  assert.equal(toSvgString(b), toSvgString(await new Ordinary(new NullSink()).run()));
  class Broken extends Scene { override async construct() { throw new Error('intentional'); } }
  await assert.rejects(new (bindLettering(Broken, s))(new NullSink()).run(), /intentional/);
  assert.equal(toSvgString(b), toSvgString(await new Ordinary(new NullSink()).run()));
});

const capture = process.env.EXPLAIN_LETTERING === '1';
for (const [id, face, text] of [
  ['arabic', 'fontsource-noto-naskh-arabic-5.3.0/package/files/noto-naskh-arabic-arabic-400-normal.woff2', 'السَّلَامُ عَلَيْكُمْ'],
  ['devanagari', 'fontsource-noto-sans-devanagari-5.3.0/package/files/noto-sans-devanagari-devanagari-400-normal.woff2', 'नमस्ते दुनिया'],
] as const) test(`${id}: stored glyph IDs, clusters, advances and offsets agree with independent HarfBuzz`, { skip: !capture && 'set EXPLAIN_LETTERING=1 for the build-time oracle' }, async () => {
  const s = await snapshot(id);
  const expected = JSON.parse(execFileSync(process.env.RAYNER_LETTERING_PYTHON ?? 'python3', [join(fixtures, 'oracle.py'), join(process.env.RAYNER_LETTERING_FONTS ?? join(ROOT, 'out/lettering-fonts'), face), text], { encoding: 'utf8' }));
  const actual = s.runs[runKey('sans', text)]!.glyphs.map(({ gid, cluster, x, dx, dy, ax }) => ({ gid, cluster, x, dx, dy, ax }));
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) for (const k of ['gid', 'cluster', 'x', 'dx', 'dy', 'ax'] as const)
    assert.ok(Math.abs(actual[i]![k] - expected[i][k]) < 1e-12, `${i}.${k}: ${actual[i]![k]} vs ${expected[i][k]}`);
});

test('math: fraction rules and script scales are stored; symbol glyphs agree with HarfBuzz', { skip: !capture && 'set EXPLAIN_LETTERING=1 for the build-time oracle' }, async () => {
  const s = await snapshot('math');
  const glyphs = s.runs[runKey('math', '\\frac{1}{2}+x^2')]!.glyphs;
  const expected = JSON.parse(execFileSync(process.env.RAYNER_LETTERING_PYTHON ?? 'python3', [join(fixtures, 'oracle.py'), process.env.RAYNER_MATH_FONT ?? '/usr/share/texmf/fonts/opentype/public/lm-math/latinmodern-math.otf', '12+𝑥'], { encoding: 'utf8' }));
  for (const g of expected) assert.ok(glyphs.some((p) => p.gid === g.gid));
  assert.ok(glyphs.some((p) => p.gid === -1 && p.path.length === 5), 'fraction bar');
  assert.ok(new Set(glyphs.filter((p) => p.gid >= 0).map((p) => p.s)).size > 1, 'superscript scales');
});

test('capture rejects an unrequested script and a Math object without opt-in', { skip: !capture && 'set EXPLAIN_LETTERING=1 to refresh snapshots' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lettering-closed-'));
  try {
    const source = await readFile(join(fixtures, 'arabic/scene.ts'), 'utf8');
    await writeFile(join(dir, 'scene.ts'), source.replace("scripts:['Arab']", "scripts:['Deva']"));
    await assert.rejects(collectProject(dir, { captureLettering: true, write: false }), /Script not requested/);
    const math = await readFile(join(fixtures, 'math/scene.ts'), 'utf8');
    await writeFile(join(dir, 'scene.ts'), math.replace('lettering: {math:true}', 'lettering: {math:false}'));
    await assert.rejects(collectProject(dir, { captureLettering: true, write: false }), /Math requires/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('snapshot refresh is deterministic, including font subsets', { skip: !capture && 'set EXPLAIN_LETTERING=1 to refresh snapshots' }, async () => {
  const project = await collectProject(join(fixtures, 'arabic'), { captureLettering: true, write: false });
  assert.deepEqual(project.lettering, await snapshot('arabic'));
});

test('requested pages run offline in Chromium without errors or network requests', { skip: process.env.EXPLAIN_BROWSER !== '1' && 'set EXPLAIN_BROWSER=1 for browser playback' }, async () => {
  const browser = await launch();
  const dir = await mkdtemp(join(tmpdir(), 'lettering-browser-'));
  try {
    for (const id of ids) {
      const project = await collectProject(join(fixtures, id), { write: false });
      const { html } = await buildExplainer(project, join(dir, id + '.html'));
      const page = await browser.newPage();
      const errors: string[] = [];
      const network: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/*', (r) => { network.push(r.request().url()); return r.abort(); });
      await page.setContent(html);
      await page.waitForSelector('#content[data-ready=true]');
      assert.deepEqual(errors, [], id);
      assert.deepEqual(network, [], id);
      assert.ok(await page.locator('.stage path').count() > 0);
      await page.close();
    }
  } finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }
});
