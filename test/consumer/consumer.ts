// A TypeScript consumer of the package, type-checked against the emitted
// declarations in dist/ (npm run check builds them first). 'rayner' resolves
// through package.json "exports", as it would from node_modules. If this stops
// compiling, the public types broke.
import { Scene, Rectangle, Text, Labeled, Arrow, FadeIn, Create, Transform, RIGHT, TEAL, StringSink, traceScene, renderAt, SnapshotSink } from 'rayner';
import type { AnimOpts, TextOpts } from 'rayner';

export class Demo extends Scene {
  override async construct() {
    this.state = { ok: false };
    await this.step('one', { caption: 'hello' });
    const opts: TextOpts = { fontSize: 0.3, font: 'mono' };
    const box = new Labeled(new Rectangle({ width: 2, height: 1, stroke: TEAL }), new Text('box', opts));
    const a = new Arrow([0, 0], [1, 0], { buff: 0.1 });
    const fade: AnimOpts = { runTime: 0.5 };
    await this.play(new FadeIn(box, { shift: [0, 1] }), new Create(a), fade);
    await this.play(box.animate.shift(RIGHT));
    await this.play(new Transform(a, new Arrow([0, 0], [2, 0])));
    this.state = { ok: true };
  }
}

export async function run(): Promise<number> {
  const sink = new StringSink();
  await new Demo(sink, { fps: 30 }).run();
  const tr = await traceScene(Demo);
  const snap = new SnapshotSink();
  await renderAt(Demo, 0.2, snap);
  return sink.frames.length + tr.steps.length + snap.svg.length;
}
