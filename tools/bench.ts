#!/usr/bin/env node
// What a reader feels on built explainer pages, BASE against HEAD, in real Chromium.
//
//   npm run bench                              the working tree against origin/main
//   npm run bench -- --base <rev>              against another revision (HEAD: the uncommitted change alone)
//   npm run bench -- --reps 9 --cpu 1 --explainers mr-cache,exgit
//
// Both revisions' pages are built by their own `explain build` (BASE from a temporary git
// worktree), served side by side, and opened in turn, interleaved, in fresh browser contexts.
// Each opening loads a page, presses Next once, then jumps to the last step through the
// steps list, a step it has not seen. Absolute numbers on a shared machine move with whatever
// else runs, so there is no stored baseline: each metric's HEAD median is compared with BASE's
// from the same run (tools/lib/bench-stats.ts), and a metric that looks slower is measured
// again; only a regression seen both times fails. Layout shift while stepping must be zero.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, symlink, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Browser } from 'playwright-core';
import { launch } from './lib/browser.ts';
import { ROOT } from './lib/explain-project.ts';
import { serve } from './lib/explain-serve.ts';
import { MIN_PAIRS, blocking, compare, longestGap, order, verdict } from './lib/bench-stats.ts';
import type { Comparison, Rule } from './lib/bench-stats.ts';

const { values: flags } = parseArgs({
  options: {
    base: { type: 'string', default: 'origin/main' },
    reps: { type: 'string', default: '7' },
    cpu: { type: 'string', default: '4' },
    // A short scene and a long one, native charts and captured diagrams; docs/REFERENCE.md says why these.
    explainers: { type: 'string', default: 'mr-cache,seasons,oauth-pkce,exgit' },
  },
});
const reps = Number(flags.reps),
  cpu = Number(flags.cpu),
  ids = flags.explainers.split(',');
// A phone: the narrow stage opens each step on a close-up, so its layout work is measured too.
const VIEWPORT = { width: 390, height: 844 },
  // How long the reader looks at a step before acting: the player prepares the next step meanwhile.
  READ_MS = 1000;

/** One opening of one page, in ms (`shift` is the layout-shift score). */
type Sample = { ready: number; motion: number; rest: number; gap: number; jump: number; blocking: number; shift: number };
const METRICS: { key: Exclude<keyof Sample, 'shift'>; label: string; rule: Rule }[] = [
  { key: 'ready', label: 'load → ready', rule: { rel: 0.1, floor: 100 } },
  { key: 'motion', label: 'Next → first motion', rule: { rel: 0.25, floor: 40 } },
  // Mostly the step's authored motion, the same on both sides, so the relative part is small.
  { key: 'rest', label: 'Next → resting', rule: { rel: 0.03, floor: 100 } },
  { key: 'gap', label: 'Next: longest gap', rule: { rel: 0.5, floor: 50 } },
  { key: 'jump', label: 'jump to last step', rule: { rel: 0.2, floor: 60 } },
  { key: 'blocking', label: 'blocking (Next+jump)', rule: { rel: 0.25, floor: 60 } },
];

/** What the page records, from before its own script runs (timestamps are performance.now()). */
type PageLog = {
  ready: number;
  clicks: number[];
  steps: [string, number][];
  stage: number[];
  frames: number[];
  tasks: [number, number][];
  shifts: [number, number][];
};
function record() {
  const r: PageLog = { ready: 0, clicks: [], steps: [], stage: [], frames: [], tasks: [], shifts: [] };
  (window as unknown as { __bench: PageLog }).__bench = r;
  new PerformanceObserver((l) => l.getEntries().forEach((e) => r.tasks.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
  // Every shift counts, including those just after a click, which CLS itself would excuse.
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => r.shifts.push([e.startTime, (e as PerformanceEntry & { value: number }).value])),
  ).observe({ type: 'layout-shift', buffered: true });
  // The event's own time: when the reader pressed, including any wait for the main thread.
  document.addEventListener('click', (e) => r.clicks.push(e.timeStamp), true);
  document.addEventListener('rayner:step', (e) => r.steps.push([(e as CustomEvent).detail.step, performance.now()]));
  // The stage's picture changing: a new picture put on it, or a drawn element inside it patched.
  // The stage element's own attributes (its label) change with the caption, not the picture.
  new MutationObserver((list) => {
    if (r.ready && list.some((m) => (m.target as Element).closest?.('.stage') && (m.type === 'childList' || !(m.target as Element).classList.contains('stage'))))
      r.stage.push(performance.now());
    if (!r.ready && document.querySelector('[data-ready=true]')) r.ready = performance.now();
  }).observe(document, { subtree: true, childList: true, attributes: true });
  const tick = (t: number) => {
    r.frames.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function measure(browser: Browser, url: string): Promise<Sample> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.addInitScript(record);
    const until = (step: string) =>
      page.waitForFunction((s) => (window as unknown as { __bench: PageLog }).__bench.steps.some(([n]) => n === s), step, { polling: 100, timeout: 120_000 });
    await page.goto(url);
    await page.waitForFunction(() => (window as unknown as { __bench: PageLog }).__bench.ready > 0, null, { polling: 100, timeout: 120_000 });
    const names = await page.locator('.steps button').evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset.step!));
    await page.waitForTimeout(READ_MS);
    await page.locator('.controls .primary').click();
    await until(names[1]!);
    await page.waitForTimeout(READ_MS);
    await page.locator('.steps button').last().click();
    await until(names.at(-1)!);
    const r = await page.evaluate(() => (window as unknown as { __bench: PageLog }).__bench);
    if (errors.length) throw new Error(`${url}: ${errors.join('; ')}`);
    const [next, jump] = r.clicks as [number, number];
    const at = (step: string, after: number) => r.steps.find(([n, t]) => n === step && t >= after)![1];
    const rested = at(names[1]!, next),
      jumped = at(names.at(-1)!, jump);
    return {
      ready: r.ready,
      motion: (r.stage.find((t) => t >= next) ?? rested) - next,
      rest: rested - next,
      gap: longestGap(r.frames, next, rested),
      jump: jumped - jump,
      blocking: blocking(r.tasks, next, rested) + blocking(r.tasks, jump, jumped),
      shift: r.shifts.filter(([t]) => t >= r.ready).reduce((s, [, v]) => s + v, 0),
    };
  } finally {
    await context.close();
  }
}

const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const short = (rev: string) => git('rev-parse', '--short', rev);
const baseSha = git('rev-parse', '--verify', `${flags.base}^{commit}`),
  headSha = git('rev-parse', 'HEAD'),
  dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
const worktree = await mkdtemp(join(tmpdir(), 'rayner-bench-'));
const servers: { url: string; close(): void }[] = [];
let browser: Browser | undefined;
try {
  git('worktree', 'add', '--detach', '--quiet', worktree, baseSha);
  await symlink(await realpath(join(ROOT, 'node_modules')), join(worktree, 'node_modules'));
  const urls = { base: '', head: '' };
  for (const [side, source] of [['base', worktree], ['head', ROOT]] as const) {
    const out = join(ROOT, 'out/bench', side);
    for (const id of ids)
      execFileSync(process.execPath, ['tools/explain.ts', 'build', `scenes/explainers/${id}`, '--out', join(out, id + '.html')], { cwd: source, stdio: ['ignore', 'ignore', 'inherit'] });
    const server = await serve(out, 0, '');
    servers.push(server);
    urls[side] = server.url;
  }
  browser = await launch();
  console.log(
    `BASE ${flags.base} (${short(baseSha)}) against HEAD ${short(headSha)}${dirty ? ' with uncommitted changes' : ''}: ` +
      `${ids.join(', ')}; ${reps} interleaved pairs each; CPU ×${cpu}; ${VIEWPORT.width}×${VIEWPORT.height}; Chromium ${browser.version()}`,
  );
  /** `reps` interleaved pairs of openings of each explainer, BASE and HEAD in alternating order. */
  async function round(which: string[]) {
    const out = new Map(which.map((id) => [id, { base: [] as Sample[], head: [] as Sample[] }]));
    for (let rep = 0; rep < reps; rep++)
      for (const id of which) for (const side of order(rep)) out.get(id)![side].push(await measure(browser!, `${urls[side]}/${id}.html`));
    return out;
  }
  // One unrecorded opening of each side first: the browser's first pages are slower whichever they are.
  for (const side of ['base', 'head'] as const) await measure(browser, `${urls[side]}/${ids[0]}.html`);
  const comparisons = (s: { base: Sample[]; head: Sample[] }) =>
    new Map(METRICS.map((m) => [m.key, compare(s.base.map((x) => x[m.key]), s.head.map((x) => x[m.key]), m.rule)]));
  const first = await round(ids);
  const results = new Map([...first].map(([id, s]) => [id, comparisons(s)]));
  const flagged = [...results].filter(([, c]) => [...c.values()].some((x) => x.regressed)).map(([id]) => id);
  const again = new Map<string, Map<string, Comparison>>(),
    second = flagged.length ? await round(flagged) : new Map<string, { base: Sample[]; head: Sample[] }>();
  if (flagged.length) console.log(`Slower on the first round: ${flagged.join(', ')}; measured ${flagged.length > 1 ? 'them' : 'it'} again.`);
  for (const [id, s] of second) again.set(id, comparisons(s));
  // Every sample, for a closer look than the medians below.
  await writeFile(
    join(ROOT, 'out/bench/samples.json'),
    JSON.stringify({ base: baseSha, head: headSha, dirty, reps, cpu, first: Object.fromEntries(first), again: Object.fromEntries(second) }, null, 1) + '\n',
  );
  const pad = (s: string | number, n: number) => String(s).padEnd(n),
    num = (v: number) => String(Math.round(v)).padStart(7);
  console.log(`\n${pad('explainer', 12)}${pad('metric', 22)}   base ms   head ms   change          HEAD slower  verdict`);
  const failures: string[] = [];
  for (const [id, c] of results) {
    for (const m of METRICS) {
      const x = c.get(m.key)!,
        y = again.get(id)?.get(m.key),
        v = verdict(x, y);
      const change = `${x.delta >= 0 ? '+' : ''}${Math.round(x.delta)} (${x.delta >= 0 ? '+' : ''}${x.base ? Math.round((100 * x.delta) / x.base) : 0}%)`;
      console.log(
        `${pad(id, 12)}${pad(m.label, 22)}${num(x.base)}   ${num(x.head)}   ${pad(change, 16)}${pad(`${Math.round(x.slower * reps)}/${reps}`, 13)}` +
          `${v}${y ? ` (again: ${y.delta >= 0 ? '+' : ''}${Math.round(y.delta)} ms, ${Math.round(y.slower * reps)}/${reps})` : ''}`,
      );
      if (v === 'regression') failures.push(`${id} ${m.label}: ${Math.round(x.base)} → ${Math.round(x.head)} ms, again ${Math.round(y!.base)} → ${Math.round(y!.head)} ms`);
    }
    const shifts = first.get(id)!,
      worst = (side: 'base' | 'head') => Math.max(...shifts[side].map((s) => s.shift));
    console.log(`${pad(id, 12)}${pad('layout shift', 22)}${worst('base').toFixed(3).padStart(7)}   ${worst('head').toFixed(3).padStart(7)}   (the worst opening; HEAD's must be 0)`);
    if (worst('head') > 0) failures.push(`${id}: stepping shifted the layout (score ${worst('head').toFixed(3)})`);
  }
  if (reps < MIN_PAIRS) console.log(`\nFewer than ${MIN_PAIRS} pairs: timings are shown, not judged; layout shift still is.`);
  if (failures.length) {
    console.log(`\nREGRESSION (thresholds per metric in tools/bench.ts; slower on two separate rounds):\n  ${failures.join('\n  ')}`);
    process.exitCode = 1;
  } else
    console.log(`\nok: no regression${flagged.length ? ` (${flagged.join(', ')} looked slower once; not reproduced)` : ''}`);
} finally {
  await browser?.close();
  for (const s of servers) s.close();
  try {
    git('worktree', 'remove', '--force', worktree);
  } catch {
    await rm(worktree, { recursive: true, force: true });
    git('worktree', 'prune');
  }
}
