import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile, readFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, join, basename } from 'node:path';
import { Scene, Text, Rectangle, NullSink, toSvgString, loadFonts, traceScene, takeMissingGlyphs } from '../../src/index.ts';
import type { Trace } from '../../src/index.ts';
import type { ExplainerClass, Settings } from '../../explain/index.ts';
import type { Project } from './explain-project.ts';
import { ROOT, hash, baseReceipt } from './explain-project.ts';

/**
 * Pace of the caption pre-roll: adult silent reading of English non-fiction (Brysbaert 2019).
 * The caption stays up through the motion and the settle, so a slower reader still finishes.
 */
const READ_WPM = 238;
/** Seconds the resting picture holds after the motion, before the next caption replaces this one. */
const SETTLE = 0.4;
/** Footer caption type in scene units (80 px each at 1280): 27 px text on 40 px lines, about 80 characters a line. */
const CAPTION = { size: 0.34, leading: 0.5, lines: 4 };
export const FOOTER_TEXT_WIDTH = 13.6;
/** Footer height in scene units: a 1280 × 720 stage over a 240 px footer is 1280 × 960. */
const FOOTER_HEIGHT = 3;
/** MP4 tags a stream with an ISO 639-2 code; WebM and WebVTT take the scene's BCP 47 tag as is. */
const ISO_639_2: Record<string, string> = { en: 'eng' };

/** Breakable white space: every \s except the no-break spaces, which hold their words together. */
const BREAK = /[^\S\u00a0\u2007\u202f]+/;

/** Wrap a caption on real glyph advances; it must fit the footer's four lines. */
export function wrapCaption(text: string, width: number, size = CAPTION.size): string[] {
  if (!(width > 0) || !(size > 0)) throw new Error(`Caption width and size must be positive (${width}, ${size})`);
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(BREAK)) {
    if (new Text(word, { fontSize: size }).width() > width)
      throw new Error(`Caption word exceeds footer width: ${word}`);
    const next = line ? line + ' ' + word : word;
    if (line && new Text(next, { fontSize: size }).width() > width) {
      lines.push(line);
      if (lines.length > CAPTION.lines) break;
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > CAPTION.lines) throw new Error('Caption exceeds four footer lines; shorten the caption');
  return lines;
}

let resvg: typeof import('@resvg/resvg-js') | undefined;
/** Rasterise an SVG with the embedded fonts only. resvg loads on first use: only PNG and video output need it. */
export async function rasterize(svg: string) {
  resvg ??= await import('@resvg/resvg-js').catch(() => {
    throw new Error('PNG and video output need @resvg/resvg-js: npm install @resvg/resvg-js');
  });
  return new resvg.Resvg(svg, { font: { loadSystemFonts: false } }).render();
}

/** An SVG of the horizontal band `height` units tall around y = 0, `width` pixels wide, on `background`. */
export function band(scene: Scene, width: number, height: number, background: string): string {
  return toSvgString(scene, { width, background }).replace(
    /height="\d+" viewBox="[^"]+"/,
    `height="${(width * height) / 16}" viewBox="-8000 ${-height * 500} 16000 ${height * 1000}"`,
  );
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

/**
 * The film's order for each step: its caption over the previous resting picture for the reading
 * time, then the motion up to the scene's caption hold, then a short settle on the resting
 * picture. The scene's hold is skipped; the pre-roll does its job. The first step has no picture
 * before it, so it plays first and holds for reading after. Times are the film's.
 */
function filmSteps(trace: Trace) {
  const { fps } = trace;
  let start = 0;
  return trace.steps.map((s, i) => {
    const caption = typeof s.meta.caption === 'string' ? s.meta.caption.trim() : '';
    const read = Math.ceil(((caption ? caption.split(/\s+/).length : 0) / READ_WPM) * 60 * fps - 1e-6);
    const pre = i ? read : 0,
      settle = Math.round(SETTLE * fps) + read - pre;
    const last = s.frame1 ?? trace.frames,
      moveEnd = s.hold == null ? last : Math.round(s.hold * fps);
    const length = pre + moveEnd - s.frame0 + settle,
      t0 = start / fps;
    start += length;
    return { ...s, pre, settle, last, moveEnd, t0, t1: start / fps };
  });
}

/** The embed's light or dark --bg, --fg and --line, so the footer looks like the page's caption under its stage. */
async function footerColours(dark: boolean) {
  const css = await readFile(join(ROOT, 'app/embed.css'), 'utf8');
  const rule = css.match(dark ? /:root\[data-theme=dark\]\{([^}]*)\}/ : /:root\{([^}]*)\}/)?.[1] ?? '';
  const [bg, fg, line] = ['bg', 'fg', 'line'].map((name) => rule.match(new RegExp(`--${name}:([^;}]+)`))?.[1]);
  if (!bg || !fg || !line) throw new Error(`app/embed.css lacks the ${dark ? 'dark' : 'light'} --bg, --fg or --line`);
  return { bg, fg, line };
}

async function footer(lines: string[], width: number, colours: { bg: string; fg: string; line: string }) {
  const scene = new Scene(new NullSink()),
    top = FOOTER_HEIGHT / 2;
  // A hairline divides stage from footer when their backgrounds are close.
  scene.add(new Rectangle({ width: 16, height: 0.025, fill: colours.line, stroke: 'none' }).moveTo([0, top - 0.0125]));
  lines.forEach((line, i) =>
    scene.add(
      new Text(line, { fontSize: CAPTION.size, color: colours.fg, anchor: 'start' }).moveTo(
        [-FOOTER_TEXT_WIDTH / 2, top - 0.62 - i * CAPTION.leading],
        [-1, 0],
      ),
    ),
  );
  return (await rasterize(band(scene, width, FOOTER_HEIGHT, colours.bg))).pixels;
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
    throw new Error('The caption-footer preset is 1280 × 960; use --width 1280');
  // Preserve a 16:9 viewBox inside the nearest even-height encoder canvas.
  const stageHeight = Math.max(2, 2 * Math.round((width * 9) / 32));
  const height = stageHeight + (withFooter ? (width * FOOTER_HEIGHT) / 16 : 0);
  const webm = out.endsWith('.webm');
  if (!webm && !out.endsWith('.mp4')) throw new Error('Use an .mp4 or .webm output');
  const lang = project.Scene.meta?.lang ?? 'en',
    trackLang = webm ? lang : (/^[a-z]{3}$/.test(lang) ? lang : ISO_639_2[lang.split('-')[0]!]);
  if (!trackLang) throw new Error(`No ISO 639-2 code for language ${lang}; add it to ISO_639_2 in ${import.meta.filename}`);
  let ffmpeg: string;
  try {
    ffmpeg = execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0]!;
  } catch {
    throw new Error('Video export needs FFmpeg on PATH: https://ffmpeg.org/download.html');
  }
  await loadFonts();
  // Trace at the requested output fps: chapter times and deterministic frame counts follow it.
  const trace = await traceScene(variant.Scene, { fps });
  const steps = filmSteps(trace);
  if (!steps.length) throw new Error('A video needs at least one step');
  // The footer must hold every caption; fail before FFmpeg starts, naming the step and case.
  takeMissingGlyphs();
  const captions = steps.map((s) => {
    try {
      const lines = withFooter ? wrapCaption(String(s.meta.caption ?? ''), FOOTER_TEXT_WIDTH) : [];
      // Footer captions are drawn as outlines too, so a character the fonts lack would be blank.
      const lost = [...takeMissingGlyphs().values()].join('');
      if (lost) throw new Error(`the caption has characters the fonts cannot draw: ${[...new Set(lost)].join(' ')}`);
      return lines;
    } catch (error) {
      throw new Error(`${s.step} ${JSON.stringify(variant.values)}: ${(error as Error).message}`);
    }
  });
  out = resolve(out);
  await mkdir(dirname(out), { recursive: true });
  const temp = await mkdtemp(join(dirname(out), '.lantern-video-'));
  const temporaryVideo = join(temp, basename(out));
  const vtt = temporaryVideo.replace(/\.[^.]+$/, '.vtt'),
    metadata = temporaryVideo + '.chapters.ffmeta';
  const film = { ...trace, steps, duration: steps.at(-1)!.t1 };
  await writeFile(vtt, captionsVtt(film, lang));
  const escape = (v: string) => v.replace(/([\\=;#\n])/g, '\\$1');
  await writeFile(
    metadata,
    ';FFMETADATA1\n' +
      steps
        .map(
          (s) =>
            `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s.t0 * 1000)}\nEND=${Math.round(s.t1 * 1000)}\ntitle=${escape(String(s.meta.title ?? s.step))}\n`,
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
  let svg = '',
    drawn = '',
    pixels: Uint8Array | undefined;
  /** The current SVG as pixels; a run of identical frames is rasterised once. */
  async function picture(): Promise<Uint8Array> {
    if (svg !== drawn || !pixels) {
      pixels = (await rasterize(svg)).pixels;
      drawn = svg;
      rasterizedFrames++;
    }
    return pixels;
  }
  const footers: Uint8Array[] = [];
  let colours: Awaited<ReturnType<typeof footerColours>> | undefined;
  /** `count` frames of the current picture over `step`'s caption. */
  async function write(step: number, count: number) {
    if (!count) return;
    const stage = await picture();
    let frame = stage;
    if (withFooter) {
      // Light or dark tokens to match the stage, judged by its top-left pixel.
      colours ??= await footerColours(0.2126 * stage[0]! + 0.7152 * stage[1]! + 0.0722 * stage[2]! < 128);
      footers[step] ??= await footer(captions[step]!, width, colours);
      frame = Buffer.concat([stage, footers[step]]);
    }
    for (let i = 0; i < count; i++) {
      if (!child.stdin.write(frame))
        await Promise.race([
          once(child.stdin, 'drain'),
          done.then(() => {
            throw new Error('FFmpeg closed its input');
          }),
        ]);
      frames++;
    }
  }
  let current = -1,
    hold = '';
  /** Settle each step before `index` and open the next with its caption over the current picture. */
  async function reach(index: number) {
    while (current < index) {
      if (current >= 0) await write(current, steps[current]!.settle);
      current++;
      await write(current, steps[current]!.pre);
    }
  }
  try {
    await new variant.Scene(
      {
        async frame(scene, dt) {
          if (dt === 0) return;
          const n = scene.frameCount,
            index = steps.findIndex((s) => n <= s.last);
          const next = toSvgString(scene, { width }).replace(/height="\d+" viewBox=/, `height="${stageHeight}" viewBox=`);
          // A step opens over the frame before this one: the resting picture of the steps this frame
          // closes (or, for a step with no frames before the first, the first frame).
          if (!svg) svg = next;
          await reach(index < 0 ? steps.length - 1 : index);
          svg = next;
          const step = steps[current]!;
          if (n <= step.moveEnd) return write(current, 1);
          // The scene's caption hold, which the film skips: the picture must already be at rest.
          if (n === step.moveEnd + 1) hold = svg;
          else if (svg !== hold)
            throw new Error(
              `${step.step} ${JSON.stringify(variant.values)}: the picture changes after the caption hold begins, and the film and the player both skip the hold. Finish every change before the step's last play() ends.`,
            );
        },
      },
      { fps },
    ).run();
    await reach(steps.length - 1);
    await write(current, steps[current]!.settle);
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
    ...baseReceipt(project),
    settings: variant.values,
    exporterHash: hash(await readFile(new URL(import.meta.url))),
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
    preset: withFooter ? 'caption-footer' : 'stage-only',
    chapters: steps.map((s) => s.step),
  };
  // Commit the receipt last; interrupted renders never replace a complete video with a partial file.
  await rename(temporaryVideo, out);
  await rename(vtt, out.replace(/\.[^.]+$/, '.vtt'));
  await rename(metadata, out + '.chapters.ffmeta');
  await writeFile(out + '.receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  await rm(temp, { recursive: true, force: true });
  return receipt;
}
