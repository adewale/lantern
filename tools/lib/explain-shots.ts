import { writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { Scene, Text, NullSink, SnapshotSink, renderAt } from '../../src/index.ts';
import { rasterize, band, pushedView } from './explain-video.ts';
import { filmPlan, pushAt } from '../../explain/film.ts';
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

/**
 * The video as a reviewer should see it: one frame every `every` seconds of film, motion and
 * rests alike (with the rest's push-in), each tile labelled with its film time, its step and
 * whether it is moving or resting. Resting pictures alone hide what goes wrong mid-motion:
 * collisions, clipping, stray marks, a tool left behind.
 */
export async function filmstrip(
  project: Project,
  out: string,
  v: Project['variants'][number] = defaultVariant(project),
  every = 1,
): Promise<string> {
  if (!(every > 0)) throw new Error('--every must be a positive number of seconds');
  const { fps } = v.trace,
    plan = filmPlan(v.trace);
  const total = Math.round(plan.at(-1)!.t1 * fps);
  // Each sample: the film frame, the scene frame it shows, its step, and whether it rests.
  const samples: { film: number; scene: number; step: number; resting: boolean }[] = [];
  for (let film = 0; film < total; film += Math.max(1, Math.round(every * fps))) {
    const step = plan.find((s) => film < Math.round(s.t1 * fps))!;
    const start = Math.round(step.t0 * fps),
      rest = Math.round(step.rest * fps);
    const resting = film >= rest;
    const scene = resting ? Math.min(step.last, step.moveEnd + (step.moveEnd < step.last ? 1 : 0)) : step.frame0 + 1 + (film - start);
    samples.push({ film, scene, step: step.index, resting });
  }
  const w = 480,
    h = 300,
    cols = 4;
  // Each sample drawn when its scene frame is on stage, pushed in as the film is then.
  const svgs = new Map<number, string>();
  await new v.Scene({
    async frame(scene) {
      samples.forEach((s, i) => {
        if (s.scene !== scene.frameCount) return;
        const p = pushAt(plan, fps, s.film);
        svgs.set(i, band(scene, w, 9, undefined, p ? pushedView(scene, p) : undefined));
      });
    },
  }).run();
  const tiles = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!,
      svg = svgs.get(i);
    if (!svg) continue;
    const png = (await rasterize(svg)).asPng();
    const labelScene = new Scene(new NullSink()),
      title = stepWords(v.trace.steps[s.step]!).title;
    const label = new Text(`${(s.film / fps).toFixed(1)} s · ${s.step + 1} ${s.resting ? 'rest' : 'motion'} · ${title}`, {
      fontSize: 0.5,
      color: '#eef3fa',
      anchor: 'start',
    });
    if (label.width() > 15.2) label.setWidth(15.2);
    label.moveTo([-7.6, 0], [-1, 0]);
    labelScene.add(label);
    tiles.push(
      `<g transform="translate(${(i % cols) * w} ${Math.floor(i / cols) * h})"><image width="${w}" height="270" href="data:image/png;base64,${png.toString('base64')}"/><g transform="translate(0 270)">${band(labelScene, w, 1, '#101820')}</g></g>`,
    );
  }
  const rows = Math.ceil(tiles.length / cols);
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * cols}" height="${h * rows}"><rect width="100%" height="100%" fill="#101820"/>${tiles.join('')}</svg>`;
  out = resolve(extname(out) ? out : out + '.png');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, (await rasterize(sheet)).asPng());
  return out;
}
