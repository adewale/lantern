import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectProject, ROOT } from '../tools/lib/explain-project.ts';
import { renderVideo, vttTime, captionsVtt, probeVideo } from '../tools/lib/explain-video.ts';
import { Scene, Dot, FadeIn } from '../src/index.ts';
import { fc, params } from './lib/pbt.ts';

// Caption wrapping for the footer is proven in explain-tools.property.test.ts.
test('caption timestamps round to the millisecond and carry into the next unit', () => {
  assert.equal(vttTime(0), '00:00:00.000');
  assert.equal(vttTime(3661.25), '01:01:01.250');
  assert.equal(vttTime(59.9999), '00:01:00.000');
});
test('WebVTT names the language and escapes markup in cues', () => {
  const trace = { fps: 30, duration: 1, frames: 30, steps: [{ step: 'a', t0: 0, t1: 1, frame0: 0, meta: { caption: 'Bonjour.' }, before: {} }] };
  assert.match(captionsVtt(trace, 'fr'), /^WEBVTT\nLanguage: fr\n\n1\n/);
  trace.steps[0]!.meta.caption = 'tokens < 1 --> 429 & stop';
  assert.match(captionsVtt(trace), /\ntokens &lt; 1 --&gt; 429 &amp; stop\n$/);
});
// Regression (ManimCommunity #2314, #3062, #3243: https://github.com/ManimCommunity/manim/pull/2314,
// https://github.com/ManimCommunity/manim/pull/3062, https://github.com/ManimCommunity/manim/issues/3243).
// A blank line inside a caption used to end the cue, and players dropped the rest.
test('a caption with a blank line or "-->" stays one WebVTT cue', () => {
  fc.assert(
    fc.property(fc.array(fc.string({ unit: fc.constantFrom('a', ' ', '\n', '-', '>', 'é'), minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 4 }), (caps) => {
      const steps = caps.map((caption, i) => ({ step: `s${i}`, t0: i, t1: i + 1, frame0: i * 30, meta: { caption }, before: {} }));
      const vtt = captionsVtt({ fps: 30, duration: caps.length, frames: caps.length * 30, steps });
      const blocks = vtt.trim().split(/\n\s*\n/).slice(1); // after the WEBVTT header
      assert.equal(blocks.length, caps.filter((c) => c).length, vtt);
      for (const b of blocks) assert.match(b, /^\d+\n\d\d:\d\d:\d\d\.\d{3} --> \d\d:\d\d:\d\d\.\d{3}(\n|$)/);
    }),
    params(300),
  );
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
      const probe = probeVideo(out);
      const video = probe.streams.find((s) => s.codec_type === 'video')!;
      assert.equal(video.codec_name, 'h264');
      assert.equal(video.width, 1280);
      assert.equal(video.height, 960);
      assert.equal(Number(video.nb_frames), receipt.frames);
      assert.equal(receipt.systemFonts, false);
      assert.ok(Number(receipt.rasterizedFrames) < Number(receipt.frames));
      assert.ok(!probe.streams.some((s) => s.codec_type === 'audio'));
      assert.equal(probe.streams.find((s) => s.codec_name === 'mov_text')!.tags!.language, 'eng');
      // Chapters carry step titles and start at the motion. Step one plays 0.5 s of motion (2 frames
      // at 4 fps) under its title, then holds its resting picture under its caption for the reading
      // time (3 words at 160 wpm: 5 frames); the scene's own hold is skipped. Step two's 0.5 s wait
      // plays the same way.
      assert.deepEqual(
        probe.chapters.map((c) => [c.tags.title, Number(c.start_time)]),
        [['First', 0], ['Second', 1.75]],
      );
      assert.equal(receipt.frames, 14);
      assert.deepEqual(receipt.chapters, [{ step: 'one', captionHold: 1.25 }, { step: 'two', captionHold: 1.25 }]);
      assert.equal(receipt.language, 'en');
      assert.equal(
        await readFile(out.replace('.mp4', '.vtt'), 'utf8'),
        'WEBVTT\nLanguage: en\n\n1\n00:00:00.500 --> 00:00:01.750\nA dot arrives.\n\n2\n00:00:02.250 --> 00:00:03.500\nThe dot stays.\n',
      );
      assert.match(
        await readFile(join(folder, receipt.transcript as string), 'utf8'),
        /<h1>Video test · First: One · Second: One<\/h1><ol><li><h2>First<\/h2><p>A dot arrives\.<\/p>.*<li><h2>Second<\/h2><p>The dot stays\.<\/p>/,
      );
      assert.equal(JSON.parse(await readFile(out + '.receipt.json', 'utf8')).frames, receipt.frames);
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
      // Footer text is drawn as outlines: a character the fonts lack fails before FFmpeg starts.
      class Han extends Scene {
        override async construct() {
          await this.step('han', { title: 'Han', caption: 'A caption with 中 in it.' });
          await this.play(new FadeIn(new Dot(), { runTime: 0.5 }));
        }
      }
      await assert.rejects(
        renderVideo(project, { ...project.variants[0]!, Scene: Han }, out, { footer: true, fps: 4 }),
        /han .*the title or caption has characters the fonts cannot draw: 中/,
      );
      // The film holds the first frame after the step's last play() under the caption, so a
      // picture still moving there fails the render (check fails it too: explain-gates.test.ts).
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
      const wp = probeVideo(webm);
      assert.equal(wp.streams[0]!.codec_name, 'vp9');
      assert.equal(wp.streams[0]!.width, 320);
      assert.equal(wp.streams[0]!.height, 180);
      assert.ok(!wp.streams.some((s) => s.codec_type === 'audio'));
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
      const { streams } = probeVideo(arbitrary);
      assert.equal(streams[0]!.width, 514);
      assert.equal(streams[0]!.height, 290);
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
