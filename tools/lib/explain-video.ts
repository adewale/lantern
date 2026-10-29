import { rightToLeft, withSceneLettering } from '../../src/lettering-outlines.ts';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, resolve, join, basename } from 'node:path';
import { Scene, Text, takeMissingGlyphs, toSvgString, loadFonts, traceScene } from '../../src/index.ts';
import type { Trace, Box } from '../../src/index.ts';
import { FRAME } from '../../src/svg.ts';
import { caseNameIn, descriptionLang } from '../../app/embed-strings.ts';
import type { ExplainerClass, Settings } from '../../explain/index.ts';
import { filmPlan, pushAt, pacing, pacingProblems, FILM } from '../../explain/film.ts';
import { pictureHtml, htmlEscape, stepWords, wordsHtml } from '../../explain/trace.ts';
import type { Project } from './explain-project.ts';
import { ROOT, hash, baseReceipt } from './explain-project.ts';

// Retain the caption layout helpers for existing lettering snapshot capture and validation.
// Film export uses subtitles and does not draw a footer.
/** Footer caption type in scene units (80 px each at 1280): 27 px text on 40 px lines, about 80 characters a line. */
const CAPTION = { size: 0.34, leading: 0.5, lines: 4 };
export const FOOTER_TEXT_WIDTH = 13.6;
/** Footer height in scene units: a 1280 × 720 stage over a 240 px footer is 1280 × 960. */
const FOOTER_HEIGHT = 3;
/** The footer's top edge, in the footer band's scene units. */
const FOOTER_TEXT_TOP = FOOTER_HEIGHT / 2;
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
      const words = stepWords(s);
      const lines = [words.title, words.caption].map((t) => footerParagraph(t));
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
      const shows = pictureHtml(s.after),
        words = stepWords(s);
      return `<li><h2${dir(words.title)}>${htmlEscape(words.title)}</h2>${wordsHtml(words, dir)}${shows && descriptionLang(lang) ? `<div${descriptionLang(lang)}>${shows}</div>` : shows}</li>`;
    })
    .join('')}</ol></html>\n`;
}

export { rasterize, band } from './explain-raster.ts';
import { rasterize, band } from './explain-raster.ts';

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
      .filter((s) => stepWords(s).caption)
      .map(
        (s, i) =>
          `${i + 1}\n${vttTime(s.t0)} --> ${vttTime(s.t1 ?? trace.duration)}\n${stepWords(s).caption.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\s*\n/g, '\n').trim()}\n`,
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
  const temp = await mkdtemp(join(dirname(out), '.rayner-video-'));
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
            `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s.t0 * 1000)}\nEND=${Math.round(s.t1 * 1000)}\ntitle=${escape(stepWords(trace.steps[i]!).title)}\n`,
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
    const problems = pacingProblems(pacing(trace, changed));
    if (problems.length) throw new Error(`Video pacing: ${problems.join('; ')}`);
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
