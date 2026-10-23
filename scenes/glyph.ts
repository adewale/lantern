// Example 5: real text. Titles and code are glyph outlines (Inter, JetBrains
// Mono via the glyph shaper), so widths are exact, Write draws letter by
// letter, and a diff is a morph from the old line's glyphs to the new line's.
import {
  Scene, Code, Text, Group, Labeled, Rectangle, Arrow, FadeIn, FadeOut, Create, Transform, Indicate,
  LaggedStart, UP, DOWN, LEFT, BLUE, TEAL, GOLD, GREEN, RED, GREY, WHITE, YELLOW, linear,
} from '../src/index.ts';

export class GlyphScene extends Scene {
  override async construct() {
    const st = { title: 'estimated', codeLine: 'before' };
    this.state = st;

    await this.step('write');
    const title = new Text('Text as outlines: exact widths, letter-by-letter Write', { fontSize: 0.42 }).toEdge(UP, 0.5);
    // Write: each glyph is a VMobject, so Create with lag draws them in order
    await this.play(new Create(title, { lagRatio: 0.08 }), { runTime: 1.6 });

    // --- boxes sized by advance, not by a character-count estimate -----------
    await this.step('exact-boxes');
    const node = (label: string, color: string, x: number) => {
      const t = new Text(label, { fontSize: 0.36 });
      const box = new Rectangle({ width: t.advance() + 0.7, height: 1, cornerRadius: 0.16, stroke: color, strokeWidth: 0.05, fill: color, fillOpacity: 0.12 });
      return new Labeled(box, t).moveTo([x, 1.3]);
    };
    const a = node('Request', BLUE, -5.2), b = node('Worker handler', TEAL, -1.2), c = node('D1', GOLD, 2.6);
    const e1 = new Arrow(a.shape.right(), b.shape.left(), { buff: 0.12, stroke: GREY }), e2 = new Arrow(b.shape.right(), c.shape.left(), { buff: 0.12, stroke: GREY });
    const cap = new Text('advance() = 2.61 units; the estimate said 2.82', { font: 'mono', fontSize: 0.24, color: GREY }).nextTo(b, DOWN, 0.3);
    await this.play(new LaggedStart([new FadeIn(a, { scale: 0.8 }), new Create(e1), new FadeIn(b, { scale: 0.8 }), new Create(e2), new FadeIn(c, { scale: 0.8 })], { lagRatio: 0.3 }), { runTime: 1.4 });
    await this.play(new FadeIn(cap), { runTime: 0.4 });
    st.title = 'exact';

    // --- a diff as a morph: glyphs of the old line become glyphs of the new ---
    await this.step('morph');
    const code = new Code([
      'async function getUser(id, env) {',
      '  return env.DB.prepare(SQL).bind(id).first();',
      '}',
    ], { fontSize: 0.27 }).moveTo([0, -1.6]);
    await this.play(new FadeIn(code, { shift: [0, -0.2] }), { runTime: 0.5 });
    await this.wait(0.4);
    const oldLine = code.lines[1]!;
    const newLine = new Text('  const hit = await env.KV.get(`user:${id}`, "json");', { font: 'mono', fontSize: 0.27, color: GREEN });
    newLine.moveTo(oldLine).alignTo(oldLine, LEFT);
    await this.play(new Transform(oldLine, newLine), { runTime: 1.2 });
    st.codeLine = 'after';
    await this.play(new Indicate(oldLine, { color: GREEN, scaleFactor: 1.03 }), { runTime: 0.8 });

    // --- and back: the same morph in reverse is the revert --------------------
    await this.step('revert');
    const back = new Text('  return env.DB.prepare(SQL).bind(id).first();', { font: 'mono', fontSize: 0.27, color: RED });
    back.moveTo(oldLine).alignTo(oldLine, LEFT);
    await this.play(new Transform(oldLine, back), { runTime: 1.2 });
    st.codeLine = 'before';
    await this.wait(1.2);
  }
}
