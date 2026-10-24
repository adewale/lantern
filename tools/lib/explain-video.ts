import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile, readFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, resolve, join, basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { Scene, Text, Rectangle, NullSink, toSvgString, loadFonts } from '../../src/index.ts';
import type { Trace } from '../../src/trace.ts';
import type { ExplainerClass, Settings } from '../../explain/index.ts';
import type { Project } from './explain-project.ts';
import { hash, sceneSlug } from './explain-project.ts';
import { wrapCaption, FOOTER_TEXT_WIDTH } from './explain-captions.ts';
export { wrapCaption, FOOTER_TEXT_WIDTH };

export function vttTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error('Caption time must be finite and non-negative');
  const ms = Math.round(seconds * 1000),
    pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}
export function captionsVtt(trace: Trace): string {
  return (
    'WEBVTT\n\n' +
    trace.steps
      .filter((s) => s.meta.caption)
      .map(
        (s, i) =>
          `${i + 1}\n${vttTime(s.t0)} --> ${vttTime(s.t1 ?? trace.duration)}\n${String(s.meta.caption).replace(/-->/g, '→').replace(/[<>]/g, '')}\n`,
      )
      .join('\n')
  );
}
async function footer(trace: Trace, index: number, width: number): Promise<Uint8Array> {
  const scene = new Scene(new NullSink());
  scene.add(new Rectangle({ width: 16, height: 2, fill: '#101820', stroke: 'none' }));
  const step = trace.steps[index];
  if (step) {
    scene.add(
      new Text(
        `${String(index + 1).padStart(2, '0')} / ${trace.steps.length}    ${String(step.meta.title ?? step.step)}`,
        { fontSize: 0.23, color: '#9ad9d0', weight: 'bold', anchor: 'start' },
      ).moveTo([-7.45, 0.62], [-1, 0]),
    );
    wrapCaption(String(step.meta.caption ?? ''), FOOTER_TEXT_WIDTH).forEach((line, i) =>
      scene.add(
        new Text(line, { fontSize: 0.25, color: '#f0f5fa', anchor: 'start' }).moveTo(
          [-7.45, 0.12 - i * 0.36],
          [-1, 0],
        ),
      ),
    );
  }
  const svg = toSvgString(scene, { width }).replace(
    /height="\d+" viewBox="[^"]+"/,
    `height="${width / 8}" viewBox="-8000 -1000 16000 2000"`,
  );
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels;
}
export async function renderVideo(
  project: Project,
  variant: { Scene: ExplainerClass; trace: Trace; values: Settings },
  out: string,
  {
    width = 1280,
    fps = 30,
    footer: withFooter = false,
  }: { width?: number; fps?: number; footer?: boolean } = {},
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(width) || width < 2 || width % 2)
    throw new Error('Video width must be a positive even integer');
  if (!Number.isInteger(fps) || fps < 1 || fps > 120)
    throw new Error('Video fps must be an integer from 1 to 120');
  if (withFooter && width !== 1280)
    throw new Error('The caption-footer preset is 1280 × 880; use --width 1280');
  // Preserve a 16:9 viewBox inside the nearest even-height encoder canvas.
  const stageHeight = Math.max(2, 2 * Math.round((width * 9) / 32));
  const height = stageHeight + (withFooter ? width / 8 : 0);
  const webm = out.endsWith('.webm');
  if (!webm && !out.endsWith('.mp4')) throw new Error('Use an .mp4 or .webm output');
  out = resolve(out);
  await mkdir(dirname(out), { recursive: true });
  const ffmpeg = execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0];
  await loadFonts();
  // Trace at the requested output fps: chapter times and deterministic frame counts follow it.
  const { traceScene } = await import('../../src/index.ts');
  const trace = await traceScene(variant.Scene, { fps });
  const temp = await mkdtemp(join(dirname(out), '.lantern-video-'));
  const temporaryVideo = join(temp, basename(out));
  const vtt = temporaryVideo.replace(/\.[^.]+$/, '.vtt'),
    metadata = temporaryVideo + '.chapters.ffmeta';
  await writeFile(vtt, captionsVtt(trace));
  const escape = (v: string) => v.replace(/([\\=;#\n])/g, '\\$1');
  await writeFile(
    metadata,
    ';FFMETADATA1\n' +
      trace.steps
        .map(
          (s) =>
            `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s.t0 * 1000)}\nEND=${Math.round((s.t1 ?? trace.duration) * 1000)}\ntitle=${escape(s.step)}\n`,
        )
        .join(''),
  );
  const args = [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pixel_format',
    'rgba',
    '-video_size',
    `${width}x${height}`,
    '-framerate',
    String(fps),
    '-i',
    'pipe:0',
    '-i',
    vtt,
    '-i',
    metadata,
    '-map',
    '0:v:0',
    '-map',
    '1:s:0?',
    '-map_metadata',
    '2',
    '-map_chapters',
    '2',
    '-an',
    ...(webm
      ? ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-cpu-used', '4', '-c:s', 'webvtt']
      : [
          '-c:v',
          'libx264',
          '-crf',
          '20',
          '-preset',
          'veryfast',
          '-c:s',
          'mov_text',
          '-movflags',
          '+faststart',
        ]),
    '-threads',
    '2',
    '-pix_fmt',
    'yuv420p',
    temporaryVideo,
  ];
  const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let errors = '';
  child.stderr.on('data', (chunk) => {
    errors = (errors + chunk.toString()).slice(-10000);
  });
  // Attach completion/error handlers immediately, including while rendering the first frame.
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${errors}`)),
    );
  });
  done.catch(() => {});
  child.stdin.on('error', () => {});
  const footers = new Map<number, Uint8Array>();
  let frames = 0,
    rasterizedFrames = 0;
  let previousSvg = '',
    previousPixels: Uint8Array | undefined;
  let previousFooter = -2,
    stackedPixels: Uint8Array | undefined;
  try {
    await new variant.Scene(
      {
        async frame(scene, dt) {
          if (dt === 0) return;
          const svg = toSvgString(scene, { width }).replace(
            /height="\d+" viewBox=/,
            `height="${stageHeight}" viewBox=`,
          );
          const changed = svg !== previousSvg || !previousPixels;
          if (changed) {
            previousPixels = new Resvg(svg, { font: { loadSystemFonts: false } }).render().pixels;
            previousSvg = svg;
            rasterizedFrames++;
          }
          const rgba = previousPixels!;
          let pixels: Uint8Array = rgba;
          if (withFooter) {
            const i = Math.max(
              0,
              trace.steps.findIndex((s) => s.step === scene.currentStep?.path),
            );
            if (!footers.has(i)) footers.set(i, await footer(trace, i, width));
            if (changed || previousFooter !== i || !stackedPixels)
              stackedPixels = Buffer.concat([rgba, footers.get(i)!]);
            previousFooter = i;
            pixels = stackedPixels;
          }
          if (!child.stdin.write(pixels))
            await Promise.race([
              once(child.stdin, 'drain'),
              done.then(() => {
                throw new Error('FFmpeg closed its input');
              }),
            ]);
          frames++;
        },
      },
      { fps },
    ).run();
    child.stdin.end();
    await done;
  } catch (error) {
    child.stdin.destroy();
    child.kill();
    await done.catch(() => {});
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  const receipt = {
    version: 1,
    scene: sceneSlug(project),
    settings: variant.values,
    sourceHash: project.sourceHash,
    engineHash: project.engineHash,
    exporterHash: hash(await readFile(new URL(import.meta.url))),
    engine: 'lantern@2c7bad5+explainer',
    agenticMermaid: '0.4.1',
    snapshotHashes: Object.values(project.store).map((s) => hash(JSON.stringify(s))),
    fps,
    width,
    height,
    frames,
    rasterizedFrames,
    systemFonts: false,
    resvg: '2.6.2',
    ffmpeg,
    codec: webm ? 'VP9' : 'H.264',
    audio: false,
    preset: withFooter ? 'caption-footer' : 'stage-only',
    chapters: trace.steps.map((s) => s.step),
  };
  // Commit the receipt last; interrupted renders never replace a complete video with a partial file.
  await rename(temporaryVideo, out);
  await rename(vtt, out.replace(/\.[^.]+$/, '.vtt'));
  await rename(metadata, out + '.chapters.ffmeta');
  await writeFile(out + '.receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  await rm(temp, { recursive: true, force: true });
  return receipt;
}
