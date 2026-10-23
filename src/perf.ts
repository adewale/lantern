// Span tracer. Zero deps, near-zero cost when off (one boolean check).
//
//   perf.enable()                      start collecting
//   perf.span('render', () => ...)     time a synchronous block (nests)
//   perf.count('copy.points', n)       a counter, no timing
//   perf.report()                      table: calls, total, self, per call
//   perf.chromeTrace()                 Trace Event JSON for ui.perfetto.dev / chrome://tracing
//
// Self time is total minus time spent in child spans, so the table answers
// "where does the time actually go" rather than "what is on the stack".
// Only spans at depth <= timelineDepth are kept as individual events; deeper
// spans are aggregated, which keeps a 700-frame trace small.

const now: () => number = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

interface SpanFrame { name: string; start: number; child: number }
interface SpanStats { calls: number; total: number; self: number; max: number }
export interface SpanRow extends SpanStats { name: string }
interface TraceEvent { name: string; ph: 'X'; ts: number; dur: number; pid: number; tid: number }

class Perf {
  on: boolean;
  stats!: Map<string, SpanStats>;
  counters!: Map<string, number>;
  stack!: SpanFrame[];
  events!: TraceEvent[];
  t0!: number;
  timelineDepth?: number;

  constructor() { this.on = false; this.reset(); }
  reset(): void {
    this.stats = new Map(); // name -> { calls, total, self }
    this.counters = new Map();
    this.stack = [];
    this.events = [];
    this.t0 = now();
  }
  enable({ timelineDepth = 2 }: { timelineDepth?: number } = {}): this { this.reset(); this.on = true; this.timelineDepth = timelineDepth; return this; }
  disable(): this { this.on = false; return this; }

  span<T>(name: string, fn: () => T): T {
    if (!this.on) return fn();
    const frame = { name, start: now(), child: 0 };
    this.stack.push(frame);
    try { return fn(); } finally { this.close(frame); }
  }

  /** For async code: const end = perf.begin('x'); ...; end(). Not nested-safe across awaits for self time. */
  begin(name: string): () => void {
    if (!this.on) return noop;
    const frame = { name, start: now(), child: 0 };
    this.stack.push(frame);
    return () => this.close(frame);
  }

  close(frame: SpanFrame): void {
    const end = now();
    const dur = end - frame.start;
    const i = this.stack.lastIndexOf(frame);
    if (i >= 0) this.stack.splice(i, 1);
    const parent = this.stack[this.stack.length - 1];
    if (parent) parent.child += dur;
    let s = this.stats.get(frame.name);
    if (!s) this.stats.set(frame.name, (s = { calls: 0, total: 0, self: 0, max: 0 }));
    s.calls++; s.total += dur; s.self += dur - frame.child; if (dur > s.max) s.max = dur;
    // timelineDepth is set whenever spans are recorded (enable() sets it with `on`)
    if (i < this.timelineDepth!) {
      this.events.push({ name: frame.name, ph: 'X', ts: (frame.start - this.t0) * 1000, dur: dur * 1000, pid: 1, tid: 1 });
    }
  }

  count(name: string, n = 1): void {
    if (!this.on) return;
    this.counters.set(name, (this.counters.get(name) ?? 0) + n);
  }

  rows(): SpanRow[] {
    return [...this.stats].map(([name, s]) => ({ name, ...s })).sort((a, b) => b.self - a.self);
  }

  report({ top = 25 }: { top?: number } = {}): string {
    const rows = this.rows();
    const wall = rows.reduce((m, r) => Math.max(m, r.total), 0);
    const pad = (s: string | number, n: number) => String(s).padStart(n);
    const lines = [`${'span'.padEnd(28)} ${pad('calls', 9)} ${pad('total ms', 10)} ${pad('self ms', 10)} ${pad('self %', 7)} ${pad('µs/call', 9)}`];
    for (const r of rows.slice(0, top)) {
      lines.push(`${r.name.padEnd(28)} ${pad(r.calls, 9)} ${pad(r.total.toFixed(1), 10)} ${pad(r.self.toFixed(1), 10)} ${pad((100 * r.self / wall).toFixed(1), 7)} ${pad((1000 * r.total / r.calls).toFixed(1), 9)}`);
    }
    if (this.counters.size) {
      lines.push('', 'counters:');
      for (const [k, v] of [...this.counters].sort((a, b) => b[1] - a[1])) lines.push(`  ${k.padEnd(26)} ${pad(v.toLocaleString(), 14)}`);
    }
    return lines.join('\n');
  }

  chromeTrace(): string { return JSON.stringify({ traceEvents: this.events, displayTimeUnit: 'ms' }); }
}

const noop = (): void => {};
export const perf = new Perf();
export type { Perf };
