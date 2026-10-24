import { Scene } from '../../../src/index.ts';
import { stage, settingsOf, edgePartOf } from '../../../explain/index.ts';
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
const SIDE_TOP = [2.65, 0.15, 7.55, 3.25] as const,
  SIDE_LOW = [2.65, -4.25, 7.55, -0.15] as const;

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

    await this.step('source', {
      title: 'The agent’s edit, parsed into a snapshot with ids',
      caption:
        'The agent’s edit is Mermaid source, and the card lists the id the snapshot gives each node and edge. Agentic Mermaid parses, lays out, styles and verifies it at build time, and none of Agentic Mermaid ships to the reader.',
    });
    const d = await s.show({ source: first, style: STYLE }, { box: 'main' });
    await s.code(first.split('\n'), { at: [...SIDE_TOP], title: 'flow.mmd (the agent’s edit)', fontSize: 0.24 });
    const ids = d.snapshot.parts.filter((p) => p.role === 'node' || p.role === 'edge');
    await s.card(
      ids.map((p) => [p.role, p.id] as const),
      { at: [...SIDE_LOW], title: 'Ids in the snapshot' },
    );

    await this.step('verify', {
      title: missing ? 'The verifier flags both edges out of Cached' : 'The verifier finds no warnings in the first edit',
      caption: missing
        ? 'verify(flow) returns ok: true with two DECISION_BRANCH_UNLABELED warnings, one per marked edge. The diagram renders, but nothing on it says which edge out of Cached means yes.'
        : 'Both edges out of Cached carry labels, yes and no, so verify(flow) returns no warnings and this case skips the repair step.',
    });
    await s.clearOverlays();
    const findings = findingsOf(d.snapshot);
    this.state.warnings = findings.warnings;
    if (findings.warnings.length) {
      const flagged = d.findings().map((w) => {
        if (!w.part) throw new Error(`Warning ${w.edge} names no edge part`);
        return w.part;
      });
      await d.mark(['A', ...flagged]);
      for (const [i, id] of flagged.entries())
        await d.note(id, 'unlabeled: yes or no?', { side: i === 0 ? 'above' : 'below' });
    } else {
      await d.mark(
        findings.layout.edges.flatMap((e, i) => (e.label ? [edgePartOf(d.snapshot, `${e.id}#${i}`)!] : [])),
      );
    }
    await s.code(
      [
        `verify(flow).ok: ${findings.ok}`,
        `warnings: ${findings.warnings.length}`,
        ...findings.warnings.flatMap((w) => [`  ${w.code}`, `    node ${w.node}, edge ${w.edge}`]),
      ],
      { at: [2.65, -4.25, 7.55, 3.25], title: 'verifier findings', fontSize: 0.22 },
    );

    if (missing) {
      await this.step('repair', {
        title: 'Two set_label operations label the branches',
        caption:
          'Two set_label operations add yes and no to the edges. The build replays them on the parsed first edit and throws unless the result serializes to the same Mermaid as the next diagram.',
      });
      await s.clearOverlays();
      const ops = await s.code(
        OPS.flatMap((op) => [`{ kind: '${op.kind}',`, `  target: '${op.target}',`, `  label: '${op.label}' }`]),
        { at: [...SIDE_TOP], title: 'typed ops (replayed by the build)', fontSize: 0.24 },
      );
      await ops.focus([0, OPS.length * 3 - 1]);
      await d.morph({ source: GOOD, style: STYLE }, { ops: OPS });
      const after = findingsOf(d.snapshot);
      await d.mark(OPS.map((op) => `edge:${op.target}`));
      await s.card(
        [
          ...after.layout.edges.map((e) => [`${e.id} label`, e.label?.text ?? '(none)'] as const),
          ['warnings', after.warnings.length],
        ],
        { at: [...SIDE_LOW], title: 'Next snapshot' },
      );
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
    await d.note('B', 'the yes branch', { side: 'below' });
    const route = d.snapshot.parts.find((p) => p.role === 'edge' && p.from === 'A' && p.to === 'B')!.route ?? [];
    const pt = (p: readonly number[] | undefined) => (p ? `(${p[0]!.toFixed(2)}, ${p[1]!.toFixed(2)})` : '–');
    const linked = d.snapshot.parts.some((p) => p.role === 'edge' && p.from === 'B' && p.to === 'C');
    await s.card(
      [
        ['edge', 'A -> B'],
        ['route points', route.length],
        ['starts', pt(route[0])],
        ['ends', pt(route.at(-1))],
      ],
      { at: [...SIDE_TOP], title: 'Route the token used' },
    );
    await s.code(
      ["d.walk([['A', 'B']])  // real edge", "d.walk([['B', 'C']])", linked ? '// B -> C exists' : '// throws: not a real link'],
      { at: [...SIDE_LOW], title: 'walk() checks the snapshot', fontSize: 0.22 },
    );

    await this.step('evidence', {
      title: 'The chart counts stored verifier warnings',
      caption:
        'scene.snapshots.json stores each diagram’s marks, ids, routes and verifier findings. The bars count the warnings stored for the first edit and for the final diagram.',
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
    await chart.note('bar:0:First edit', count ? `${count} unlabeled branches` : '0: labeled from the start', {
      side: 'above',
    });
    await chart.note('bar:0:Final', `${finalCount} after ${missing ? 'repair' : 'the first edit'}`, {
      side: 'above',
    });
    await s.card(
      [
        ['renderer', final.renderer],
        ['marks', final.parts.length],
        ['edge routes', final.parts.filter((p) => p.route).length],
        ['first warnings', count],
        ['final warnings', finalCount],
      ],
      { at: 'side', title: 'Stored in scene.snapshots.json' },
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
      { box: 'main' },
    );
    await git.note('source', 'flow.mmd', { side: 'right' });
    await git.note('typed edit', missing ? '2 set_label ops' : 'labels in first edit', { side: 'right' });
    await git.note('checked snapshot', `${finalCount} warnings, pinned`, { side: 'right' });
    await s.card(
      [
        ['renderer', final.renderer],
        ['cache', 'scene.snapshots.json'],
        ['on upgrade', 'review the diff'],
      ],
      { at: 'side', title: 'Pinned with the source' },
    );
  }
}
