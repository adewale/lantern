// Attribute late frames: Chrome trace of one playback, then for every frame >= 1.5 frames late,
// main-thread time by kind (JS, style, layout, paint, GC), the DOM writes that frame made, and
// the engine's own spans (src/perf.ts) in that window.
//   node tools/hitch.ts [scene] [--cpu=4] [--html=out/demo.html]
import { launch, OBSERVE } from './lib/browser.ts';
import type { PageGlobals } from './lib/browser.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string | number): string => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? String(d);
const scene = args.find((a) => !a.startsWith('--')) ?? 'pyex-limits', cpu = Number(opt('cpu', 4));
const html = new URL('../' + opt('html', 'out/demo.html'), import.meta.url).pathname;
const FRAME = 1000 / 30;
const KIND: Record<string, string> = { FunctionCall: 'JS', EvaluateScript: 'JS', FireAnimationFrame: 'JS', TimerFire: 'JS', UpdateLayoutTree: 'style', Layout: 'layout',
  PrePaint: 'paint', Paint: 'paint', Layerize: 'paint', MajorGC: 'GC', MinorGC: 'GC', Commit: 'commit' };

/** A Chrome trace event, the fields read here. */
interface TraceEvent { name: string; ph: string; pid: number; tid: number; ts: number; dur: number }

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.addInitScript(OBSERVE);
const cdp = await page.context().newCDPSession(page);
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'blink.user_timing'] });
await page.goto(`file://${html}?scene=${scene}&perf=1`);
await page.waitForFunction(() => { const t = document.querySelector('.time'); if (!t) return false; const [a, b] = (t.textContent ?? '').split(' / '); return a === b; }, null, { timeout: 180000 });
const { log, muts, spans } = await page.evaluate(() => {
  const w = window as unknown as PageGlobals;
  return { log: w.__frameLog, muts: w.__mutLog, spans: w.__perf.events.map((e): [string, number, number] => [e.name, e.ts / 1000 + w.__perf.t0, e.dur / 1000]) };
});
const events = (JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: TraceEvent[] }).traceEvents;
await browser.close();

// Main renderer thread = the one with the most JS; trace µs align to performance.now() via navigationStart
const count = new Map<string, number>();
for (const e of events) if (e.name === 'FunctionCall') { const k = `${e.pid}:${e.tid}`; count.set(k, (count.get(k) ?? 0) + 1); }
const [pid, tid] = [...count].sort((a, b) => b[1] - a[1])[0]![0].split(':').map(Number) as [number, number];
const nav = events.find((e) => e.name === 'navigationStart' && e.pid === pid)!.ts;
const work = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === 'X' && KIND[e.name]);

const wall = log.filter((_, i) => i % 2 === 0), st = log.filter((_, i) => i % 2 === 1);
const W: number[] = []; for (let i = 0; i < muts.length; i += 3) W.push(muts[i]!);
const late: number[] = []; for (let i = 1; i < wall.length; i++) if (wall[i]! - wall[i - 1]! >= 1.5 * FRAME && wall[i - 1]! - wall[0]! > 1500) late.push(i);
const sum = (pairs: Array<[string, number]>): Array<[string, number]> => [...pairs.reduce((m, [k, v]) => m.set(k, (m.get(k) ?? 0) + v), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
console.log(`${scene} cpu×${cpu}: ${late.length} late frames of ${wall.length}; DOM writes per frame median ${W.sort((a, b) => a - b)[W.length >> 1]}`);
for (const i of late) {
  const a = wall[i - 1]!, z = wall[i]!, lo = nav + a * 1000, hi = nav + z * 1000;
  const kinds = sum(work.filter((e) => e.ts < hi && e.ts + e.dur > lo).map((e): [string, number] => [KIND[e.name]!, (Math.min(e.ts + e.dur, hi) - Math.max(e.ts, lo)) / 1000]));
  const own = sum(spans.filter(([n, t, d]) => !['run', 'sink'].includes(n) && t < z && t + d > a).map(([n, t, d]): [string, number] => [n, Math.min(t + d, z) - Math.max(t, a)]));
  console.log(`  t=${st[i]!.toFixed(2)}s  ${(z - a).toFixed(0)} ms  writes ${String(muts[3 * i]).padStart(4)} (prev ${String(muts[3 * (i - 1)]).padStart(4)})  ` +
    `main: ${kinds.slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}  engine: ${own.slice(0, 2).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}`);
}
