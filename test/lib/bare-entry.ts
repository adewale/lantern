// Entry for test/runtime.test.ts: bundled by esbuild and evaluated in a
// context with nothing but ECMAScript globals (+ TextEncoder/TextDecoder/atob).
import { loadFonts, traceScene, renderAt, SnapshotSink, renderText, stepTime, indexScene } from '../../src/index.ts';
import { SCENES } from '../../scenes/index.ts';

/** Per scene: what the runtime test checks is non-trivial. */
export interface BareResult { steps: number; svgBytes: number; text: number; duration: number }

export async function run(): Promise<Record<string, BareResult>> {
  await loadFonts();
  const out: Record<string, BareResult> = {};
  for (const [name, { Scene }] of Object.entries(SCENES)) {
    const ix = await indexScene(Scene);
    const mid = ix.steps[Math.floor(ix.steps.length / 2)]!;
    const snap = new SnapshotSink();
    const scene = await renderAt(Scene, stepTime(ix, mid.name)! + 0.2, snap);
    const tr = await traceScene(Scene);
    out[name] = { steps: tr.steps.length, svgBytes: snap.svg.length, text: renderText(scene).length, duration: ix.duration };
  }
  return out;
}
