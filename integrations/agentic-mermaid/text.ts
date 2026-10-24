import { Text } from '../../src/text.ts';
import type { VMobject } from '../../src/vmobject.ts';
import type { Style } from '../../src/mobject.ts';
import type { SnapshotTextRun } from './snapshot.ts';

let xHeightEm: number | undefined;

/** Shared lowering of a resolved SVG text run to embedded glyph outlines.
 * Store text/placement once, not thousands of repeated font control points. */
export function outlineText(run: SnapshotTextRun, style: Style): VMobject[] {
  const text = new Text(run.text, { fontSize: run.size, color: style.fill });
  text.build(run.text, run.size, { ...style, strokeWidth: (style.strokeWidth ?? 0) * 100 });
  if (run.width != null && text.advance())
    text.stretch(run.width / text.advance(), 0, { aboutPoint: [0, 0] });
  const advance = text.advance();
  let offset = 0;
  switch (run.baseline ?? 'alphabetic') {
    case 'auto':
    case 'alphabetic':
      break;
    case 'middle':
      xHeightEm ??= new Text('x', { fontSize: 1 }).children[0]!.height();
      offset = (xHeightEm * run.size) / 2;
      break;
    case 'central':
      offset = (text.run.ascent - text.run.descent) / 2;
      break;
    case 'text-before-edge':
      offset = text.run.ascent;
      break;
    case 'text-after-edge':
      offset = -text.run.descent;
      break;
    default:
      throw new Error(`Unsupported imported text baseline: ${run.baseline}`);
  }
  const baseline = run.y + offset;
  text.shift([
    run.x - (run.anchor === 'middle' ? advance / 2 : run.anchor === 'end' ? advance : 0),
    baseline,
  ]);
  text.applyAffine(1, 0, 0, -1, 0, 2 * baseline, { aboutPoint: [0, 0] });
  const [a, b, c, d, e, f] = run.matrix as [number, number, number, number, number, number];
  for (const path of text.children) {
    path.applyAffine(a / 100, -b / 100, c / 100, -d / 100, e / 100, -f / 100, { aboutPoint: [0, 0] });
    path.style = { ...path.style, ...style };
  }
  return text.children as VMobject[];
}
