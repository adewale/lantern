import { Text } from './text.ts';
import type { TextOpts } from './text.ts';
import type { Style } from './mobject.ts';
import { mathRun, withFontRun } from './lettering-outlines.ts';

// Text's constructor calls build() before a subclass can set a field, so the
// constructor hands its display flag to that first build here. Otherwise a
// display formula is typeset inline first, and the snapshot stores an unused run.
let constructing = false;

/** TeX-subset maths, typeset by glyph at build time. No browser typesetter. */
export class MathTex extends Text {
  declare display: boolean;
  constructor(latex: string, { display = false, ...opts }: TextOpts & { display?: boolean } = {}) {
    constructing = display;
    try { super(latex, opts); } finally { constructing = false; }
    this.display = display;
  }
  override build(latex: string, size: number, style: Style): void {
    const run = mathRun(latex, size, this.display ?? constructing);
    withFontRun(this.font, run, () => super.build(latex, size, style));
    // A formula's glyphs are not characters of its TeX source. With no cluster,
    // TransformMatchingText pairs them by shape, as TransformMatchingShapes does,
    // and still keeps the formula one piece while terms grow in or fade out.
    for (const glyph of this.children) (glyph as { cluster?: number }).cluster = undefined;
  }
}
