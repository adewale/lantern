import { Scene, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
import { checkStep } from '../lib/models.ts';
const STYLE = 'one-dark';
const MEMORY = 30000,
  CHARGE = 5000;
const HUB =
  'graph LR\nStatement[Statement] --> Check[check_step]\nLoop[Loop boundary] --> Check\nCall[Function call] --> Check\nCheck --> Result[Result and next context]';
// cond's clauses in order. A clause that says yes returns its error (shown as a note);
// every no falls through to the next clause.
const CHAIN =
  'graph LR\nSteps[steps over?] --> Memory[memory over?]\nMemory --> Output[output over?]\nOutput --> Deadline[past deadline?]\nDeadline --> Next[steps + 1]';
// checkStep in scenes/explainers/lib/models.ts, written as pyex's cond.
const CHECK = [
  'def check_step(ctx, limits) do',
  '  cond do',
  '    ctx.steps >= limits.steps -> {:error, :step_limit}',
  '    ctx.memory >= limits.memory -> {:error, :memory_limit}',
  '    ctx.output >= limits.output -> {:error, :output_limit}',
  '    past_deadline?(ctx) -> {:error, :deadline}',
  '    true -> {:ok, %{ctx | steps: ctx.steps + 1}}',
  '  end',
  'end',
];
// The caller's side, from Lantern's original pyex example: the limit arrives as an exception.
const CALLER = [
  'try:',
  '    run_plan(plan)',
  'except LimitError as e:',
  '    replan(budget_hint=str(e))',
];
// Diagrams across the top; the code and the counters it reads below.
const CODE = regionBox('bottom', { right: 1.95, top: -0.6 }),
  CARD = regionBox('bottom', { left: 2.25, top: -0.6 });
const CLAUSE: Record<string, { line: number; node: string; row: string }> = {
  'step limit': { line: 2, node: 'Steps', row: 'steps' },
  'memory limit': { line: 3, node: 'Memory', row: 'memory' },
};

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
      limits = { steps: max, memory: MEMORY, output: Infinity },
      s = stage(this, { style: STYLE });

    await this.step('context', {
      title: 'check_step compares ctx counters with fixed limits',
      caption:
        'The interpreter carries ctx between evaluations and, at cooperative boundaries, calls check_step to compare it with the fixed limits, so the interpreter’s own code enforces them with no OS sandbox involved.',
    });
    const limitsCard = await s.card(
      [
        ['steps', limits.steps],
        ['memory', limits.memory],
        ['output', '∞'],
      ],
      { at: regionBox('left', { bottom: -0.35 }), title: 'limits', fontSize: 0.3, width: 6 },
    );
    const ctxCard = await s.card(
      [
        ['steps', 0],
        ['memory', 0],
        ['output', 0],
      ],
      { at: regionBox('right', { bottom: -0.35 }), title: 'ctx', fontSize: 0.3, width: 6 },
    );
    await ctxCard.mark('steps');
    const wide = await s.code(CHECK, { at: 'bottom', fontSize: 0.21 });
    await wide.focus(0);

    await this.step('boundaries', {
      title: 'Statements, loops and calls all pass through check_step',
      caption:
        'Because every boundary calls the same function, ctx.steps counts all three kinds of work and a single cond decides which error comes back.',
    });
    const code = await s.code(CHECK, { at: CODE, fontSize: 0.2, enter: false });
    await this.play(new FadeOut(limitsCard), new FadeOut(ctxCard), new FadeOut(wide), new FadeIn(code));
    const fmt = (c: { steps: number; memory: number; output: number }) => ({
      steps: `${c.steps} / ${limits.steps}`,
      memory: `${c.memory} / ${limits.memory}`,
      output: `${c.output} / ∞`,
    });
    let ctx = { steps: 0, memory: 0, output: 0 };
    const card = await s.card(Object.entries(fmt(ctx)), {
      at: CARD,
      title: 'ctx / limits',
      fontSize: 0.28,
      width: 5.2,
    });
    const hub = await s.show({ source: HUB }, { box: regionBox('top', { bottom: -0.85 }) });
    await hub.walk(
      [
        ['Statement', 'Check'],
        ['Loop', 'Check'],
        ['Call', 'Check'],
      ],
      { parallel: true, trail: true },
    );
    await hub.walk([['Check', 'Result']], { trail: true });
    await code.focus([1, 7]);

    await this.step('order', {
      title: 'The first matching clause wins',
      caption:
        'cond tries steps, then memory, then output, then the deadline. Several limits can be over at once; the earliest clause decides the error.',
    });
    await hub.hide();
    const d = await s.show({ source: CHAIN }, { box: 'top' });
    await code.focus([2, 5]);

    await this.step('run', {
      title: `Run the model with a budget of ${max}`,
      caption: `Each boundary that passes every clause adds one step. Between boundaries this small model charges ${CHARGE} bytes of memory.`,
    });
    // The model answers first; the animation replays what it computed.
    let status = 'ok';
    const history = [];
    for (let i = 0; i < 12; i++) {
      const result = checkStep(ctx, limits);
      history.push({ ...ctx, ...result });
      status = result.status;
      if (status !== 'ok') break;
      ctx = { ...ctx, steps: result.steps, memory: ctx.memory + CHARGE };
    }
    const passed = history.filter((h) => h.status === 'ok');
    await code.focus(6);
    await d.walk(
      [
        ['Steps', 'Memory'],
        ['Memory', 'Output'],
        ['Output', 'Deadline'],
        ['Deadline', 'Next'],
      ],
      { trail: true },
    );
    let shown = { steps: 0, memory: 0, output: 0 };
    for (const h of passed) {
      shown = { ...shown, steps: h.steps, memory: h.memory + CHARGE };
      await card.set(fmt(shown), { runTime: 0.3 });
    }

    await this.step('failure', {
      title: `The model returns ${status}`,
      caption:
        status === 'step limit'
          ? `At ${ctx.steps} of ${max} steps the first clause matches, so cond returns step limit without checking memory, which stands at ${ctx.memory} of ${MEMORY} bytes.`
          : `At ${ctx.steps} of ${max} steps the first clause does not match. Memory has reached ${ctx.memory} of ${MEMORY} bytes, so the second clause matches and cond returns memory limit.`,
    });
    this.state = { ...ctx, status, history, limit: max };
    const fired = CLAUSE[status]!;
    await d.clearNotes();
    await d.unmark();
    const path = (
      status === 'step limit'
        ? []
        : [['Steps', 'Memory']]
    ) as [string, string][];
    await d.dim([...new Set(['Steps', fired.node, ...path.flat()])]);
    if (path.length) await d.walk(path, { trail: true });
    await d.mark([fired.node], { color: s.bad, as: 'matched' });
    await code.focus(fired.line);
    await card.mark(fired.row);
    await d.note(
      fired.node,
      status === 'step limit'
        ? `yes: ${ctx.steps} ≥ ${max} → step limit`
        : `yes: ${ctx.memory} ≥ ${MEMORY} → memory limit`,
      { side: 'below', color: s.bad },
    );
    if (path.length) await d.note('Steps', `no: ${ctx.steps} < ${max}`, { side: 'above' });

    await this.step('result', {
      title: 'The limit reaches the agent’s Python as LimitError',
      caption:
        `Because check_step returns {:error, :${status === 'step limit' ? 'step_limit' : 'memory_limit'}} as an ordinary value, no process is killed. The agent’s Python receives it as LimitError, so its except clause can catch it and replan with str(e) as the budget hint.`,
    });
    const message =
      status === 'step limit'
        ? `LimitError: step limit exceeded (${max} steps)`
        : `LimitError: memory limit exceeded (${MEMORY} bytes)`;
    // The message the agent's except clause reads, as a comment under the code that reads it.
    const caller = await s.code([...CALLER, `# str(e) == "${message}"`], { at: CODE, enter: false });
    await this.play(new FadeOut(code), new FadeIn(caller));
    await caller.focus([2, 4]);
  }
}
