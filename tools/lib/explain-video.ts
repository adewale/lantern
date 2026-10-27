import { rightToLeft, withSceneLettering } from '../../src/lettering-outlines.ts';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile, readFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, join, basename } from 'node:path';
import { Scene, Text, Rectangle, NullSink, toSvgString, loadFonts, traceScene, takeMissingGlyphs } from '../../src/index.ts';
import type { Trace } from '../../src/index.ts';
import { FRAME } from '../../src/svg.ts';
import { caseNameIn, descriptionLang } from '../../app/embed-strings.ts';
import type { ExplainerClass, Settings } from '../../explain/index.ts';
import { pictureHtml, htmlEscape } from '../../explain/trace.ts';
import type { Project } from './explain-project.ts';
import { ROOT, hash, baseReceipt } from './explain-project.ts';

/** Footer caption type in scene units (80 px each at 1280): 27 px text on 40 px lines, about 80 characters a line. */
const CAPTION = { size: 0.34, leading: 0.5, lines: 4 };
export const FOOTER_TEXT_WIDTH = 13.6;
/** Footer height in scene units: a 1280 × 720 stage over a 240 px footer is 1280 × 960. */
const FOOTER_HEIGHT = 3;
/** The footer's top edge, in the footer band's scene units. */
const FOOTER_TEXT_TOP = FOOTER_HEIGHT / 2;
/** MP4 tags a stream with an ISO 639-2 code (the terminology code, as MP4 uses); WebM and WebVTT take the scene's BCP 47 tag as is. */
const ISO_639_2: Record<string, string> = { ar: 'ara', hi: 'hin', he: 'heb', zh: 'zho', ja: 'jpn', ko: 'kor', el: 'ell', ru: 'rus', en: 'eng', fr: 'fra' };
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
  // A right-to-left title or caption is marked so, as the footer aligns it
  const dir = (text: unknown) => (rightToLeft(String(text)) ? ' dir="rtl"' : '');
  return `<!doctype html><html lang="${htmlEscape(lang)}"><meta charset="utf-8"><title>${htmlEscape(title)}</title><h1${dir(title)}>${htmlEscape(title)}</h1><ol>${steps
    .map((s) => {
      const shows = pictureHtml(s.after);
      return `<li><h2${dir(s.meta.title ?? s.step)}>${htmlEscape(s.meta.title ?? s.step)}</h2><p${dir(s.meta.caption ?? '')}>${htmlEscape(s.meta.caption ?? '')}</p>${shows && descriptionLang(lang) ? `<div${descriptionLang(lang)}>${shows}</div>` : shows}</li>`;
    })
    .join('')}</ol></html>\n`;
}

export { rightToLeft };
/** Right-to-left mark: a line that starts with it keeps its paragraph's direction when shaped alone. */
const RLM = '\u200f';
/**
 * A title or caption as the footer draws it: wrapped, and for a right-to-left
 * paragraph each line led by a right-to-left mark, so a wrapped line that starts
 * with a Latin word still reads right to left and the footer aligns it right.
 */
export function footerParagraph(text: string, width = FOOTER_TEXT_WIDTH, size = CAPTION.size): string[] {
  const lines = wrapCaption(text, width, size);
  return rightToLeft(text) ? lines.map((line) => RLM + line) : lines;
}

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

/**
 * Each step's title and caption wrapped for the caption-footer preset. Throws, naming the step
 * and case, when one does not fit four lines or has a character the embedded fonts cannot draw.
 * `rayner render --footer` runs it before FFmpeg starts; `npm run videos` runs it on every case it renders.
 */
export async function footerLines(trace: Trace, values: Settings): Promise<string[][][]> {
  await loadFonts();
  takeMissingGlyphs();
  return trace.steps.map((s) => {
    try {
      const lines = [s.meta.title ?? s.step, s.meta.caption ?? ''].map((t) => footerParagraph(String(t)));
      // wrapCaption shaped each line as it measured it; a right-to-left line is drawn with its mark, so shape that too
      for (const line of lines.flat()) if (line.startsWith(RLM)) new Text(line, { fontSize: CAPTION.size });
      // Footer text is drawn as outlines too, so a character the fonts lack would be blank.
      const lost = [...takeMissingGlyphs().values()].join('');
      if (lost) throw new Error(`the title or caption has characters the fonts cannot draw: ${[...new Set(lost)].join(' ')}`);
      return lines;
    } catch (error) {
      throw new Error(`${s.step} ${JSON.stringify(values)}: ${(error as Error).message}`);
    }
  });
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
export function band(scene: Scene, width: number, height: number, background?: string): string {
  const full = Math.round((width * FRAME.h) / FRAME.w),
    px = Math.round((width * height) / FRAME.w);
  // cull: resvg 2.6.2 aborts on a fading element the camera has left outside the view.
  // overflow="visible": resvg 2.6.2 also panics (geom.rs, unwrap on None) on a translucent element
  // inside a nested svg that clips its viewport when something there reaches past it, as the paper
  // does under a zoomed camera. The outer svg crops the band, which lies inside the inner viewport,
  // so letting the inner one overflow shows nothing more.
  const stage = toSvgString(scene, { width, background, cull: true }).replace(/^<svg /, '<svg overflow="visible" ');
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

/**
 * The film's order for each step: the motion under the step's title, then the resting picture
 * under the full caption for its whole reading time at Scene.captionWpm. The scene's own hold is
 * skipped: it counts the motion as reading time, and in the film the caption waits for the rest.
 * Times are the film's; `rest` is when the caption appears.
 */
function filmSteps(trace: Trace) {
  const { fps } = trace;
  let start = 0;
  return trace.steps.map((s) => {
    const caption = typeof s.meta.caption === 'string' ? s.meta.caption.trim() : '';
    const read = Math.ceil(((caption ? caption.split(/\s+/).length : 0) / Scene.captionWpm) * 60 * fps - 1e-6);
    const last = s.frame1 ?? trace.frames,
      moveEnd = s.hold == null ? last : Math.round(s.hold * fps);
    const t0 = start / fps,
      rest = (start += moveEnd - s.frame0) / fps;
    start += read;
    return { ...s, read, last, moveEnd, t0, rest, t1: start / fps };
  });
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
    top = FOOTER_TEXT_TOP;
  // A hairline divides stage from footer when their backgrounds are close.
  scene.add(new Rectangle({ width: 16, height: 0.025, fill: colours.line, stroke: 'none' }).moveTo([0, top - 0.0125]));
  footerText(scene, lines, colours.fg);
  return (await rasterize(band(scene, width, FOOTER_HEIGHT, colours.bg))).pixels;
}
/**
 * The footer's lines on `scene`: each starts at the left edge of the text column,
 * or for a right-to-left paragraph (footerParagraph), ends at its right edge.
 */
export function footerText(scene: Scene, lines: string[], color: string): Text[] {
  const top = FOOTER_TEXT_TOP;
  return lines.map((line, i) => {
    const rtl = line.startsWith(RLM);
    const text = new Text(line, { fontSize: CAPTION.size, color, anchor: rtl ? 'end' : 'start' }).moveTo(
      [(rtl ? 1 : -1) * FOOTER_TEXT_WIDTH / 2, top - 0.62 - i * CAPTION.leading],
      [rtl ? 1 : -1, 0],
    );
    scene.add(text);
    return text;
  });
}

export async function renderVideo(
  project: Project,
  variant: { Scene: ExplainerClass; values: Settings },
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
  const steps = filmSteps(trace);
  if (!steps.length) throw new Error('A video needs at least one step');
  // The footer must hold every title and caption; fail before FFmpeg starts, naming the step and case.
  const footerLinesByStep = withFooter ? await withSceneLettering(variant.Scene, () => footerLines(trace, variant.values)) : steps.map((): string[][] => [[], []]);
  out = resolve(out);
  await mkdir(dirname(out), { recursive: true });
  const temp = await mkdtemp(join(dirname(out), '.rayner-video-'));
  const temporaryVideo = join(temp, basename(out));
  const vtt = temporaryVideo.replace(/\.[^.]+$/, '.vtt'),
    metadata = temporaryVideo + '.chapters.ffmeta';
  // Subtitle cues match the footer's captions: from the resting picture to the step's end.
  await writeFile(vtt, captionsVtt({ ...trace, steps: steps.map((s) => ({ ...s, t0: s.rest })) }, lang));
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
  const footers: Uint8Array[][] = steps.map(() => []);
  let colours: Awaited<ReturnType<typeof footerColours>> | undefined;
  /** `count` frames of the current picture over `step`'s title (part 0) or caption (part 1). */
  async function write(step: number, part: 0 | 1, count: number) {
    if (!count) return;
    const stage = await picture();
    let frame = stage;
    if (withFooter) {
      // Light or dark tokens to match the stage, judged by its top-left pixel.
      colours ??= await footerColours(0.2126 * stage[0]! + 0.7152 * stage[1]! + 0.0722 * stage[2]! < 128);
      const pixels = (footers[step]![part] ??= await withSceneLettering(variant.Scene, () => footer(footerLinesByStep[step]![part]!, width, colours!)));
      frame = Buffer.concat([stage, pixels]);
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
  let current = 0;
  /** Hold the resting picture of each step before `index` under its caption. */
  async function rest(index: number) {
    for (; current < index; current++) await write(current, 1, steps[current]!.read);
  }
  try {
    await new variant.Scene(
      {
        async frame(scene, dt) {
          if (dt === 0) return;
          const n = scene.frameCount,
            index = steps.findIndex((s) => n <= s.last);
          await rest(index < 0 ? steps.length - 1 : index);
          const next = band(scene, width, (stageHeight * FRAME.w) / width),
            step = steps[current]!;
          if (n <= step.moveEnd) {
            svg = next;
            return write(current, 0, 1);
          }
          // The scene's caption hold, which the film skips. Its first frame is the resting picture
          // the caption is held over: a play lands (a morph gets its paths' own structure back)
          // only after its last frame is drawn. After that the picture must stay at rest.
          if (n === step.moveEnd + 1) svg = next;
          else if (next !== svg)
            throw new Error(
              `${step.step} ${JSON.stringify(variant.values)}: the picture changes after the caption hold begins, and the film and the player both skip the hold. Finish every change before the step's last play() ends.`,
            );
        },
      },
      { fps },
    ).run();
    await rest(steps.length);
    child.stdin.end();
    await done;
  } catch (error) {
    child.stdin.destroy();
    child.kill();
    await done.catch(() => {});
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  // The text alternative to the video (WCAG 1.2.1): each step's title, caption and what its picture shows.
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
    preset: withFooter ? 'caption-footer' : 'stage-only',
    // Each chapter starts at its motion; its caption then holds over its resting picture this many seconds.
    chapters: steps.map((s) => ({ step: s.step, captionHold: Math.round((s.read / fps) * 1000) / 1000 })),
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
