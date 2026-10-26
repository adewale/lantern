import type { Font, Segment } from './glyph.js';
export interface MathRun {
  width: number; ascent: number; descent: number; s: number;
  glyphs: { gid: number; x: number; y: number; k: number; path: Segment[] }[];
  rules: { x: number; y: number; w: number; h: number }[];
}
export function typeset(font: Font, key: string, latex: string, opts: { size: number; display?: boolean }):
  { tag: 'Ok'; value: MathRun } | { tag: 'Err'; error: unknown };
