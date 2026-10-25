// Property tests for the tools/lib surfaces the build and `check` stand on:
// caption wrapping, resting-text collisions, the per-diagram snapshot store,
// Counts: test/lib/pbt.ts (FULL=1 is 10x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Text, Group, Rectangle, loadFonts } from '../src/index.ts';
import type { Mobject } from '../src/index.ts';
import { wrapCaption, FOOTER_TEXT_WIDTH } from '../tools/lib/explain-video.ts';
import { restingTextProblems, checkProject } from '../tools/lib/explain-check.ts';
import { readSnapshots, writeSnapshots, snapshotFileName, collectProject, IMPORTER } from '../tools/lib/explain-project.ts';
import { diagramKey } from '../explain/index.ts';
import type { SnapshotStore } from '../explain/index.ts';
import { fc, params } from './lib/pbt.ts';

await loadFonts();

// ---- wrapCaption -----------------------------------------------------------------

const word = fc.oneof(
  fc.stringMatching(/^[A-Za-z0-9,.;'"()-]{1,10}$/),
  fc.string({ unit: 'grapheme', minLength: 1, maxLength: 8 }).map((w) => w.replace(/\s/g, '') || 'x'),
);
const gap = fc.constantFrom(' ', '  ', '\t', '\n', ' \n ', ' ');
const caption = fc
  .tuple(fc.array(fc.tuple(word, gap), { maxLength: 30 }), gap, gap)
  .map(([parts, lead, tail]) => lead + parts.map(([w, g]) => w + g).join('') + tail);
const width = fc.double({ min: 0.5, max: 30, noNaN: true });
const size = fc.double({ min: 0.05, max: 1, noNaN: true });
const words = (text: string) => text.trim().split(/[^\S   ]+/).filter(Boolean);
/** Wrap, or the documented refusal (a word too wide, or more than four lines). */
function wrapped(text: string, w: number, s: number): string[] | null {
  try {
    return wrapCaption(text, w, s);
  } catch (error) {
    assert.match((error as Error).message, /exceeds footer width|four footer lines/);
    return null;
  }
}

test('wrapped caption lines each fit the width', () => {
  fc.assert(
    fc.property(caption, width, size, (text, w, s) => {
      for (const line of wrapped(text, w, s) ?? []) assert.ok(new Text(line, { fontSize: s }).width() <= w, line);
    }),
    params(),
  );
});

test('wrapped caption lines reassemble the words, in order, none lost or split', () => {
  fc.assert(
    fc.property(caption, width, size, (text, w, s) => {
      const lines = wrapped(text, w, s);
      if (lines) assert.deepEqual(lines.join(' ').split(' ').filter(Boolean), words(text).join(' ').split(' ').filter(Boolean));
      if (lines) assert.deepEqual(lines.flatMap((l) => l.split(' ')), words(text));
    }),
    params(),
  );
});

test('wrapping is greedy: no line could have taken the next line’s first word', () => {
  fc.assert(
    fc.property(caption, width, size, (text, w, s) => {
      const lines = wrapped(text, w, s) ?? [];
      for (let i = 0; i + 1 < lines.length; i++)
        assert.ok(new Text(lines[i] + ' ' + lines[i + 1]!.split(' ')[0], { fontSize: s }).width() > w);
    }),
    params(),
  );
});

test('wrapping its own output gives the same lines', () => {
  fc.assert(
    fc.property(caption, width, size, (text, w, s) => {
      const lines = wrapped(text, w, s);
      if (lines) assert.deepEqual(wrapCaption(lines.join(' '), w, s), lines);
    }),
    params(),
  );
});

test('a caption that needs more than four lines is refused', () => {
  fc.assert(
    fc.property(fc.array(word, { minLength: 5, maxLength: 12 }), size, (ws, s) => {
      // Each line can hold only one of these words, so five or more need five lines.
      const widest = Math.max(...ws.map((x) => new Text(x, { fontSize: s }).width()));
      const narrowestPair = Math.min(...ws.slice(1).map((x, i) => new Text(ws[i] + ' ' + x, { fontSize: s }).width()));
      fc.pre(widest > 0 && narrowestPair > widest);
      assert.throws(() => wrapCaption(ws.join(' '), widest, s), /four footer lines/);
    }),
    params(),
  );
});

test('a caption word wider than the line is refused', () => {
  fc.assert(
    fc.property(caption, word, size, (text, long, s) => {
      const w = new Text(long, { fontSize: s }).width() * 0.99;
      fc.pre(w > 0);
      assert.throws(() => wrapCaption(long + ' ' + text, w, s), /exceeds footer width/);
    }),
    params(),
  );
});

test('a width or size that is not positive is refused', () => {
  fc.assert(
    fc.property(caption, fc.constantFrom(NaN, 0, -1, -Infinity), fc.boolean(), (text, bad, which) => {
      assert.throws(() => (which ? wrapCaption(text, bad) : wrapCaption(text, FOOTER_TEXT_WIDTH, bad)), /must be positive/);
    }),
    params(),
  );
});

test('no-break spaces hold their words on one line', () => {
  fc.assert(
    fc.property(caption, fc.array(word, { minLength: 2, maxLength: 3 }), fc.constantFrom(' ', ' ', ' '), width, (text, group, nb, w) => {
      const glued = group.join(nb);
      const lines = wrapped(text + ' ' + glued + ' ' + text, w, 0.25);
      if (lines) assert.ok(lines.some((l) => l.split(' ').includes(glued)), `${JSON.stringify(glued)} split across ${JSON.stringify(lines)}`);
    }),
    params(),
  );
});

test('a wider line never needs more lines', () => {
  fc.assert(
    fc.property(caption, width, width, size, (text, a, b, s) => {
      const [narrow, wide] = [wrapped(text, Math.min(a, b), s), wrapped(text, Math.max(a, b), s)];
      if (narrow && wide) assert.ok(wide.length <= narrow.length);
      if (narrow) assert.ok(wide, 'what fits a narrow line fits a wider one');
    }),
    params(),
  );
});

test('scale probe: wrapCaption on a 200,000-word caption fails fast and cleanly', () => {
  const t = performance.now();
  assert.throws(() => wrapCaption('word '.repeat(200_000), FOOTER_TEXT_WIDTH), /four footer lines/);
  assert.equal(wrapCaption('word '.repeat(20), 1e6).length, 1);
  assert.ok(performance.now() - t < 20_000);
});

// ---- restingTextProblems ---------------------------------------------------------

interface Placed {
  text: string;
  x: number;
  y: number;
  size: number;
  native: boolean;
  hide: 'none' | 'faded' | 'parent' | 'heading' | 'blank' | 'nested' | 'clear';
}
const placedText: fc.Arbitrary<Placed> = fc.record({
  text: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 8 }),
  x: fc.double({ min: -9, max: 9, noNaN: true }),
  y: fc.double({ min: -5, max: 5, noNaN: true }),
  size: fc.double({ min: 0.1, max: 0.6, noNaN: true }),
  native: fc.boolean(),
  hide: fc.constantFrom('none', 'none', 'none', 'faded', 'parent', 'heading', 'blank', 'nested', 'clear'),
});
/** Mobjects for each placed text: a native Text, or a diagram-style labelled path. */
function build(items: Placed[]): Mobject[] {
  return items.map((p) => {
    const label = p.hide === 'blank' ? ' \t' : p.text;
    let m: Mobject = p.native
      ? new Text(label, { fontSize: p.size }).moveTo([p.x, p.y])
      : Object.assign(new Rectangle({ width: p.size * label.length, height: p.size, fill: '#ffffff' }).moveTo([p.x, p.y]), { text: label });
    if (p.hide === 'faded') m.setOpacity(0.3);
    if (p.hide === 'clear') m.setStyle({ fillOpacity: 0, stroke: 'none' });
    if (p.hide === 'heading') m.key = '__heading';
    if (p.hide === 'parent') m = new Group(m).setOpacity(0.2);
    // Inside a blank text-bearing group: the inner text is part of it, and the group shows nothing.
    if (p.hide === 'nested') m = Object.assign(new Group(m), { text: ' ' });
    return m;
  });
}
const sceneOf = (mobs: Mobject[]) => ({ familyMembers: () => mobs.flatMap((m) => m.family()) });
const asSet = (problems: string[]) =>
  new Set(problems.map((p) => (/^(".*") overlaps (".*")$/s.exec(p) ? [...(/^(".*") overlaps (".*")$/s.exec(p)!.slice(1))].sort().join(' overlaps ') : p)));

test('a text listed twice is still one text: duplicates add no problems', () => {
  fc.assert(
    fc.property(fc.array(placedText, { maxLength: 6 }), fc.nat(), (items, k) => {
      const mobs = build(items);
      fc.pre(mobs.length > 0);
      const once = restingTextProblems(sceneOf(mobs));
      const extra = mobs[k % mobs.length]!;
      assert.deepEqual(restingTextProblems({ familyMembers: () => [...sceneOf(mobs).familyMembers(), ...extra.family()] }), once);
    }),
    params(),
  );
});

test('collisions do not depend on the order texts are listed in', () => {
  fc.assert(
    fc.property(fc.array(placedText, { maxLength: 6 }), (items) => {
      const mobs = build(items);
      assert.deepEqual(asSet(restingTextProblems(sceneOf([...mobs].reverse()))), asSet(restingTextProblems(sceneOf(mobs))));
    }),
    params(),
  );
});

test('texts nobody can see, the heading, and text inside text never collide', () => {
  fc.assert(
    fc.property(fc.array(placedText, { maxLength: 5 }), fc.array(placedText.filter((p) => p.hide !== 'none'), { maxLength: 4 }), (shown, hidden) => {
      const visible = build(shown.map((p) => ({ ...p, hide: 'none' as const })));
      assert.deepEqual(restingTextProblems(sceneOf([...visible, ...build(hidden)])), restingTextProblems(sceneOf(visible)));
    }),
    params(),
  );
});

test('two diagram labels never collide with each other', () => {
  fc.assert(
    fc.property(fc.array(placedText.map((p) => ({ ...p, native: false, hide: 'none' as const })), { maxLength: 6 }), (items) => {
      assert.deepEqual(restingTextProblems(sceneOf(build(items))).filter((p) => p.includes('overlaps')), []);
    }),
    params(),
  );
});

test('a native text is cut off exactly when its box leaves the frame', () => {
  fc.assert(
    fc.property(placedText.map((p) => ({ ...p, native: true, hide: 'none' as const })), (p) => {
      fc.pre(p.text.trim() !== '');
      const [m] = build([p]);
      const b = m!.box()!;
      const out = b[0] < -8 || b[1] < -4.5 || b[2] > 8 || b[3] > 4.5;
      assert.equal(restingTextProblems(sceneOf([m!])).some((x) => x.endsWith('is cut off by the frame')), out);
    }),
    params(),
  );
});

test('texts with disjoint boxes never collide, and a text over a copy of itself always does', () => {
  fc.assert(
    fc.property(placedText.map((p) => ({ ...p, native: true, hide: 'none' as const, x: Math.max(-6, Math.min(6, p.x)), y: Math.max(-3, Math.min(3, p.y)) })), fc.double({ min: 0, max: 1, noNaN: true }), (p, d) => {
      const [a] = build([p]),
        [b] = build([p]);
      const w = a!.width();
      fc.pre(p.text.trim() !== '' && w > 0 && a!.height() > 0);
      assert.equal(restingTextProblems(sceneOf([a!, b!])).filter((x) => x.includes('overlaps')).length, 1);
      b!.shift([w * (1 + d) + 1e-6, 0]);
      assert.deepEqual(restingTextProblems(sceneOf([a!, b!])).filter((x) => x.includes('overlaps')), []);
    }),
    params(),
  );
});

// ---- readSnapshots / writeSnapshots ----------------------------------------------

const snapshotValue = fc.jsonValue({ maxDepth: 2 }).map((v) => ({ version: 1, body: v }));
const storeKey = fc.oneof(
  fc.record({ source: fc.string({ maxLength: 10 }), style: fc.constantFrom('nord', 'default', 'blueprint') }).map((s) => diagramKey(s)),
  fc.constantFrom('__proto__', 'constructor', 'index.json', '', '../x', 'toString'),
  fc.string({ unit: 'binary', maxLength: 8 }),
);
const store = fc.dictionary(storeKey, snapshotValue, { maxKeys: 5 }).map((d) => {
  // fc.dictionary sets '__proto__' as an own key already; keep it that way through a copy.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out as unknown as SnapshotStore;
});
async function folder<T>(run: (base: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'lantern-pbt-snapshots-'));
  try {
    return await run(join(dir, 'scene'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const ownEntries = (s: object) => Object.keys(s).sort().map((k) => [k, JSON.stringify((s as Record<string, unknown>)[k])]);
// Filesystem cases each create, write and read a directory: 200 by default (2000 under FULL=1).
const FS = 200;

test('writeSnapshots then readSnapshots gives back the store, any keys included', async () => {
  await fc.assert(
    fc.asyncProperty(store, async (s) =>
      folder(async (base) => {
        await writeSnapshots(base, s, 'h');
        assert.deepEqual(ownEntries(await readSnapshots(base)), ownEntries(s));
      }),
    ),
    params(FS),
  );
});

test('the written folder is index.json plus one file per diagram, whatever was there before', async () => {
  await fc.assert(
    fc.asyncProperty(store, store, fc.array(fc.stringMatching(/^[a-z0-9]{1,8}\.json$/), { maxLength: 3 }), async (first, s, stray) =>
      folder(async (base) => {
        await writeSnapshots(base, first, 'h');
        for (const name of stray) await writeFile(join(base + '.snapshots', name), '{}');
        await mkdir(join(base + '.snapshots', 'kept-folder'), { recursive: true });
        await writeSnapshots(base, s, 'h');
        assert.deepEqual((await readdir(base + '.snapshots')).sort(), ['index.json', 'kept-folder', ...Object.keys(s).map(snapshotFileName)].sort());
      }),
    ),
    params(FS),
  );
});

test('the same store writes the same bytes, in whatever order its keys were added', async () => {
  const written = (st: SnapshotStore) =>
    folder(async (b) => {
      await writeSnapshots(b, st, 'h');
      const names = (await readdir(b + '.snapshots')).sort();
      return Promise.all(names.map(async (n) => [n, await readFile(join(b + '.snapshots', n), 'utf8')]));
    });
  await fc.assert(
    fc.asyncProperty(store, async (s) => {
      const reversed: Record<string, unknown> = {};
      for (const k of Object.keys(s).reverse()) Object.defineProperty(reversed, k, { value: s[k], enumerable: true, writable: true, configurable: true });
      assert.deepEqual(await written(reversed as SnapshotStore), await written(s));
    }),
    params(FS),
  );
});

test('changing one diagram rewrites one file; rewriting the same store rewrites nothing', async () => {
  await fc.assert(
    fc.asyncProperty(store.filter((s) => Object.keys(s).length > 0), fc.nat(), snapshotValue, fc.boolean(), async (s, k, value, same) =>
      folder(async (base) => {
        await writeSnapshots(base, s, 'h');
        const dir = base + '.snapshots';
        const old = new Date(1_000_000);
        for (const n of await readdir(dir)) await utimes(join(dir, n), old, old);
        const key = Object.keys(s)[k % Object.keys(s).length]!;
        const next: Record<string, unknown> = { ...s };
        Object.defineProperty(next, key, { value: same ? s[key] : value, enumerable: true, writable: true, configurable: true });
        const changed = JSON.stringify(s[key]) !== JSON.stringify(next[key]);
        await writeSnapshots(base, next as SnapshotStore, 'h');
        const touched = [];
        for (const n of await readdir(dir)) if ((await stat(join(dir, n))).mtimeMs !== old.getTime()) touched.push(n);
        assert.deepEqual(touched, changed ? [snapshotFileName(key)] : []);
      }),
    ),
    params(FS),
  );
});

test('a damaged or hostile cache index reads as an object holding only what it may', async () => {
  await fc.assert(
    fc.asyncProperty(fc.jsonValue(), fc.string(), async (diagrams, name) =>
      folder(async (base) => {
        await writeFile(join(base, '..', 'outside.json'), JSON.stringify({ secret: true }));
        await mkdir(base + '.snapshots', { recursive: true });
        const index = { version: 2, importer: IMPORTER, diagrams: diagrams && typeof diagrams === 'object' && !Array.isArray(diagrams) ? { ...diagrams, [name]: '../outside.json' } : diagrams };
        await writeFile(join(base + '.snapshots', 'index.json'), JSON.stringify(index));
        const read = await readSnapshots(base);
        assert.ok(read && typeof read === 'object' && !Array.isArray(read));
        assert.ok(!JSON.stringify(read).includes('secret'), 'an index entry cannot reach outside the folder');
      }),
    ),
    params(FS),
  );
});

test('a corrupt diagram file fails the read loudly rather than vanishing from the store', async () => {
  await fc.assert(
    fc.asyncProperty(store.filter((s) => Object.keys(s).length > 0), fc.nat(), fc.string().filter((t) => { try { JSON.parse(t); return false; } catch { return true; } }), async (s, k, junk) =>
      folder(async (base) => {
        await writeSnapshots(base, s, 'h');
        const key = Object.keys(s)[k % Object.keys(s).length]!;
        await writeFile(join(base + '.snapshots', snapshotFileName(key)), junk);
        await assert.rejects(readSnapshots(base), SyntaxError);
      }),
    ),
    params(FS),
  );
});

test('scale probe: a store of 2,000 diagrams writes, rewrites nothing, and reads back', { timeout: 120_000 }, async () => {
  const s: SnapshotStore = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [diagramKey({ source: 'graph ' + i }), { version: 1, i } as never]));
  await folder(async (base) => {
    await writeSnapshots(base, s, 'h');
    await writeSnapshots(base, s, 'h');
    assert.equal(Object.keys(await readSnapshots(base)).length, 2000);
  });
});
