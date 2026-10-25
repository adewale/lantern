import { Scene, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, settingsOf, edgePartOf, Card, CodeBlock, REGIONS } from '../../../explain/index.ts';
import type { CardRow } from '../../../explain/index.ts';
import type { DiagramSnapshot } from '../../../integrations/agentic-mermaid/snapshot.ts';
const STYLE = 'blueprint';
const BAD = 'graph LR\nA{Cached} --> B[Reply]\nA --> C[Database]';
const GOOD = 'graph LR\nA{Cached} -->|yes| B[Reply]\nA -->|no| C[Database]';
const OPS = [
  { kind: 'set_label', target: 'A->B#0', label: 'yes' },
  { kind: 'set_label', target: 'A->C#0', label: 'no' },
];
interface Warning {
  code: string;
  node: string;
  edge: string;
}
interface Findings {
  ok: boolean;
  warnings: Warning[];
  layout: { edges: { id: string; label?: { text: string } }[] };
}
const findingsOf = (snap: DiagramSnapshot) => snap.findings as Findings;
const SIDE = REGIONS.side,
  GAP = 0.3;

export default class MermaidExplainer extends Scene {
  static meta = {
    id: 'agentic-mermaid',
    title: 'Verify and repair an agent’s Mermaid edit',
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
      s = stage(this);
    const first = missing ? BAD : GOOD;
    const code = (lines: readonly string[], fontSize = 0.24) =>
      new CodeBlock(this, s.palette, lines, { at: SIDE, fontSize });
    const card = (rows: readonly CardRow[]) => new Card(this, s.palette, rows, { at: SIDE });
    // Side panels share one left edge and one gap, stacked and centred beside the diagram.
    const column = async (...panels: (Card | CodeBlock)[]) => {
      const total = panels.reduce((h, p) => h + p.height(), 0) + GAP * (panels.length - 1);
      let top = (SIDE[1] + SIDE[3]) / 2 + total / 2;
      for (const p of panels) {
        p.moveTo([SIDE[0], top], [-1, 1]);
        top -= p.height() + GAP;
      }
      await this.play(...panels.map((p) => new FadeIn(s.keep(p), { runTime: 0.35 })));
    };

    await this.step('source', {
      title: 'The agent’s edit, parsed into a snapshot with ids',
      caption:
        'The agent’s edit is Mermaid source, and the card lists the id the snapshot gives each node and edge. Agentic Mermaid parses, lays out, styles and verifies it at build time, and none of Agentic Mermaid ships to the reader.',
    });
    const d = await s.show({ source: first, style: STYLE }, { box: 'main' });
    const source = code(first.split('\n'));
    const ids = card(
      d.snapshot.parts.filter((p) => p.role === 'node' || p.role === 'edge').map((p) => [p.role, p.id] as const),
    );
    await column(source, ids);

    await this.step('verify', {
      title: missing ? 'The verifier flags both edges out of Cached' : 'The verifier finds no warnings in the first edit',
      caption: missing
        ? 'verify(flow) returns ok: true with two DECISION_BRANCH_UNLABELED warnings, one per marked edge. The diagram renders, but nothing on it says which edge out of Cached means yes.'
        : 'Both edges out of Cached carry labels, yes and no, so verify(flow) returns no warnings and this case skips the repair step.',
    });
    await this.play(new FadeOut(ids, { runTime: 0.3 }));
    const findings = findingsOf(d.snapshot);
    this.state.warnings = findings.warnings;
    if (findings.warnings.length) {
      const flagged = d.findings().map((w) => {
        if (!w.part) throw new Error(`Warning ${w.edge} names no edge part`);
        return w.part;
      });
      await d.mark(['A', ...flagged]);
    } else {
      await d.mark(
        findings.layout.edges.flatMap((e, i) => (e.label ? [edgePartOf(d.snapshot, `${e.id}#${i}`)!] : [])),
      );
    }
    // The verifier's report sits under the source it checked.
    const report = code(
      [
        `verify(flow).ok: ${findings.ok}`,
        `warnings: ${findings.warnings.length}`,
        ...findings.warnings.flatMap((w) => [`  ${w.code}`, `    node ${w.node}, edge ${w.edge}`]),
      ],
      0.22,
    );
    report.moveTo([SIDE[0], source.box()![1] - GAP], [-1, 1]);
    await this.play(new FadeIn(s.keep(report), { runTime: 0.35 }));

    if (missing) {
      await this.step('repair', {
        title: 'Two set_label operations label the branches',
        caption:
          'Two set_label operations add yes and no to the edges. The build replays them on the parsed first edit and throws unless the result serializes to the same Mermaid as the next diagram.',
      });
      await this.play(new FadeOut(source, { runTime: 0.3 }));
      const ops = code(
        OPS.flatMap((op) => [`{ kind: '${op.kind}',`, `  target: '${op.target}',`, `  label: '${op.label}' }`]),
      );
      ops.moveTo([SIDE[0], report.box()![3] + GAP], [-1, -1]);
      await this.play(new FadeIn(s.keep(ops), { runTime: 0.35 }));
      await ops.focus([0, OPS.length * 3 - 1]);
      await d.morph({ source: GOOD, style: STYLE }, { ops: OPS });
      const after = findingsOf(d.snapshot);
      await d.mark(OPS.map((op) => `edge:${op.target}`));
      // The same report, rerun on the repaired diagram.
      await report.morph([`verify(flow).ok: ${after.ok}`, `warnings: ${after.warnings.length}`]);
    }

    await this.step('walk', {
      title: 'The token travels the yes edge’s own route',
      caption:
        'The card lists the route the token follows from Cached to Reply. walk() looks up every hop before animating, so a hop with no edge, such as Reply to Database, throws before anything moves.',
    });
    await s.clearOverlays();
    await d.unmark();
    await d.dim(['A', 'B']);
    await d.walk([['A', 'B']], { trail: true });
    const route = d.snapshot.parts.find((p) => p.role === 'edge' && p.from === 'A' && p.to === 'B')!.route ?? [];
    const pt = (p: readonly number[] | undefined) => (p ? `(${p[0]!.toFixed(2)}, ${p[1]!.toFixed(2)})` : '–');
    const linked = d.snapshot.parts.some((p) => p.role === 'edge' && p.from === 'B' && p.to === 'C');
    await column(
      card([
        ['edge', 'A -> B'],
        ['route points', route.length],
        ['starts', pt(route[0])],
        ['ends', pt(route.at(-1))],
      ]),
      code(
        [
          "d.walk([['A', 'B']])  // real edge",
          "d.walk([['B', 'C']])",
          linked ? '// B -> C exists' : '// throws: not a real link',
        ],
        0.22,
      ),
    );

    await this.step('evidence', {
      title: 'The chart counts stored verifier warnings',
      caption:
        'The scene.snapshots folder stores each diagram’s marks, ids, routes and verifier findings. The bars count the warnings stored for the first edit and for the final diagram.',
    });
    const final = d.snapshot;
    const count = findings.warnings.length,
      finalCount = findingsOf(final).warnings.length;
    await s.clearOverlays();
    await d.hide();
    const chart = await s.show(
      {
        source: `xychart-beta\n x-axis ["First edit", "Final"]\n y-axis "Warnings" 0 --> 3\n bar [${count},${finalCount}]`,
        style: STYLE,
      },
      { box: 'main' },
    );
    // A bar of height zero draws nothing, so a zero gets its value as a note.
    if (!count) await chart.note('bar:0:First edit', '0 warnings', { side: 'above' });
    if (!finalCount) await chart.note('bar:0:Final', '0 warnings', { side: 'above' });
    await column(
      card([
        ['renderer', final.renderer],
        ['marks', final.parts.length],
        ['edge routes', final.parts.filter((p) => p.route).length],
      ]),
    );
    this.state.finalWarnings = finalCount;

    await this.step('history', {
      title: 'Source, edit and snapshot share one history',
      caption:
        'The git graph shows the Mermaid source, the typed edit and the checked snapshot as three commits in order. The renderer stays pinned at agentic-mermaid@0.4.1, so an upgrade is a deliberate change whose snapshot diff gets reviewed.',
    });
    await s.clearOverlays();
    await chart.hide();
    const git = await s.show(
      {
        source: 'gitGraph TB:\n commit id: "source"\n commit id: "typed edit"\n commit id: "checked snapshot"',
        style: STYLE,
      },
      { box: 'full' },
    );
    await git.note('source', 'flow.mmd', { side: 'right' });
    await git.note('typed edit', missing ? '2 set_label ops' : 'labels in first edit', { side: 'right' });
    await git.note('checked snapshot', `${finalCount} warnings, ${final.renderer}`, { side: 'right' });
  }
}
