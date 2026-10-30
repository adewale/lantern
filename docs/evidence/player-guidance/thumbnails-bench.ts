// The G5 budget (specs/player-guidance.md): node docs/evidence/player-guidance/thumbnails-bench.ts <baseDir> <thumbsDir> [runs]
// <baseDir> and <thumbsDir> each hold mr-cache.html, token-bucket.html and quotient-familial.html, built without and with thumbnails.
// For mr-cache, token-bucket and quotient-familial at 1280×800 and 4× CPU:
// 1. bench-measure's measure() on both builds, `runs` times each, interleaved: medians of ready, motion, rest.
// 2. On the G5 build, no interaction: every long task (≥ 50 ms) from data-ready until every thumbnail
//    has loaded, and how long that took; the same window on the base build for comparison.
const root = new URL('../../../', import.meta.url).href;
const { launch } = await import(root + 'tools/lib/browser.ts');
const { serve } = await import(root + 'tools/lib/explain-serve.ts');
const { measure } = await import(root + 'tools/lib/bench-measure.ts');
const [baseDir, g5Dir, runsArg] = process.argv.slice(2);
const runs = Number(runsArg ?? 5);
const pages = ['mr-cache', 'token-bucket', 'quotient-familial'];
const viewport = { width: 1280, height: 800 };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2; };
const base = await serve(baseDir!, 0, 'mr-cache.html'), g5 = await serve(g5Dir!, 0, 'mr-cache.html');
const browser = await launch();
const out: Record<string, unknown> = { cpu: 4, viewport, runs, browser: browser.version() };
try {
  for (const page of pages) {
    const samples: Record<string, { ready: number[]; motion: number[]; rest: number[] }> = { base: { ready: [], motion: [], rest: [] }, g5: { ready: [], motion: [], rest: [] } };
    for (let i = 0; i < runs; i++)
      for (const [name, server] of [['base', base], ['g5', g5]] as const) {
        const s = await measure(browser, `${server.url}/${page}.html`, { cpu: 4, readMs: 1500, viewport });
        samples[name]!.ready.push(s.ready); samples[name]!.motion.push(s.motion); samples[name]!.rest.push(s.rest);
      }
    const med = (name: string) => Object.fromEntries(Object.entries(samples[name]!).map(([k, v]) => [k, Math.round(median(v))]));
    const b = med('base'), g = med('g5');
    const ratio = Object.fromEntries(Object.keys(b).map((k) => [k, Math.round(((g[k]! / b[k]!) - 1) * 1000) / 10]));
    // Thumbnails, with no interaction, on each build.
    const idle: Record<string, unknown> = {};
    let window = 0;
    for (const [name, server] of [['g5', g5], ['base', base]] as const) {
      const results = [];
      for (let i = 0; i < runs; i++) {
        const context = await browser.newContext({ viewport });
        try {
          const p = await context.newPage();
          await (await context.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
          await p.addInitScript(() => {
            const w = window as unknown as { __tasks: [number, number][]; __ready: number };
            w.__tasks = [];
            new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__tasks.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
            new MutationObserver(() => { if (!w.__ready && document.querySelector('[data-ready=true]')) w.__ready = performance.now(); }).observe(document, { subtree: true, attributes: true });
          });
          await p.goto(`${server.url}/${page}.html`);
          await p.waitForSelector('[data-ready=true]', { timeout: 120_000 });
          let done: number;
          if (name === 'g5') {
            await p.waitForFunction(() => {
              const items = document.querySelectorAll('aside.rail .steps li'), imgs = [...document.querySelectorAll<HTMLImageElement>('aside.rail .steps img')];
              return items.length > 0 && imgs.length === items.length && imgs.every((i) => i.complete && i.naturalWidth > 0);
            }, null, { polling: 50, timeout: 120_000 });
            done = await p.evaluate(() => performance.now());
          } else {
            await p.waitForTimeout(window);
            done = await p.evaluate(() => performance.now());
          }
          const r = await p.evaluate(() => { const w = window as unknown as { __tasks: [number, number][]; __ready: number }; return { ready: w.__ready, tasks: w.__tasks }; });
          const inWindow = r.tasks.filter(([t]) => t >= r.ready && t <= done);
          results.push({ window: Math.round(done - r.ready), longTasks: inWindow.length, longest: Math.round(Math.max(0, ...inWindow.map(([, d]) => d))), blockingMs: Math.round(inWindow.reduce((s, [, d]) => s + d - 50, 0)) });
        } finally { await context.close(); }
      }
      if (name === 'g5') window = Math.max(...results.map((r) => r.window));
      idle[name] = results;
    }
    out[page] = { base: b, g5: g, deltaPercent: ratio, idle };
    console.log(page, JSON.stringify(out[page]));
  }
} finally {
  await browser.close();
  base.close(); g5.close();
}
console.log(JSON.stringify(out, null, 2));
