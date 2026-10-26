import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile, readFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, join, basename } from 'node:path';
import { Scene, toSvgString, loadFonts, traceScene } from '../../src/index.ts';
import type { Trace, Box } from '../../src/index.ts';
import { FRAME } from '../../src/svg.ts';
import { caseNameIn, descriptionLang } from '../../app/embed-strings.ts';
import type { ExplainerClass, Settings } from '../../explain/index.ts';
import { filmPlan, pushAt, pacing, FILM } from '../../explain/film.ts';
import { pictureHtml, htmlEscape } from '../../explain/trace.ts';
import type { Project } from './explain-project.ts';
import { ROOT, hash, baseReceipt } from './explain-project.ts';

/** MP4 tags a stream with an ISO 639-2 code (the terminology code, as MP4 uses); WebM and WebVTT take the scene's BCP 47 tag as is. */
const ISO_639_2: Record<string, string> = { en: 'eng', fr: 'fra' };
/** The subtitle stream's language tag: the BCP 47 tag for WebM, an ISO 639-2 code for MP4. */
export function trackLanguage(lang: string, webm = false): string {
  if (webm) return lang;
  const code = /^[a-z]{3}$/.test(lang) ? lang : ISO_639_2[lang.split('-')[0]!.toLowerCase()];
  if (!code) throw new Error(`No ISO 639-2 code for language ${lang}; add it to ISO_639_2 in ${import.meta.filename}`);
  return code;
}
/**
 * The video's text alternative (WCAG 1.2.1): title, then each step's title, caption and what its
 * picture shows. Descriptions follow the page's language where explain/words.ts has it; otherwise they are English and marked so.
 */
export function videoTranscript(title: string, lang: string, steps: Trace['steps']): string {
  return `<!doctype html><html lang="${htmlEscape(lang)}"><meta charset="utf-8"><title>${htmlEscape(title)}</title><h1>${htmlEscape(title)}</h1><ol>${steps
    .map((s) => {
      const shows = pictureHtml(s.after);
      const line = typeof s.meta.line === 'string' && s.meta.line.trim() ? `<p><strong>${htmlEscape(s.meta.line)}</strong></p>` : '';
      return `<li><h2>${htmlEscape(s.meta.title ?? s.step)}</h2>${line}<p>${htmlEscape(s.meta.caption ?? '')}</p>${shows && descriptionLang(lang) ? `<div${descriptionLang(lang)}>${shows}</div>` : shows}</li>`;
    })
    .join('')}</ol></html>\n`;
}

/** Peer ranges, so a missing package's error gives the install line the help gives. */
const PEERS: Record<string, string> = createRequire(import.meta.url)('../../package.json').peerDependencies;
let resvg: typeof import('@resvg/resvg-js') | undefined;
/** Rasterise an SVG with the embedded fonts only. resvg loads on first use: only PNG and video output need it. */
export async function rasterize(svg: string) {
  resvg ??= await import('@resvg/resvg-js').catch(() => {
    throw new Error('PNG and video output need @resvg/resvg-js: npm i @resvg/resvg-js@' + PEERS['@resvg/resvg-js']);
  });
  return new resvg.Resvg(svg, { font: { loadSystemFonts: false } }).render();
}

/** The horizontal band `height` units tall around y = 0, `width` pixels wide: a window onto the scene's SVG. */
export function band(scene: Scene, width: number, height: number, background?: string, view?: Box): string {
  const full = Math.round((width * FRAME.h) / FRAME.w),
    px = Math.round((width * height) / FRAME.w);
  // cull: resvg 2.6.2 aborts on a fading element the camera has left outside the view.
  // overflow="visible": resvg 2.6.2 also panics (geom.rs, unwrap on None) on a translucent element
  // inside a nested svg that clips its viewport when something there reaches past it, as the paper
  // does under a zoomed camera. The outer svg crops the band, which lies inside the inner viewport,
  // so letting the inner one overflow shows nothing more.
  const stage = toSvgString(scene, { width, background, cull: true, view }).replace(/^<svg /, '<svg overflow="visible" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${px}" viewBox="0 ${(full - px) / 2} ${width} ${px}">${stage}</svg>`;
}

export function vttTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error('Caption time must be finite and non-negative');
  const ms = Math.round(seconds * 1000),
    pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}
/** WebVTT cues; `&`, `<` and `>` are escaped (which also keeps "-->" out of the text) and blank lines, which end a cue, are closed up. */
export function captionsVtt(trace: Trace, lang = 'en'): string {
  return (
    `WEBVTT\nLanguage: ${lang}\n\n` +
    trace.steps
      .filter((s) => s.meta.caption)
      .map(
        (s, i) =>
          `${i + 1}\n${vttTime(s.t0)} --> ${vttTime(s.t1 ?? trace.duration)}\n${String(s.meta.caption).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\s*\n/g, '\n').trim()}\n`,
      )
      .join('\n')
  );
}

/** The hash of this file, which decides how a video is made; a receipt with another is stale. */
export const exporterHash = async () => hash(await readFile(new URL(import.meta.url)));

/** FFprobe's streams and chapters for a video, once FFmpeg has decoded every frame of it without error. */
export function probeVideo(file: string): {
  streams: { codec_type: string; codec_name: string; width?: number; height?: number; nb_frames?: string; tags?: Record<string, string> }[];
  chapters: { start_time: string; tags: { title: string } }[];
} {
  execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { stdio: 'pipe' });
  return JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_chapters', '-of', 'json', file], { encoding: 'utf8' }),
  );
}

/** The camera's view closed in on its centre by `p` × FILM.push: the film's ambient push-in during a rest. */
export function pushedView(scene: Scene, p: number): Box {
  const [x0, y0, x1, y1] = scene.frame.box()!;
  const k = (FILM.push * p) / 2,
    dx = (x1 - x0) * k,
    dy = (y1 - y0) * k;
  return [x0 + dx, y0 + dy, x1 - dx, y1 - dy];
}

export async function renderVideo(
  project: Project,
  variant: { Scene: ExplainerClass; values: Settings },
  out: string,
  { width = 1280, fps = 30 }: { width?: number; fps?: number } = {},
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(width) || width < 2 || width % 2)
    throw new Error('Video width must be a positive even integer');
  if (!Number.isInteger(fps) || fps < 1 || fps > 120)
    throw new Error('Video fps must be an integer from 1 to 120');
  // Preserve a 16:9 viewBox inside the nearest even-height encoder canvas.
  const height = Math.max(2, 2 * Math.round((width * 9) / 32));
  const webm = out.endsWith('.webm');
  if (!webm && !out.endsWith('.mp4')) throw new Error('Use an .mp4 or .webm output');
  const lang = project.Scene.meta?.lang ?? 'en',
    trackLang = trackLanguage(lang, webm);
  let ffmpeg: string;
  try {
    ffmpeg = execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0]!;
  } catch {
    throw new Error('Video export needs FFmpeg on PATH: https://ffmpeg.org/download.html');
  }
  await loadFonts();
  // Trace at the requested output fps: chapter times and deterministic frame counts follow it.
  const trace = await traceScene(variant.Scene, { fps });
  const plan = filmPlan(trace);
  if (!plan.length) throw new Error('A video needs at least one step');
  out = resolve(out);
  await mkdir(dirname(out), { recursive: true });
  const temp = await mkdtemp(join(dirname(out), '.lantern-video-'));
  const temporaryVideo = join(temp, basename(out));
  const vtt = temporaryVideo.replace(/\.[^.]+$/, '.vtt'),
    metadata = temporaryVideo + '.chapters.ffmeta';
  // Subtitles carry each full caption across its step's whole stretch of film.
  await writeFile(vtt, captionsVtt({ ...trace, steps: trace.steps.map((s, i) => ({ ...s, t0: plan[i]!.t0, t1: plan[i]!.t1 })) }, lang));
  const escape = (v: string) => v.replace(/([\\=;#\n])/g, '\\$1');
  await writeFile(
    metadata,
    ';FFMETADATA1\n' +
      plan
        .map(
          (s, i) =>
            `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s.t0 * 1000)}\nEND=${Math.round(s.t1 * 1000)}\ntitle=${escape(String(trace.steps[i]!.meta.title ?? s.step))}\n`,
        )
        .join(''),
  );
  // Raw RGBA frames on stdin, then the captions and chapters; silent, one subtitle stream in the scene's language.
  const args = [
    ...['-y', '-loglevel', 'error'],
    ...['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0'],
    ...['-i', vtt, '-i', metadata, '-map', '0:v:0', '-map', '1:s:0?', '-map_metadata', '2', '-map_chapters', '2'],
    ...['-metadata:s:s:0', `language=${trackLang}`, '-an'],
    ...(webm
      ? ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-cpu-used', '4', '-c:s', 'copy']
      : ['-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-c:s', 'mov_text', '-movflags', '+faststart']),
    ...['-threads', '2', '-pix_fmt', 'yuv420p', temporaryVideo],
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

  let frames = 0,
    rasterizedFrames = 0;
  let drawn = '',
    written = '',
    pixels: Uint8Array | undefined;
  /** Write one film frame; a run of identical frames is rasterised once. */
  async function writeSvg(svg: string) {
    if (svg !== drawn || !pixels) {
      pixels = (await rasterize(svg)).pixels;
      drawn = svg;
      rasterizedFrames++;
    }
    if (!child.stdin.write(pixels))
      await Promise.race([
        once(child.stdin, 'drain'),
        done.then(() => {
          throw new Error('FFmpeg closed its input');
        }),
      ]);
    written = svg;
    frames++;
  }
  const stage = (scene: Scene, view?: Box) => band(scene, width, (height * FRAME.w) / width, undefined, view);
  /** The scene as the film shows it at film frame `f`: pushed in when the film is. */
  const filmed = (scene: Scene, f: number, plain: string) => {
    const p = pushAt(plan, fps, f);
    return p ? stage(scene, pushedView(scene, p)) : plain;
  };
  // Each step's rest, drawn when its resting picture is on stage and written when the film gets there.
  const beats: string[][] = plan.map(() => []);
  // Whether each scene frame's picture differs from the one before: the film's pacing.
  const changed: boolean[] = [];
  let previous = '',
    rested = '';
  let current = 0;
  /** Rest on the picture of each step before `index` for its beat. */
  async function rest(index: number) {
    for (; current < index; current++) {
      const list = beats[current]!;
      if (list.length) for (const svg of list) await writeSvg(svg);
      // A step with no frame of its own rests on the picture before it.
      else for (let i = 0; i < plan[current]!.beat; i++) await writeSvg(written);
      beats[current] = [];
    }
  }
  try {
    await new variant.Scene(
      {
        async frame(scene, dt) {
          if (dt === 0) {
            previous = written = stage(scene);
            return;
          }
          const n = scene.frameCount,
            index = plan.findIndex((s) => n <= s.last);
          await rest(index < 0 ? plan.length - 1 : index);
          const plain = stage(scene),
            step = plan[current]!;
          changed[n] = plain !== previous;
          previous = plain;
          // The scene's caption hold, which the film skips. Its first frame is the resting picture
          // the beat rests on: a play lands (a morph gets its paths' own structure back) only
          // after its last frame is drawn. After that the picture must stay at rest.
          const restFrame = step.moveEnd < step.last ? step.moveEnd + 1 : step.moveEnd;
          if (n <= step.moveEnd) await writeSvg(filmed(scene, frames, plain));
          if (n === restFrame) {
            rested = plain;
            const from = Math.round(step.rest * fps);
            beats[current] = Array.from({ length: step.beat }, (_, i) => filmed(scene, from + i, plain));
          } else if (n > step.moveEnd && plain !== rested)
            throw new Error(
              `${step.step} ${JSON.stringify(variant.values)}: the picture changes after the caption hold begins, and the film and the player both skip the hold. Finish every change before the step's last play() ends.`,
            );
        },
      },
      { fps },
    ).run();
    await rest(plan.length);
    child.stdin.end();
    await done;
  } catch (error) {
    child.stdin.destroy();
    child.kill();
    await done.catch(() => {});
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  // The text alternative to the video (WCAG 1.2.1): each step's title, line, caption and what its picture shows.
  const title = [project.Scene.meta?.title ?? basename(out), caseNameIn(lang, project.Scene, variant.values)].filter(Boolean).join(' · '),
    transcript = out.replace(/\.[^.]+$/, '.transcript.html');
  const receipt = {
    ...baseReceipt(project),
    settings: variant.values,
    exporterHash: await exporterHash(),
    fps,
    width,
    height,
    frames,
    rasterizedFrames,
    systemFonts: false,
    resvg: createRequire(import.meta.url)('@resvg/resvg-js/package.json').version,
    ffmpeg,
    codec: webm ? 'VP9' : 'H.264',
    audio: false,
    language: lang,
    // Each chapter starts at its motion and rests on its picture for `beat` seconds.
    chapters: plan.map((s) => ({ step: s.step, motion: Math.round(((s.moveEnd - s.frame0) / fps) * 1000) / 1000, beat: Math.round((s.beat / fps) * 1000) / 1000 })),
    pacing: pacing(trace, changed),
    transcript: basename(transcript),
  };
  // Commit the receipt last; interrupted renders never replace a complete video with a partial file.
  await rename(temporaryVideo, out);
  await rename(vtt, out.replace(/\.[^.]+$/, '.vtt'));
  await writeFile(transcript, videoTranscript(title, lang, trace.steps));
  await rename(metadata, out + '.chapters.ffmeta');
  await writeFile(out + '.receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  await rm(temp, { recursive: true, force: true });
  return receipt;
}
