import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageSnapshots} from '../tools/lib/page-snapshots.ts';
import type {SnapshotStore} from '../integrations/agentic-mermaid/snapshot.ts';
import {RENDERER} from '../integrations/agentic-mermaid/snapshot.ts';
import {fc, params} from './lib/pbt.ts';
import {collectProject} from '../tools/lib/explain-project.ts';
import {bindSnapshots} from '../explain/index.ts';
import {toSvgString} from '../src/index.ts';
import type {SceneClass} from '../src/index.ts';

const fixture = (points: number[]): SnapshotStore => ({
  diagram: {version: 1, renderer: RENDERER, spec: {source: 'graph LR\nA[Example]'}, family: 'flowchart', width: 123.4567890123, height: 100,
    palette: {paper: '#ffffff', ink: '#000000', accent: '#ff0000', muted: '#808080'},
    parts: [{id: 'A', role: 'node', kind: 'node', shapes: [{subpaths: [points], closed: [false], style: {fill: 'none', stroke: '#000000', strokeWidth: 0.1234567890123}}]}], findings: {ok: true, warnings: []}},
});

test('page path compaction preserves exact float32 bytes through JSON, including signed underflow', () => {
  const check = (points: number[]) => {
    const store = fixture(points), before = JSON.stringify(store);
    const compact = pageSnapshots(store);
    assert.equal(JSON.stringify(store), before, 'never change the committed snapshot or its caller');
    const wire = JSON.parse(JSON.stringify(compact)) as SnapshotStore;
    const original = JSON.parse(before) as SnapshotStore;
    const shape = (s: SnapshotStore) => s.diagram!.parts[0]!.shapes[0]!;
    const actual = new Float32Array(shape(wire).subpaths[0]!);
    const expected = new Float32Array(shape(original).subpaths[0]!);
    assert.deepEqual(Buffer.from(actual.buffer), Buffer.from(expected.buffer));
    assert.equal(wire.diagram!.width, original.diagram!.width, 'layout dimensions retain double precision');
    assert.deepEqual(shape(wire).style, shape(original).style, 'paint metadata retains double precision');
    shape(original).subpaths = shape(wire).subpaths;
    assert.deepEqual(wire, original, 'every non-path field remains exact');
  };
  check([0, -0, -1e-300, 1e-300, -1e-45, 1e-45, 3.4028234e38, -3.4028234e38]);
  fc.assert(fc.property(fc.array(fc.double({min: -3.402823466e38, max: 3.402823466e38, noNaN: true, noDefaultInfinity: true}), {minLength: 2, maxLength: 38}), check), params(200));
});

test('compacted real flowchart, timeline and XY snapshots render byte-identical resting SVGs', async () => {
  const frames = async (Source: SceneClass) => {
    const result: string[] = [];
    await new Source({async frame() {}, async stepEnd(scene) {result.push(toSvgString(scene));}}, {skipUntil: Infinity}).run();
    return result;
  };
  for (const id of ['mr-cache', 'cert-renewal', 'tailwind-gamut']) {
    const project = await collectProject(`scenes/explainers/${id}`, {write: false});
    const compact = pageSnapshots(project.store);
    const Source = project.variants[0]!.Scene;
    const original = await frames(Source);
    assert.ok(original.length >= 3, 'compare every resting picture, not an empty render');
    assert.deepEqual(await frames(bindSnapshots(Source, compact)), original, id);
  }
});
