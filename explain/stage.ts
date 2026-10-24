import { Rectangle, Text, Group, FadeIn, FadeOut } from '../src/index.ts';
import type { Scene, Vec } from '../src/index.ts';
import { Diagram } from './diagrams.ts';
import type { ShowOptions } from './diagrams.ts';
import { diagramsOf } from '../integrations/agentic-mermaid/snapshot.ts';
import type { Palette, DiagramSpec } from '../integrations/agentic-mermaid/snapshot.ts';
import { palette } from './palettes.ts';

export interface StageOptions {
  palette?: Palette;
  title?: string;
}
export function stage(scene: Scene, options: StageOptions = {}) {
  let colors = options.palette ?? palette('nord');
  const paper = new Rectangle({ width: 16, height: 9, fill: colors.paper, stroke: 'none' });
  paper.key = '__paper';
  scene.add(paper);
  const heading = new Text(options.title ?? '', { fontSize: 0.38, color: colors.ink, weight: 'bold' }).moveTo(
    [0, 3.78],
  );
  scene.add(heading);
  const overlays = new Set<Group>();
  return {
    scene,
    paper,
    heading,
    get palette() {
      return colors;
    },
    async title(text: string) {
      if (heading.text) await scene.play(new FadeOut(heading, { runTime: 0.18 }));
      heading.setText(text);
      heading.setFill(colors.ink);
      heading.moveTo([0, 3.78]);
      await scene.play(new FadeIn(heading, { runTime: 0.25 }));
    },
    async show(spec: DiagramSpec, opts: ShowOptions = {}): Promise<Diagram> {
      const snapshot = await diagramsOf(scene).diagram(spec);
      if (!options.palette) {
        colors = snapshot.palette;
        paper.setFill(colors.paper);
        heading.setFill(colors.ink);
      }
      const diagram = new Diagram(scene, spec, snapshot, opts);
      await diagram.build(opts.build, opts.runTime);
      return diagram;
    },
    async card(
      rows: readonly (readonly [string, unknown])[],
      { at = [0, -2.9], width = 6.4 }: { at?: Vec; width?: number } = {},
    ): Promise<Group> {
      const group = new Group();
      const height = rows.length * 0.48 + 0.45;
      group.add(
        new Rectangle({
          width,
          height,
          cornerRadius: 0.1,
          fill: colors.paper,
          stroke: colors.accent,
          strokeWidth: 0.018,
        }),
      );
      rows.forEach(([label, value], i) => {
        const key = new Text(label, { fontSize: 0.2, color: colors.muted, anchor: 'start' }).moveTo(
          [-width / 2 + 0.24, height / 2 - 0.44 - i * 0.48],
          [-1, 0],
        );
        const val = new Text(String(value), {
          fontSize: 0.22,
          font: 'mono',
          color: colors.ink,
          anchor: 'end',
        }).moveTo([width / 2 - 0.24, height / 2 - 0.44 - i * 0.48], [1, 0]);
        if (val.width() > width * 0.6) val.setWidth(width * 0.6);
        group.add(key, val);
      });
      group.moveTo(at);
      overlays.add(group);
      await scene.play(new FadeIn(group, { runTime: 0.3 }));
      return group;
    },
    async chip(text: string, { at = [-5.3, -3.85] }: { at?: Vec } = {}): Promise<Group> {
      const label = new Text(text, { fontSize: 0.21, font: 'mono', color: colors.accent });
      const bg = new Rectangle({
        width: label.width() + 0.35,
        height: 0.4,
        fill: colors.paper,
        stroke: colors.accent,
        strokeWidth: 0.012,
        cornerRadius: 0.08,
      });
      const g = new Group(bg, label).moveTo(at);
      overlays.add(g);
      await scene.play(new FadeIn(g, { runTime: 0.2 }));
      return g;
    },
    async clearOverlays() {
      if (overlays.size) await scene.play(...[...overlays].map((g) => new FadeOut(g, { runTime: 0.25 })));
      overlays.clear();
    },
  };
}
