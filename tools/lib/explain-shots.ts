import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { Scene, Text, NullSink, SnapshotSink, renderAt, toSvgString } from '../../src/index.ts';
import { defaultVariant } from './explain-project.ts';
import type { Project } from './explain-project.ts';

export async function contactSheet(project: Project, out: string): Promise<string> {
  const v = defaultVariant(project),
    steps = v.trace.steps,
    cols = 2,
    w = 640,
    h = 400,
    rows = Math.ceil(steps.length / cols);
  const tiles = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!,
      sink = new SnapshotSink({ width: w });
    await renderAt(v.Scene, Math.max(step.t0, (step.t1 ?? step.t0) - 1 / v.trace.fps), sink);
    const png = new Resvg(sink.svg, { font: { loadSystemFonts: false } }).render().asPng();
    const labelScene = new Scene(new NullSink()),
      label = new Text(`${i + 1}. ${String(step.meta.title ?? step.step)}`, {
        fontSize: 0.36,
        color: '#eef3fa',
        anchor: 'start',
      });
    if (label.width() > 15.2) label.setWidth(15.2);
    label.moveTo([-7.6, 0], [-1, 0]);
    labelScene.add(label);
    const labelSvg = toSvgString(labelScene, { width: w, background: '#101820' }).replace(
      /height="360" viewBox="[^"]+"/,
      'height="40" viewBox="-8000 -500 16000 1000"',
    );
    tiles.push(
      `<g transform="translate(${(i % cols) * w} ${Math.floor(i / cols) * h})"><image width="${w}" height="360" href="data:image/png;base64,${png.toString('base64')}"/><g transform="translate(0 360)">${labelSvg}</g></g>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * cols}" height="${h * rows}"><rect width="100%" height="100%" fill="#101820"/>${tiles.join('')}</svg>`;
  out = resolve(out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out.replace(/\.[^.]+$/, '.svg'), svg);
  await writeFile(out, new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng());
  return out;
}
