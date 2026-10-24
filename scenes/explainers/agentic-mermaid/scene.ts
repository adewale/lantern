import { Scene } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
const BAD = 'graph LR\nA{Cached} --> B[Reply]\nA --> C[Database]';
const GOOD = 'graph LR\nA{Cached} -->|yes| B[Reply]\nA -->|no| C[Database]';
export default class MermaidExplainer extends Scene {
  static meta = {
    id: 'agentic-mermaid',
    title: 'Make the diagram an editable, checkable model',
    sources: [
      'https://github.com/adewale/agentic-mermaid',
      'https://www.npmjs.com/package/agentic-mermaid/v/0.4.1',
    ],
  };
  static settings = [
    {
      id: 'edit',
      label: 'The agent’s first edit',
      default: 'missing',
      options: [
        { value: 'missing', label: 'Leaves out branch labels' },
        { value: 'complete', label: 'Includes branch labels' },
      ],
    },
  ];
  override async construct() {
    const missing = settingsOf(this).edit === 'missing',
      s = stage(this, {
        palette: palette('blueprint'),
        title: 'An agent edits semantics, not SVG coordinates',
      });
    await this.step('source', {
      title: 'Begin with a typed diagram',
      caption:
        'Mermaid source gives marks stable identities. Agentic Mermaid parses, lays out, styles and verifies it. Lantern uses a build-time snapshot; none of that renderer ships to the reader.',
    });
    const d = await s.show({ source: missing ? BAD : GOOD, style: 'blueprint' });
    await this.step('verify', {
      title: missing ? 'Verify catches ambiguous branches' : 'Verify passes the first edit',
      caption: missing
        ? 'The real verifier reports two unlabeled decision branches. The picture renders, but the reader cannot tell which outcome means yes. Rendering success is not semantic clarity.'
        : 'Both decision branches are labeled. The real verifier has no decision-label warnings. There is no need to invent a failed edit just to make a story.',
    });
    const findings = d.snapshot.findings as { warnings: unknown[] };
    this.state.warnings = findings.warnings;
    await d.highlight(['A']);
    if (missing) {
      await this.step('repair', {
        title: 'Repair by replaying typed operations',
        caption:
          'Set the two edge labels with typed mutation operations. The build replays them and requires their result to equal the next diagram. A decorative morph is not evidence that the edit is correct.',
      });
      await d.morph(
        { source: GOOD, style: 'blueprint' },
        {
          ops: [
            { kind: 'set_label', target: 'A->B#0', label: 'yes' },
            { kind: 'set_label', target: 'A->C#0', label: 'no' },
          ],
        },
      );
    }
    await this.step('walk', {
      title: 'Travel an actual link',
      caption:
        'The token uses the layout route associated with the yes branch. Requesting a hop to a node without an edge would throw before the animation begins.',
    });
    await d.walk([['A', 'B']]);
    await this.step('evidence', {
      title: 'Keep verification findings with the snapshot',
      caption:
        'The snapshot stores mark artwork, identities, routes and the verifier’s findings. This chart counts the real warnings before and after the edit, not a made-up quality score.',
    });
    await d.hide();
    const count = findings.warnings.length;
    const chart = await s.show({
      source: `xychart-beta\n x-axis [First,Final]\n y-axis "Warnings" 0 --> 3\n bar [${count},0]`,
      style: 'blueprint',
    });
    this.state.finalWarnings = 0;
    await this.step('history', {
      title: 'Version the model and its build evidence',
      caption:
        'A source change, a replayed operation and a checked snapshot belong in version control together. The renderer is pinned so a future upgrade can be reviewed for geometry, style and semantic drift.',
    });
    await chart.hide();
    await s.show(
      {
        source: 'gitGraph\n commit id: "source"\n commit id: "typed edit"\n commit id: "checked snapshot"',
        style: 'blueprint',
      },
      { box: [-7, -3.3, 7, 2.7] },
    );
  }
}
