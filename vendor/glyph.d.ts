// Types for the vendored glyph shaper bundle (generated JS; not type-checked).
type Result<T> = { tag: 'Ok'; value: T } | { tag: 'Error'; error: unknown };
export type Segment =
  | { tag: 'MoveTo' | 'LineTo'; x: number; y: number }
  | { tag: 'QuadTo'; x1: number; y1: number; x: number; y: number }
  | { tag: 'CubicTo'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { tag: 'Close' };
export type ShapedGlyph = { gid: number; cluster: number; x: number; dx: number; dy: number; ax: number; s?: number; path: Segment[] };
export type Run = { glyphs: ShapedGlyph[]; width: number; ascent: number; descent: number; s?: number };
export type Font = { readonly __font: unique symbol };
export function loadFont(bytes: Uint8Array): Promise<Result<Font>>;
export function run(font: Font, key: string, text: string, size: number, opts?: object): Result<Run>;
