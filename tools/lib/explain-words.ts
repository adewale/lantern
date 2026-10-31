// How a case's words sit on a phone. The player gives every step the room its case's longest
// title, line and caption need (app/embed.ts, reserve()), so one long step leaves the others with
// empty space under their words. This estimates each step's lines on a 390 px page and names the
// steps that set the room, so an author can see the cost before a reader does. Advisory: `check`
// reports it and never fails on it.

/**
 * Characters per line in the phone's 326 px column, measured from the catalog's own words in the
 * player's type (title 17 px semibold, line 15 px, caption 17 px). System fonts differ by platform,
 * so a count is an estimate, good for comparing a case's steps with each other.
 */
export const PHONE_CHARS = { title: 39, line: 46, caption: 41 } as const;
/** How many lines above the case's median a step may run before it is named as an outlier. */
const OUTLIER_LINES = { title: 1, line: 1, caption: 2 } as const;

type Role = keyof typeof PHONE_CHARS;
export interface StepWords {
  step: string;
  title: string;
  line: string;
  caption: string;
}

/** Lines a text takes when wrapped greedily at word boundaries to `width` characters. */
export function wrappedLines(text: string, width: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  let lines = 1,
    used = 0;
  for (const word of words) {
    // A word longer than the line breaks across lines, as overflow-wrap does.
    const length = [...word].length;
    if (used === 0) {
      lines += Math.floor(Math.max(0, length - 1) / width);
      used = length % width || width;
    } else if (used + 1 + length <= width) used += 1 + length;
    else {
      lines += 1 + Math.floor(Math.max(0, length - 1) / width);
      used = length % width || width;
    }
  }
  return lines;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b),
    mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * For one case: each step's estimated lines on a phone, and for the title, the line and the
 * caption, the tallest, the median, the slack the tallest leaves a median step (`slackLines`), and
 * the steps that run past the median by more than the allowance (`outliers`). Wrapping alone is
 * not reported: most catalog titles and lines take two phone lines, so it would name every scene.
 */
export function wordsReport(steps: StepWords[]) {
  const lines = steps.map((s) => ({
    step: s.step,
    title: wrappedLines(s.title, PHONE_CHARS.title),
    line: wrappedLines(s.line, PHONE_CHARS.line),
    caption: wrappedLines(s.caption, PHONE_CHARS.caption),
  }));
  const roles = Object.fromEntries(
    (['title', 'line', 'caption'] as Role[]).map((role) => {
      // A step without a line takes no room for one, so the median is over steps that have one.
      const counted = lines.filter((l) => role !== 'line' || l[role] > 0);
      if (!counted.length) return [role, { tallest: 0, median: 0, slackLines: 0, outliers: [] as string[] }];
      const values = counted.map((l) => l[role]),
        tallest = Math.max(...values),
        middle = median(values);
      return [
        role,
        {
          tallest,
          median: middle,
          slackLines: tallest - middle,
          outliers: counted.filter((l) => l[role] > middle + OUTLIER_LINES[role]).map((l) => l.step),
        },
      ];
    }),
  ) as Record<Role, { tallest: number; median: number; slackLines: number; outliers: string[] }>;
  return { phoneLines: lines, ...roles };
}
