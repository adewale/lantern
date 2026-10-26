import { writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { Scene, Text, NullSink, SnapshotSink, renderAt } from '../../src/index.ts';
import { rasterize, band } from './explain-video.ts';
import { defaultVariant } from './explain-project.ts';
import { restingTime, stepWords } from '../../explain/trace.ts';
import type { Project } from './explain-project.ts';

/**
 * A scene's picture at `time` as PNG, `width` pixels wide. Culled: resvg 2.6.2 aborts on a
 * fading element the camera has left outside the view, which a zoomed camera leaves often.
 */
export async function stillPng(Source: Project['Scene'], time: number, width: number): Promise<Buffer> {
  const sink = new SnapshotSink({ width, cull: true });
  await renderAt(Source, time, sink);
  return (await rasterize(sink.svg)).asPng();
}

export async function contactSheet(
  project: Project,
  out: string,
  v: Project['variants'][number] = defaultVariant(project),
): Promise<string> {
  const
    steps = v.trace.steps,
    cols = 2,
    w = 640,
    h = 400,
    rows = Math.ceil(steps.length / cols);
  const tiles = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!,
      png = await stillPng(v.Scene, restingTime(step, v.trace.fps), w);
    const labelScene = new Scene(new NullSink()),
      label = new Text(`${i + 1}. ${stepWords(step).title}`, {
        fontSize: 0.36,
        color: '#eef3fa',
        anchor: 'start',
      });
    if (label.width() > 15.2) label.setWidth(15.2);
    label.moveTo([-7.6, 0], [-1, 0]);
    labelScene.add(label);
    // A 40-pixel band: one scene unit at 640 pixels wide.
    const labelSvg = band(labelScene, w, 1, '#101820');
    tiles.push(
      `<g transform="translate(${(i % cols) * w} ${Math.floor(i / cols) * h})"><image width="${w}" height="360" href="data:image/png;base64,${png.toString('base64')}"/><g transform="translate(0 360)">${labelSvg}</g></g>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * cols}" height="${h * rows}"><rect width="100%" height="100%" fill="#101820"/>${tiles.join('')}</svg>`;
  // The PNG at `out` (given .png when it has no extension), the SVG beside it.
  out = resolve(extname(out) ? out : out + '.png');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(join(dirname(out), basename(out, extname(out)) + '.svg'), svg);
  await writeFile(out, (await rasterize(svg)).asPng());
  return out;
}

