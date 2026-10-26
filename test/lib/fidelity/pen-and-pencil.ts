import assert from 'node:assert/strict';
import type { Trace } from '../../../src/trace.ts';
import { Text, loadFonts } from '../../../src/index.ts';
import { assertStepState } from '../explainer-state.ts';
import { WORLD, BOUND, graphFacts, hershey } from '../../../scenes/explainers/lib/pen-and-pencil.ts';

/** Counts come from the world's text, the letters from Hershey Simplex, and no stroke leaves its bound. */
export async function check(trace: Trace): Promise<void> {
  const { nodes, links } = graphFacts(WORLD);
  assertStepState(trace, 'text', { places: nodes.size, links: links.length });
  const after = (step: string) => trace.steps.find((s) => s.step === step)!.after!;
  const pen = after('pen').pen as { bound: number; widestSwing: number };
  assert.equal(pen.bound, BOUND);
  assert.ok(pen.widestSwing <= BOUND, `widest swing ${pen.widestSwing}`);
  assert.equal((after('pencil').pencil as { endsOutside: number }).endsOutside, 0);
  await loadFonts();
  const inter = new Text('Windmill', { fontSize: 0.62 });
  const contours = inter.family().reduce((n, m) => n + ((m as { subpaths?: unknown[] }).subpaths?.length ?? 0), 0);
  assertStepState(trace, 'letters', {
    letters: { word: 'Windmill', contours, strokes: hershey('Windmill').strokes.length },
  });
  const plate = after('plate').plate as { letterCount: number; widest: number; ends: number };
  assert.equal(plate.letterCount, [...nodes.values()].reduce((n, label) => n + hershey(label).strokes.length, 0));
  assert.ok(plate.widest <= BOUND, `widest ${plate.widest}`);
  assert.equal(plate.ends, 0);
}
