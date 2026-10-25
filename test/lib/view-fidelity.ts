import assert from 'node:assert/strict';
import { TraceSink } from '../../src/trace.ts';
import type { Scene, SceneClass, SceneState, Step } from '../../src/scene.ts';
import type { Mobject } from '../../src/mobject.ts';
import { pictureText } from '../../src/view.ts';
import type { View } from '../../src/view.ts';

/** A trace sink that also notes what a View shows at the end of every step. */
class ShownSink extends TraceSink {
  shown: Array<string[] | null> = [];
  pick: (scene: Scene) => View | null | undefined;
  constructor(pick: (scene: Scene) => View | null | undefined) { super(); this.pick = pick; }
  override async stepEnd(scene: Scene, s: Step): Promise<void> {
    await super.stepEnd(scene, s);
    const v = this.pick(scene);
    this.shown.push(v ? v.shown : null);
  }
}

/**
 * Named pattern, picture side: at the end of every step, the View `pick`
 * finds shows what `render` (default: the View's own) makes of that step's
 * traced `after` state. The state side is assertStepState / the fidelity
 * replays; this says the picture tells the same story. Returns the number
 * of steps checked (steps before the View exists are skipped).
 */
export async function assertViewFollowsState(
  SceneClass: SceneClass,
  pick: (scene: Scene) => View | null | undefined,
  render?: (state: SceneState) => Mobject,
): Promise<number> {
  const sink = new ShownSink(pick);
  const scene = new SceneClass(sink, { skipUntil: Infinity });
  await scene.run();
  const draw = render ?? pick(scene)?.render;
  assert.ok(draw, 'the View was made from the scene\'s state (view(scene, render)), or a render is passed');
  const steps = sink.steps();
  let checked = 0;
  steps.forEach((s, i) => {
    const shown = sink.shown[i];
    if (!shown) return;
    assert.deepEqual(shown, pictureText(draw(s.after!)), `step "${s.step}": the view shows ${JSON.stringify(shown)}; the state ${JSON.stringify(s.after)} renders otherwise`);
    checked++;
  });
  assert.ok(checked > 0, 'the View existed at the end of some step');
  return checked;
}
