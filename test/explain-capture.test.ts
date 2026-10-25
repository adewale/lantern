import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capture } from '../integrations/agentic-mermaid/build/capture.ts';
import { renderMermaidSVG } from 'agentic-mermaid';
import { snapshotBuilder } from '../integrations/agentic-mermaid/build/index.ts';
import { Resvg } from '@resvg/resvg-js';
import { outlineText } from '../integrations/agentic-mermaid/text.ts';
import { lostLabelWarnings } from '../tools/lib/explain-warnings.ts';
import { Scene, NullSink, VMobject, toSvgString } from '../src/index.ts';
import { PALETTES } from '../explain/palettes.ts';

test('capture delegates the real backend without changing its output', () => {
  const spec = { source: 'graph LR\nA[Client] --> B[Server]', style: 'hand-drawn' };
  const result = capture(spec);
  assert.equal(result.svg, renderMermaidSVG(spec.source, { style: spec.style }));
  assert.deepEqual(
    result.parts.map((p) => p.node.id),
    ['edge:A->B#0', 'node:A', 'node:B'],
  );
  assert.match(result.marked, /data-lantern-part="0"/);
});
test('the palettes copied from Agentic Mermaid match its styles', () => {
  for (const [style, palette] of Object.entries(PALETTES))
    assert.deepEqual(capture({ source: 'graph LR\nA --> B', style }).palette, palette, style);
});
test(
  'SVG lowering preserves finite glyph geometry for em-relative baselines',
  { skip: !process.env.EXPLAIN_BROWSER ? 'set EXPLAIN_BROWSER=1 to run real Chromium capture' : false },
  async () => {
    const builder = await snapshotBuilder();
    try {
      const value = await builder.diagram({
        source: 'xychart-beta\n x-axis [One,Two]\n y-axis "Count" 0 --> 4\n bar [1,3]',
        style: 'blueprint',
      });
      const shapes = value.parts.flatMap((p) => p.shapes);
      assert.ok(shapes.some((s) => s.text === 'One'));
      assert.equal(shapes.find((s) => s.text === '4')?.textRun?.baseline, 'middle');
      for (const shape of shapes) {
        const paths = shape.textRun
          ? outlineText(shape.textRun, shape.style).flatMap((p) => p.subpaths)
          : shape.subpaths;
        assert.ok(paths.length > 0, `Empty imported mark ${shape.text ?? 'shape'}`);
        for (const path of paths)
          assert.ok(path.every(Number.isFinite), `Non-finite points in ${shape.text ?? 'shape'}`);
      }
      const late = await builder.diagram({ source: 'graph LR\nA --> B\nB[Database]', style: 'nord' });
      assert.match(lostLabelWarnings(late)[0]!, /Node B rendered its bare id/);
    } finally {
      await builder.close();
    }
  },
);

test(
  'every authored style keeps its non-text artwork against the real SVG renderer',
  { skip: !process.env.EXPLAIN_BROWSER ? 'set EXPLAIN_BROWSER=1 for real style fidelity checks' : false },
  async () => {
    const builder = await snapshotBuilder();
    try {
      for (const style of Object.keys(PALETTES)) {
        const snapshot = await builder.diagram({
          source: 'graph LR\nA[Client] -->|request| B[Server]',
          style,
        });
        const scene = new Scene(new NullSink());
        for (const part of snapshot.parts)
          for (const shape of part.shapes) {
            if (shape.textRun || shape.text != null) continue;
            const path = new VMobject(shape.style);
            path.subpaths = shape.subpaths.map((a) => new Float32Array(a));
            path.closed = shape.closed;
            scene.add(path);
          }
        const original = renderMermaidSVG(snapshot.spec.source, { style }).replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, '');
        const imported = toSvgString(scene)
          .replace(
            /width="1280" height="720" viewBox="[^"]+"/,
            `width="${snapshot.width}" height="${snapshot.height}" viewBox="0 0 ${snapshot.width * 10} ${snapshot.height * 10}"`,
          )
          .replace(/<rect x="-8000"[^>]+\/>/, '');
        const reference = new Resvg(original, {
          fitTo: { mode: 'width', value: 640 },
          font: { loadSystemFonts: false },
        }).render();
        const actual = new Resvg(imported, {
          fitTo: { mode: 'width', value: 640 },
          font: { loadSystemFonts: false },
        }).render();
        assert.equal(actual.width, reference.width);
        assert.equal(actual.height, reference.height);
        const actualPixels = actual.pixels,
          referencePixels = reference.pixels;
        let error = 0;
        for (let i = 0; i < actualPixels.length; i++)
          error += Math.abs(actualPixels[i]! - referencePixels[i]!);
        const mean = error / actualPixels.length;
        assert.ok(
          mean < 1,
          `${style}: non-text mean channel error ${mean.toFixed(4)} exceeds 1/255 (path quantization allowance)`,
        );
      }
    } finally {
      await builder.close();
    }
  },
);
