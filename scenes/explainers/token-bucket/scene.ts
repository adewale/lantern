import {
  Scene,
  Rectangle,
  Text,
  Group,
  Dot,
  Axes,
  FadeIn,
  FadeOut,
  Create,
  Transform,
  AnimationGroup,
  Succession,
  ViewSync,
  stateView,
} from '../../../src/index.ts';
import type { Animation, SceneState, SyncOpts, View, VMobject } from '../../../src/index.ts';
import { stage, settingsOf } from '../../../explain/index.ts';
import { TokenBucket } from '../lib/models.ts';

const TIMES = [0, 0, 0, 0, 0, 0, 0.5, 1, 1, 2];
const GROUPS = [
  [0, 6],
  [6, 9],
  [9, 10],
] as const;
const RATES = [1, 2, 4];
const CAPACITY = 5;
const CODE = [
  'function allow(now) {',
  '  tokens = min(5,',
  '    tokens + (now - lastRefill) * rate)',
  '  lastRefill = now',
  '  if (tokens < 1) return 429',
  '  tokens -= 1',
  '  return 200',
  '}',
];
/** Code lines, by what they do: refill, refuse, spend. */
const REFILL = [1, 3] as const,
  REFUSE = [4, 4] as const,
  SPEND = [5, 6] as const;
const fmt = (n: number) => n.toFixed(1);
const name = (i: number) => 'R' + (i + 1);
const perSecond = (r: number) => `${r} token${r > 1 ? 's' : ''} a second`;

/** One call of allow(): when it came, what it found after refill, and what it left. */
interface Call {
  at: number;
  ok: boolean;
  found: number;
  after: number;
}
/** The ten requests through the model at one refill rate. */
function runAt(rate: number): Call[] {
  const bucket = new TokenBucket(rate, CAPACITY);
  return TIMES.map((at) => {
    const ok = bucket.allow(at);
    return { at, ok, found: bucket.tokens + (ok ? 1 : 0), after: bucket.tokens };
  });
}
/**
 * The balance between the previous call and this one, as allow() would
 * compute it at each moment: what the last call left plus
 * (now − lastRefill) × rate, capped at five. Straight, with a corner where the
 * cap is reached; it ends at what this call found.
 */
function climb(prev: { at: number; after: number }, call: Call, rate: number): [number, number][] {
  const points: [number, number][] = [[prev.at, prev.after]];
  if (prev.after + (call.at - prev.at) * rate > CAPACITY + 1e-9)
    points.push([prev.at + (CAPACITY - prev.after) / rate, CAPACITY]);
  points.push([call.at, call.found]);
  return points;
}
const START = { at: 0, after: CAPACITY };
/** How the readout and its description write a value of scene.state. */
const formatState = (v: unknown) =>
  Array.isArray(v)
    ? v.length
      ? v.join(', ')
      : 'none'
    : typeof v === 'number'
      ? Number.isInteger(v)
        ? String(v)
        : v.toFixed(1)
      : String(v);
/** Drop repeated points; a line needs two distinct ones. */
const distinct = (points: [number, number][]) =>
  points.filter((p, i) => i === 0 || p[0] !== points[i - 1]![0] || p[1] !== points[i - 1]![1]);

/**
 * A readout sync that first makes one call's result the scene's state. In a
 * Succession it begins when its turn comes, so each request's members show
 * that request's state, and the step ends on the last one.
 */
class SyncToCall extends ViewSync {
  owner: Scene;
  result: SceneState;
  constructor(owner: Scene, readout: View, result: SceneState, opts: SyncOpts) {
    super(readout, opts);
    this.owner = owner;
    this.result = result;
  }
  override begin(): void {
    this.owner.state = this.result;
    super.begin();
  }
}

export default class TokenBucketExplainer extends Scene {
  static meta = {
    id: 'token-bucket',
    title: 'A token bucket refills when a request arrives',
    sources: ['https://github.com/ivarvong/lantern/blob/2c7bad5/scenes/token-bucket.ts'],
  };
  static settings = [
    {
      id: 'rate',
      label: 'Refill per second',
      default: '2',
      options: [
        { value: '1', label: '1 token' },
        { value: '2', label: '2 tokens' },
        { value: '4', label: '4 tokens' },
      ],
    },
  ];
  /** The state readout: a View of scene.state, checked against the trace at every step. */
  readout: View | null = null;

  override async construct() {
    const rate = Number(settingsOf(this).rate),
      bucket = new TokenBucket(rate, CAPACITY),
      s = stage(this, { style: 'github-dark' });
    const ink = s.palette.ink,
      soft = s.soft;

    // A dry run of the same model at every rate, so titles and captions can name its answers.
    const runs = new Map(RATES.map((r) => [r, runAt(r)] as const)),
      plan = runs.get(rate)!;
    const codes = (a: number, b: number) =>
      plan
        .slice(a, b)
        .map((r) => (r.ok ? 200 : 429))
        .join(', ');
    const refusedAt = (r: number) => runs.get(r)!.flatMap((c, i) => (c.ok ? [] : [name(i)]));
    const list = (names: string[]) =>
      names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    /** The calls made so far, in order: what every readout and description reports. */
    const calls: Call[] = [];
    let othersShown = false;

    // ---- descriptions of the native drawings, read at every step boundary
    const chartSays = () => {
      const refused = calls.flatMap((c, i) => (c.ok ? [] : [`${name(i)} at ${fmt(c.found)}`]));
      return !calls.length
        ? `A chart of tokens, 0 to ${CAPACITY}, against time, 0 to 2.5 s, with a dashed line at the one token a request needs`
        : `A chart of the balance over time: it climbs at ${rate} a second between calls and drops one token for each 200. ` +
            `Dots mark what R1–${name(calls.length - 1)} found; ` +
            (refused.length ? `${list(refused)} ${refused.length > 1 ? 'are' : 'is'} under the one-token line and got 429` : 'none is under the one-token line') +
            (othersShown
              ? `. Grey lines are the same requests at ${list(RATES.filter((r) => r !== rate).map(String))} tokens a second; ` +
                `each line's end names its 429s: ${RATES.map((r) => `${r} / s ${list(refusedAt(r)) || 'none'}`).join(', ')}`
              : '');
    };
    const chipsSay = () => {
      const ok = calls.filter((c) => c.ok).length,
        no = calls.flatMap((c, i) => (c.ok ? [] : [name(i)]));
      return (
        'Requests R1 to R10 at their arrival times: ' +
        (calls.length
          ? `${ok} answered 200${no.length ? `, ${list(no)} 429` : ''}${calls.length < TIMES.length ? `, ${TIMES.length - calls.length} waiting` : ''}`
          : 'none answered yet')
      );
    };
    const gaugeSays = () => `The bucket, filled to ${fmt(bucket.tokens)} of ${CAPACITY} tokens`;

    // ---- request chips: one per call, filled in as each answer comes back
    const PITCH = 1.46,
      CHIP_Y = 2.3;
    const chipX = (i: number) => (i - 4.5) * PITCH;
    const chip = (i: number, result: boolean | null) => {
      const color = result == null ? s.palette.muted : result ? s.good : s.bad;
      const box = new Rectangle({
        width: 1.22,
        height: 0.95,
        cornerRadius: 0.1,
        fill: result == null ? s.palette.paper : color,
        fillOpacity: result == null ? 1 : 0.22,
        stroke: color,
        strokeWidth: result == null ? 0.02 : 0.035,
        ...(result == null ? { dashArray: '0.08 0.06' } : {}),
      });
      const label = new Text(name(i), { fontSize: 0.2, color: soft }).moveTo([0, 0.24]);
      const answer = new Text(result == null ? '…' : result ? '200' : '429', {
        fontSize: 0.3,
        font: 'mono',
        weight: 'bold',
        color: result == null ? soft : ink,
      }).moveTo([0, -0.14]);
      return new Group(box, label, answer).moveTo([chipX(i), CHIP_Y]);
    };
    const chips = TIMES.map((_, i) => chip(i, null));
    const times = TIMES.map((t, i) =>
      new Text('t = ' + t, { fontSize: 0.2, color: soft }).moveTo([chipX(i), CHIP_Y + 0.72]),
    );

    // ---- the chart: tokens over time. Its y axis has the gauge's scale, so the
    // bucket's level always stands where the chart's line ends.
    const Y0 = -3.87,
      Y5 = 0.57;
    const axes = new Axes({
      xRange: [0, 2.5, 0.5],
      yRange: [0, CAPACITY, 1],
      width: 5.8,
      height: Y5 - Y0,
      axisStyle: { stroke: s.palette.muted, labelColor: soft, labelFontSize: 0.2, includeNumbers: true },
      xAxisStyle: { decimals: 1 },
      xLabel: 's',
      yLabel: 'tokens',
      axisLabelFontSize: 0.2,
    });
    axes.shift([-5.2 - axes.c2p(0, 0)[0], Y0 - axes.c2p(0, 0)[1]]);
    const need = axes.horizontalLine(1, {
      stroke: soft,
      strokeWidth: 0.02,
      dashArray: '0.1 0.08',
      to: 2,
    });
    const needLabel = new Text('1 token', { fontSize: 0.2, color: soft }).moveTo(
      [axes.c2p(2.05, 1)[0], axes.c2p(2.05, 1)[1] + 0.17],
      [-1, 0],
    );
    const line = (points: [number, number][], color: string, width = 0.045) => {
      const p = distinct(points);
      return p.length < 2 ? null : axes.lineGraph(p, { color, strokeWidth: width });
    };

    // ---- the gauge: a bucket whose level is the balance
    const SHELL_X = -6.75,
      SHELL_W = 1.1;
    const shell = new Rectangle({
      width: SHELL_W,
      height: Y5 - Y0 + 0.16,
      stroke: s.palette.muted,
      strokeWidth: 0.03,
      fill: s.palette.paper,
    }).moveTo([SHELL_X, (Y0 + Y5) / 2]);
    const fill = (n: number) =>
      new Rectangle({
        width: SHELL_W - 0.16,
        height: Math.max(0.001, ((Y5 - Y0) * n) / CAPACITY),
        stroke: 'none',
        fill: s.palette.accent,
      }).moveTo([SHELL_X, Y0], [0, -1]);
    const level = fill(CAPACITY);
    const bucketLabel = new Text('bucket', { fontSize: 0.2, color: soft }).moveTo([SHELL_X, Y0 - 0.33]);

    // ------------------------------------------------------------- balance
    await this.step('balance', {
      title: 'Five tokens of burst capacity',
      line: 'allow(now) adds refill on each call; no timer runs.',
      caption:
        'The bucket starts full at five tokens, and each accepted request spends one. allow(now) adds refill for the time since the last call, so no background timer runs. The chart will plot the balance over time; the dashed line is the one token a request needs.',
    });
    const record = (calls: Call[]) => ({
      rate,
      tokens: bucket.tokens,
      lastRefill: bucket.lastRefill,
      responses: calls.map((c) => (c.ok ? 200 : 429)),
      balances: calls.map((c) => c.after),
      allowed: calls.filter((c) => c.ok).length,
      rejected: calls.flatMap((c, i) => (c.ok ? [] : [name(i)])),
    });
    this.state = record([]);
    const readout = stateView(this, ['tokens', 'lastRefill', 'allowed', 'rejected'], {
      fontSize: 0.26,
      gap: 0.42,
      at: [3.85, -2.78],
      format: formatState,
    });
    this.readout = readout;
    const readoutTitle = new Text('scene.state', { fontSize: 0.2, color: soft }).moveTo([2.25, -2.4], [-1, 0]);
    s.keep(readout, readoutTitle, {
      describe: () =>
        'scene.state: ' +
        ['tokens', 'lastRefill', 'allowed', 'rejected'].map((k) => `${k} ${formatState(this.state[k])}`).join(', '),
    });
    await s.enter(shell, level, bucketLabel, { describe: gaugeSays });
    s.keep(axes, { describe: chartSays });
    await this.play(new Create(axes), { runTime: 2 });
    await s.enter(need, needLabel, { describe: chartSays });
    s.keep(chips[0]!, ...chips.slice(1), ...times, { describe: chipsSay });
    await this.play(...chips.map((c) => new FadeIn(c, { runTime: 0.4 })), ...times.map((t) => new FadeIn(t)));
    const code = await s.code(CODE, {
      at: [1.3, -2.25, 7.55, 1.55],
      title: `bucket.allow(now), rate = ${rate}`,
      fontSize: 0.25,
    });
    await this.play(new FadeIn(readout), new FadeIn(readoutTitle));
    await code.focus(REFILL, { as: 'refill' });

    /** The focus bar's place on lines a..b, as CodeBlock.focus draws it, for use inside a Succession. */
    const barAt = ([a, b]: readonly [number, number]) => {
      const lines = code.code.lines,
        pitch = Math.abs(lines[1]!.anchorPoint()[1] - lines[0]!.anchorPoint()[1]),
        top = lines[a]!.anchorPoint()[1] + pitch / 2,
        bottom = lines[b]!.anchorPoint()[1] - pitch / 2;
      return new Rectangle({
        width: code.panel.width() - 0.14,
        height: top - bottom,
        cornerRadius: 0.05,
        stroke: 'none',
      })
        .setStyle({ ...code.bar.style })
        .moveTo([code.panel.center()[0], (top + bottom) / 2]);
    };

    // ---------------------------------------- burst, refill, later: the calls
    const titles = [
      'Six at once: five 200s, then a 429',
      `Refill at ${rate}/s: R7–R9 get ${codes(6, 9)}`,
      `R10 arrives at 2 s and gets ${codes(9, 10)}`,
    ];
    const f = (i: number) => fmt(plan[i]!.found);
    // Which of R7–R9 found under one token, with the balance each one found.
    const low = [6, 7, 8].filter((i) => !plan[i]!.ok),
      lowNames = low.map((i) => `${name(i)} (${f(i)})`).join(' and ');
    const verdict = !low.length
      ? 'All three dots stay at or above the dashed line, so all three get 200.'
      : `${lowNames} ${low.length > 1 ? 'are' : 'is'} under the dashed line, so ${low.length > 1 ? 'they get' : 'it gets'} 429.`;
    const lines = [
      `No time passes, so no refill: R6 finds ${f(5)} tokens.`,
      `Between calls the balance climbs ${perSecond(rate)}.`,
      `R10 finds ${f(9)}; min(5, …) keeps the balance at five or below.`,
    ];
    const captions = [
      `Six requests arrive at time zero. No time has passed, so refill adds nothing and the line drops one token per request. The sixth finds ${f(5)} tokens, under the dashed line, and gets 429.`,
      `Between calls the line climbs at ${rate} a second: (now − lastRefill) × ${rate}. R7 at 0.5 s finds ${f(6)} and R8 at 1 s finds ${f(7)}; R9 arrives at the same instant as R8 and finds what R8 left. ${verdict}`,
      `R10 arrives at 2 s, one second after R9, and finds ${f(9)}. The min(5, …) cap keeps the balance at five or below however long a client waits. R10 spends one token and leaves ${fmt(plan[9]!.after)}.`,
    ];
    for (const [index, [from, to]] of GROUPS.entries()) {
      await this.step(['burst', 'refill', 'later'][index]!, {
        title: titles[index],
        line: lines[index],
        caption: captions[index],
      });
      // Ask the program, one request at a time; each call's members show its answer.
      const members: Animation[] = [];
      for (let i = from; i < to; i++) {
        const now = TIMES[i]!,
          prev = calls.at(-1) ?? START;
        const ok = bucket.allow(now);
        const call: Call = { at: now, ok, found: bucket.tokens + (ok ? 1 : 0), after: bucket.tokens };
        calls.push(call);
        const after = record(calls);
        // Refill: the bar on the min(…) lines while the line climbs to what the call found.
        const rise = line(climb(prev, call, rate), s.palette.accent);
        if (rise) s.keep(rise, { describe: chartSays });
        members.push(
          new AnimationGroup([new Transform(code.bar, barAt(REFILL)), ...(rise ? [new Create(rise)] : [])], {
            runTime: 0.3,
          }),
        );
        // The verdict: spend one token or refuse, and every readout follows.
        const drop = ok ? line([[now, call.found], [now, call.after]], s.palette.accent) : null;
        const dot = axes.dot(now, call.found, { radius: 0.085, color: ok ? s.good : s.bad });
        const tag = ok
          ? null
          : new Text(name(i), { fontSize: 0.2, color: s.bad }).moveTo(
              // Above and to the left: the line climbs away to the right.
              [dot.center()[0] - 0.12, dot.center()[1] + 0.28],
              [1, 0],
            );
        s.keep(dot, ...(drop ? [drop] : []), ...(tag ? [tag] : []), { describe: chartSays });
        const marks: Animation[] = [new FadeIn(dot), ...(tag ? [new FadeIn(tag)] : [])];
        const next = chip(i, ok);
        s.keep(next, { describe: chipsSay });
        members.push(
          new AnimationGroup(
            [
              new Transform(code.bar, barAt(ok ? SPEND : REFUSE)),
              ...(drop ? [new Create(drop)] : []),
              ...marks,
              new FadeOut(chips[i]!),
              new FadeIn(next),
              new Transform(level, fill(call.after)),
              // By position: a value that gains characters ("0" to "0.5") splits its
              // glyphs outward instead of growing new ones inside a box that jumps.
              new SyncToCall(this, readout, after, { match: 'index' }),
            ].map((a) => a.setOptions({ runTime: 0.4 })),
          ),
        );
        chips[i] = next;
      }
      await this.play(new Succession(members));
      // The bar already stands where the last call left it; this names those lines for the description.
      const last = calls.at(-1)!;
      await code.focus(last.ok ? SPEND : REFUSE, { as: last.ok ? 'spend' : 'refuse', runTime: 0.2 });
    }

    // --------------------------------------------------------------- trace
    const refused = RATES.map((r) => `${perSecond(r)}, ${list(refusedAt(r))}`);
    await this.step('trace', {
      title: 'The same ten requests at 1, 2 and 4 tokens a second',
      line: `429s at 4 / s: ${list(refusedAt(4))}; at 1 / s: ${list(refusedAt(1))}.`,
      caption: `Each line is one run of allow() over the same ten requests, and the bright one is this case. A faster refill climbs back over one token sooner: at ${refused[2]} gets 429, and at ${refused[0]} do.`,
    });
    const others = RATES.filter((r) => r !== rate).map((r) => {
      const run = runs.get(r)!;
      const points = run.flatMap((c, i): [number, number][] => [
        ...climb(i ? run[i - 1]! : START, c, r),
        [c.at, c.after],
      ]);
      return line(points, soft, 0.03)!.setStyle({ strokeOpacity: 0.7 }) as VMobject;
    });
    // Each line's end names its rate and, under it, the requests it refused: the table the
    // three runs make, said where each run ends.
    const ends = new Group(
      ...RATES.map((r) => {
        const last = runs.get(r)!.at(-1)!,
          p = axes.c2p(last.at, last.after),
          color = r === rate ? s.palette.accent : soft,
          weight = r === rate ? ('bold' as const) : ('normal' as const);
        const rateLabel = new Text(`${r} / s`, { fontSize: 0.2, color, weight }),
          refusedLabel = new Text(refusedAt(r).length ? `429: ${list(refusedAt(r))}` : 'no 429', { fontSize: 0.2, color, weight });
        const at: [number, number] = [p[0] + 0.16, Math.max(p[1], Y0 + 0.42)];
        rateLabel.moveTo([at[0], at[1] + 0.12], [-1, 0]);
        refusedLabel.moveTo([at[0], at[1] - 0.12], [-1, 0]);
        return new Group(rateLabel, refusedLabel);
      }),
    );
    await this.play(new FadeOut(code, { runTime: 0.4 }), new FadeOut(needLabel, { runTime: 0.4 }));
    othersShown = true;
    s.keep(others[0]!, ...others.slice(1), ends, { describe: chartSays });
    await this.play(...others.map((o) => new Create(o, { runTime: 1.2 })), new FadeIn(ends));
  }
}
