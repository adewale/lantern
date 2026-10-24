import { Scene, Code, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { checkStep } from '../lib/models.ts';
export default class LimitsExplainer extends Scene {
  static meta = {
    id: 'pyex-limits',
    title: 'Which resource limit wins?',
    sources: [
      'https://github.com/elixir-ai-tools/pyex/pull/29',
      'https://github.com/ivarvong/lantern/blob/2c7bad5/scenes/pyex-limits.ts',
    ],
  };
  static settings = [
    {
      id: 'limit',
      label: 'Step limit',
      default: '9',
      options: [
        { value: '9', label: '9 steps' },
        { value: '3', label: '3 steps' },
      ],
    },
  ];
  override async construct() {
    const max = Number(settingsOf(this).limit),
      s = stage(this, { palette: palette('one-dark'), title: 'Cooperative limits live inside the context' });
    await this.step('context', {
      title: 'Limits are configuration; counters are state',
      caption:
        'The interpreter carries a context between evaluations. Resource checks inspect that value at cooperative boundaries. They are not an operating-system sandbox or a preemptive interrupt.',
    });
    const code = new Code(
      [
        `limits = { steps: ${max}, memory: 30000, output: Infinity }`,
        'ctx = { steps: 0, memory: 0, output: 0 }',
      ],
      { fontSize: 0.27 },
    ).moveTo([0, 0]);
    code.setFill(s.palette.ink);
    await this.play(new FadeIn(code));
    await this.step('boundaries', {
      title: 'Many callers, one check',
      caption:
        'Statements, loops and function calls all pass through the same check. Centralizing the policy keeps counter updates and exception selection consistent.',
    });
    await this.play(new FadeOut(code));
    const hub = await s.show({
      source:
        'graph TD\nStatement[Statement] --> Check[check_step]\nLoop[Loop boundary] --> Check\nCall[Function call] --> Check\nCheck --> Result[Result and next context]',
      style: 'one-dark',
    });
    await hub.walk([
      ['Loop', 'Check'],
      ['Check', 'Result'],
    ]);
    await this.step('order', {
      title: 'The first matching clause wins',
      caption:
        'Steps are checked before memory, then output, then deadline. Multiple limits may be exceeded at once. The returned error depends on this order, not on the most dramatic counter.',
    });
    await hub.hide();
    const d = await s.show({
      source:
        'graph LR\nSteps{Step budget spent} -->|yes| Error[Return first error]\nSteps -->|no| Memory{Memory ceiling}\nMemory -->|yes| Error\nMemory -->|no| Output{Output ceiling}\nOutput -->|yes| Error\nOutput -->|no| Deadline{Past deadline}\nDeadline -->|yes| Error\nDeadline -->|no| Next[Increment steps]',
      style: 'one-dark',
    });
    await d.focus(['Steps', 'Memory']);
    await this.wait(0.4);
    await d.focus(['Output', 'Deadline', 'Next']);
    await this.wait(0.4);
    await d.focus('all');
    await this.step('run', {
      title: 'Ask the executable model',
      caption: `Run a context through the checks with a step budget of ${max}. Each successful boundary increments steps. Memory is charged between boundaries in this deliberately small model.`,
    });
    await d.focus('all');
    let ctx = { steps: 0, memory: 0, output: 0 },
      status = 'ok';
    const history = [];
    for (let i = 0; i < 12; i++) {
      const result = checkStep(ctx, { steps: max, memory: 30000, output: Infinity });
      history.push({ ...ctx, ...result });
      status = result.status;
      ctx = { ...ctx, steps: result.steps };
      if (status !== 'ok') break;
      ctx.memory += 5000;
    }
    this.state = { ...ctx, status, history, limit: max };
    await this.step('failure', {
      title: `The model returns ${status}`,
      caption:
        status === 'step limit'
          ? 'With the smaller budget, the step clause fires before memory reaches its ceiling. Follow the first yes branch.'
          : 'With nine steps allowed, memory reaches its ceiling first. The step clause says no; the next clause returns the memory error.',
    });
    await d.walk(
      status === 'step limit'
        ? [['Steps', 'Error']]
        : [
            ['Steps', 'Memory'],
            ['Memory', 'Error'],
          ],
    );
    await d.focus([status === 'step limit' ? 'Steps' : 'Memory'], { zoom: 0.75 });
    await s.card(
      [
        [
          status === 'step limit' ? 'Steps / budget' : 'Bytes / ceiling',
          status === 'step limit' ? `${ctx.steps} / ${max}` : `${ctx.memory} / 30000`,
        ],
        ['First matching result', status],
      ],
      { at: [0, -3.1], width: 9 },
    );
    await this.step('result', {
      title: 'An ordinary result, not a swallowed stop signal',
      caption:
        'The scene computes the model result before playing its animation. Author code must not wrap awaited animations in a broad catch: that can intercept Lantern’s internal seeking stop signal.',
    });
    await d.hide();
    await s.clearOverlays();
    await s.card(
      [
        ['Steps', ctx.steps],
        ['Memory bytes', ctx.memory],
        ['First matching error', status],
      ],
      { at: [0, 0], width: 8 },
    );
  }
}
