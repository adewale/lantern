// Property tests for the tools/lib surfaces the build and `check` stand on:
// the film's plan and pacing, resting-text collisions, the construct lint, the per-diagram
// snapshot store and inline-script escaping. The gates themselves, each with a
// seeded defect, are in explain-gates.test.ts. Counts: test/lib/pbt.ts (FULL=1 is 10x).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { Text, Group, Rectangle, loadFonts } from '../src/index.ts';
import type { Mobject } from '../src/index.ts';
import { filmPlan, pushAt, pacing, FILM } from '../explain/film.ts';
import { restingTextProblems, lintConstruct } from '../tools/lib/explain-check.ts';
import { readSnapshots, writeSnapshots, snapshotFileName, scriptEscape, IMPORTER } from '../tools/lib/explain-project.ts';
import { diagramKey } from '../integrations/agentic-mermaid/snapshot.ts';
import type { SnapshotStore } from '../explain/index.ts';
import { fc, params } from './lib/pbt.ts';

await loadFonts();

// ---- the film's plan and pacing (explain/film.ts) ---------------------------------

const planTrace = fc
  .array(
    fc.record({
      motion: fc.integer({ min: 0, max: 120 }),
      hold: fc.integer({ min: 0, max: 200 }),
      title: fc.array(fc.constantFrom('a', 'step', 'title'), { maxLength: 14 }),
      line: fc.array(fc.constantFrom('the', 'line', 'says'), { maxLength: 14 }),
    }),
    { minLength: 1, maxLength: 8 },
  )
  .map((rows) => {
    let at = 0;
    const steps = rows.map((r, i) => {
      const frame0 = at;
      at += r.motion + r.hold;
      return {
        step: `s${i}`,
        frame0,
        frame1: at,
        t0: frame0 / 30,
        t1: at / 30,
        ...(r.hold ? { hold: (frame0 + r.motion) / 30 } : {}),
        meta: { title: r.title.join(' '), line: r.line.join(' ') },
        before: {},
      };
    });
    return { fps: 30, frames: at, duration: at / 30, steps };
  });

test('the film plays each step\'s motion, then rests between the shortest and longest beat', () => {
  fc.assert(
    fc.property(planTrace, (trace) => {
      const plan = filmPlan(trace);
      plan.forEach((s, i) => {
        const beat = s.beat / trace.fps;
        if (i === plan.length - 1) assert.ok(beat >= FILM.lastBeat - 1 / trace.fps);
        else assert.ok(beat >= FILM.minBeat - 1 / trace.fps && beat <= FILM.maxBeat + 1 / trace.fps, `${beat}`);
        // Motion is the scene's own: up to the caption hold, never the hold itself.
        assert.equal(s.moveEnd - s.frame0, Math.round(((trace.steps[i]!.hold ?? trace.steps[i]!.t1) * trace.fps)) - s.frame0);
        assert.ok(s.t0 <= s.rest && s.rest <= s.t1);
        if (i) assert.equal(s.t0, plan[i - 1]!.t1);
      });
    }),
    params(300),
  );
});

test('the push-in rises over a rest, eases out as the next step moves, and stays in [0, 1]', () => {
  fc.assert(
    fc.property(planTrace, (trace) => {
      const plan = filmPlan(trace),
        end = Math.round(plan.at(-1)!.t1 * trace.fps);
      let last = 0;
      for (let f = 0; f < end; f++) {
        const p = pushAt(plan, trace.fps, f);
        assert.ok(p >= 0 && p <= 1);
        // Smooth: never more than a sixth of the way in one frame, so the motion check would not see a jump.
        assert.ok(Math.abs(p - last) <= 1 / 6 + 1e-9 || f === 0, `${f}: ${last} -> ${p}`);
        last = p;
      }
      // A first step that moves starts unpushed.
      if (plan[0]!.moveEnd > plan[0]!.frame0) assert.equal(pushAt(plan, trace.fps, 0), 0);
    }),
    params(300),
  );
});

test('pacing: rests count toward the rest share and longest still; pauses in motion toward the still share', () => {
  fc.assert(
    fc.property(planTrace, fc.integer(), (trace, seed) => {
      const changed = Array.from({ length: trace.frames + 1 }, (_, i) => ((i * 2654435761 + seed) >>> 0) % 3 !== 0);
      const p = pacing(trace, changed),
        plan = filmPlan(trace);
      const rests = plan.reduce((n, s) => n + s.beat, 0),
        total = plan.reduce((n, s) => n + s.moveEnd - s.frame0 + s.beat, 0);
      assert.ok(Math.abs(p.seconds - total / trace.fps) < 0.01);
      // Rests count toward the rest share and the longest still, never toward the still share.
      assert.ok(Math.abs(p.restShare - rests / total) < 1e-3);
      const motion = total - rests,
        still = plan.reduce((n, s) => n + Array.from({ length: s.moveEnd - s.frame0 }, (_, i) => !changed[s.frame0 + 1 + i]).filter(Boolean).length, 0);
      assert.ok(Math.abs(p.stillShare - (motion ? still / motion : 0)) < 1e-3);
      assert.ok(p.longestStill >= Math.max(...plan.map((s) => s.beat)) / trace.fps - 0.01);
    }),
    params(300),
  );
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

test('texts nobody can see and text inside text never collide', () => {
  fc.assert(
    fc.property(fc.array(placedText, { maxLength: 5 }), fc.array(placedText.filter((p) => p.hide !== 'none' && p.hide !== 'heading'), { maxLength: 4 }), (shown, hidden) => {
      const visible = build(shown.map((p) => ({ ...p, hide: 'none' as const })));
      assert.deepEqual(restingTextProblems(sceneOf([...visible, ...build(hidden)])), restingTextProblems(sceneOf(visible)));
    }),
    params(),
  );
});

test('the heading collides with no text, but a text runs into it exactly when their boxes overlap', () => {
  fc.assert(
    fc.property(placedText.map((p) => ({ ...p, hide: 'none' as const })), placedText.map((p) => ({ ...p, hide: 'heading' as const })), (shown, head) => {
      fc.pre(shown.text.trim() !== '' && head.text.trim() !== '');
      const [m] = build([shown]),
        [h] = build([head]);
      const without = restingTextProblems(sceneOf([m!]));
      const problems = restingTextProblems(sceneOf([m!, h!]));
      const a = m!.box()!,
        b = h!.box()!;
      const overlap = a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      // Nothing about the heading itself is judged: only what runs into it.
      assert.deepEqual(problems.filter((x) => !x.includes('runs into the heading')), without);
      assert.equal(problems.some((x) => x.includes('runs into the heading')), overlap && !!m!.box() && !!h!.box());
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
      assert.equal(restingTextProblems(sceneOf([m!])).some((x) => x.endsWith('crosses the stage edge')), out);
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

test('a label clipped out of sight collides with nothing; a clipped label still in sight does', () => {
  // A diagram framed on one part clips its other labels to the frame: a reader sees none of them,
  // so a card beside the frame cannot collide with them.
  fc.assert(
    fc.property(placedText.map((p) => ({ ...p, native: true, hide: 'none' as const, x: Math.max(-6, Math.min(6, p.x)), y: Math.max(-3, Math.min(3, p.y)) })), fc.double({ min: 0, max: 1, noNaN: true }), (p, cut) => {
      const [card] = build([p]),
        [label] = build([{ ...p, native: false }]);
      const b = label!.box()!;
      fc.pre(p.text.trim() !== '' && b[2] - b[0] > 0.01 && b[3] - b[1] > 0.01);
      const frame = new Group(label!);
      // A clip that ends before the label starts hides it.
      frame.clipBox = [b[0] - 5, b[1] - 5, b[0] - 0.01, b[3] + 5];
      assert.deepEqual(restingTextProblems(sceneOf([card!, frame])).filter((x) => x.includes('overlaps')), []);
      // A clip that leaves most of the label in sight keeps the collision.
      frame.clipBox = [b[0] + (b[2] - b[0]) * cut * 0.5, b[1] - 5, b[2] + 5, b[3] + 5];
      assert.equal(restingTextProblems(sceneOf([card!, frame])).filter((x) => x.includes('overlaps')).length, 1);
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

test('snapshotFileName is the first 16 hex digits of the key\'s SHA-256, so never index.json', () => {
  fc.assert(
    fc.property(fc.string({ unit: 'binary' }), (key) => {
      assert.match(snapshotFileName(key), /^[0-9a-f]{16}\.json$/);
      assert.equal(snapshotFileName(key), createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16) + '.json');
    }),
    params(),
  );
});

test('snapshotFileName gives different diagram keys different files', () => {
  // Real keys: diagramKey output, which JSON-escapes lone surrogates, so distinct keys are distinct UTF-8.
  const key = fc.record({ source: fc.string({ unit: 'binary' }), style: fc.constantFrom('nord', 'default', 'blueprint') }).map((s) => diagramKey(s));
  fc.assert(
    fc.property(key, key, (a, b) => {
      fc.pre(a !== b);
      assert.notEqual(snapshotFileName(a), snapshotFileName(b));
    }),
    params(),
  );
});

// ---- lintConstruct ---------------------------------------------------------------

type Stmt =
  | { k: 'await' | 'forAwait' | 'sync' | 'catchCall' }
  | { k: 'fn'; body: Stmt[] }
  | { k: 'try'; body: Stmt[]; handler: 'catch' | 'finally' | 'both'; recover: Stmt[] };
const stmts: fc.Arbitrary<Stmt[]> = fc.letrec<{ list: Stmt[]; stmt: Stmt }>((tie) => ({
  stmt: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.record({ k: fc.constantFrom('await' as const, 'forAwait' as const, 'sync' as const, 'catchCall' as const) }),
    fc.record({ k: fc.constant('fn' as const), body: tie('list') }),
    fc.record({ k: fc.constant('try' as const), body: tie('list'), handler: fc.constantFrom('catch' as const, 'finally' as const, 'both' as const), recover: tie('list') }),
  ),
  list: fc.array(tie('stmt'), { maxLength: 3 }),
})).list;
const render = (list: Stmt[]): string =>
  list
    .map((s) => {
      if (s.k === 'await') return "await this.step('s');";
      if (s.k === 'forAwait') return 'for await (const x of this.items()) { model.push(x); }';
      if (s.k === 'sync') return 'model.push(1);';
      if (s.k === 'catchCall') return 'await this.play(x).catch(() => {});';
      if (s.k === 'fn') return `const f = async () => { ${render(s.body)} };`;
      if (s.k !== 'try') return '';
      const catchPart = s.handler === 'finally' ? '' : `catch (e) { ${render(s.recover)} }`;
      const finallyPart = s.handler === 'catch' ? '' : `finally { ${s.handler === 'finally' ? render(s.recover) : ''} }`;
      return `try { ${render(s.body)} } ${catchPart} ${finallyPart}`;
    })
    .join('\n');
/** Awaited by this function body (a nested function is not awaited by the code around it). */
const awaits = (list: Stmt[]): boolean =>
  list.some((s) => s.k === 'await' || s.k === 'forAwait' || s.k === 'catchCall' || (s.k === 'try' && (awaits(s.body) || awaits(s.recover))));
const expectedErrors = (list: Stmt[]): number =>
  list.reduce(
    (n, s) =>
      n +
      (s.k === 'catchCall' ? 1 : 0) +
      (s.k === 'fn' ? expectedErrors(s.body) : 0) +
      (s.k === 'try' ? (s.handler !== 'finally' && awaits(s.body) ? 1 : 0) + expectedErrors(s.body) + expectedErrors(s.recover) : 0),
    0,
  );
const constructForm = fc.constantFrom(
  (b: string) => `async construct() { ${b} }`,
  (b: string) => `async 'construct'() { ${b} }`,
  (b: string) => `async ['construct']() { ${b} }`,
  (b: string) => `construct = async () => { ${b} };`,
);

test('lintConstruct flags each catch around awaited construct code, however construct is spelled', () => {
  fc.assert(
    fc.property(stmts, constructForm, stmts, (body, form, other) => {
      const source = `class S extends Scene { ${form(render(body))}\n async helper() { ${render(other)} } }`;
      const errors = lintConstruct(source);
      assert.equal(errors.length, expectedErrors(body), source);
      for (const e of errors) assert.match(e, /StopScene/);
    }),
    params(),
  );
});

test('scale probe: the lint counts 300 nested catches in a 20,000-statement construct', () => {
  let nested = "await this.step('x');";
  for (let i = 0; i < 300; i++) nested = `try { ${nested} } catch (e) {}`;
  assert.equal(lintConstruct(`class S { async construct() { ${nested} ${'model.push(1);'.repeat(20_000)} } }`).length, 300);
});

// ---- scriptEscape ----------------------------------------------------------------

/** Strings rich in the tokens the HTML parser reacts to, overlapping in every way. */
const hostile = fc.string({ unit: fc.constantFrom('<', '/', '!', '-', 's', 'c', 'r', 'i', 'p', 't', 'S', 'C', 'R', 'I', 'P', 'T', '>', ' ', '\u2028', '\u2029', 'x', '\\', '`', '"'), maxLength: 40 });

test('scriptEscape leaves no </script (any case) and no <!--', () => {
  fc.assert(
    fc.property(fc.oneof(hostile, fc.string({ unit: 'binary' })), (code) => {
      const out = scriptEscape(code);
      assert.doesNotMatch(out, /<\/script/i);
      assert.doesNotMatch(out, /<!--/);
    }),
    params(),
  );
});

test('scriptEscape changes nothing in code without those tokens', () => {
  fc.assert(
    fc.property(fc.oneof(hostile, fc.string({ unit: 'binary' })), (code) => {
      fc.pre(!/<\/script|<!--|\u2028|\u2029/i.test(code));
      assert.equal(scriptEscape(code), code);
    }),
    params(),
  );
});

/** Expression fragments as bundled code contains them: strings, templates, regexes (with u/v), raw templates. */
const regexToken = fc.constantFrom('<', '!', '-', 'a', '<!--', '<\\/script', '\\/', 's', '>', 'x*');
const fragment = fc.oneof(
  hostile.map((t) => JSON.stringify(t)),
  hostile.map((t) => '`' + t.replace(/[\\`$]/g, '\\$&') + '`'),
  hostile.map((t) => '`' + t.replace(/[\\`$]/g, '\\$&') + '${1}`'),
  fc.tuple(fc.array(regexToken, { minLength: 1, maxLength: 5 }), fc.constantFrom('', 'u', 'v', 'i', 'gu'), hostile).map(
    // What a regex matches, not its .source text: escaping `<!--` changes the text of a regex
    // (and of a raw template) that holds it, never what it matches (ledger: scriptEscape).
    ([tokens, flags, sample]) =>
      `(r => [r.flags, r.test(${JSON.stringify(sample)}), r.test(${JSON.stringify(tokens.join('').replace(/\\/g, ''))}), '<!--'.replace(r, '#')])(/${tokens.join('')}/${flags})`,
  ),
  // Raw templates keep their backslashes, so no textual escape of `<!--` or U+2028/9 can preserve them
  // (ledger: scriptEscape, String.raw). esbuild itself rewrites raw templates holding </script.
  hostile.filter((t) => !/<!--|\u2028|\u2029/.test(t)).map((t) => 'String.raw`' + t.replace(/[`$]/g, '').replace(/\\+$/, '') + '`'),
);
const runOut = (code: string) => {
  const context = vm.createContext({});
  vm.runInContext(code, context);
  return JSON.stringify((context as { out: unknown }).out);
};

test('scriptEscape keeps what bundled code does', () => {
  fc.assert(
    fc.property(fc.array(fragment, { minLength: 1, maxLength: 6 }), (fragments) => {
      const program = `globalThis.out = [${fragments.join(', ')}];`;
      let bundled: string;
      try {
        bundled = transformSync(program, { minify: true, format: 'iife', target: 'es2022' }).code;
      } catch {
        fc.pre(false);
        return;
      }
      assert.equal(runOut(scriptEscape(bundled)), runOut(bundled), bundled);
    }),
    {
      ...params(),
      // The regex that broke the built Lantern page (escaping every `</` made /</g into /<\/g),
      // beside the cases the HTML parser cares about.
      examples: [[['"a<b</c".replace(/</g, "&lt;")', '"</script>".length', '/<\\/SCRIPT>/i.test("</script>")', '"x\\u2028y".length']]],
    },
  );
});

test('scale probe: scriptEscape on 5.6 MB of </script and <!-- leaves neither', () => {
  assert.doesNotMatch(scriptEscape('</script><!-- '.repeat(400_000)), /<\/script|<!--/i);
});
