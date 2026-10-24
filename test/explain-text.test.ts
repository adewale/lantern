import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, loadFonts } from '../src/index.ts';
import { outlineText } from '../integrations/agentic-mermaid/text.ts';

test('SVG middle baseline centres the embedded font x-height, while alphabetic preserves its baseline', async () => {
  await loadFonts();
  const run = { text: 'x', x: 0, y: 0, size: 14, matrix: [1, 0, 0, 1, 0, 0] };
  const alphabetic = new Group(...outlineText(run, { fill: '#000000' }));
  const middle = new Group(...outlineText({ ...run, baseline: 'middle' }, { fill: '#000000' }));
  assert.ok(Math.abs(alphabetic.box()![1]) < 1e-6);
  assert.ok(alphabetic.center()[1] > 0.02);
  assert.ok(Math.abs(middle.center()[1]) < 1e-6, `Middle should centre x ink, got ${middle.center()[1]}`);
  assert.ok(Math.abs(middle.height() - alphabetic.height()) < 1e-6);
});
