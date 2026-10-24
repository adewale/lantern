import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectProject, ROOT } from '../tools/lib/explain-project.ts';
import { renderVideo, vttTime, wrapCaption } from '../tools/lib/explain-video.ts';
import { Scene, loadFonts } from '../src/index.ts';

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
      assert.equal(video.height, 880);
      assert.equal(Number(video.nb_frames), receipt.frames);
      assert.equal(receipt.systemFonts, false);
      assert.ok(Number(receipt.rasterizedFrames) < Number(receipt.frames));
      assert.equal(probe.streams.filter((s: { codec_type: string }) => s.codec_type === 'audio').length, 0);
      assert.ok(probe.streams.some((s: { codec_name: string }) => s.codec_name === 'mov_text'));
      assert.deepEqual(
        probe.chapters.map((c: { tags: { title: string } }) => c.tags.title),
        ['one', 'two'],
      );
      assert.match(await readFile(out.replace('.mp4', '.vtt'), 'utf8'), /WEBVTT\n\n1\n00:00:00.000 -->/);
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
