// Property tests for explain/panels.ts: matchLines, CodeBlock and Card.
// Scenes use a NullSink and skip every frame, so a play costs its begin and
// finish only. Counts: test/lib/pbt.ts (FULL=1 is 10x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, Text, loadFonts } from '../src/index.ts';
import type { Box, Vec } from '../src/index.ts';
import { Card, CodeBlock, matchLines } from '../explain/panels.ts';
import { REGIONS, emphasis } from '../explain/look.ts';
import type { Region } from '../explain/look.ts';
import { fc, params } from './lib/pbt.ts';
import { hexColor } from './lib/random-snapshot.ts';

await loadFonts();

// Points are float32: at stage magnitudes (up to 16) one unit in the last place is about 1e-6.
const EPS = 1e-5;
const scene = () => new Scene(new NullSink(), { skipUntil: Infinity });
const palette = fc.record({ paper: hexColor, ink: hexColor, accent: hexColor, muted: hexColor });
/** Lines: a tiny alphabet (so many lines repeat), empty lines, near-duplicates and any text. */
const line = fc.oneof(
  fc.constantFrom('a', 'b', 'c', '', 'a ', 'x = 1;', 'é', 'é'),
  fc.string({ unit: 'grapheme', maxLength: 24 }),
  fc.string({ unit: 'binary', maxLength: 8 }),
);
const lines = (min = 0) => fc.array(line, { minLength: min, maxLength: 10 });
const region = fc.constantFrom(...(Object.keys(REGIONS) as Region[]));
const box: fc.Arbitrary<Box> = fc
  .tuple(
    fc.double({ min: -8, max: 7, noNaN: true }),
    fc.double({ min: -4.5, max: 4, noNaN: true }),
    fc.double({ min: 0, max: 16, noNaN: true }),
    fc.double({ min: 0, max: 9, noNaN: true }),
  )
  .map(([x, y, w, h]): Box => [x, y, x + w, y + h]);
const point: fc.Arbitrary<Vec> = fc.tuple(fc.double({ min: -7, max: 7, noNaN: true }), fc.double({ min: -4, max: 4, noNaN: true }));
const regionOf = (at: Box | Region): Box => (typeof at === 'string' ? [...REGIONS[at]] : at);
const inside = (b: Box, r: Box) => b[0] >= r[0] - EPS && b[1] >= r[1] - EPS && b[2] <= r[2] + EPS && b[3] <= r[3] + EPS;

/** An independent LCS length: the classic forward DP. */
function lcs(a: readonly string[], b: readonly string[]): number {
  const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      t[i]![j] = a[i - 1] === b[j - 1] ? t[i - 1]![j - 1]! + 1 : Math.max(t[i - 1]![j]!, t[i]![j - 1]!);
  return t[a.length]![b.length]!;
}

// ---- matchLines --------------------------------------------------------------

test('matchLines pairs only equal lines, at valid indices', () => {
  fc.assert(
    fc.property(lines(), lines(), (a, b) => {
      for (const [j, i] of matchLines(a, b)) {
        assert.ok(Number.isInteger(j) && j >= 0 && j < b.length && Number.isInteger(i) && i >= 0 && i < a.length);
        assert.equal(a[i], b[j]);
      }
    }),
    params(),
  );
});

test('matchLines pairs form a subsequence: increasing in both lines', () => {
  fc.assert(
    fc.property(lines(), lines(), (a, b) => {
      const pairs = [...matchLines(a, b)].sort((x, y) => x[0] - y[0]);
      for (let k = 1; k < pairs.length; k++) assert.ok(pairs[k]![1] > pairs[k - 1]![1], JSON.stringify(pairs));
    }),
    params(),
  );
});

test('matchLines finds a longest common subsequence', () => {
  fc.assert(
    fc.property(lines(), lines(), (a, b) => assert.equal(matchLines(a, b).size, lcs(a, b))),
    params(),
  );
});

test('matchLines of a list with itself is the identity', () => {
  fc.assert(
    fc.property(lines(), (a) => assert.deepEqual([...matchLines(a, a)], a.map((_, i) => [i, i]))),
    params(),
  );
});

test('matchLines with an empty side pairs nothing', () => {
  fc.assert(
    fc.property(lines(), (a) => {
      assert.equal(matchLines([], a).size, 0);
      assert.equal(matchLines(a, []).size, 0);
    }),
    params(),
  );
});

test('matchLines pairs as many lines either way round', () => {
  fc.assert(
    fc.property(lines(), lines(), (a, b) => assert.equal(matchLines(a, b).size, matchLines(b, a).size)),
    params(),
  );
});

test('scale probe: matchLines on 3000 x 3000 lines', () => {
  const a = Array.from({ length: 3000 }, (_, i) => `line ${i % 97}`),
    b = Array.from({ length: 3000 }, (_, i) => `line ${(i * 7) % 97}`);
  const t = performance.now();
  const m = matchLines(a, b);
  assert.ok(m.size > 0 && m.size <= 3000);
  assert.ok(performance.now() - t < 10_000);
});

// ---- CodeBlock -----------------------------------------------------------------

const placed = fc.oneof(region, box.filter((b) => b[2] - b[0] > 0.7));
/** A code block, unless refused for want of room: then that must be the documented refusal, and true. */
function code(colors: Of<typeof palette>, text: string[], opts: Record<string, unknown>): CodeBlock {
  try {
    return new CodeBlock(scene(), colors, text, opts);
  } catch (error) {
    assert.match((error as Error).message, /no room for code/);
    const at = opts.at as Box;
    assert.ok(at[2] - at[0] - 0.7 < ((opts.fontSize as number) ?? 0.25));
    fc.pre(false);
    throw error;
  }
}
/** CodeBlock's other knobs: font size and an optional title. */
const knobs = fc.record({ fontSize: fc.double({ min: 0.08, max: 0.5, noNaN: true }), title: fc.option(fc.string({ maxLength: 16 }), { nil: undefined }) }, { requiredKeys: [] });

test('a code block placed in a box fits its width and never rises above its top', () => {
  fc.assert(
    fc.property(palette, lines(1), placed, fc.constantFrom('center' as const, 'top' as const), knobs, (colors, text, at, align, k) => {
      const block = code(colors, text, { at, align, ...k });
      const b = block.panel.box()!,
        r = regionOf(at);
      assert.ok(b[0] >= r[0] - EPS && b[2] <= r[2] + EPS, `${b} wider than ${r}`);
      assert.ok(b[3] <= r[3] + EPS, `${b} above ${r}`);
      if (align === 'top') assert.ok(Math.abs(b[3] - r[3]) < EPS);
    }),
    params(),
  );
});

test('a code block refuses a box too narrow for code', () => {
  fc.assert(
    fc.property(palette, lines(1), box, fc.double({ min: 0.08, max: 0.5, noNaN: true }), (colors, code, at, fontSize) => {
      fc.pre(at[2] - at[0] - 0.7 < fontSize);
      assert.throws(() => new CodeBlock(scene(), colors, code, { at, fontSize }), /no room for code/);
    }),
    params(),
  );
});

test('a code block refuses empty code, and so does morph', async () => {
  await fc.assert(
    fc.asyncProperty(palette, lines(1), fc.option(placed, { nil: undefined }), async (colors, text, at) => {
      assert.throws(() => new CodeBlock(scene(), colors, [], at ? { at } : {}), /at least one line|no room for code/);
      await assert.rejects(code(colors, text, at ? { at } : {}).morph([]), /at least one line/);
    }),
    params(),
  );
});

test('focus puts the bar over exactly the chosen lines, inside the block', async () => {
  await fc.assert(
    fc.asyncProperty(
      palette,
      lines(1).chain((code) =>
        fc.tuple(fc.constant(code), fc.nat({ max: code.length - 1 }), fc.nat({ max: code.length - 1 })),
      ),
      fc.option(placed, { nil: undefined }),
      async (colors, [text, x, y], at) => {
        const block = code(colors, text, at ? { at } : {});
        const [a, b] = [Math.min(x, y), Math.max(x, y)];
        await block.focus(a === b ? a : [a, b]);
        const bar = block.bar.box()!;
        const row = (i: number) => block.code.lines[i]!.anchorPoint()[1];
        for (let i = 0; i < text.length; i++) {
          const on = row(i) > bar[1] && row(i) < bar[3];
          assert.equal(on, i >= a && i <= b, `line ${i} vs bar over ${a}..${b}`);
        }
        assert.equal(block.bar.parent, block);
        assert.equal(block.bar.style.opacity, 1);
      },
    ),
    params(),
  );
});

test('focus rejects any line that is not an index into the code, with the documented error', async () => {
  await fc.assert(
    fc.asyncProperty(
      palette,
      lines(1),
      fc.oneof(
        fc.double().filter((n) => !Number.isInteger(n)),
        fc.integer({ max: -1 }),
        fc.integer({ min: 10, max: 1e6 }),
        fc.tuple(fc.integer({ min: -3, max: 12 }), fc.integer({ min: -3, max: 12 })),
      ),
      async (colors, code, bad) => {
        const [a, b] = typeof bad === 'number' ? [bad, bad] : bad;
        fc.pre(!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b < code.length && a <= b));
        const block = new CodeBlock(scene(), colors, code);
        await assert.rejects(block.focus(bad as number), /No code lines/);
      },
    ),
    params(),
  );
});

const morphCase = fc.record({
  colors: palette,
  before: lines(1),
  after: lines(1),
  at: fc.option(placed, { nil: undefined }),
  markAdded: fc.boolean(),
  focus: fc.option(fc.nat(), { nil: undefined }),
  knobs,
});
type Of<A> = A extends fc.Arbitrary<infer T> ? T : never;
async function morphed({ colors, before, after, at, markAdded, focus, knobs: k }: Of<typeof morphCase>) {
  const block = code(colors, before, { ...(at ? { at } : {}), ...k });
  const s = block.scene;
  s.add(block);
  if (focus != null) await block.focus(focus % before.length);
  const old = [...block.code.lines];
  const top = block.panel.box()![3],
    centre = block.panel.center()[0];
  await block.morph(after, { markAdded });
  return { s, block, old, top, centre };
}

test('morph turns the code into the next lines, keeping each surviving line object', async () => {
  await fc.assert(
    fc.asyncProperty(morphCase, async (c) => {
      const { block, old } = await morphed(c);
      // Code shows tabs expanded; the morphed block shows `after` exactly as a fresh block would.
      const shown = (code: string[]) => new CodeBlock(scene(), c.colors, code).code.lines.map((l) => l.text);
      const [a, b] = [shown(c.before), shown(c.after)];
      assert.deepEqual(block.code.lines.map((l) => l.text), b);
      for (const [j, i] of matchLines(a, b)) assert.equal(block.code.lines[j], old[i], `line ${j}`);
      assert.equal(block.marks.length, c.markAdded ? b.length - matchLines(a, b).size : 0);
    }),
    params(300),
  );
});

test('morph leaves no departed line on stage', async () => {
  await fc.assert(
    fc.asyncProperty(morphCase, async (c) => {
      const { s, block, old } = await morphed(c);
      const present = new Set(s.familyMembers());
      const kept = new Set(block.code.lines);
      assert.deepEqual(old.filter((l) => !kept.has(l) && present.has(l)).map((l) => l.text), []);
      const shown = s.familyMembers().filter((m): m is Text => m instanceof Text && m.parent === block.code);
      assert.deepEqual(shown, block.code.lines);
    }),
    params(300),
  );
});

test('a morphed block stays inside the region it was placed in', async () => {
  await fc.assert(
    fc.asyncProperty(morphCase.filter((c) => c.at != null), async (c) => {
      const r = regionOf(c.at!);
      // A region shorter than the morphed block bounds only its width (see the next property).
      const natural = code(c.colors, c.after, c.knobs).panel.box()!;
      fc.pre(r[3] - r[1] >= natural[3] - natural[1]);
      const { block } = await morphed(c);
      const b = block.panel.box()!;
      assert.ok(inside([b[0], Math.max(b[1], r[1]), b[2], b[3]], r) && b[1] >= r[1] - EPS, `${b} outside ${r}`);
    }),
    params(300),
  );
});

test('a morphed block stays within its region\'s width and on stage, whatever the region', async () => {
  await fc.assert(
    fc.asyncProperty(morphCase, async (c) => {
      const { block } = await morphed(c);
      const b = block.panel.box()!,
        r = regionOf(c.at ?? 'full');
      assert.ok(b[0] >= r[0] - EPS && b[2] <= r[2] + EPS, `${b} outside ${r} horizontally`);
      assert.ok(b.every(Number.isFinite));
    }),
    params(300),
  );
});

test('a morphed block keeps its top and centre unless its region made it move', async () => {
  await fc.assert(
    fc.asyncProperty(morphCase, async (c) => {
      const { block, top, centre } = await morphed(c);
      const b = block.panel.box()!,
        placed = regionOf(c.at ?? 'full');
      // Vertically the bound is the region, or the stage for a region shorter than a line.
      const r: Box = placed[3] - placed[1] >= 1 ? placed : [placed[0], REGIONS.full[1], placed[2], REGIONS.full[3]];
      if (b[1] > r[1] + EPS) assert.ok(Math.abs(b[3] - top) < EPS, `top ${top} -> ${b[3]}`);
      if (b[0] > r[0] + EPS && b[2] < r[2] - EPS) assert.ok(Math.abs(block.panel.center()[0] - centre) < EPS, 'centre moved');
    }),
    params(300),
  );
});

test('after morph, focus works as on a fresh block: the bar is the block’s, over the line', async () => {
  await fc.assert(
    fc.asyncProperty(morphCase, fc.nat(), async (c, k) => {
      const { block } = await morphed(c);
      const i = k % c.after.length;
      await block.focus(i);
      assert.equal(block.bar.parent, block, 'the focus bar still belongs to the block');
      const bar = block.bar.box()!,
        y = block.code.lines[i]!.anchorPoint()[1];
      assert.ok(y > bar[1] && y < bar[3]);
      assert.ok(block.children.indexOf(block.bar) < block.children.indexOf(block.code), 'the bar draws behind the code');
    }),
    params(300),
  );
});

test('diff marks one bar per +/- line, green for added and red for removed', () => {
  fc.assert(
    fc.property(palette, fc.array(fc.oneof(line, line.map((l) => '+ ' + l), line.map((l) => '- ' + l)), { minLength: 1, maxLength: 10 }), (colors, code) => {
      const block = new CodeBlock(scene(), colors, code, { diff: true });
      const marked = code.filter((l) => /^[+-] /.test(l));
      assert.deepEqual(block.marks.map((m) => m.kind), marked.map((l) => (l[0] === '+' ? 'added' : 'removed')));
      // A solid gutter edge marks the line by shape, not only by its tint.
      for (const m of block.marks) assert.equal(m.mob.children.length, 2);
    }),
    params(),
  );
});

test('clearMarks removes every mark from the block', async () => {
  await fc.assert(
    fc.asyncProperty(palette, fc.array(line.map((l) => '+ ' + l), { minLength: 1, maxLength: 6 }), async (colors, code) => {
      const s = scene();
      const block = new CodeBlock(s, colors, code, { diff: true });
      s.add(block);
      const marks = [...block.marks];
      await block.clearMarks();
      assert.equal(block.marks.length, 0);
      assert.ok(marks.every((m) => !block.children.includes(m.mob)));
    }),
    params(),
  );
});

// ---- Card ----------------------------------------------------------------------

const label = fc.oneof(fc.string({ unit: 'grapheme', minLength: 1, maxLength: 40 }), fc.constantFrom('__proto__', 'constructor', 'toString', 'A long label here'));
const value = fc.oneof(fc.string({ unit: 'grapheme', maxLength: 40 }), fc.integer(), fc.double(), fc.constantFrom(null, undefined, -0, NaN, ''));
const rows = fc.uniqueArray(fc.tuple(label, value), { minLength: 1, maxLength: 6, selector: ([l]) => l });
const cardAt = fc.oneof(region, box, point);
const cardCase = fc.record({
  colors: palette,
  rows,
  at: fc.option(cardAt, { nil: undefined }),
  width: fc.option(fc.double({ min: 1.2, max: 12, noNaN: true }), { nil: undefined }),
  title: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
  align: fc.constantFrom('center' as const, 'top' as const),
  fontSize: fc.option(fc.double({ min: 0.08, max: 0.5, noNaN: true }), { nil: undefined }),
});
const card = (c: Of<typeof cardCase>) => {
  const s = scene();
  const k = new Card(s, c.colors, c.rows, { ...(c.at ? { at: c.at } : {}), ...(c.width != null ? { width: c.width } : {}), ...(c.title ? { title: c.title } : {}), ...(c.fontSize != null ? { fontSize: c.fontSize } : {}), align: c.align });
  s.add(k);
  return { s, k };
};
/** The card, or null when it is refused as too narrow (the documented refusal; anything else throws). */
function tryCard(c: Of<typeof cardCase>) {
  try {
    return card(c);
  } catch (error) {
    assert.match((error as Error).message, /no room for its rows/);
    return null;
  }
}
/** Every label and value lies inside the panel horizontally, and no value extends right of its edge. */
function rowsInside(k: Card) {
  const p = k.panel.box()!;
  for (const t of [...k.labels.values(), ...k.values.values()]) {
    const b = t.box();
    if (!b) continue;
    assert.ok(b[0] >= p[0] - EPS && b[2] <= p[2] + EPS, `"${t.text}" ${b} outside panel ${p}`);
  }
  for (const v of k.values.values()) {
    const b = v.box();
    if (b) assert.ok(b[2] <= p[2] - 0.28 + EPS, `value "${v.text}" past its right edge`);
  }
}

test('a card in a box is no wider than the box and never rises above its top', () => {
  fc.assert(
    fc.property(cardCase.filter((c) => !!c.at && (c.at as unknown[]).length !== 2), (c) => {
      const made = tryCard(c);
      if (!made) return;
      const b = made.k.panel.box()!,
        r = regionOf(c.at as Box | Region);
      assert.ok(b[2] - b[0] <= r[2] - r[0] + EPS);
      assert.ok(b[3] <= r[3] + EPS);
      if (c.align === 'top') assert.ok(Math.abs(b[3] - r[3]) < EPS);
    }),
    params(),
  );
});

test('a card at a point is centred on it', () => {
  fc.assert(
    fc.property(cardCase, point, (c, at) => {
      const made = tryCard({ ...c, at });
      if (!made) return;
      const { k } = made;
      const [x, y] = k.panel.center();
      assert.ok(Math.abs(x - at[0]) < EPS && Math.abs(y - at[1]) < EPS);
    }),
    params(),
  );
});

test('every label and value fits inside its card, never mirrored', () => {
  fc.assert(
    fc.property(cardCase, (c) => {
      const made = tryCard(c);
      if (!made) return;
      rowsInside(made.k);
    }),
    params(),
  );
});

test('a card too narrow for any row is refused', () => {
  // Too narrow: less than the padding, the label gap and one glyph's width (2 x 0.28 + 2.5 x size).
  fc.assert(
    fc.property(cardCase, fc.double({ min: 0, max: 1, noNaN: true }), (c, f) => {
      const size = c.fontSize ?? 0.24;
      const width = f * (0.56 + 2.5 * size) * (1 - 1e-9);
      assert.throws(() => card({ ...c, width, at: undefined }), /no room for its rows/);
    }),
    params(),
  );
});

test('a repeated row label draws every row, but set and mark refuse it as ambiguous', async () => {
  await fc.assert(
    fc.asyncProperty(palette, rows, fc.nat(), value, fc.boolean(), async (colors, r, k, v, viaMark) => {
      const label = r[k % r.length]![0];
      const dup = [...r, [label, v] as const];
      const s = scene();
      const card = new Card(s, colors, dup, { width: 12 });
      assert.equal(card.family().filter((m) => m instanceof Text && m.parent === card).length, 2 * dup.length);
      await assert.rejects(viaMark ? card.mark(label) : card.set(Object.fromEntries([[label, 'x']])), /not unique/);
    }),
    params(),
  );
});

const changesFor = (r: readonly (readonly [string, unknown])[]) =>
  fc.subarray(r.map(([l]) => l)).chain((ls) => fc.tuple(...ls.map(() => value)).map((vs) => Object.fromEntries(ls.map((l, i) => [l, vs[i]]))));

test('set shows each new value and leaves unchanged rows alone', async () => {
  await fc.assert(
    fc.asyncProperty(cardCase.chain((c) => fc.tuple(fc.constant(c), changesFor(c.rows))), async ([c, changes]) => {
      const made = tryCard(c);
      if (!made) return;
      const { s, k } = made;
      const before = new Map([...k.values].map(([l, t]) => [l, t]));
      await k.set(changes);
      for (const [l] of c.rows) {
        const expected = Object.hasOwn(changes, l) ? String(changes[l]) : before.get(l)!.text;
        assert.equal(k.values.get(l)!.text, expected);
        if (before.get(l)!.text === expected) assert.equal(k.values.get(l), before.get(l), `${l} did not move`);
      }
      void s;
    }),
    params(300),
  );
});

test('after set, each row shows exactly one value, inside the card', async () => {
  await fc.assert(
    fc.asyncProperty(cardCase.chain((c) => fc.tuple(fc.constant(c), changesFor(c.rows))), async ([c, changes]) => {
      const made = tryCard(c);
      if (!made) return;
      const { s, k } = made;
      const before = [...k.values.values()];
      await k.set(changes);
      const now = [...k.values.values()];
      const present = new Set(s.familyMembers());
      assert.equal(now.filter((t) => present.has(t)).length, c.rows.length);
      assert.deepEqual(before.filter((t) => !now.includes(t) && present.has(t)), [], 'replaced values leave the stage');
      rowsInside(k);
    }),
    params(300),
  );
});

test('set with an unknown row changes nothing and plays nothing', async () => {
  await fc.assert(
    fc.asyncProperty(cardCase.chain((c) => fc.tuple(fc.constant(c), changesFor(c.rows))), label, value, async ([c, changes], extra, v) => {
      fc.pre(!c.rows.some(([l]) => l === extra));
      const made = tryCard(c);
      if (!made) return;
      const { s, k } = made;
      const children = [...k.children],
        values = [...k.values],
        looks = JSON.stringify(k.family().map((m) => m.style));
      let plays = 0;
      const play = s.play.bind(s);
      s.play = async (...args) => {
        plays++;
        return play(...args);
      };
      await assert.rejects(k.set({ ...changes, ...Object.fromEntries([[extra, v]]) }), /No card row/);
      assert.deepEqual(k.children, children);
      assert.deepEqual([...k.values], values);
      assert.equal(JSON.stringify(k.family().map((m) => m.style)), looks);
      assert.equal(plays, 0);
    }),
    params(300),
  );
});

test('a faded card stays faded when a value changes', async () => {
  await fc.assert(
    fc.asyncProperty(cardCase.chain((c) => fc.tuple(fc.constant(c), changesFor(c.rows))), fc.double({ min: 0, max: 1, noNaN: true }), async ([c, changes], o) => {
      const made = tryCard(c);
      if (!made) return;
      for (const m of made.k.family()) m.style.opacity = o;
      await made.k.set(changes);
      for (const v of made.k.values.values()) assert.equal(v.style.opacity, o);
    }),
    params(300),
  );
});

test('mark lights the row and stays; mark(null) hides the bar', async () => {
  await fc.assert(
    fc.asyncProperty(cardCase.chain((c) => fc.tuple(fc.constant(c), fc.array(fc.option(fc.constantFrom(...c.rows.map(([l]) => l))), { minLength: 1, maxLength: 5 }))), async ([c, marks]) => {
      const made = tryCard(c);
      if (!made) return;
      const { k } = made;
      for (const l of marks) {
        await k.mark(l);
        if (l == null) assert.equal(k.bar.style.opacity, 0);
        else {
          assert.equal(k.bar.style.opacity, 1);
          assert.ok(Math.abs(k.bar.center()[1] - k.values.get(l)!.anchorPoint()[1]) < EPS);
          assert.equal(k.bar.style.fill, emphasis(c.colors));
        }
      }
    }),
    params(300),
  );
});

