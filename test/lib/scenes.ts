// Scenes for the engine tests. `Fixture` is small and changes only when the
// engine does, so the golden trace pins the engine rather than an author's
// edits. `explainer(id)` is what readers see: an explainer's default case with
// its diagram snapshots bound.
import { join } from 'node:path';
import {
  Scene, Rectangle, Circle, Arrow, Line, Dot, Text, Code, DecimalNumber,
  FadeIn, FadeOut, Write, Create, Transform, Indicate, MoveAlongPath, LaggedStart, TEAL, GOLD, GREY,
} from '../../src/index.ts';
import type { SceneClass } from '../../src/index.ts';
import { EXPLAINERS } from '../../scenes/explainers/catalog.ts';
import { collectProject, defaultVariant, ROOT } from '../../tools/lib/explain-project.ts';

export class Fixture extends Scene {
  override async construct() {
    this.state = { count: 0 };
    await this.step('draw', { caption: 'A title is written and two shapes are drawn.' });
    const heading = new Text('A fixture for the engine tests', { fontSize: 0.4 }).moveTo([0, 3.4]);
    const box = new Rectangle({ width: 2.4, height: 1.2, cornerRadius: 0.1, stroke: TEAL }).moveTo([-3, 1]);
    const ring = new Circle({ radius: 0.6, stroke: GOLD }).moveTo([3, 1]);
    await this.play(new Write(heading), new Create(box), new FadeIn(ring, { shift: [0, 0.5] }));
    const link = new Arrow(box.right(), ring.left(), { buff: 0.1 });
    await this.play(new Create(link));

    await this.step('code', { caption: 'A loop appears and its condition is lit.' });
    const code = new Code(['let count = 0;', 'while (count < 3) count++;', 'return count;']).moveTo([-3.5, -2]);
    await this.play(new FadeIn(code, { shift: [0.3, 0] }));
    const bar = code.highlight(1);
    await this.play(new FadeIn(bar));

    await this.step('count', { caption: 'The counter rises while a dot rides the track.' });
    const n = new DecimalNumber(0, { fontSize: 0.5, font: 'mono' }).moveTo([3, -1.4]);
    const track = new Line([1.5, -2.6], [4.5, -2.6], { stroke: GREY });
    const dot = new Dot().moveTo([1.5, -2.6]);
    await this.play(new FadeIn(n), new Create(track), new FadeIn(dot));
    for (let i = 1; i <= 3; i++) {
      await this.play(new Transform(n, n.copy().setValue(i)), new MoveAlongPath(dot, new Line([0.5 + i, -2.6], [1.5 + i, -2.6])), { runTime: 0.5 });
      this.state = { count: i };
    }

    await this.step('end', { caption: 'The shapes pulse, then the code leaves.' });
    await this.play(new LaggedStart([new Indicate(box), new Indicate(ring)]));
    await this.play(new Transform(ring, new Rectangle({ width: 1.2, height: 1.2, stroke: GOLD }).moveTo([3, 1])));
    await this.play(new FadeOut(code), new FadeOut(bar));
  }
}

const loaded = new Map<string, Promise<SceneClass>>();
export const explainer = (id: string): Promise<SceneClass> => {
  if (!loaded.has(id))
    loaded.set(id, collectProject(join(ROOT, 'scenes/explainers', id), { write: false }).then((p) => defaultVariant(p).Scene));
  return loaded.get(id)!;
};
export const explainers = (): Promise<[string, SceneClass][]> =>
  Promise.all(EXPLAINERS.map(async ({ id }): Promise<[string, SceneClass]> => [id, await explainer(id)]));
