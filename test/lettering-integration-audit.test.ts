import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { takeMissingGlyphs } from '../src/lettering.ts';
import { collectProject, ROOT } from '../tools/lib/explain-project.ts';
import { contactSheet } from '../tools/lib/explain-shots.ts';

const fixture = join(ROOT, 'test/lettering/arabic');
const sourceAt = async (folder: string) => {
  await writeFile(join(folder, 'scene.ts'), await readFile(join(fixture, 'scene.ts'), 'utf8'));
  const snapshot = JSON.parse(await readFile(join(fixture, 'scene.lettering.json'), 'utf8'));
  return snapshot;
};

test('a fresh metadata fingerprint cannot hide damaged cached outline data', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lettering-audit-integrity-'));
  try {
    const snapshot = await sourceAt(folder);
    const run = Object.values(snapshot.runs).find((r: unknown) => (r as { glyphs: unknown[] }).glyphs.length) as { glyphs: { path: unknown[] }[] };
    run.glyphs[0]!.path = [{ tag: 'LineTo', x: 'broken', y: 0 }];
    // Even someone updating the checksum cannot bypass structural checks.
    snapshot.payloadHash = createHash('sha256').update(JSON.stringify({ ...snapshot, payloadHash: undefined })).digest('hex');
    await writeFile(join(folder, 'scene.lettering.json'), JSON.stringify(snapshot));
    await assert.rejects(collectProject(folder, { write: false }), /Invalid lettering snapshot outline/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('editing a contour without changing metadata is caught by the payload checksum', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lettering-audit-checksum-'));
  try {
    const snapshot = await sourceAt(folder);
    const run = Object.values(snapshot.runs).find((r: unknown) => (r as { glyphs: unknown[] }).glyphs.length) as { glyphs: { dx: number }[] };
    run.glyphs[0]!.dx += .1;
    await writeFile(join(folder, 'scene.lettering.json'), JSON.stringify(snapshot));
    await assert.rejects(collectProject(folder, { write: false }), /checksum|payload/i);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('a cached snapshot rejects a glyph cluster one past the source even with fresh fingerprints and checksum', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lettering-audit-cluster-'));
  try {
    const snapshot = await sourceAt(folder);
    const file = join(folder, 'scene.lettering.json');
    await writeFile(file, JSON.stringify(snapshot));
    const control = await collectProject(folder, { write: false });
    assert.ok(control.outlineLettering, 'the unchanged cached snapshot is fresh');
    const [key, run] = Object.entries(snapshot.runs).find(([key, value]) =>
      [...JSON.parse(key)[1]].length > 0 && (value as { glyphs: unknown[] }).glyphs.length > 0,
    )! as [string, { glyphs: { cluster: number }[] }];
    run.glyphs[0]!.cluster = [...JSON.parse(key)[1]].length;
    snapshot.payloadHash = createHash('sha256').update(JSON.stringify({ ...snapshot, payloadHash: undefined })).digest('hex');
    await writeFile(file, JSON.stringify(snapshot));
    await assert.rejects(collectProject(folder, { write: false }), /^Error: Invalid lettering snapshot glyph;/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('numbered contact-sheet titles are captured and drawn with the requested script', { skip: process.env.EXPLAIN_LETTERING !== '1' }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lettering-audit-sheet-'));
  try {
    await writeFile(join(folder, 'scene.ts'), `import{Scene,Text}from'rayner';import{stage}from'rayner/explain';export default class S extends Scene{static meta={id:'sheet',lettering:{scripts:['Arab']}};async construct(){const s=stage(this,{heading:false});await this.step('one',{title:'السَّلَامُ عَلَيْكُمْ',caption:'Arabic'});await s.enter(new Text('السَّلَامُ عَلَيْكُمْ'));}}`);
    const p = await collectProject(folder, { captureLettering: true, write: false });
    const key = JSON.stringify(['sans', '1. السَّلَامُ عَلَيْكُمْ', false]);
    assert.ok(p.outlineLettering?.runs[key]);
    takeMissingGlyphs();
    const output = join(folder, 'sheet.png');
    await contactSheet(p, output);
    assert.deepEqual([...takeMissingGlyphs()], [], 'the numbered title must not silently lose glyphs');
    assert.equal((await readFile(output)).subarray(1, 4).toString(), 'PNG');
  } finally { await rm(folder, { recursive: true, force: true }); }
});
