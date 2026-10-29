import { Scene, Rectangle, Text, Group } from '../../../src/index.ts';
import { stage, regionBox } from '../../../explain/index.ts';
import { beatSeconds, words as wordsIn, FILM } from '../../../explain/film.ts';
const STYLE = 'github-light';
// Upstream Lantern at the fork base, 2c7bad5: README "Outputs", app/worker.ts, src/mermaid.ts, src/doc.ts.
const LANTERN =
  'graph LR\nDoc[JSON doc]\nParser[Flowchart parser]\nScene[Scene class]\nClock[Fixed dt clock]\nPlayer[Dev player]\nWorker[Worker]\nFrames[SVG frames]\nDoc --> Scene\nParser --> Scene\nScene --> Clock\nClock --> Player\nClock --> Worker\nClock --> Frames';
// The fork: docs/UPSTREAM.md and the design record's table of what is inherited and what changes.
const FORK =
  'graph LR\nSettings[Settings]\nCapture[Agentic Mermaid]\nSnaps[Snapshots]\nScene[Scene class]\nClock[Fixed dt clock]\nPage[Embed page]\nFrames[SVG frames]\nVideo[Captioned video]\nCheck[rayner check]\nSettings --> Scene\nCapture --> Snaps\nSnaps --> Scene\nScene --> Clock\nClock --> Page\nClock --> Frames\nFrames --> Video\nClock --> Check';
// scenes/explainers/token-bucket/scene.ts.
const SETTINGS = [
  'static settings = [{',
  "  id: 'rate', label: 'Refill per second', default: '2',",
  "  options: [{ value: '1', label: '1 token' },",
  "            { value: '2', label: '2 tokens' },",
  "            { value: '4', label: '4 tokens' }],",
  '}];',
];
const GONE = ['Doc', 'Parser', 'Player', 'Worker'];
// The diagram takes the top three fifths; cards sit under it.
const ABOVE = regionBox('top', { bottom: -1.1 }),
  BELOW = regionBox('bottom', { top: -1.35 });

export default class ForkExplainer extends Scene {
  static meta = {
    id: 'fork',
    title: 'What this fork keeps from Lantern, and what it replaces',
    sources: [
      'https://github.com/ivarvong/lantern/blob/2c7bad5/README.md',
      'https://github.com/ivarvong/lantern/blob/2c7bad5/app/worker.ts',
      'https://github.com/ivarvong/lantern/blob/2c7bad5/src/mermaid.ts',
      'https://github.com/adewale/rayner/blob/main/docs/UPSTREAM.md',
    ],
  };
  override async construct() {
    const s = stage(this, { style: STYLE });
    const ink = s.palette.ink;

    await this.step('lantern', {
      title: 'Lantern plays a scene in a live player and a Worker',
      line: 'A fixed clock feeds the dev player and the Worker alike.',
      caption:
        'Lantern, at commit 2c7bad5, runs a Scene class on a fixed clock. A development player shows it with links to any step, and a Cloudflare Worker serves one frame as SVG or as text, or the whole trace as JSON, to people and agents alike.',
    });
    const flow = await s.show({ source: LANTERN }, { box: ABOVE });
    await flow.walk([['Scene', 'Clock']], { trail: true });
    await flow.walk(
      [
        ['Clock', 'Player'],
        ['Clock', 'Worker'],
      ],
      { parallel: true, trail: true },
    );
    await s.card(
      [
        ['Dev player', '?scene=&step= links, reloads on save'],
        ['Worker', '/frame.svg, /text, /trace.json, /llms.txt'],
        ['Diagrams', 'Mermaid flowcharts, laid out in the page'],
        ['Runtime dependencies', 'none'],
      ],
      { at: BELOW },
    );

    await this.step('engine', {
      title: 'The fork keeps the engine',
      line: 'Bézier points, fixed endpoints and seek by replay all stay.',
      caption:
        'The scene still runs on Lantern’s src/: shapes and glyphs stored as Bézier points, animations whose endpoints are fixed when they begin, the fixed clock and seeking by replay. The fork changed the engine only to fix a fault or add a hook the helpers need, and docs/UPSTREAM.md lists each change with its regression test.',
    });
    await s.clearOverlays();
    await flow.unmark();
    await flow.dim(['Scene', 'Clock', 'Frames']);
    await s.card(
      [
        ['Mobject', 'Bézier points'],
        ['Animation', 'endpoints fixed at begin'],
        ['Scene', 'fixed dt, seek by replay'],
        ['Text', 'Inter and JetBrains Mono outlines'],
        ['Changes offered upstream', 'none yet'],
      ],
      { at: BELOW },
    );

    await this.step('removed', {
      title: 'Four parts of Lantern are deleted',
      line: 'The JSON doc, parser, dev player and Worker are gone.',
      caption:
        'The fork deleted the JSON scene format, the flowchart parser, the development player and the Worker, along with the nine original scenes, which the explainers rebuild. The player and the parser have replacements; the JSON format and the Worker’s endpoints have none.',
    });
    await s.clearOverlays();
    await flow.dim(null);
    await flow.mark(GONE, { color: s.bad, as: 'deleted' });
    // What replaces each deleted part, said on the part.
    await flow.note('Doc', 'no replacement', { side: 'left' });
    await flow.note('Parser', 'replaced by Agentic Mermaid capture', { side: 'below' });
    await flow.note('Player', 'replaced by the embed page', { side: 'above' });
    await flow.note('Worker', 'no replacement', { side: 'right' });

    await this.step('fork', {
      title: 'The fork puts a build between the scene and the reader',
      line: 'Diagrams are captured once; the page runs no renderer.',
      caption:
        'Agentic Mermaid draws each diagram in Chromium at build time, and the snapshot is stored beside the scene, so the page runs no diagram renderer. The same scene and clock then feed an embed page, a captioned video and rayner check.',
    });
    await flow.morph({ source: FORK });
    await flow.walk(
      [
        ['Capture', 'Snaps'],
        ['Snaps', 'Scene'],
        ['Scene', 'Clock'],
        ['Clock', 'Page'],
      ],
      { trail: true },
    );
    await flow.note('Capture', '15 diagram families in 0.4.1', { side: 'below' });
    await flow.note('Page', 'no diagram renderer, still no dependencies', { side: 'above' });

    await this.step('settings', {
      title: 'A reader setting is a case built ahead of time',
      line: 'Each option of the refill rate is a case, checked in advance.',
      caption:
        'A scene may declare a few settings, like the token bucket’s refill rate. Every combination of options is a case: the build runs each one, captures its diagrams and checks it, so choosing 4 tokens opens a page that was already tested.',
    });
    await s.clearOverlays();
    await flow.unmark();
    await flow.dim(['Settings', 'Scene', 'Clock', 'Page']);
    await flow.walk([['Settings', 'Scene']], { trail: true });
    await s.code(SETTINGS, { at: BELOW, fontSize: 0.24 });
    await flow.note('Settings', '3 cases, each built, captured and checked', { side: 'above' });

    // The video step reads the timing of the 'fork' step this scene has just played.
    const shown = this.steps.find((st) => st.name === 'fork')!;
    const words = wordsIn(shown.meta.caption);
    const motion = (shown.hold ?? shown.t1!) - shown.t0,
      rest = beatSeconds(wordsIn(shown.meta.title), motion),
      // What the first exporter did: hold the picture under the whole caption at reading speed.
      held = (words / Scene.captionWpm) * 60;
    await this.step('video', {
      title: 'The same steps become a silent video, paced by their motion',
      line: `Moving ${motion.toFixed(1)} s, then resting ${rest.toFixed(1)} s.`,
      caption: `rayner render draws every frame with resvg and encodes them with FFmpeg. Each step moves under its title, then rests at most ${FILM.maxBeat} s while the view pushes in; its caption goes to the subtitles. The first exporter held each picture under its caption at ${Scene.captionWpm} words a minute instead, and most of every video stood still.`,
    });
    await s.clearOverlays();
    await flow.dim(['Clock', 'Frames', 'Video']);
    await flow.focus(['Clock', 'Page', 'Frames', 'Video', 'Check'], { zoom: 0.95 });
    // The 'fork' step in the video, to scale: as it plays now, and as the first exporter played it.
    const unit = 11 / (motion + held),
      x0 = -5.5;
    const phase = (from: number, len: number, y: number, fill: string, label: string) => {
      const bar = new Rectangle({ width: len * unit, height: 0.4, fill, fillOpacity: 0.85, stroke: 'none' }).moveTo([
        x0 + (from + len / 2) * unit,
        y,
      ]);
      const text = new Text(label, { fontSize: 0.22, color: ink }).moveTo([x0 + (from + len / 2) * unit, y - 0.42]);
      return new Group(bar, text);
    };
    const rowLabel = (text: string, y: number) =>
      new Text(text, { fontSize: 0.22, color: ink, weight: 'bold', anchor: 'start' }).moveTo([x0, y + 0.42], [-1, 0]);
    await s.enter(
      rowLabel(`Now: ${(motion + rest).toFixed(1)} s`, -1.95),
      phase(0, motion, -1.95, s.emphasis, `moving: ${motion.toFixed(1)} s`),
      phase(motion, rest, -1.95, s.soft, `rest: ${rest.toFixed(1)} s`),
      rowLabel(`First exporter: ${(motion + held).toFixed(1)} s`, -3.2),
      phase(0, motion, -3.2, s.emphasis, `moving: ${motion.toFixed(1)} s`),
      phase(motion, held, -3.2, s.soft, `still under a ${words}-word caption: ${held.toFixed(1)} s`),
      {
        describe: `Two timelines of the fork step in the video, to scale. Now: ${motion.toFixed(1)} seconds of motion, then a ${rest.toFixed(1)}-second rest. The first exporter: the same motion, then ${held.toFixed(1)} seconds still under its ${words}-word caption`,
      },
    );
    this.state.video = { motion: Number(motion.toFixed(2)), rest: Number(rest.toFixed(2)), held: Number(held.toFixed(2)), words };

    await this.step('checks', {
      title: 'Every case passes rayner check before it ships',
      line: 'Two checks come from Lantern; the fork adds four.',
      caption:
        'Lantern’s own tests compared a seeked frame with a played one and looked for jumps in motion. rayner check runs both on every case and adds the fork’s checks: text at least 14 px, no letters the fonts lack, words for every drawing, a still picture while the caption is read, and a video that does not stand still.',
    });
    await s.clearOverlays();
    await flow.focus('all');
    await flow.dim(['Clock', 'Check']);
    await flow.walk([['Clock', 'Check']], { trail: true });
    await s.card(
      [
        ['Seek equals play', 'from Lantern'],
        ['No jumps in motion', 'from Lantern'],
        ['Text at least 14 px', 'fork'],
        ['Letters in the fonts', 'fork'],
        ['Words for every drawing', 'fork'],
        ['Still while the caption reads', 'fork'],
        ['A video that keeps moving', 'fork'],
      ],
      { at: BELOW, fontSize: 0.2 },
    );

    await this.step('cost', {
      title: 'What the fork gave up',
      line: 'No agent endpoints, Inter everywhere, Chromium to capture.',
      caption:
        'Agents lose the Worker’s endpoints, and every diagram style is lettered in Inter. Capturing a new diagram needs Chromium at build time, though a page built from stored snapshots needs nothing. No engine change has gone upstream.',
    });
    await s.clearOverlays();
    await flow.dim(null);
    await flow.mark(['Capture'], { as: 'needs Chromium' });
    await flow.note('Capture', 'Chromium at build time; Inter in every style', { side: 'below' });
    await flow.note('Page', 'no agent endpoints', { side: 'above' });
  }
}
