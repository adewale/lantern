import { Text } from '../../src/index.ts';

/** Width, in scene units, of the caption text in the 1280 × 880 video footer. */
export const FOOTER_TEXT_WIDTH = 14.9;

/** Breakable white space: every \s except the no-break spaces, which hold their words together. */
const BREAK = /[^\S\u00a0\u2007\u202f]+/;

/** Wrap a caption on real glyph advances; it must fit three footer lines. */
export function wrapCaption(text: string, width: number, size = 0.25): string[] {
  if (!(width > 0) || !(size > 0)) throw new Error(`Caption width and size must be positive (${width}, ${size})`);
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(BREAK)) {
    if (new Text(word, { fontSize: size }).width() > width)
      throw new Error(`Caption word exceeds footer width: ${word}`);
    const next = line ? line + ' ' + word : word;
    if (line && new Text(next, { fontSize: size }).width() > width) {
      lines.push(line);
      if (lines.length > 3) break;
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > 3) throw new Error('Caption exceeds three footer lines; shorten the caption');
  return lines;
}
