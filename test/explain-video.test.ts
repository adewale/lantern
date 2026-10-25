import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectProject, ROOT } from '../tools/lib/explain-project.ts';
import { renderVideo, vttTime, wrapCaption, captionsVtt } from '../tools/lib/explain-video.ts';
import { Scene, Dot, FadeIn, loadFonts } from '../src/index.ts';

test('caption timestamps and wrapping use real glyph advances', async () => {
  await loadFonts();
  assert.equal(vttTime(0), '00:00:00.000');
  assert.equal(vttTime(3661.25), '01:01:01.250');
  assert.equal(vttTime(59.9999), '00:01:00.000');
  for (const value of [-1, Infinity, NaN]) assert.throws(() => vttTime(value));
  const lines = wrapCaption('A short sentence with several measured words.', 3, 0.25);
  assert.equal(lines.join(' '), 'A short sentence with several measured words.');
  assert.ok(lines.length <= 3);
  assert.throws(() => wrapCaption('W'.repeat(1000), 3), /exceeds footer/);
  const trace = { fps: 30, duration: 1, frames: 30, steps: [{ step: 'a', t0: 0, t1: 1, frame0: 0, meta: { caption: 'Bonjour.' }, before: {} }] };
  assert.match(captionsVtt(trace, 'fr'), /^WEBVTT\nLanguage: fr\n\n1\n/);
  trace.steps[0]!.meta.caption = 'tokens < 1 --> 429 & stop';
  assert.match(captionsVtt(trace), /\ntokens &lt; 1 --&gt; 429 &amp; stop\n$/);
});
test(
  'real FFmpeg outputs silent H.264 footer video, subtitles, chapters, VTT and a truthful receipt',
  { skip: process.env.EXPLAIN_VIDEO ? false : 'set EXPLAIN_VIDEO=1 to run FFmpeg integration' },
  async () => {
    const folder = await mkdtemp(join(tmpdir(), 'lantern-video-'));
    try {
      const file = join(folder, 'scene.ts');
      await writeFile(
        file,
        `import{Scene,Dot,FadeIn}from'manim-js';export default class Example extends Scene{static meta={id:'video-test',title:'Video test'};static settings=[{id:'first',label:'First',default:'a-b',options:[{value:'a-b',label:'One'},{value:'a',label:'Two'}]},{id:'second',label:'Second',default:'c',options:[{value:'c',label:'One'},{value:'b-c',label:'Two'}]}];async construct(){await this.step('one',{title:'First',caption:'A dot arrives.'});await this.play(new FadeIn(new Dot(),{runTime:.5}));await this.step('two',{title:'Second',caption:'The dot stays.'});await this.wait(.5)}}`,
      );
      const project = await collectProject(file);
      const out = join(folder, 'test.mp4');
      const receipt = await renderVideo(project, project.variants[0]!, out, { footer: true, fps: 4 });
      const probe = JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_chapters', '-of', 'json', out], {
          encoding: 'utf8',
        }),
      );
      const video = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
      assert.equal(video.codec_name, 'h264');
      assert.equal(video.width, 1280);
      assert.equal(video.height, 960);
      assert.equal(Number(video.nb_frames), receipt.frames);
      assert.equal(receipt.systemFonts, false);
      assert.ok(Number(receipt.rasterizedFrames) < Number(receipt.frames));
      assert.equal(probe.streams.filter((s: { codec_type: string }) => s.codec_type === 'audio').length, 0);
      const subtitles = probe.streams.find((s: { codec_name: string }) => s.codec_name === 'mov_text');
      assert.equal(subtitles.tags.language, 'eng');
      // Chapters carry step titles. A step reads its caption over the previous picture (3 words at
      // 238 wpm: 4 frames at 4 fps), plays its 0.5 s of motion (2 frames) and settles for 0.4 s
      // (2 frames); the scene's caption hold is skipped. The first step, with nothing before it,
      // reads after its motion instead. So each step lasts 8 frames, 2 s.
      assert.deepEqual(
        probe.chapters.map((c: { tags: { title: string }; start_time: string }) => [c.tags.title, Number(c.start_time)]),
        [['First', 0], ['Second', 2]],
      );
      assert.equal(receipt.frames, 16);
      assert.equal(receipt.language, 'en');
      assert.equal(
        await readFile(out.replace('.mp4', '.vtt'), 'utf8'),
        'WEBVTT\nLanguage: en\n\n1\n00:00:00.000 --> 00:00:02.000\nA dot arrives.\n\n2\n00:00:02.000 --> 00:00:04.000\nThe dot stays.\n',
      );
      assert.equal(JSON.parse(await readFile(out + '.receipt.json', 'utf8')).frames, receipt.frames);
      execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-f', 'null', '-'], { stdio: 'pipe' });
      const before = await readFile(out),
        beforeReceipt = await readFile(out + '.receipt.json');
      class TooLong extends Scene {
        override async construct() {
          await this.step('bad', { caption: 'W'.repeat(1000) });
          await this.wait(0.5);
        }
      }
      await assert.rejects(
        renderVideo(project, { ...project.variants[0]!, Scene: TooLong }, out, { footer: true, fps: 4 }),
        /exceeds footer/,
      );
      // The film skips the scene's caption hold, so a picture still moving there fails the render.
      class Moving extends Scene {
        override async construct() {
          await this.step('moves', { caption: 'A caption long enough to need a hold of a few seconds at reading pace.' });
          const dot = new Dot();
          await this.play(new FadeIn(dot, { runTime: 0.5 }));
          dot.addUpdater((m, dt) => {
            m.shift([dt * 0.5, 0]);
          });
        }
      }
      await assert.rejects(
        renderVideo(project, { ...project.variants[0]!, Scene: Moving }, out, { fps: 4 }),
        /moves .*changes after the caption hold begins/,
      );
      assert.deepEqual(await readFile(out), before);
      assert.deepEqual(await readFile(out + '.receipt.json'), beforeReceipt);
      const webm = join(folder, 'test.webm');
      await renderVideo(project, project.variants[0]!, webm, { width: 320, fps: 4 });
      const wp = JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', webm], { encoding: 'utf8' }),
      );
      assert.equal(wp.streams[0].codec_name, 'vp9');
      assert.equal(wp.streams[0].width, 320);
      assert.equal(wp.streams[0].height, 180);
      assert.ok(!wp.streams.some((s: { codec_type: string }) => s.codec_type === 'audio'));
      execFileSync(
        process.execPath,
        [
          join(ROOT, 'tools/explain.ts'),
          'render',
          file,
          '--all',
          '--width',
          '320',
          '--fps',
          '4',
          '--out',
          join(folder, 'case.mp4'),
        ],
        { stdio: 'pipe' },
      );
      const arbitrary = join(folder, 'even-width.mp4');
      await renderVideo(project, project.variants[0]!, arbitrary, { width: 514, fps: 4 });
      const arbitraryProbe = JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', arbitrary], {
          encoding: 'utf8',
        }),
      );
      assert.equal(arbitraryProbe.streams[0].width, 514);
      assert.equal(arbitraryProbe.streams[0].height, 290);
      const cases = (await readdir(folder)).filter(
        (name) => name.startsWith('case-') && name.endsWith('.mp4'),
      );
      assert.equal(
        cases.length,
        4,
        'Every cartesian case needs a unique filename, even when joined values collide',
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  },
);
