import { Scene, Code, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, palette } from '../../../explain/index.ts';
export default class LanternExplainer extends Scene {
  static meta = {
    id: 'lantern',
    title: 'One scene. Every output.',
    sources: [
      'https://github.com/ivarvong/lantern',
      'https://github.com/ivarvong/lantern/blob/2c7bad5/src/scene.ts',
    ],
  };
  override async construct() {
    const s = stage(this, { palette: palette('hand-drawn'), title: 'Lantern explains itself, using itself' });
    await this.step('model', {
      title: 'A scene is an ordinary program',
      caption:
        'The author writes an async construct method. Steps name ideas; play advances animations. There is no lesson interpreter between the author and the engine.',
    });
    const code = new Code(
      [
        "await this.step('before', { caption: 'One idea.' });",
        'await this.play(new FadeIn(diagram));',
        "await this.step('after', { caption: 'The next idea.' });",
        'await this.play(new Transform(before, after));',
      ],
      { fontSize: 0.31 },
    ).moveTo([0, 0]);
    code.setFill(s.palette.ink);
    await this.play(new FadeIn(code));
    await this.step('objects', {
      title: 'Objects hold points; animations move them',
      caption:
        'A scene owns mobjects. Mobjects hold geometry and styles. Animations interpolate endpoints. A sink decides whether those same frames become a browser view, an SVG string or an inspection trace.',
    });
    await this.play(new FadeOut(code));
    const classes = await s.show({
      source:
        'classDiagram\n direction LR\n class Scene {\n construct()\n play()\n step()\n }\n class Mobject {\n points\n style\n }\n class Animation {\n interpolate()\n }\n class Sink {\n frame()\n }\n Scene --> Mobject : owns\n Scene --> Animation : plays\n Scene --> Sink : emits',
      style: 'hand-drawn',
    });
    await this.step('points', {
      title: 'Points are the truth',
      caption:
        'Imported diagrams become the same cubic paths as native shapes and text. Camera helpers transform those points. They do not hide an independent SVG renderer inside the player.',
    });
    await classes.focus(['Mobject']);
    await classes.focus('all');
    await this.step('clock', {
      title: 'The clock advances by fixed steps',
      caption:
        'Scene time advances one fixed interval per frame. A real-time sink may wait for the display. An offline sink can run immediately. The scene’s simulation does not change.',
    });
    await classes.hide();
    const flow = await s.show({
      source:
        'graph LR\nAuthor[Native Scene] --> Clock[Fixed dt loop]\nClock --> Browser[Browser sink]\nClock --> SVG[SVG frames]\nClock --> Trace[State trace]\nSVG --> Video[Video encoder]',
      style: 'hand-drawn',
    });
    await flow.walk(
      [
        ['Clock', 'Browser'],
        ['Clock', 'Trace'],
      ],
      { parallel: true },
    );
    await this.step('seek', {
      title: 'Seeking replays the same program',
      caption:
        'To seek, run the scene again while skipping frames before the target time. Endpoints are fixed when each animation begins. The sought frame must equal the played frame exactly.',
    });
    await flow.walk([
      ['Author', 'Clock'],
      ['Clock', 'SVG'],
    ]);
    this.state.seekContract = 'played SVG equals seeked SVG';
    await this.step('publish', {
      title: 'Publish one complete explanation',
      caption:
        'Build-time capture supplies the diagrams. The HTML contains one explanation, its cases, poster and transcript. Reader controls change pace; they do not call a layout service.',
    });
    await flow.morph({
      source:
        'graph LR\nAuthor[Native Scene] --> Build[Build snapshots]\nBuild --> Page[Portable HTML]\nBuild --> Video[Captioned video]\nPage --> Reader[Reader-paced steps]',
      style: 'hand-drawn',
    });
    await this.step('inspect', {
      title: 'Make the explanation inspectable',
      caption:
        'Walks record real edges. State traces expose the program’s answers. Seek, motion and bare-runtime checks validate every built case. A nice-looking animation is not enough evidence on its own.',
    });
    await flow.walk([
      ['Author', 'Build'],
      ['Build', 'Page'],
      ['Page', 'Reader'],
    ]);
  }
}
