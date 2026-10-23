// Playback verifier: plays scenes to the end in Chromium and checks frame pacing,
// long tasks and layout shift. Gates at 1x CPU; other rates are reported only.
//   npm run verify:playback -- [scene ...] [--cpu=1,4] [--html=out/demo.html]
import { launch, playToEnd, pacing } from './lib/browser.ts';
import { SCENES } from '../scenes/index.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string): string => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const html = new URL('../' + opt('html', 'out/demo.html'), import.meta.url).pathname;
const cpus = opt('cpu', '1').split(',').map(Number);
const scenes = args.filter((a) => !a.startsWith('--'));
let fail = false;
const browser = await launch();
for (const scene of scenes.length ? scenes : Object.keys(SCENES)) {
  for (const cpu of cpus) {
    const p = pacing(await playToEnd(browser, html, scene, { cpu }));
    const bad = cpu !== 1 ? [] : [
      // 1% of frames, but never fewer than 3: on a 260-frame scene one GC pause
      // is 0.4%, and a gate that flakes on noise gets ignored.
      p.hitchPct * p.frames / 100 > Math.max(3, p.frames / 100) && `${p.hitchPct.toFixed(1)}% frames >= 50 ms apart (max 1%, or 3 frames)`,
      Math.abs(p.speed - 1) > 0.01 && `speed ${p.speed.toFixed(3)}x (not within 1% of realtime)`,
      p.lateCls > 0.001 && `layout shift after load ${p.lateCls.toFixed(4)}`,
    ].filter((x): x is string => Boolean(x));
    fail ||= bad.length > 0;
    console.log(`${scene.padEnd(16)} cpu×${cpu}  late ${p.hitchPct.toFixed(1).padStart(4)}%  p95 ${p.p95.toFixed(1)} ms  max ${p.max.toFixed(0).padStart(3)} ms  ` +
      `long tasks ${p.longTasks.length}  speed ${p.speed.toFixed(3)}x  CLS ${p.cls.toFixed(4)}  ${cpu === 1 ? (bad.length ? 'FAIL: ' + bad.join('; ') : 'pass') : ''}`);
  }
}
await browser.close();
process.exitCode = fail ? 1 : 0;
