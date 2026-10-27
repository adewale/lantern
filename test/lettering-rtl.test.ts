// Right-to-left and bidi lettering, and morphs by cluster. Bidi is resolved once, at build time,
// with the shaping (tools/lettering.py); the page and the video draw the stored runs. These
// tests hold the stored runs to the Unicode Bidi Algorithm's visual order, the footer and page
// to the paragraph's direction, and TransformMatchingText to pairing whole clusters.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Scene, NullSink, loadFonts } from '../src/index.ts';
import { runKey, withSceneLettering } from '../src/lettering-outlines.ts';
import type { LetteringSnapshot } from '../src/lettering-outlines.ts';
import { collectProject, defaultVariant, ROOT } from '../tools/lib/explain-project.ts';
import { buildExplainer } from '../tools/lib/explain-build.ts';
import { footerLines, footerParagraph, footerText, rightToLeft, FOOTER_TEXT_WIDTH } from '../tools/lib/explain-video.ts';

const folder = await mkdtemp(join(tmpdir(), 'rayner-lettering-rtl-'));
after(() => rm(folder, { recursive: true, force: true }));
const stored = async (id: string): Promise<LetteringSnapshot> =>
  JSON.parse(await readFile(join(ROOT, 'test/lettering', id, 'scene.lettering.json'), 'utf8'));
/** A stored run's source clusters, left to right on the page. */
const visual = (s: LetteringSnapshot, text: string) =>
  [...s.runs[runKey('sans', text)]!.glyphs].sort((a, b) => a.x - b.x || a.cluster - b.cluster).map((g) => g.cluster);
const indexOf = (text: string, part: string) => [...text.slice(0, text.indexOf(part))].length;

test('a right-to-left paragraph runs right to left; a Latin word and a number in it keep their own order', async () => {
  const s = await stored('hebrew');
  // Pure Hebrew: the first letter is rightmost, and clusters fall from right to left
  const word = 'שָׁלוֹם';
  const order = visual(s, word);
  assert.equal(order.at(-1), 0, 'the first letter is rightmost');
  assert.deepEqual(order, [...order].sort((a, b) => b - a), 'logical order runs right to left');
  // An RTL paragraph (first strong letter Hebrew): "Rayner" and "2.0" read left to right inside it,
  // "Rayner" sits left of the Hebrew before it, and the paragraph's first word is rightmost
  const mixed = 'גרסה 2.0 של Rayner (בטא)';
  const v = visual(s, mixed);
  const at = (part: string) => [...part].map((_, i) => v.indexOf(indexOf(mixed, part) + i));
  for (const part of ['Rayner', '2.0']) {
    const positions = at(part);
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${part} reads left to right`);
  }
  assert.ok(Math.max(...at('Rayner')) < Math.min(...at('של')), 'Rayner is left of the Hebrew word before it');
  assert.ok(Math.min(...at('גרסה')) > Math.max(...at('של')), 'the first word is rightmost');
  // An LTR paragraph (first strong letter Latin) puts Rayner first, at the left
  const ltr = 'Rayner גרסה 2.0';
  const w = visual(s, ltr);
  assert.deepEqual(w.slice(0, 6), [0, 1, 2, 3, 4, 5]);
  // UAX #9 rule N1: the space and "2.0" after Hebrew join its right-to-left run, so 2.0 sits left of גרסה
  assert.ok(w.indexOf(indexOf(ltr, '2.0')) < w.indexOf(indexOf(ltr, 'גרסה')));
});

test('a right-to-left title or caption: its footer lines lead with RLM and end at the right edge of the text column', async () => {
  assert.equal(rightToLeft('שלום world'), true);
  assert.equal(rightToLeft('2026: שלום'), true, 'digits and punctuation are not strong');
  assert.equal(rightToLeft('Rayner גרסה'), false);
  await loadFonts();
  assert.deepEqual(footerParagraph('Plain caption'), ['Plain caption'], 'a left-to-right paragraph is as it was');
  const project = await collectProject(join(ROOT, 'test/lettering/hebrew'), { write: false });
  const v = defaultVariant(project);
  const lines = await withSceneLettering(v.Scene, () => footerLines(v.trace, v.values));
  const caption = lines[1]![1]!;
  assert.equal(caption.length, 2, 'the mixed caption wraps');
  for (const line of caption) assert.ok(line.startsWith('\u200f'), JSON.stringify(line));
  // The second line starts with a Latin word. Alone it would read left to right; led by RLM it
  // keeps the paragraph's direction, so Rayner, its first word, is drawn at the right end
  const second = caption[1]!;
  assert.ok(second.startsWith('\u200fRayner'));
  const order = visual(await stored('hebrew'), second);
  const rayner = [...'Rayner'].map((_, i) => order.indexOf(1 + i));
  assert.deepEqual(rayner, [...rayner].sort((a, b) => a - b), 'Rayner itself reads left to right');
  assert.ok(Math.min(...rayner) > order.indexOf(indexOf(second, 'בשורה')), 'Rayner is right of the Hebrew that follows it');
  // Drawn as the footer draws them, from the stored runs: right-aligned, and a Latin line left-aligned
  await withSceneLettering(v.Scene, async () => {
    const scene = new Scene(new NullSink());
    const [rtl, ltr] = [footerText(scene, caption, '#000'), footerText(scene, ['Plain caption'], '#000')];
    for (const t of rtl) assert.ok(Math.abs(t.box()![2] - FOOTER_TEXT_WIDTH / 2) < 1e-6, `${t.text} ends at the right edge`);
    assert.ok(Math.abs(ltr[0]!.box()![0] + FOOTER_TEXT_WIDTH / 2) < 1e-6, 'a left-to-right line starts at the left edge');
  });
});

test('a page that asks for a right-to-left script sets each caption\'s direction from its text; others are as they were', async () => {
  const hebrew = await buildExplainer(await collectProject(join(ROOT, 'test/lettering/hebrew'), { write: false }), join(folder, 'hebrew.html'));
  assert.match(hebrew.html, /\.caption,[^{]*\{unicode-bidi:plaintext;text-align:start\}/);
  const devanagari = await buildExplainer(await collectProject(join(ROOT, 'test/lettering/devanagari'), { write: false }), join(folder, 'devanagari.html'));
  assert.doesNotMatch(devanagari.html, /unicode-bidi:plaintext/);
});

test('TransformMatchingText pairs whole clusters: a conjunct that replaces a letter fades, kept clusters morph', async () => {
  const project = await collectProject(join(ROOT, 'test/lettering/matching'), { write: false });
  const steps = defaultVariant(project).trace.steps;
  const match = (name: string) => {
    const e = steps.find((s) => s.step === name)!.evidence!.find((r) => r.kind === 'match')!;
    return { matched: e.matched, morphed: e.morphed, removed: e.removed, added: e.added };
  };
  // नम -> नमस्ते: न and म stay; स्ते (a conjunct cluster) arrives
  assert.deepEqual(match('grow'), { matched: 2, morphed: 0, removed: 0, added: 3 });
  // क -> क्ष: the cluster that starts with क is now a conjunct drawn by another glyph, so it fades
  // (pairing by the character at the cluster's start would have morphed क into the conjunct)
  assert.deepEqual(match('conjunct'), { matched: 0, morphed: 0, removed: 1, added: 1 });
  // سلم -> سلام: each letter keeps its cluster and one glyph, though its joining form changes
  assert.deepEqual(match('joining'), { matched: 3, morphed: 0, removed: 0, added: 1 });
});

const capture = process.env.EXPLAIN_LETTERING === '1';
test('hebrew: stored glyph IDs, clusters, advances and offsets agree with independent HarfBuzz', { skip: !capture && 'set EXPLAIN_LETTERING=1 for the build-time oracle' }, async () => {
  const s = await stored('hebrew');
  const fonts = process.env.RAYNER_LETTERING_FONTS ?? join(ROOT, 'out/lettering-fonts');
  for (const text of ['שָׁלוֹם עוֹלָם', 'אותיות']) {
    const expected = JSON.parse(execFileSync(process.env.RAYNER_LETTERING_PYTHON ?? 'python3', [join(ROOT, 'test/lettering/oracle.py'),
      join(fonts, 'fontsource-noto-sans-hebrew-5.3.0/package/files/noto-sans-hebrew-hebrew-400-normal.woff2'), text], { encoding: 'utf8' }));
    const actual = s.runs[runKey('sans', text)]!.glyphs;
    assert.equal(actual.length, expected.length, text);
    for (let i = 0; i < actual.length; i++) for (const k of ['gid', 'cluster', 'x', 'dx', 'dy', 'ax'] as const)
      assert.ok(Math.abs(actual[i]![k] - expected[i][k]) < 1e-12, `${text} ${i}.${k}: ${actual[i]![k]} vs ${expected[i][k]}`);
  }
});

test('capture of the Hebrew and matching fixtures is deterministic', { skip: !capture && 'set EXPLAIN_LETTERING=1 to capture' }, async () => {
  for (const id of ['hebrew', 'matching']) {
    const project = await collectProject(join(ROOT, 'test/lettering', id), { captureLettering: true, write: false });
    assert.deepEqual(project.outlineLettering, await stored(id), id);
  }
});
