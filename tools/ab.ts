// A/B player builds on playback smoothness, interleaved and repeated so drift hits all equally.
//   node tools/ab.ts name=a.html name=b.html [--scene=pyex-limits] [--cpu=4,1] [--reps=3]
import { launch, playToEnd, pacing } from './lib/browser.ts';
import type { Pacing } from './lib/browser.ts';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (k: string, d: string | number): string => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? String(d);
const builds = args.filter((a) => !a.startsWith('--')).map((a): [string, string] => { const [n, p] = a.split('='); return [n!, resolve(p!)]; });
const scenes = opt('scene', 'pyex-limits').split(','), cpus = opt('cpu', '4,1').split(',').map(Number), reps = Number(opt('reps', 3));
const res = new Map<string, Array<Pacing & { task: number }>>();
const browser = await launch();
for (let r = 0; r < reps; r++) for (const scene of scenes) for (const cpu of cpus) for (const [name, html] of builds) {
  const run = await playToEnd(browser, html, scene, { cpu });
  const key = `${scene} cpu×${cpu}|${name}`;
  res.set(key, [...(res.get(key) ?? []), { ...pacing(run), task: run.taskMsPerS }]);
}
await browser.close();
const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
console.log(`${'config'.padEnd(24)} ${'build'.padEnd(12)} late%   p99 ms  max ms  long>50  ms/s main   (median of ${reps}; late% per run)`);
for (const [key, runs] of res) {
  const [cfg, name] = key.split('|') as [string, string];
  console.log(`${cfg.padEnd(24)} ${name.padEnd(12)} ${med(runs.map((r) => r.hitchPct)).toFixed(2).padStart(5)}  ${med(runs.map((r) => r.p99)).toFixed(1).padStart(6)}  ${med(runs.map((r) => r.max)).toFixed(0).padStart(6)}  ${String(med(runs.map((r) => r.longTasks.length))).padStart(7)}  ${med(runs.map((r) => r.task)).toFixed(0).padStart(9)}   [${runs.map((r) => r.hitchPct.toFixed(1)).join(', ')}]`);
}
