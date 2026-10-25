import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { collectProject } from '../tools/lib/explain-project.ts';
import { assertStepState } from './lib/explainer-state.ts';
import {
  reduceSession,
  sessionAttempt,
  TokenBucket,
  ringStory,
  exec,
  sunlight,
  daylightYear,
} from '../scenes/explainers/lib/models.ts';
import { find, run } from '../scenes/explainers/lib/2password.ts';
import { Scene, Text, Code, loadFonts, parseUnifiedDiff } from '../src/index.ts';
import type { VMobject, Sink } from '../src/index.ts';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as mrCache from '../scenes/explainers/mr-cache/code.ts';
import { Repo, AUTHOR } from '../scenes/explainers/lib/git.ts';
import { check as certRenewal } from './lib/fidelity/cert-renewal.ts';
import { check as quotientFamilial } from './lib/fidelity/quotient-familial.ts';
import { check as sendSync } from './lib/fidelity/send-sync.ts';
import { check as gtfs } from './lib/fidelity/gtfs.ts';
import { check as pgPage } from './lib/fidelity/pg-page.ts';
import { check as trafficPolicy } from './lib/fidelity/traffic-policy.ts';
import { check as isdigit } from './lib/fidelity/isdigit.ts';
import { check as icalRecurrence } from './lib/fidelity/ical-recurrence.ts';
import { check as ext4Space } from './lib/fidelity/ext4-space.ts';
import { check as trustProxy } from './lib/fidelity/trust-proxy.ts';
import { check as tailwindGamut } from './lib/fidelity/tailwind-gamut.ts';
import { check as gnomeFiles } from './lib/fidelity/gnome-files.ts';
import { check as wcagMap } from './lib/fidelity/wcag-map.ts';

for (const entry of EXPLAINERS)
  test(`${entry.id}: every authored case exposes the program's answers at step boundaries`, async () => {
    const project = await collectProject(`scenes/explainers/${entry.id}`, { write: false });
    for (const variant of project.variants) {
      const { values, trace } = variant,
        last = trace.steps.at(-1)!;
      // Every visible token (including sequence build-ins) names a link in a captured diagram.
      const links = Object.values(project.store)
        .flatMap((s) => s.parts)
        .filter((p) => p.from && p.to);
      const walks = (last.after?.walks ?? []) as { step: string; from: string; to: string; edge: string }[];
      for (const walk of walks)
        assert.ok(
          links.some((p) => p.id === walk.edge && p.from === walk.from && p.to === walk.to),
          `Trace invents link ${walk.from}->${walk.to}`,
        );
      switch (entry.id) {
        case 'seasons': {
          const lat = ({ tromso: 69.65, london: 51.5, quito: 0, sydney: -33.87 } as Record<string, number>)[
            values.place!
          ]!;
          assertStepState(trace, 'june', { latitude: lat, june: sunlight(lat, 23.44) });
          assertStepState(trace, 'december', { december: sunlight(lat, -23.44) });
          assertStepState(trace, 'year', { daylight: daylightYear(lat) });
          // The chart and its card run the model on every day of the year with daylightYear's own
          // declination, δ = −23.44° × cos(360° × (day + 10) / 365), which the scene restates
          // (lib/models.ts does not export it): on each month's 15th it gives daylightYear's value.
          const declination = (day: number) => -23.44 * Math.cos((2 * Math.PI * (day + 10)) / 365);
          const fifteenths = [14, 45, 73, 104, 134, 165, 195, 226, 257, 287, 318, 348];
          assert.deepEqual(
            fifteenths.map((d) => Math.round(sunlight(lat, declination(d)).daylight * 10) / 10),
            daylightYear(lat),
          );
          // The card counts the model's days of polar day and night over one year.
          const days = Array.from({ length: 365 }, (_, d) => sunlight(lat, declination(d)).daylight);
          assertStepState(trace, 'year', {
            polarDay: days.filter((h) => h === 24).length,
            polarNight: days.filter((h) => h === 0).length,
          });
          if (lat === 69.65) assert.ok((trace.steps.find((s) => s.step === 'year')!.after!.polarDay as number) > 50);
          break;
        }
        case 'oauth-pkce':
          assertStepState(trace, 'exchange', {
            challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            accepted: true,
          });
          if (values.attacker === 'yes') assertStepState(trace, 'attack', { attackerAccepted: false });
          break;
        case 'mr-cache':
          assertStepState(trace, 'request', {
            request: values.request,
            reads: values.request === 'hit' ? 0 : 1,
          });
          assert.equal(walks.filter((w) => w.step === 'request').length, values.request === 'hit' ? 3 : 4);
          await mrCacheDiff(trace, variant.Scene);
          break;
        case 'lantern':
          assert.ok(walks.some((w) => w.from === 'Clock' && w.to === 'Browser'));
          assert.ok(walks.some((w) => w.from === 'Clock' && w.to === 'Trace'));
          break;
        case 'agentic-mermaid': {
          const warnings = trace.steps.find((s) => s.step === 'verify')!.after!.warnings as unknown[];
          assert.equal(warnings.length, values.edit === 'missing' ? 2 : 0);
          assertStepState(trace, 'evidence', { finalWarnings: 0 });
          break;
        }
        case '2password': {
          const launched = run(
            values.auth as 'desktop' | 'service',
            { API_KEY: 'op://Personal/Cloud API/credential' },
            ['app'],
          );
          assertStepState(trace, 'match', { matches: { 'cloud api': ['Cloud API'], databse: [] } });
          assertStepState(trace, 'suggest', { found: find(['cloud api', 'databse']) });
          assertStepState(trace, 'run', { argv: launched.argv, childEnv: launched.childEnv });
          break;
        }
        case 'state-machine': {
          let state = 'idle';
          for (const event of values.events === 'success'
            ? ['CONNECT', 'OPENED', 'CLOSE']
            : ['CONNECT', 'ERROR']) {
            state = reduceSession(state, event);
            assertStepState(trace, event.toLowerCase(), { session: state, event });
          }
          assertStepState(trace, 'terminal', { invalid: sessionAttempt(state, 'OPENED') });
          break;
        }
        case 'token-bucket': {
          const bucket = new TokenBucket(Number(values.rate)),
            balances: number[] = [];
          const responses = [0, 0, 0, 0, 0, 0, 0.5, 1, 1, 2].map((at) => {
            const ok = bucket.allow(at);
            balances.push(bucket.tokens);
            return ok ? 200 : 429;
          });
          assertStepState(trace, 'trace', { tokens: bucket.tokens, lastRefill: 2, responses });
          // The chart and the gauge draw these balances; the trace carries them.
          assertStepState(trace, 'trace', {
            balances,
            allowed: responses.filter((r) => r === 200).length,
            rejected: responses.flatMap((r, i) => (r === 429 ? ['R' + (i + 1)] : [])),
          });
          break;
        }
        case 'ring-buffer': {
          const result = ringStory(values.operations!).at(-1)!;
          assertStepState(trace, 'result', {
            ...result.result,
            error: result.error ?? null,
            operation: result.operation,
          });
          break;
        }
        case 'exgit': {
          const repo = new Repo(),
            hello = repo.blob('hello\n'),
            t1 = repo.tree([['100644', 'hello.txt', hello]]),
            c1 = repo.commit({ tree: t1, author: AUTHOR, message: 'first\n' }),
            nextBlob = repo.blob(values.change === 'add' ? 'world\n' : 'hello again\n'),
            t2 = repo.tree(
              values.change === 'add'
                ? [
                    ['100644', 'hello.txt', hello],
                    ['100644', 'world.txt', nextBlob],
                  ]
                : [['100644', 'hello.txt', nextBlob]],
            ),
            c2 = repo.commit({ tree: t2, parents: [c1], author: AUTHOR, message: 'second\n' });
          assertStepState(trace, 'hashes', {
            hello,
            t1,
            c1,
            nextBlob,
            t2,
            c2,
            head: c2,
            shared: values.change === 'add',
          });
          // The counts on screen come from this evidence: the redraw of commit one's row kept every
          // shape it had, and each id morph paired at least the digits that stayed in place.
          const matches = (step: string) =>
            (trace.steps.find((s) => s.step === step)?.evidence ?? []).filter((e) => e.kind === 'match');
          const [grown] = matches('change');
          assert.ok(grown && grown.removed === 0 && grown.morphed === 0 && (grown.added as number) > 0);
          const ids = matches('hashes');
          assert.equal(ids.length, 2);
          const same = (a: string, b: string) => [...a].filter((c, i) => b[i] === c).length;
          assert.ok((ids[0]!.matched as number) >= same(t1, t2) && (ids[1]!.matched as number) >= same(c1, c2));
          break;
        }
        case 'just-bash': {
          const original = { fs: {}, steps: 0 },
            run = exec(
              original,
              [
                ['echo', 'hello'],
                ['tr', 'a-z', 'A-Z'],
              ],
              'shout.txt',
            ),
            cat = exec(values.shell === 'new' ? run.shell : original, [['cat', 'shout.txt']]);
          assertStepState(trace, 'cat', { oldShell: original, newShell: run.shell, cat: cat.stdout });
          break;
        }
        case 'glyph': {
          await loadFonts();
          const font = values.font as 'sans' | 'mono',
            other = font === 'sans' ? 'mono' : 'sans';
          assertStepState(trace, 'measure', {
            font: values.font,
            width: new Text('Hello, outlines', { font, fontSize: 0.9 }).advance(),
          });
          const evidenceOf = (step: string) => trace.steps.find((s) => s.step === step)!.evidence ?? [];
          // The morph pairs the letters the two words share, longest common runs first;
          // a space has no glyph, so it is not a part.
          const [a, b] = ['cache miss', 'cache hit'].map((w) => w.replaceAll(' ', ''));
          const shared = commonRuns(a!, b!);
          assert.equal(shared, 6); // "cache" and the i
          assert.deepEqual(evidenceOf('morph'), [
            { kind: 'match', matched: shared, morphed: 0, removed: a!.length - shared, added: b!.length - shared },
          ]);
          // Outline shapes, compared point by point once each glyph is centred and scaled
          // to one size: each glyph pairs with itself at 60%, and the other font's pairs
          // only where an outline really is the same.
          const outlines = (f: 'sans' | 'mono', size: number) =>
            new Text('Hello, outlines', { font: f, fontSize: size }).children.map((g) => normalOutline(g as VMobject));
          const mine = outlines(font, 0.9),
            smaller = outlines(font, 0.9 * 0.6),
            theirs = outlines(other, 0.9);
          const same = pairOutlines(mine, smaller),
            across = pairOutlines(mine, theirs);
          assert.equal(same, mine.length);
          assert.deepEqual(evidenceOf('letterforms'), [
            { kind: 'match', matched: same, morphed: 0, removed: mine.length - same, added: smaller.length - same },
            { kind: 'match', matched: across, morphed: 0, removed: mine.length - across, added: theirs.length - across },
          ]);
          assertStepState(trace, 'letterforms', { shapePairs: { sameFont: same, otherFont: across } });
          break;
        }
        case 'fork': {
          // The timeline drawn in 'video' is the trace's own timing of the 'fork' step,
          // and that step lasts its caption's reading time at Scene.captionWpm, to the frame.
          const fork = trace.steps.find((s) => s.step === 'fork')!;
          const words = String(fork.meta.caption).trim().split(/\s+/).length;
          assert.ok(fork.hold != null && fork.t1 != null, 'the fork step holds for its caption');
          assertStepState(trace, 'video', {
            video: { motion: +(fork.hold - fork.t0).toFixed(2), held: +(fork.t1 - fork.hold).toFixed(2), words },
          });
          assert.ok(Math.abs(fork.t1 - fork.t0 - (words / Scene.captionWpm) * 60) <= 1 / trace.fps + 1e-9);
          break;
        }
        case 'cert-renewal':
          certRenewal(trace, values);
          break;
        case 'quotient-familial':
          quotientFamilial(trace, values);
          break;
        case 'send-sync':
          sendSync(trace, values);
          break;
        case 'gtfs':
          gtfs(trace, values);
          break;
        case 'pg-page':
          pgPage(trace, values);
          break;
        case 'traffic-policy':
          trafficPolicy(trace, values);
          break;
        case 'isdigit':
          isdigit(trace, values);
          break;
        case 'ical-recurrence':
          icalRecurrence(trace, values);
          break;
        case 'ext4-space':
          ext4Space(trace, values);
          break;
        case 'trust-proxy':
          trustProxy(trace, values);
          break;
        case 'tailwind-gamut':
          tailwindGamut(trace, values);
          break;
        case 'gnome-files':
          gnomeFiles(trace, values);
          break;
        case 'wcag-map':
          wcagMap(trace, values);
          break;
        default:
          assert.fail(`${entry.id} has no fidelity oracle: compare its step state with the program it explains`);
      }
    }
  });

/**
 * mr-cache's diff step: its TransformDiff animates the hunks the real git CLI prints for the
 * two code texts, its line counts are git's, and every line git leaves alone ends exactly
 * on its line of the after block.
 */
async function mrCacheDiff(trace: { steps: { step: string; evidence?: { kind: string }[] }[] }, Bound: new (sink: Sink) => Scene) {
  const { BEFORE_CODE, AFTER_CODE, BEFORE_SPANS, AFTER_SPANS } = mrCache;
  // The syntax colours lie inside their lines.
  for (const [code, spans] of [
    [BEFORE_CODE, BEFORE_SPANS],
    [AFTER_CODE, AFTER_SPANS],
  ] as const)
    for (const sp of spans) assert.ok(sp.from >= 0 && sp.from < sp.to && sp.to <= code[sp.line]!.length, JSON.stringify(sp));
  const git = gitHunks(BEFORE_CODE, AFTER_CODE);
  const recorded = trace.steps
    .find((s) => s.step === 'diff')!
    .evidence!.find((e) => e.kind === 'diff')! as unknown as {
    hunks: unknown;
    lines: { unchanged: number; changed: number; removed: number; added: number };
  };
  assert.deepEqual(recorded.hunks, git);
  const count = (op: string) => git.reduce((n, h) => n + h.ops.filter((o) => o === op).length, 0);
  assert.equal(recorded.lines.changed + recorded.lines.removed, count('-'));
  assert.equal(recorded.lines.changed + recorded.lines.added, count('+'));
  assert.equal(recorded.lines.unchanged, BEFORE_CODE.length - count('-'));

  // Watch the diff step: the last frame before the after block takes over is the transform's end.
  const points = (c: Code) => c.lines.map((l) => l.children.map((g) => (g as VMobject).subpaths.map((a) => a.slice())));
  let prev: { code: Code; lines: Float32Array[][][] } | null = null,
    handoff: { from: Float32Array[][][]; to: Code } | null = null;
  const sink: Sink = {
    async frame(scene: Scene) {
      if (scene.currentStep?.name !== 'diff' || handoff) return;
      const code = scene.mobjects.find((m): m is Code => m instanceof Code);
      if (!code) return;
      if (prev && code !== prev.code) handoff = { from: prev.lines, to: code };
      else prev = { code, lines: points(code) };
    },
  };
  await new Bound(sink).run();
  assert.ok(handoff, 'the after block took over from the before block');
  const { from, to } = handoff as { from: Float32Array[][][]; to: Code };
  let i = 0,
    j = 0,
    checked = 0;
  const same = (n: number) => {
    for (; n > 0; n--, i++, j++, checked++) {
      assert.equal(BEFORE_CODE[i], AFTER_CODE[j]);
      assert.deepEqual(from[i], points(to)[j], `unchanged line ${i + 1} -> ${j + 1} ends where the after block shows it`);
    }
  };
  for (const h of git) {
    same((h.oldLines ? h.oldStart - 1 : h.oldStart) - i);
    i += h.oldLines;
    j += h.newLines;
  }
  same(BEFORE_CODE.length - i);
  assert.equal(checked, recorded.lines.unchanged);
}

/** `git diff --no-index --unified=0 --diff-algorithm=myers` of two texts, parsed into hunks. */
function gitHunks(before: readonly string[], after: readonly string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'mr-cache-explainer-oracle-'));
  let out: string;
  try {
    writeFileSync(join(dir, 'before.js'), before.join('\n') + '\n');
    writeFileSync(join(dir, 'after.js'), after.join('\n') + '\n');
    const args = ['diff', '--no-index', '--no-color', '--no-ext-diff', '--diff-algorithm=myers', '--unified=0'];
    try {
      out = execFileSync('git', [...args, 'before.js', 'after.js'], { cwd: dir, encoding: 'utf8' });
    } catch (e) {
      // Exit status 1 is "the files differ"; the diff is on stdout either way
      const r = e as { status?: number; stdout?: string };
      if (r.status !== 1 || r.stdout == null) throw e;
      out = r.stdout;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const hunks = parseUnifiedDiff(out);
  assert.ok(hunks.length > 0);
  return hunks;
}

/** How many characters two strings share when the longest common runs are taken first, each character once. */
function commonRuns(a: string, b: string): number {
  const usedA = a.split('').map(() => false),
    usedB = b.split('').map(() => false);
  let total = 0;
  for (;;) {
    let best = { len: 0, i: 0, j: 0 };
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++) {
        let len = 0;
        while (i + len < a.length && j + len < b.length && !usedA[i + len] && !usedB[j + len] && a[i + len] === b[j + len])
          len++;
        if (len > best.len) best = { len, i, j };
      }
    if (!best.len) return total;
    for (let k = 0; k < best.len; k++) usedA[best.i + k] = usedB[best.j + k] = true;
    total += best.len;
  }
}

/** A glyph's outline, centred on its box and scaled so the box's longer side is 1. */
function normalOutline(g: VMobject): { closed: boolean[]; points: number[][] } {
  const all = g.subpaths.flatMap((a) => Array.from(a));
  const xs = all.filter((_, i) => i % 2 === 0),
    ys = all.filter((_, i) => i % 2 === 1);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = Math.max(x1 - x0, y1 - y0),
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  return {
    closed: [...g.closed],
    points: g.subpaths.map((a) => Array.from(a, (v, i) => (v - (i % 2 ? cy : cx)) / size)),
  };
}

/** How many outlines of `xs` pair one to one with an outline of `ys` that is the same path, point for point. */
function pairOutlines(xs: ReturnType<typeof normalOutline>[], ys: ReturnType<typeof normalOutline>[]): number {
  const same = (p: ReturnType<typeof normalOutline>, q: ReturnType<typeof normalOutline>) =>
    p.points.length === q.points.length &&
    p.closed.every((c, i) => c === q.closed[i]) &&
    p.points.every((a, i) => a.length === q.points[i]!.length && a.every((v, k) => Math.abs(v - q.points[i]![k]!) < 1e-4));
  const used = new Set<number>();
  let n = 0;
  for (const x of xs) {
    const j = ys.findIndex((y, k) => !used.has(k) && same(x, y));
    if (j >= 0) used.add(j), n++;
  }
  return n;
}

// The fork explainer's claims about Lantern, held to Lantern's code at the fork base and to this tree.
test('fork: what it says Lantern had and the fork deleted matches both trees', async (t) => {
  const { execFileSync } = await import('node:child_process');
  const { existsSync, readFileSync } = await import('node:fs');
  const BASE = '2c7bad533be25fbd56d26a9a2b6c5651743f011e';
  for (const gone of ['app/worker.ts', 'app/player.ts', 'src/doc.ts', 'src/mermaid.ts', 'wrangler.toml'])
    assert.ok(!existsSync(gone), `${gone} is still here`);
  assert.match(readFileSync('docs/UPSTREAM.md', 'utf8'), /None has been offered upstream/);
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    git('cat-file', '-e', `${BASE}^{commit}`);
  } catch {
    return t.skip('the fork base is not in this clone (shallow checkout)');
  }
  const show = (path: string) => git('show', `${BASE}:${path}`);
  const worker = show('app/worker.ts');
  for (const route of ['/frame.svg', '/text', '/trace.json', '/llms.txt']) assert.ok(worker.includes(`'${route}'`), route);
  assert.match(show('src/mermaid.ts'), /expected "flowchart <dir>" or "graph <dir>"/);
  const scenes = git('ls-tree', '--name-only', `${BASE}:scenes`)
    .split('\n')
    .filter((f) => /\.ts$/.test(f) && f !== 'index.ts');
  assert.equal(scenes.length, 9, scenes.join(', '));
  const tools = git('ls-tree', '-r', '--name-only', BASE, 'tools', 'app', 'src').split('\n').filter(Boolean);
  assert.ok(!tools.some((f) => /ffmpeg|\.mp4|webm/i.test(show(f))), 'Lantern encodes no video');
  assert.equal(JSON.parse(show('package.json')).dependencies, undefined, 'Lantern has no runtime dependencies');
});
