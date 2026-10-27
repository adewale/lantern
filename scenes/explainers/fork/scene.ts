import { Scene, Rectangle, Text, Group } from '../../../src/index.ts';
import { stage, regionBox } from '../../../explain/index.ts';
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
    await s.card(
      [
        ['JSON doc', 'no replacement'],
        ['Flowchart parser', 'Agentic Mermaid capture'],
        ['Dev player', 'embed page'],
        ['Worker', 'no replacement'],
        ['Nine scenes', 'rebuilt as explainers'],
      ],
      { at: BELOW },
    );

    await this.step('fork', {
      title: 'The fork puts a build between the scene and the reader',
      line: 'Diagrams are captured once; the page runs no renderer.',
      caption:
        'Agentic Mermaid draws each diagram in Chromium at build time, and the snapshot is stored beside the scene, so the page runs no diagram renderer. The same scene and clock then feed an embed page, a captioned video and rayner check.',
    });
    await s.clearOverlays();
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
    await s.card(
      [
        ['Diagram families', '15 in Agentic Mermaid 0.4.1'],
        ['Diagram renderer in the page', 'none'],
        ['Runtime dependencies', 'still none'],
      ],
      { at: BELOW },
    );

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
    await s.code(SETTINGS, { at: regionBox(BELOW, { right: 2.2 }), fontSize: 0.24 });
    await s.card(
      [
        ['Cases', '3, one per option'],
        ['Each case', 'built, captured, checked'],
      ],
      { at: regionBox(BELOW, { left: 2.6 }) },
    );

    // The video step reads the timing of the 'fork' step this scene has just played.
    const shown = this.steps.find((st) => st.name === 'fork')!;
    const words = String(shown.meta.caption).trim().split(/\s+/).length;
    const motion = (shown.hold ?? shown.t1!) - shown.t0,
      held = shown.hold == null ? 0 : shown.t1! - shown.hold;
    await this.step('video', {
      title: 'The same steps become a silent, captioned video',
      line: `Moving ${motion.toFixed(1)} s under its title, then still ${held.toFixed(1)} s under its caption.`,
      caption: `rayner render draws every frame with resvg and encodes them with FFmpeg. In the video, each step shows its title while it moves, then holds still under its caption long enough to read it at ${Scene.captionWpm} words a minute. Lantern’s render stops at numbered SVG frames.`,
    });
    await s.clearOverlays();
    await flow.dim(['Clock', 'Frames', 'Video']);
    await flow.focus(['Clock', 'Page', 'Frames', 'Video', 'Check'], { zoom: 0.95 });
    // One bar per phase of the 'fork' step, to scale.
    const unit = 11 / (motion + held),
      x0 = -5.5,
      y = -2.85;
    const phase = (from: number, len: number, fill: string, label: string) => {
      const bar = new Rectangle({ width: len * unit, height: 0.55, fill, fillOpacity: 0.85, stroke: 'none' }).moveTo([
        x0 + (from + len / 2) * unit,
        y,
      ]);
      const text = new Text(label, { fontSize: 0.24, color: ink }).moveTo([x0 + (from + len / 2) * unit, y - 0.6]);
      return new Group(bar, text);
    };
    await s.enter(
      new Text(`Step 'fork' in the video: ${(motion + held).toFixed(1)} s`, { fontSize: 0.26, color: ink, weight: 'bold' }).moveTo([0, -1.85]),
      phase(0, motion, s.emphasis, `moving, title in the footer: ${motion.toFixed(1)} s`),
      phase(motion, held, s.soft, `still, caption of ${words} words: ${held.toFixed(1)} s`),
      {
        describe: `A timeline of the fork step in the video: ${motion.toFixed(1)} seconds of motion under its title, then ${held.toFixed(1)} seconds still under its ${words}-word caption`,
      },
    );
    this.state.video = { motion: Number(motion.toFixed(2)), held: Number(held.toFixed(2)), words };

    await this.step('checks', {
      title: 'Every case passes rayner check before it ships',
      line: 'Two checks come from Lantern; the fork adds four.',
      caption:
        'Lantern’s own tests compared a seeked frame with a played one and looked for jumps in motion. rayner check runs both on every case and adds the fork’s checks: text at least 14 px, no letters the fonts lack, words for every drawing, and a still picture while the caption is read.',
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
    await s.card(
      [
        ['Agent endpoints', 'gone'],
        ['Diagram lettering', 'Inter in every style'],
        ['New diagrams need', 'Chromium at build time'],
        ['Engine changes upstream', 'none yet'],
      ],
      { at: BELOW },
    );
  }
}
