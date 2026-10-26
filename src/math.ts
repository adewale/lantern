import { Text } from './text.ts';
import type { TextOpts } from './text.ts';
import type { Style } from './mobject.ts';
import { mathRun, withFontRun } from './lettering.ts';

/** TeX-subset maths, typeset by glyph at build time. No browser typesetter. */
export class MathTex extends Text {
  display = false;
  constructor(latex: string, { display = false, ...opts }: TextOpts & { display?: boolean } = {}) {
    // Text invokes build before this constructor can initialise its fields.
    super(latex, opts);
    this.display = display;
    if (display) this.setText(latex);
  }
  override build(latex: string, size: number, style: Style): void {
    const run = mathRun(latex, size, this.display ?? false);
    withFontRun(this.font, run, () => super.build(latex, size, style));
  }
}
