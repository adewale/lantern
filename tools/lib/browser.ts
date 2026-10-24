// Chromium for the browser tools, via playwright-core (dev dependency).
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

function executable(): string | undefined {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return process.env.CHROMIUM_EXECUTABLE_PATH;
  // Any installed Playwright Chromium will do, newest first, on Linux or macOS.
  const bases = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? [process.env.PLAYWRIGHT_BROWSERS_PATH]
    : [`${process.env.HOME}/.cache/ms-playwright`, `${process.env.HOME}/Library/Caches/ms-playwright`];
  const binaries = [
    'chrome-linux/chrome',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    const dirs = readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d) && existsSync(`${base}/${d}/INSTALLATION_COMPLETE`))
      .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
    for (const dir of dirs)
      for (const bin of binaries) if (existsSync(`${base}/${dir}/${bin}`)) return `${base}/${dir}/${bin}`;
  }
  return undefined; // let playwright find its own
}

export const launch = (): Promise<Browser> => chromium.launch({ executablePath: executable() });

/** A layout shift as OBSERVE records it. */
export interface Shift { t: number; v: number; nodes: string[] }

/** What OBSERVE (and the player, with ?perf=1) leave on the page's window. */
export interface PageGlobals {
  __frameLog: number[];
  __mutLog: number[];
  __long: Array<[start: number, duration: number]>;
  __shifts: Shift[];
  __perf: { events: Array<{ name: string; ts: number; dur: number }>; t0: number };
}

/** Script injected before page scripts: frame log (src/svg.ts), DOM write log, long tasks, layout shifts. */
export const OBSERVE = `
window.__frameLog = []; window.__mutLog = []; window.__long = []; window.__shifts = [];
new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput)
  window.__shifts.push({ t: e.startTime, v: e.value, nodes: (e.sources || []).map((s) => s.node ? String(s.node.className || s.node.nodeName) : '?') }); })
  .observe({ type: 'layout-shift', buffered: true });
`;

/** One playback: the page's logs plus main-thread task time per wall second. */
export interface PlaybackRun {
  log: number[];
  muts: number[];
  longs: Array<[start: number, duration: number]>;
  shifts: Shift[];
  taskMsPerS: number;
}

/** Open the built player on a scene, optionally throttled; resolves once playback reaches the end. */
export async function playToEnd(browser: Browser, html: string, scene: string, { cpu = 1, query = '' }: { cpu?: number; query?: string } = {}): Promise<PlaybackRun> {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.addInitScript(OBSERVE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`file://${html}?scene=${scene}${query}`);
  await page.waitForFunction(() => (window as unknown as PageGlobals).__frameLog.length > 45, null, { timeout: 60000 });
  const metric = async (): Promise<Record<string, number>> => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const m0 = await metric(), w0 = Date.now();
  await page.waitForFunction(() => { const t = document.querySelector('.time'); if (!t) return false; const [a, b] = (t.textContent ?? '').split(' / '); return a === b; }, null, { timeout: 180000 });
  const m1 = await metric(), w1 = Date.now();
  const data = await page.evaluate(() => { const w = window as unknown as PageGlobals; return { log: w.__frameLog, muts: w.__mutLog, longs: w.__long, shifts: w.__shifts }; });
  await page.close();
  return { ...data, taskMsPerS: (m1.TaskDuration! - m0.TaskDuration!) * 1000 / ((w1 - w0) / 1000) };
}

const FRAME = 1000 / 30;

export interface Pacing {
  frames: number;
  hitchPct: number;
  p50: number; p95: number; p99: number; max: number;
  speed: number;
  longTasks: number[];
  lateCls: number;
  cls: number;
}

/** Playback quality from a frame log: steady state starts 1.5 s after the first frame. */
export function pacing({ log, longs, shifts }: Pick<PlaybackRun, 'log' | 'longs' | 'shifts'>): Pacing {
  const wall = log.filter((_, i) => i % 2 === 0), st = log.filter((_, i) => i % 2 === 1);
  const i0 = wall.findIndex((w) => w - wall[0]! > 1500);
  const iv: number[] = []; for (let i = i0 + 1; i < wall.length; i++) iv.push(wall[i]! - wall[i - 1]!);
  const q = (p: number) => [...iv].sort((a, b) => a - b)[Math.min(iv.length - 1, Math.floor(p * iv.length))]!;
  return {
    frames: iv.length,
    hitchPct: 100 * iv.filter((x) => x >= 1.5 * FRAME).length / iv.length,
    p50: q(0.5), p95: q(0.95), p99: q(0.99), max: Math.max(...iv),
    speed: (st.at(-1)! - st[i0]!) / ((wall.at(-1)! - wall[i0]!) / 1000),
    longTasks: longs.filter(([t]) => t > wall[i0]!).map(([, d]) => d),
    lateCls: shifts.filter((s) => s.t > 2000).reduce((a, s) => a + s.v, 0),
    cls: shifts.reduce((a, s) => a + s.v, 0),
  };
}
