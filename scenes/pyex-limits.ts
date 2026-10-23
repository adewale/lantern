// PR explainer: elixir-ai-tools/pyex #29 "Add cooperative resource limits".
//
// Pyex is a Python interpreter in Elixir where eval is a pure function:
//   eval(stmt, env, ctx) -> {result, env, ctx}
// Before #29 the only ceiling was a wall-clock deadline checked in loops.
// The PR puts limits + counters INTO the ctx value and funnels every step
// boundary through one function, Ctx.check_step/1. Exceeding a limit is an
// ordinary Python exception, so an agent loop can catch it.
import {
  Scene, Code, Group, Labeled, Rectangle, Arrow, CurvedArrow, Dot, Text, DecimalNumber, FadeIn, FadeOut,
  Create, Transform, Indicate, MoveAlongPath, LaggedStart, UP, DOWN, LEFT, RIGHT, BLUE, TEAL, GOLD,
  GREEN, RED, GREY, WHITE, YELLOW, PURPLE, smooth,
} from '../src/index.ts';
import type { Vec } from '../src/index.ts';

// Real code from the PR, abridged to fit the frame (lib/pyex/ctx.ex).
const CHECK_STEP = [
  'def check_step(%Ctx{limits: l} = ctx) do',
  '  cond do',
  '    ctx.steps >= l.max_steps ->',
  '      {:exceeded, "LimitError: step limit exceeded"}',
  '    ctx.memory_bytes >= l.max_memory_bytes ->',
  '      {:exceeded, "LimitError: memory limit exceeded"}',
  '    ctx.output_bytes >= l.max_output_bytes ->',
  '      {:exceeded, "LimitError: output limit exceeded"}',
  '    past_deadline?(ctx) ->',
  '      {:exceeded, "TimeoutError: time limit"}',
  '    true ->',
  '      {:ok, %{ctx | steps: ctx.steps + 1}}',
  '  end',
  'end',
];

const PROGRAM = [
  'xs = []',
  'while True:',
  '    xs.append([0] * 1000)',
  '    print(len(xs))',
];

const MAX_STEPS = 9, MAX_MEM = 30_000;

export class PyexLimitsScene extends Scene {
  override async construct() {
    const st = { steps: 0, memory_bytes: 0, output_bytes: 0, status: 'running' };
    this.state = st;

    const mono = (s: string, size: number, color = WHITE) => new Text(s, { font: 'mono', fontSize: size, color });
    const sans = (s: string, size: number, color = WHITE) => new Text(s, { fontSize: size, color });
    const bar = (code: Code, i: number, color: string) => {
      const r = new Rectangle({ width: code.width() + 0.3, height: code.lines[i]!.height() * 1.9, cornerRadius: 0.06, fill: color, fillOpacity: 0.2, stroke: 'none' });
      return r.moveTo(code.lineCenter(i));
    };

    // ---- before ---------------------------------------------------------------
    await this.step('before');
    const title = sans('pyex #29 · Cooperative resource limits', 0.44).toEdge(UP, 0.45);
    await this.play(new Create(title, { lagRatio: 0.06 }), { runTime: 1.3 });
    const sig = mono('eval(stmt, env, ctx) -> {result, env, ctx}', 0.26, GREY).nextTo(title, DOWN, 0.25);
    await this.play(new FadeIn(sig, { shift: [0, -0.15] }), { runTime: 0.5 });

    const ctxBefore = new Code(['%Ctx{', '  timeout_ms: 5_000', '}'], { fontSize: 0.24 }).moveTo([-4.6, 1.3]);
    const ctxLabel = sans('the only ceiling: a wall clock, checked in loops', 0.24, GREY).nextTo(ctxBefore, DOWN, 0.25);
    await this.play(new FadeIn(ctxBefore, { shift: [0, -0.2] }), new FadeIn(ctxLabel), { runTime: 0.6 });
    await this.wait(0.6);

    // ---- the ctx grows limits + counters ----------------------------------------
    await this.step('ctx');
    const ctxAfter = new Code([
      '%Ctx{',
      '  limits: %Limits{max_steps: 9,',
      '                  max_memory_bytes: 30_000,',
      '                  max_output_bytes: :infinity},',
      '  steps: 0, memory_bytes: 0, output_bytes: 0',
      '}',
    ], { fontSize: 0.24 }).moveTo([-3.6, 1.1]);
    for (const i of [1, 2, 3]) ctxAfter.lines[i]!.setFill(GREEN);
    ctxAfter.lines[4]!.setFill(TEAL);
    const ctxLabel2 = sans('limits are configuration; counters are state. Both live in the value.', 0.24, GREY).nextTo(ctxAfter, DOWN, 0.25);
    await this.play(new Transform(ctxBefore, ctxAfter, { replace: true }), new Transform(ctxLabel, ctxLabel2, { replace: true }), { runTime: 1.2 });
    await this.wait(0.8);

    // ---- one function at every boundary ------------------------------------------
    await this.step('boundaries');
    await this.play(new FadeOut(ctxAfter), new FadeOut(ctxLabel2), new FadeOut(sig), { runTime: 0.4 });

    const code = new Code(CHECK_STEP, { fontSize: 0.2, color: '#d0d0d0' }).moveTo([4.3, 0.6]);
    const hl = bar(code, 1, YELLOW).setOpacity(0);
    const codeGroup = new Group(hl, code);
    await this.play(new FadeIn(codeGroup, { shift: [0.3, 0] }), { runTime: 0.6 });

    const node = (label: string, color: string, pos: Vec, w?: number) => {
      const t = mono(label, 0.2);
      const r = new Rectangle({ width: w ?? t.advance() + 0.5, height: 0.7, cornerRadius: 0.12, stroke: color, strokeWidth: 0.04, fill: color, fillOpacity: 0.12 });
      return new Labeled(r, t).moveTo(pos);
    };
    const hub = node('Ctx.check_step/1', GOLD, [-3.3, -0.9]);
    const callers: [Labeled, Labeled, Labeled, Labeled] = [
      node('eval_statements', GREY, [-6.4, 1.2]),
      node('eval_while / eval_for', GREY, [-2.4, 1.2]),
      node('call_user_function', GREY, [-6.4, -3.0]),
      node('comprehension item', GREY, [-2.4, -3.0]),
    ];
    const edges = callers.map((c): Arrow => {
      const from = c.center()[1] > hub.center()[1] ? c.shape.bottom() : c.shape.top();
      const to = c.center()[1] > hub.center()[1] ? hub.shape.top() : hub.shape.bottom();
      const sx = Math.sign(c.center()[0] - hub.center()[0]) * 0.9;
      return new Arrow([from[0], from[1]], [to[0] + sx, to[1]], { stroke: GREY, strokeWidth: 0.035, buff: 0.08 });
    });
    await this.play(new FadeIn(hub, { scale: 0.8 }), { runTime: 0.4 });
    await this.play(new LaggedStart(callers.map((c) => new FadeIn(c, { scale: 0.85 })), { lagRatio: 0.2 }), new LaggedStart(edges.map((e) => new Create(e)), { lagRatio: 0.2 }), { runTime: 1.2 });
    const note1 = sans('every step boundary funnels through one function', 0.24, GOLD).moveTo([-4.4, -4.1]);
    await this.play(new FadeIn(note1, { shift: [0, -0.15] }), { runTime: 0.4 });
    await this.wait(0.8);

    // ---- run a program against the limits ---------------------------------------
    await this.step('run');
    await this.play(new FadeOut(note1), new LaggedStart(callers.slice(2).map((c) => new FadeOut(c)), { lagRatio: 0 }), new FadeOut(edges[2]!), new FadeOut(edges[3]!), { runTime: 0.4 });

    const prog = new Code(PROGRAM, { fontSize: 0.21, color: '#d0d0d0' }).moveTo([-5.0, -3.0]);
    const phl = bar(prog, 0, BLUE).setOpacity(0);
    await this.play(new FadeIn(new Group(phl, prog), { shift: [0, -0.2] }), { runTime: 0.5 });

    // counters
    const row = (label: string, max: string, y: number, color: string) => {
      const k = mono(label, 0.22, GREY); k.moveTo([0.1, y], [1, 0]);
      const v = new DecimalNumber(0, { fontSize: 0.24, font: 'mono', color: WHITE, anchor: 'start' }); v.moveTo([0.35, y], [-1, 0]);
      const m = mono(`/ ${max}`, 0.2, color); m.moveTo([2.0, y], [-1, 0]);
      return { k, v, m, g: new Group(k, v, m) };
    };
    const steps = row('steps', String(MAX_STEPS), -2.5, GOLD);
    const mem = row('memory_bytes', '30000', -3.0, PURPLE);
    const out = row('output_bytes', '∞', -3.5, GREY);
    await this.play(new FadeIn(steps.g), new FadeIn(mem.g), new FadeIn(out.g), { runTime: 0.4 });
    const set = (r: { v: DecimalNumber }, v: number) => new Transform(r.v, r.v.copy().setValue(v));

    const token = new Dot({ radius: 0.11, color: YELLOW }).moveTo(callers[0]);
    await this.play(new FadeIn(token, { scale: 0.4 }), { runTime: 0.3 });
    const toHub = (i: number) => new MoveAlongPath(token, edges[i]!.line);
    let S = 0, M = 0, O = 0;
    const iterate = async (n: number) => {
      // statement boundary -> check_step -> ok (steps+1)
      await this.play(phl.animate.moveTo(prog.lineCenter(1)).setOpacity(1), token.animate.moveTo(callers[1]), hl.animate.moveTo(code.lineCenter(2)).setOpacity(1), { runTime: 0.35 });
      await this.play(toHub(1), { runTime: 0.4 });
      S++; st.steps = S;
      await this.play(hl.animate.moveTo(code.lineCenter(11)), set(steps, S), new Indicate(hub.shape, { color: GOLD, scaleFactor: 1.05 }), { runTime: 0.4 });
      // body: append allocates -> heap_alloc estimates 64 + 8 * 1000
      M += 64 + 8 * 1000; st.memory_bytes = M;
      await this.play(phl.animate.moveTo(prog.lineCenter(2)), token.animate.moveTo(callers[0]), set(mem, M), { runTime: 0.45 });
      // print records output bytes
      O += String(n).length + 1; st.output_bytes = O;
      await this.play(phl.animate.moveTo(prog.lineCenter(3)), set(out, O), { runTime: 0.3 });
    };
    await iterate(1); await iterate(2); await iterate(3);

    // ---- memory limit trips first -------------------------------------------------
    await this.step('exceeded');
    await this.play(phl.animate.moveTo(prog.lineCenter(1)), token.animate.moveTo(callers[1]), hl.animate.moveTo(code.lineCenter(2)), { runTime: 0.35 });
    await this.play(toHub(1), { runTime: 0.4 });
    // steps ok (3 < 9) -> next clause: memory 24192 < 30000 ok -> one more iteration would allocate past it;
    // show the clause walk, then the fourth allocation tips it
    S++; st.steps = S;
    await this.play(hl.animate.moveTo(code.lineCenter(4)), set(steps, S), { runTime: 0.3 });
    await this.play(hl.animate.moveTo(code.lineCenter(11)), { runTime: 0.3 });
    M += 64 + 8 * 1000; st.memory_bytes = M;
    await this.play(phl.animate.moveTo(prog.lineCenter(2)), token.animate.moveTo(callers[0]), set(mem, M), { runTime: 0.35 });
    await this.play(new Indicate(mem.v, { color: RED }), { runTime: 0.4 });
    O += 2; st.output_bytes = O;
    await this.play(phl.animate.moveTo(prog.lineCenter(3)), set(out, O), { runTime: 0.3 });
    // next boundary: memory clause fires
    await this.play(phl.animate.moveTo(prog.lineCenter(1)), token.animate.moveTo(callers[1]), hl.animate.moveTo(code.lineCenter(2)), { runTime: 0.35 });
    await this.play(toHub(1), { runTime: 0.4 });
    await this.play(hl.animate.moveTo(code.lineCenter(4)).setStyle({ fill: RED }), { runTime: 0.3 });
    await this.play(hl.animate.moveTo(code.lineCenter(5)), new Indicate(hub.shape, { color: RED, scaleFactor: 1.08 }), new Indicate(token, { color: RED }), { runTime: 0.5 });
    st.status = 'LimitError';
    const exc = mono('{:exception, "LimitError: memory limit exceeded (30000 bytes)"}', 0.21, RED).moveTo([-2.6, -1.85]);
    await this.play(new FadeIn(exc, { shift: [0, -0.15] }), { runTime: 0.4 });
    await this.wait(0.6);

    // ---- why "cooperative" -------------------------------------------------------
    await this.step('cooperative');
    await this.play(new FadeOut(exc), new FadeOut(token), new FadeOut(codeGroup), new FadeOut(hub), new FadeOut(callers[0]), new FadeOut(callers[1]), new FadeOut(edges[0]!), new FadeOut(edges[1]!), { runTime: 0.3 });
    const py = new Code([
      'try:',
      '    run_plan(plan)',
      'except LimitError as e:',
      '    replan(budget_hint=str(e))',
    ], { fontSize: 0.21, color: '#d0d0d0' }).moveTo([-3.8, 1.4]);
    py.lines[2]!.setFill(GREEN); py.lines[3]!.setFill(GREEN);
    await this.play(new FadeIn(py, { shift: [0, -0.2] }), { runTime: 0.5 });
    const why = new Group(
      sans('no preemption, no killed process: the limit is a value the boundary reads', 0.22, WHITE),
      sans('exceeding it is an ordinary exception, so the agent loop can catch and replan', 0.22, WHITE),
      sans('memory is an estimate (64 + 8·n for a list), counted at heap_alloc, not measured', 0.22, GREY),
    ).arrange(DOWN, 0.18).moveTo([0.2, -0.95]);
    await this.play(new LaggedStart(why.children.map((w) => new FadeIn(w, { shift: [0, -0.1] })), { lagRatio: 0.4 }), { runTime: 1.4 });
    await this.wait(2);
  }
}
