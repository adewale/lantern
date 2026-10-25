// The explain helpers on what Agentic Mermaid really captured: every pinned
// snapshot in scenes/explainers, and the step descriptions of three shipped
// explainers. Synthetic snapshots (explain-diagrams.property.test.ts) cover
// the space; these hold the helpers to the shapes capture actually writes
// (outlined labels inside node groups, links that own their labels, actor:
// and class: ids named by bare names, axes, grid lines and branches).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, loadFonts } from '../src/index.ts';
import type { Mobject } from '../src/index.ts';
import { Diagram } from '../explain/diagrams.ts';
import { dimOpacity } from '../explain/look.ts';
import { findingsOf } from '../explain/index.ts';
import type { DiagramSnapshot } from '../explain/index.ts';
import { pictureSummary, pictureHtml } from '../explain/trace.ts';
import { collectProject, readSnapshots } from '../tools/lib/explain-project.ts';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';

await loadFonts();

const corpus: { id: string; s: DiagramSnapshot }[] = [];
for (const { id } of EXPLAINERS)
  for (const s of Object.values(await readSnapshots(`scenes/explainers/${id}/scene`))) corpus.push({ id, s });
const where = ({ id, s }: (typeof corpus)[number]) => `${id}: ${s.spec.source.split('\n')[0]}`;
/** The pinned snapshot of explainer `id` whose source contains `text`. */
const pinned = (id: string, text: string) => {
  const found = corpus.find((c) => c.id === id && c.s.spec.source.includes(text));
  assert.ok(found, `no pinned ${id} diagram with ${text}`);
  return found.s;
};
async function shown(s: DiagramSnapshot) {
  const d = new Diagram(new Scene(new NullSink(), { skipUntil: Infinity }), s.spec, s, {});
  await d.build();
  return d;
}
const tops = (d: Diagram) => [...d.parts.values()].filter((p) => !p.info.owner).map((p) => p.info.id);
/** The drawn leaves of a part's words: outlines under a label. */
const labelLeaves = (d: Diagram) =>
  [...d.parts.values()].flatMap((p) =>
    p.mob.family().filter((m) => {
      for (let a: Mobject | null = m; a && a !== p.mob.parent; a = a.parent) if (typeof (a as { text?: unknown }).text === 'string') return !m.children.length;
      return false;
    }),
  );

test('the corpus holds every family the explainers use', () => {
  assert.deepEqual([...new Set(corpus.map((c) => c.s.family))].sort(), ['class', 'flowchart', 'gantt', 'gitgraph', 'quadrant', 'sequence', 'state', 'timeline', 'xychart']);
});

test('on every pinned snapshot, marking every part keeps each label its ink', async () => {
  for (const c of corpus) {
    const d = await shown(c.s);
    const leaves = labelLeaves(d);
    assert.ok(leaves.length > 0, `${where(c)} has words`);
    const ink = leaves.map((m) => m.style.fill);
    await d.mark(tops(d), { color: '#ff0000' });
    assert.deepEqual(leaves.map((m) => m.style.fill), ink, where(c));
  }
});

test('on every pinned snapshot, dimming everything spares the frame, participants, lifelines, axes, grid lines, branches, sections, rails and plates', async () => {
  // The scaffolding a reader keeps their bearings by, as each family's ids name it.
  const scaffold = (id: string) =>
    ['__frame', 'rail', 'border'].includes(id) ||
    /^(actor|lifeline|axis|grid|branch|section|section-band|section-label|plate|divider|quadrant-label):/.test(id);
  for (const c of corpus) {
    const d = await shown(c.s);
    const opacity = (id: string) => d.get(id).family().map((m) => m.style.opacity ?? 1);
    const before = new Map(tops(d).map((id) => [id, opacity(id)]));
    await d.dim([]);
    const faint = dimOpacity(c.s.palette);
    for (const id of tops(d))
      assert.deepEqual(opacity(id), before.get(id)!.map((o) => (scaffold(id) ? o : o * faint)), `${where(c)}: ${id}`);
  }
});

test('a diagram is described by the counts its source declares, and bare names name participants and classes', async () => {
  const cases: [DiagramSnapshot, string][] = [
    [pinned('state-machine', 'stateDiagram'), 'State diagram: 4 states, 4 transitions'],
    [pinned('lantern', 'classDiagram'), 'Class diagram: 4 classes, 3 relationships'],
    [pinned('oauth-pkce', 'participant X as Malicious app'), 'Sequence diagram: 3 participants, 7 messages'],
    [pinned('2password', 'participant O as op CLI'), 'Sequence diagram: 3 participants, 6 messages'],
    [pinned('agentic-mermaid', 'gitGraph'), 'Git graph: 3 commits, 2 links'],
    [pinned('2password', 'graph LR'), 'Flowchart: 4 nodes, 3 links'],
    [pinned('cert-renewal', 'Longest a public TLS'), 'Timeline “Longest a public TLS certificate may last”: 4 periods'],
    [pinned('send-sync', 'Rc<i32>'), 'Quadrant chart: 1 point'],
  ];
  for (const [s, what] of cases) assert.equal((await shown(s)).describe().what, what);
  const classes = await shown(pinned('lantern', 'classDiagram'));
  assert.equal(classes.get('Scene'), classes.get('class:Scene'));
  const seq = await shown(pinned('oauth-pkce', 'participant X as Malicious app'));
  assert.equal(seq.get('X'), seq.get('actor:X'));
});

test('the verifier’s warnings name the parts they are about, though it numbers edges globally and parts per pair', async () => {
  // "A->C#1" is the second edge of the source; it is the first A->C part.
  const s = pinned('agentic-mermaid', 'A{Cached} --> B[Reply]');
  assert.deepEqual(s.findings.warnings.map((w) => w.edge), ['A->B#0', 'A->C#1']);
  assert.deepEqual(findingsOf(s).map((f) => f.part), ['edge:A->B#0', 'edge:A->C#0']);
  assert.deepEqual((await shown(s)).findings(), findingsOf(s));
});

/** Each step's state in an explainer's default case, by step name. */
async function steps(id: string) {
  const project = await collectProject(`scenes/explainers/${id}`, { write: false });
  const trace = project.variants[0]!.trace;
  return new Map(trace.steps.map((s, i) => [s.step, { after: s.after, before: trace.steps[i - 1]?.after }]));
}

test('shipped explainers describe their steps: chart values, marks, focus, walks and what is new', async () => {
  const bucket = await steps('token-bucket');
  const summary = (name: string) => pictureSummary(bucket.get(name)!.after);
  assert.match(summary('trace'), /^XY chart: Tokens remaining from 0 to 5, 10 categories from R1 to R10\./);
  assert.match(summary('balance'), /Focused: 2: tokens = min\(5/);
  assert.match(summary('burst'), /Marked: Last call: R6 at 0 s → 429/);
  // A step that changes only emphasis lists the rest as it was.
  const refill = bucket.get('refill')!;
  assert.match(pictureHtml(refill.after, refill.before), /the rest as in the previous step/);
  assert.doesNotMatch(pictureHtml(refill.after), /the rest as in the previous step/);

  const machine = await steps('state-machine');
  const connect = pictureSummary(machine.get('connect')!.after);
  assert.match(connect, /^State diagram: 4 states, 4 transitions; /);
  assert.match(connect, /Travelled: idle → connecting: CONNECT; /);
  // The focused line of the transition table ends in a comma; its sentence still ends in a full stop.
  assert.match(connect, /focused: 2: 'idle:CONNECT': 'connecting'\. New in this step: /);

  const pkce = await steps('oauth-pkce');
  assert.match(pictureSummary(pkce.get('authorize')!.after), /^Sequence diagram: 3 participants, 1 message; /);
});
