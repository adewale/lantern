import { Scene, Rectangle, Text, FadeIn, FadeOut, Transform, Code } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { TokenBucket } from '../lib/models.ts';
export default class TokenBucketExplainer extends Scene {
  static meta = {
    id: 'token-bucket',
    title: 'A rate limit is a balance, not a timer',
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
      s = stage(this, {
        palette: palette('github-dark'),
        title: 'Refill from elapsed time, then try to consume',
      });
    await this.step('balance', {
      title: 'Five tokens of burst capacity',
      caption:
        'The bucket begins full. One accepted request spends one token. Refill is computed when a request arrives, so no background timer is required.',
    });
    const shell = new Rectangle({
      width: 1.2,
      height: 4,
      stroke: s.palette.muted,
      fill: s.palette.paper,
    }).moveTo([-5.4, -0.2]);
    const fill = (n: number) =>
      new Rectangle({
        width: 1.05,
        height: Math.max(0.001, (3.85 * n) / 5),
        stroke: 'none',
        fill: s.palette.accent,
      }).moveTo([-5.4, -2.12], [0, -1]);
    const level = fill(5),
      number = new Text('5.0', { fontSize: 0.6, font: 'mono', color: s.palette.ink }).moveTo([-3.7, 0]);
    const code = new Code(
      [
        'tokens = min(5, tokens + elapsed * rate)',
        'lastRefill = now',
        'if (tokens < 1) return 429',
        'tokens -= 1',
        'return 200',
      ],
      { fontSize: 0.24 },
    ).moveTo([2.0, 0.5]);
    code.setFill(s.palette.ink);
    await this.play(new FadeIn(shell), new FadeIn(level), new FadeIn(number), new FadeIn(code));
    const times = [0, 0, 0, 0, 0, 0, 0.5, 1, 1, 2],
      responses: number[] = [],
      balances: number[] = [];
    for (const [index, group] of [
      [0, times.slice(0, 6)],
      [1, times.slice(6, 9)],
      [2, times.slice(9)],
    ] as const) {
      await this.step(['burst', 'refill', 'later'][index]!, {
        title: ['Spend the burst', 'Half a second changes the answer', 'Wait, then ask again'][index],
        caption: [
          `Six requests arrive at time zero. The first five spend the initial balance; the sixth receives 429. The refill rate cannot rescue a zero-time burst.`,
          `At ${rate} tokens per second, elapsed time changes which requests fit. Switch rates to see why fractional tokens can still produce a rejection.`,
          `Refill is capped at capacity. Waiting earns tokens, but never an unlimited burst. The chart will show the actual balances from these calls.`,
        ][index],
      });
      for (const now of group) {
        const ok = bucket.allow(now);
        responses.push(ok ? 200 : 429);
        balances.push(bucket.tokens);
        this.state = {
          tokens: bucket.tokens,
          lastRefill: bucket.lastRefill,
          responses: [...responses],
          rate,
        };
        await this.play(
          new Transform(level, fill(bucket.tokens)),
          new Transform(
            number,
            new Text(bucket.tokens.toFixed(1), { fontSize: 0.6, font: 'mono', color: s.palette.ink }).moveTo(
              number,
            ),
          ),
          { runTime: 0.3 },
        );
      }
    }
    await this.step('trace', {
      title: 'Plot the program, not a sketch',
      caption:
        'Each bar is the balance after one real allow call. Capacity and refill jointly determine the result. These plotted values come from the same execution that drove the gauge.',
    });
    await this.play(...[shell, level, number, code].map((m) => new FadeOut(m, { runTime: 0.4 })));
    const chart =
      'xychart-beta\n x-axis [R1,R2,R3,R4,R5,R6,R7,R8,R9,R10]\n y-axis "Tokens remaining" 0 --> 5\n bar [' +
      balances.join(',') +
      ']';
    await s.show({ source: chart, style: 'github-dark' }, { box: [-7, -3.5, 7, 2.9] });
  }
}
