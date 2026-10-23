// Example 3: a token-bucket rate limiter. Two numbers are the state
// (tokens, lastRefill); each request first refills from elapsed time, then
// tries to consume. A gauge, the numbers and the code move together.
import {
  Scene, Group, Rectangle, Text, Dot, DecimalNumber, FadeIn, FadeOut, Write, Transform, Indicate,
  Flash, BLUE, TEAL, GREEN, GOLD, RED, GREY, WHITE, YELLOW, UP, DOWN, LEFT, RIGHT,
  title, CodePanel, StateReadout,
} from '../src/index.ts';
import type { Playable, Text as TextT } from '../src/index.ts';

const CAP = 10, RATE = 2; // tokens per second

/**
 * The program, instrumented: `line(i)` fires after each statement with the
 * live state. The scene plays those events; it never computes a token count
 * itself, so what it shows cannot disagree with what allow() does.
 */
class TokenBucket {
  tokens: number;
  lastRefill: number;
  line: (i: number) => void;
  constructor(line: (i: number) => void) { this.tokens = CAP; this.lastRefill = 0; this.line = line; }
  allow(now: number): boolean {
    const elapsed = now - this.lastRefill;                              this.line(1);
    this.tokens = Math.min(CAP, this.tokens + elapsed * RATE);          this.line(2);
    this.lastRefill = now;                                              this.line(3);
    if (this.tokens < 1) {                                              this.line(4);
      return false; }                                       // 429
    this.tokens -= 1;                                                   this.line(5);
    return true;                                            // 200      (line 6)
  }
}

export class TokenBucketScene extends Scene {
  override async construct() {
    await this.step('intro');
    const t = title('Token bucket: refill from elapsed time, then consume');
    await this.play(new Write(t), { runTime: 0.8 });

    // --- gauge ------------------------------------------------------------
    const W = 0.9, H = 4.2;
    const shell = new Rectangle({ width: W, height: H, cornerRadius: 0.12, stroke: GREY, strokeWidth: 0.04 }).moveTo([-5.8, -0.2]);
    const fillOf = (n: number) => new Rectangle({ width: W - 0.12, height: Math.max(0.001, (H - 0.12) * n / CAP), cornerRadius: 0.08, fill: TEAL, fillOpacity: 0.85, stroke: 'none' })
      .moveTo(shell, DOWN).shift([0, 0.06]);
    const level = fillOf(CAP);
    const ticks = new Group(...Array.from({ length: CAP + 1 }, (_, i) => {
      const y = shell.bottom()[1] + 0.06 + (H - 0.12) * i / CAP;
      return new Text(String(i), { fontSize: 0.18, font: 'mono', color: GREY, anchor: 'end' }).moveTo([shell.left()[0] - 0.15, y], [1, 0]);
    }));
    await this.play(new FadeIn(shell), new FadeIn(level), new FadeIn(ticks), { runTime: 0.7 });

    // --- state + code ---------------------------------------------------------
    const tokens = new DecimalNumber(CAP, { decimals: 1, fontSize: 0.3, font: 'mono', color: WHITE, anchor: 'start' });
    const last = new DecimalNumber(0, { decimals: 1, suffix: 's', fontSize: 0.3, font: 'mono', color: WHITE, anchor: 'start' });
    const now = new DecimalNumber(0, { decimals: 1, suffix: 's', fontSize: 0.3, font: 'mono', color: GOLD, anchor: 'start' });
    const labels = new StateReadout([['tokens', ''], ['lastRefill', ''], ['now', '']], { fontSize: 0.3, at: [-2.6, 2.3], gap: 0.5 });
    const { tokens: tokensSlot, lastRefill: lastSlot, now: nowSlot } = labels.values as Record<'tokens' | 'lastRefill' | 'now', TextT>;
    tokens.moveTo(tokensSlot, [-1, 0]);
    last.moveTo(lastSlot, [-1, 0]);
    now.moveTo(nowSlot, [-1, 0]);
    labels.remove(tokensSlot, lastSlot, nowSlot);
    const state = new Group(labels, tokens, last, now);

    const code = new CodePanel([
      'allow(now) {',
      '  const elapsed = now - this.lastRefill;',
      '  this.tokens = Math.min(CAP, this.tokens + elapsed * RATE);',
      '  this.lastRefill = now;',
      '  if (this.tokens < 1) return false;   // 429',
      '  this.tokens -= 1;',
      '  return true;                         // 200',
      '}',
    ], { fontSize: 0.24, at: [3.4, 1.3] });
    await this.play(new FadeIn(state, { shift: [0.2, 0] }), new FadeIn(code, { shift: [0.3, 0] }), { runTime: 0.7 });

    const verdicts: TextT[] = [];
    const st = { tokens: CAP, lastRefill: 0, responses: [] as number[] };
    this.state = st;
    const setNum = (m: DecimalNumber, v: number) => new Transform(m, m.copy().setValue(v));
    const setLevel = (n: number) => new Transform(level, fillOf(n));

    // Run the real allow() and animate its trace: each event is (line, state after it)
    const events: Array<{ line: number; tokens: number; lastRefill: number }> = [];
    const bucket = new TokenBucket((i) => events.push({ line: i, tokens: bucket.tokens, lastRefill: bucket.lastRefill }));
    const request = async (at: number, { burst = 1 }: { burst?: number } = {}) => {
      await this.step(`t${String(at).replace('.', '_')}`, { at, burst });
      await this.play(setNum(now, at), { runTime: 0.3 });
      for (let b = 0; b < burst; b++) {
        events.length = 0;
        const ok = bucket.allow(at);
        for (const ev of events) {
          const anims: Playable[] = [code.focus(ev.line, ev.line === 4 ? RED : YELLOW)];
          if (ev.tokens !== st.tokens) { anims.push(setNum(tokens, ev.tokens), setLevel(ev.tokens)); st.tokens = ev.tokens; }
          if (ev.lastRefill !== st.lastRefill) { anims.push(setNum(last, ev.lastRefill)); st.lastRefill = ev.lastRefill; }
          if (ev.line === 4) anims.push(new Indicate(tokens, { color: RED }));
          // Lines that change nothing (a refill with no elapsed time) flash by
          await this.play(...anims, { runTime: anims.length > 1 ? 0.45 : 0.2 });
        }
        const v = new Text(ok ? '200' : '429', { fontSize: 0.26, font: 'mono', color: ok ? GREEN : RED });
        verdicts.push(v); st.responses.push(ok ? 200 : 429);
        await this.play(...(ok ? [code.focus(6, GREEN)] : []), new FadeIn(place(v), { shift: [0, -0.15] }), { runTime: 0.3 });
        if (!ok) break;
      }
    };
    // Verdict log: a row along the bottom
    const place = (v: TextT) => v.moveTo([-3.9 + (verdicts.length - 1) * 0.62, -2.9]);
    const logLabel = new Text('responses', { fontSize: 0.22, color: GREY, anchor: 'end' }).moveTo([-4.3, -2.9], [1, 0]);
    await this.play(new FadeIn(logLabel), { runTime: 0.3 });

    await request(0.0);
    await request(0.5, { burst: 11 }); // drains the bucket, the 11th is a 429
    await this.wait(0.4);
    const note = new Text('idle 2s → +4 tokens (capped at 10)', { fontSize: 0.26, color: TEAL }).moveTo([-2.0, -1.0]);
    await this.play(new FadeIn(note, { shift: [0, -0.2] }), { runTime: 0.4 });
    await request(2.5, { burst: 2 });
    await this.play(code.unfocus(), new FadeOut(note), { runTime: 0.4 });
    await this.wait(1.5);
  }
}
