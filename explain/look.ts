import { lerpColor, parseColor } from '../src/color.ts';
import type { Box } from '../src/index.ts';
import type { Palette } from '../integrations/agentic-mermaid/snapshot.ts';

/** Secondary text that still reads on the paper: ink pulled toward paper, never the style's faint `muted`. */
export const soft = (p: Palette) => lerpColor(p.ink, p.paper, 0.32);
/**
 * The colour for emphasis: trails, marks, focus bars. A style's accent when it
 * has a hue; monochrome styles (hand-drawn, pen-and-ink, blueprint) get a warm
 * orange that reads on their paper.
 */
export function emphasis(p: Palette): string {
  const [r, g, b] = parseColor(p.accent) ?? [0, 0, 0];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  // A hue needs both relative and absolute chroma: near-black inks (pen-and-ink) are not one.
  if (max > 0 && (max - min) / max > 0.3 && max - min > 48) return p.accent;
  const [pr, pg, pb] = parseColor(p.paper) ?? [255, 255, 255];
  const dark = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb < 110;
  return dark ? '#ffb454' : '#d9480f';
}
/** A panel surface one shade off the paper. */
export const raised = (p: Palette) => lerpColor(p.paper, p.ink, 0.07);
/** A hairline that separates without shouting. */
export const rule = (p: Palette) => lerpColor(p.paper, p.ink, 0.28);

/**
 * Stage regions below the heading, in scene units (16 × 9, y up). Lay native
 * panels and diagrams into these so nothing is placed on top of anything else.
 */
export const REGIONS = {
  full: [-7.55, -4.25, 7.55, 3.25],
  left: [-7.55, -4.25, -0.15, 3.25],
  right: [0.15, -4.25, 7.55, 3.25],
  /** Two thirds left, one third right: a diagram beside a card or code. */
  main: [-7.55, -4.25, 2.35, 3.25],
  side: [2.65, -4.25, 7.55, 3.25],
  /** One third left, two thirds right. */
  aside: [-7.55, -4.25, -2.65, 3.25],
  wide: [-2.35, -4.25, 7.55, 3.25],
  top: [-7.55, -0.35, 7.55, 3.25],
  bottom: [-7.55, -4.25, 7.55, -0.65],
} as const satisfies Record<string, Box>;
export type Region = keyof typeof REGIONS;
export const regionBox = (r: Region | Box): Box => (typeof r === 'string' ? [...REGIONS[r]] : [...r]);
export const boxCenter = (b: Box): [number, number] => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
