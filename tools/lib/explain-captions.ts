import { Text } from '../../src/index.ts';

/** Width, in scene units, of the caption text in the 1280 × 880 video footer. */
export const FOOTER_TEXT_WIDTH = 14.9;

/** Wrap a caption on real glyph advances; it must fit three footer lines. */
export function wrapCaption(text: string, width: number, size = 0.25): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (new Text(word, { fontSize: size }).width() > width)
      throw new Error(`Caption word exceeds footer width: ${word}`);
    const next = line ? line + ' ' + word : word;
    if (line && new Text(next, { fontSize: size }).width() > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > 3) throw new Error('Caption exceeds three footer lines; shorten the caption');
  return lines;
}
