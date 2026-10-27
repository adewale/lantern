// Reader evidence that label-size checks cannot establish: routes behind words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';
import { toSvgString } from '../src/index.ts';
import { labelOf } from '../explain/diagrams.ts';
import { toView } from '../app/embed-closeup.ts';
import { collectProject } from '../tools/lib/explain-project.ts';

test('Lantern and cache routes leave a paper gap behind every named edge label', async () => {
  for (const [id, stepName, words] of [
    ['lantern', 'objects', ['owns', 'plays', 'emits']],
    ['mr-cache', 'after', ['hit', 'miss']],
    ['mr-cache', 'request', ['hit', 'miss']],
  ] as const) {
    const project = await collectProject(`scenes/explainers/${id}`, { write: false });
    for (const variant of project.variants) {
      let checked = 0;
      await new variant.Scene({
        async frame() {},
        async stepEnd(scene, step) {
          if (step.name !== stepName) return;
          const labels = scene.familyMembers().filter((m) => words.includes(labelOf(m)?.text as never));
          assert.equal(labels.length, words.length, `${id}: all expected edge labels exist`);
          // Remove only glyphs: if the route draws through the label's interior,
          // its ink is now visible. This checks rendered pixels, not plate metadata.
          const boxes = labels.map((m) => toView(m.box()!, scene.frame.box()!));
          const children = labels.map((m) => m.children);
          labels.forEach((m) => { m.children = []; });
          let svg: string;
          try { svg = toSvgString(scene, { width: 1280 }); }
          finally { labels.forEach((m, i) => { m.children = children[i]!; }); }
          const image = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
          const pixels = image.pixels;
          for (const [i, b] of boxes.entries()) {
            let samples = 0;
            for (let y = Math.ceil((4.5 - b[3]) * 80 + 1); y < (4.5 - b[1]) * 80 - 1; y++)
              for (let x = Math.ceil((b[0] + 8) * 80 + 1); x < (b[2] + 8) * 80 - 1; x++) {
                const at = (y * image.width + x) * 4;
                const rgb = [...pixels.subarray(at, at + 3)];
                assert.ok(Math.min(...rgb) > 200, `${id}/${stepName}/${words[i]}: route ink under label at ${x},${y}: ${rgb}`);
                samples++;
              }
            assert.ok(samples > 10, 'a nonempty label interior was sampled');
            checked++;
          }
        },
      }, { skipUntil: Infinity }).run();
      assert.equal(checked, words.length);
    }
  }
});
