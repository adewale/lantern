import { Text } from './text.ts';
import type { Style } from './mobject.ts';
import { withItalic } from './lettering-outlines.ts';

/**
 * Text in its face's Italic cut, shaped at build time like other requested
 * lettering. Needs `static meta.lettering.styles` to include 'italic'; with
 * 'bold' as well, `weight: 'bold'` draws the Bold Italic cut. Scripts whose
 * face has no italic (Arabic, Devanagari, Hebrew, Chinese) draw upright.
 */
export class ItalicText extends Text {
  override build(text: string, size: number, style: Style): void {
    withItalic(() => super.build(text, size, style));
  }
}
