import { Scene, Rectangle, Text, Group, FadeIn, FadeOut, Transform } from '../../../src/index.ts';
import type { Vec } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { TokenBucket } from '../lib/models.ts';

const TIMES = [0, 0, 0, 0, 0, 0, 0.5, 1, 1, 2];
const GROUPS = [
  [0, 6],
  [6, 9],
  [9, 10],
] as const;
const OK = '#3fb950',
  NO = '#f85149';
const CODE = [
  'function allow(now) {',
  '  tokens = min(5, tokens + (now - lastRefill) * rate)',
  '  lastRefill = now',
  '  if (tokens < 1) return 429',
  '  tokens -= 1',
  '  return 200',
  '}',
];
const fmt = (n: number) => n.toFixed(1);
const secs = (t: number) => `${t} s`;

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
  override async construct() {
    const rate = Number(settingsOf(this).rate),
      bucket = new TokenBucket(rate),
      s = stage(this, { palette: palette('github-dark') });
    const ink = s.palette.ink,
      soft = s.soft;

    // A dry run of the same model, so titles and captions can name its answers.
    const plan = (() => {
      const sim = new TokenBucket(rate);
      let before = sim.tokens;
      return TIMES.map((at) => {
        const ok = sim.allow(at),
          refilled = sim.tokens + (ok ? 1 : 0),
          gain = refilled - before;
        before = sim.tokens;
        return { at, ok, gain, after: sim.tokens };
      });
    })();
    const codes = (a: number, b: number) =>
      plan
        .slice(a, b)
        .map((r) => (r.ok ? 200 : 429))
        .join(', ');

    // ---- request chips: one per call, filled in as each answer comes back
    const PITCH = 1.46,
      CHIP_Y = 2.3;
    const chipX = (i: number) => (i - 4.5) * PITCH;
    const chip = (i: number, result: boolean | null) => {
      const color = result == null ? s.palette.muted : result ? OK : NO;
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
      const name = new Text('R' + (i + 1), { fontSize: 0.2, color: soft }).moveTo([0, 0.24]);
      const answer = new Text(result == null ? '…' : result ? '200' : '429', {
        fontSize: 0.3,
        font: 'mono',
        weight: 'bold',
        color: result == null ? soft : ink,
      }).moveTo([0, -0.14]);
      return new Group(box, name, answer).moveTo([chipX(i), CHIP_Y]);
    };
    const chips = TIMES.map((_, i) => chip(i, null));
    const times = TIMES.map((t, i) =>
      new Text('t = ' + t, { fontSize: 0.2, color: soft }).moveTo([chipX(i), CHIP_Y + 0.72]),
    );

    // ---- the gauge: a bucket whose level is the balance
    const SHELL_X = -6.4,
      SHELL_BOTTOM = -3.95,
      SHELL_H = 4.6;
    const shell = new Rectangle({
      width: 1.3,
      height: SHELL_H,
      stroke: s.palette.muted,
      strokeWidth: 0.03,
      fill: s.palette.paper,
    }).moveTo([SHELL_X, SHELL_BOTTOM + SHELL_H / 2]);
    const fill = (n: number) =>
      new Rectangle({
        width: 1.14,
        height: Math.max(0.001, ((SHELL_H - 0.16) * n) / 5),
        stroke: 'none',
        fill: s.palette.accent,
      }).moveTo([SHELL_X, SHELL_BOTTOM + 0.08], [0, -1]);
    const ticks = new Group(
      ...[0, 1, 2, 3, 4, 5].map((n) =>
        new Text(String(n), { fontSize: 0.2, color: soft }).moveTo([
          SHELL_X - 0.95,
          SHELL_BOTTOM + 0.08 + ((SHELL_H - 0.16) * n) / 5,
        ]),
      ),
      ...[1, 2, 3, 4].map((n) =>
        new Rectangle({
          width: 0.18,
          height: 0.012,
          stroke: 'none',
          fill: s.palette.muted,
        }).moveTo([SHELL_X - 0.72, SHELL_BOTTOM + 0.08 + ((SHELL_H - 0.16) * n) / 5]),
      ),
    );
    const numberAt: Vec = [-4.15, -1.2];
    const numberText = (n: number) =>
      new Text(fmt(n), { fontSize: 0.72, font: 'mono', color: ink }).moveTo(numberAt);
    const level = fill(5);
    let number = numberText(5);
    const gauge = new Group(shell, ticks);

    // ------------------------------------------------------------- balance
    await this.step('balance', {
      title: 'Five tokens of burst capacity',
      caption:
        'The bucket starts full at five tokens, and each accepted request spends one. allow(now) adds refill for the time since the last call, so no background timer runs. The chips above are R1–R10 at their arrival times.',
    });
    await this.play(new FadeIn(gauge), new FadeIn(level), new FadeIn(number));
    await this.play(...chips.map((c) => new FadeIn(c, { runTime: 0.4 })), ...times.map((t) => new FadeIn(t)));
    const code = await s.code(CODE, {
      at: [-2.75, -2.0, 7.55, 1.6],
      fontSize: 0.25,
    });
    const card = await s.card(
      [
        ['Refill rate', `${rate} token${rate > 1 ? 's' : ''} / s`],
        ['Last call', 'none yet'],
        ['Refill on arrival', '—'],
      ],
      // Same width and centre as the code above, so the two share both edges.
      { at: [-2.75, -4.25, 7.55, -2.2], width: code.width(), fontSize: 0.24 },
    );
    await code.focus(1);

    // ---------------------------------------- burst, refill, later: the calls
    const responses: number[] = [],
      balances: number[] = [];
    const titles = [
      'Six at once: five 200s, then a 429',
      `Refill at ${rate}/s: R7–R9 get ${codes(6, 9)}`,
      `R10 arrives at 2 s and gets ${codes(9, 10)}`,
    ];
    const g = (i: number) => fmt(plan[i]!.gain);
    // Which of R7–R9 found under one token, with the balance each one found.
    const low = [6, 7, 8].filter((i) => !plan[i]!.ok),
      lowNames = low.map((i) => `R${i + 1} (${fmt(plan[i]!.after)})`).join(' and ');
    const verdict = !low.length
      ? 'Each still has at least 1 token, so all three get 200.'
      : `${lowNames} ${low.length > 1 ? 'are' : 'is'} under 1 token, so ${low.length > 1 ? 'they get' : 'it gets'} 429.`;
    const leftover = plan.find((r) => !r.ok && r.after > 0);
    const captions = [
      'Six requests arrive at time zero. No time has passed, so refill adds nothing: the first five spend the balance and the sixth hits the tokens < 1 check and gets 429.',
      `Refill is (now − lastRefill) × ${rate}. R7 at 0.5 s gains ${g(6)} and R8 at 1 s gains ${g(7)}; R9 arrives at the same instant as R8 and gains nothing. ${verdict}`,
      `R10 arrives at 2 s, one second after R9, and gains ${g(9)}. The min(5, …) cap keeps the balance at five or below however long a client waits. R10 spends one token and leaves ${fmt(plan[9]!.after)}.`,
    ];
    for (const [index, [from, to]] of GROUPS.entries()) {
      await this.step(['burst', 'refill', 'later'][index]!, {
        title: titles[index],
        caption: captions[index],
      });
      for (let i = from; i < to; i++) {
        const now = TIMES[i]!,
          before = bucket.tokens,
          last = bucket.lastRefill;
        await code.focus(1, { runTime: 0.2 });
        const ok = bucket.allow(now);
        responses.push(ok ? 200 : 429);
        balances.push(bucket.tokens);
        this.state = {
          tokens: bucket.tokens,
          lastRefill: bucket.lastRefill,
          responses: [...responses],
          rate,
        };
        const refilled = bucket.tokens + (ok ? 1 : 0);
        const next = chip(i, ok);
        const nextNumber = numberText(bucket.tokens),
          nextLevel = fill(bucket.tokens);
        await this.play(
          new FadeOut(chips[i]!),
          new FadeIn(next),
          new Transform(level, nextLevel),
          new FadeOut(number),
          new FadeIn(nextNumber),
          { runTime: 0.3 },
        );
        chips[i] = next;
        number = nextNumber;
        await code.focus(ok ? [4, 5] : 3, { runTime: 0.25 });
        await card.set(
          {
            'Last call': `R${i + 1} at ${secs(now)} → ${ok ? 200 : 429}`,
            'Refill on arrival': `+${fmt(refilled - before)} (${now - last} s × ${rate})`,
          },
          { runTime: 0.25 },
        );
      }
      await card.mark('Last call');
    }

    // --------------------------------------------------------------- trace
    await this.step('trace', {
      title: 'The balance after each call, with 429s in red',
      caption: `Each bar is the balance left after one allow call, and the red columns are the requests that got 429.${
        leftover
          ? ` R${plan.indexOf(leftover) + 1} got 429 yet left ${fmt(leftover.after)} tokens, because a request needs a whole token.`
          : ''
      }`,
    });
    await this.play(...[gauge, level, number, code, card].map((m) => new FadeOut(m, { runTime: 0.4 })));
    // A wide canvas, so each column sits under its answer chip.
    const source =
      '---\nconfig:\n  xyChart:\n    width: 1100\n    height: 420\n---\n' +
      'xychart-beta\n x-axis [R1,R2,R3,R4,R5,R6,R7,R8,R9,R10]\n y-axis "Tokens remaining" 0 --> 5\n bar [' +
      balances.join(',') +
      ']';
    const chart = await s.show({ source, style: 'github-dark' }, { box: [-7.55, -4.25, 7.55, 1.55] });
    // Line the answer chips up over their own columns.
    const columnX = (i: number) => chart.get('axis:x:tick:R' + (i + 1)).center()[0];
    await this.play(
      ...chips.map((c, i) => c.animate.moveTo([columnX(i), CHIP_Y])),
      ...times.map((t, i) => t.animate.moveTo([columnX(i), CHIP_Y + 0.72])),
      { runTime: 0.6 },
    );
    const rejected = responses.flatMap((r, i) => (r === 429 ? [i] : []));
    const y0 = chart.get('axis:y:tick:0').center()[1],
      y5 = chart.get('axis:y:tick:5').center()[1];
    const pitch = columnX(1) - columnX(0);
    const bands = new Group(
      ...rejected.map((i) =>
        new Rectangle({
          width: pitch * 0.92,
          height: y5 - y0,
          stroke: NO,
          strokeWidth: 0.02,
          fill: NO,
          fillOpacity: 0.12,
        }).moveTo([columnX(i), (y0 + y5) / 2]),
      ),
    );
    s.keep(bands);
    await this.play(new FadeIn(bands));
    await chart.mark(
      rejected.map((i) => 'bar:0:R' + (i + 1)),
      { color: NO },
    );
  }
}
