// An MR explainer: "Add a KV cache in front of D1 user lookups."
// Runs unchanged in the browser (DomSink), Node and Workers (StringSink).

import {
  Scene, Group, Labeled, Rectangle, Text, Code, Arrow, Line, FadeIn, FadeOut, Create, Write, Transform,
  Indicate, LaggedStart, UP, DOWN, LEFT, RIGHT, BLUE, TEAL, GOLD, RED, GREY, WHITE, GREEN, linear,
} from '../src/index.ts';
import type { Mobject } from '../src/index.ts';

function node(label: string, color: string, { width = null, height = 1 }: { width?: number | null; height?: number } = {}) {
  const text = new Text(label, { fontSize: 0.38, color: WHITE });
  const w = width ?? Math.max(2.2, text.width() + 0.7);
  const box = new Rectangle({ width: w, height, cornerRadius: 0.18, stroke: color, strokeWidth: 0.05, fill: color, fillOpacity: 0.12 });
  return new Labeled(box, text);
}

function edge(from: Mobject, to: Mobject, { color = GREY, buff = 0.15 }: { color?: string; buff?: number } = {}) {
  return new Arrow(from.right(), to.left(), { stroke: color, strokeWidth: 0.045, buff });
}

export class CacheMRScene extends Scene {
  override async construct() {
    const mr = { cache: false, d1Reads: 'every request' };
    this.state = mr;
    await this.step('before');
    const title = new Text('MR #482 · Add KV cache in front of D1 user lookups', { fontSize: 0.42, weight: 'bold' })
      .toEdge(UP, 0.5);
    await this.play(new Write(title), { runTime: 1.2 });

    // --- Before: Request -> Handler -> D1 --------------------------------
    const req = node('Request', BLUE).moveTo([-5, 1.2]);
    const handler = node('Worker handler', TEAL).moveTo([0, 1.2]);
    const d1 = node('D1', GOLD).moveTo([5, 1.2]);
    const e1 = edge(req, handler);
    const e2 = edge(handler, d1);

    await this.play(new LaggedStart([new FadeIn(req, { shift: [0, -0.3] }), new Create(e1), new FadeIn(handler, { shift: [0, -0.3] }), new Create(e2), new FadeIn(d1, { shift: [0, -0.3] })], { lagRatio: 0.35 }), { runTime: 2 });

    const caption = new Text('Before: every request reads from D1', { fontSize: 0.34, color: GREY }).moveTo([0, -0.3]);
    await this.play(new FadeIn(caption));
    await this.play(new Indicate(e2, { color: RED }), new Indicate(d1.shape, { color: RED }), { runTime: 1 });
    await this.wait(0.4);
    await this.step('diff');
    const before = new Code([
      'async function getUser(id, env) {',
      '  return env.DB.prepare(SQL).bind(id).first();',
      '}',
    ], { fontSize: 0.27 }).moveTo([0, -2.4]);
    await this.play(new FadeIn(before, { shift: [0, -0.2] }));
    await this.wait(0.6);

    const after = new Code([
      'async function getUser(id, env) {',
      '  const hit = await env.KV.get(`user:${id}`, "json");',
      '  if (hit) return hit;',
      '  const row = await env.DB.prepare(SQL).bind(id).first();',
      '  await env.KV.put(`user:${id}`, JSON.stringify(row), { expirationTtl: 300 });',
      '  return row;',
      '}',
    ], { fontSize: 0.27 }).moveTo([0, -2.6]);
    // Color the added lines green
    for (const i of [1, 2, 4]) after.lines[i]!.setFill(GREEN);
    await this.play(new Transform(before, after, { replace: true }), { runTime: 1.4 });
    await this.wait(0.8);
    await this.step('after');
    mr.cache = true; mr.d1Reads = 'misses only';
    const kv = node('KV cache', GREEN, { width: 2.2 }).moveTo([2.3, 1.2]);
    kv.setOpacity(0);
    const newCaption = new Text('After: KV answers hits, D1 only sees misses', { fontSize: 0.34, color: GREY }).moveTo(caption);

    // Make room: boxes shift; updaters keep the arrows attached while they move
    e1.addUpdater((a) => a.putStartAndEndOn(req.right(), handler.left(), 0.15));
    e2.addUpdater((a) => a.putStartAndEndOn(handler.right(), d1.left(), 0.15));
    await this.play(
      handler.animate.shift([-1.2, 0]),
      d1.animate.shift([0.8, 0]),
      req.animate.shift([-0.6, 0]),
      new Transform(caption, newCaption, { replace: true }),
      { runTime: 0.8 },
    );
    e1.clearUpdaters(); e2.clearUpdaters();
    const e2target = new Arrow(handler.right(), kv.left(), { stroke: GREEN, strokeWidth: 0.045, buff: 0.15 });
    const e3 = new Arrow(kv.right(), d1.left(), { stroke: GOLD, strokeWidth: 0.045, buff: 0.15 });
    const missLabel = new Text('miss', { fontSize: 0.26, color: GOLD }).nextTo(e3, UP, 0.08);
    const hitLabel = new Text('hit → return', { fontSize: 0.26, color: GREEN }).nextTo(kv, DOWN, 0.15);

    kv.setOpacity(1);
    await this.play(
      new Transform(e2, e2target, { replace: true }),
      new FadeIn(kv, { scale: 0.8 }),
      { runTime: 0.9 },
    );
    await this.play(new Create(e3), new FadeIn(missLabel), new FadeIn(hitLabel), { runTime: 0.9 });
    await this.wait(0.5);
    await this.step('result');
    mr.d1Reads = '~20% of before';
    const result = new Text('Result: ~80% fewer D1 reads at p50, TTL 300s', { fontSize: 0.42, weight: 'bold', color: GREEN }).toEdge(UP, 0.5);
    await this.play(new Transform(title, result, { replace: true }), { runTime: 1 });
    await this.play(new Indicate(kv.shape, { color: GREEN, scaleFactor: 1.1 }), { runTime: 1 });
    await this.wait(1.5);
  }
}
