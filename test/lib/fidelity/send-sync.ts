import type { Trace } from '../../../src/trace.ts';
import { assertStepState } from '../explainer-state.ts';
import { SINGLES, WRAPS, build, nameOf, isSend, isSync, threads } from '../../../scenes/explainers/lib/send-sync.ts';
import type { Inner, Wrapper } from '../../../scenes/explainers/lib/send-sync.ts';

/** Every case's step state equals the evaluator's answers for its wrapper and inner type. */
export function check(trace: Trace, values: Record<string, string>): void {
  const wrapper = values.wrapper as Wrapper,
    inner = values.inner as Inner;
  assertStepState(trace, 'questions', {
    singles: Object.fromEntries(SINGLES.map((t) => [nameOf(t), { send: isSend(t), sync: isSync(t) }])),
  });
  for (const [step, name] of [
    ['i32', 'i32'],
    ['rc', 'Rc<i32>'],
    ['cell', 'Cell<i32>'],
    ['guard', 'MutexGuard<i32>'],
  ] as const)
    assertStepState(trace, step, { shown: name });
  const layers = build(wrapper, inner);
  assertStepState(trace, 'rules', { layers });
  // One step per wrapper, inside out, each ending on the type built so far.
  WRAPS[wrapper].forEach((ctor, i) => assertStepState(trace, `wrap-${ctor.toLowerCase()}`, { built: layers[i + 1] }));
  assertStepState(trace, 'threads', { threads: threads(wrapper, inner) });
}
