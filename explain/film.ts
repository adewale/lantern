// The film: how a scene's steps play as a video. The page is read at the reader's pace, so
// a step there holds for its caption; a video is watched, so its pace is the motion's. Each
// step plays its motion, then rests on its picture for a short beat: long enough to read the
// step's title and line at a quick reading speed, never longer than FILM.maxBeat. The full
// caption goes to the subtitles and the transcript, not the picture.
import type { Trace } from '../src/index.ts';

export const FILM = {
  /** Words a minute the title and line are read at while the film runs: quick, since they are short. */
  wpm: 240,
  /** The shortest rest after a step's motion, in seconds. */
  minBeat: 0.6,
  /** The longest rest after a step's motion, in seconds. */
  maxBeat: 2,
  /** The last step rests this long, so the finished picture is seen. */
  lastBeat: 2.5,
  /** How far an ambient push-in closes on the picture during a rest: 2.5% of the view. */
  push: 0.025,
  /** Seconds the next step's motion takes to ease the push back out. */
  release: 0.5,
} as const;

/** Budgets a film must keep (checked by `explain check` and `explain render`). */
export const PACING = {
  /** The longest run of frames in which the scene's picture does not change, in seconds. */
  longestStill: 3,
  /**
   * The share of the scene's motion in which its picture does not change: pauses, waits and holds
   * inside steps. Rests are not counted: each is at most FILM.maxBeat and pushes in.
   */
  stillShare: 0.2,
  /** The share of the film spent resting: more and it is a slideshow, however short each rest. */
  restShare: 0.6,
  /** The shares are judged only on a film at least this long, in seconds: a few seconds cannot drag. */
  shareFrom: 10,
} as const;

/** Words in a title, line or caption. */
export const words = (text: unknown) => (typeof text === 'string' && text.trim() ? text.trim().split(/\s+/).length : 0);

/**
 * The rest after a step's motion, in seconds: enough to read `count` words of title and line at
 * FILM.wpm beyond what the motion already gave, between FILM.minBeat and FILM.maxBeat, and at
 * least FILM.lastBeat after the last step.
 */
export function beatSeconds(count: number, motion: number, final = false): number {
  const seconds = Math.min(FILM.maxBeat, Math.max(FILM.minBeat, (count / FILM.wpm) * 60 - motion));
  return final ? Math.max(FILM.lastBeat, seconds) : seconds;
}

export interface FilmStep {
  step: string;
  index: number;
  /** The scene's frames this step plays in the film: frame0 + 1 to moveEnd. */
  frame0: number;
  moveEnd: number;
  /** The step's last frame in the scene (its caption hold, which the film skips, ends here). */
  last: number;
  /** Frames the film rests on the step's picture after its motion. */
  beat: number;
  /** Film times in seconds: the step starts, its motion ends and its rest begins, it ends. */
  t0: number;
  rest: number;
  t1: number;
  /** Words on the picture: the title and the line. */
  words: number;
}

/** Each step's place in the film, from the scene's trace. */
export function filmPlan(trace: Pick<Trace, 'fps' | 'frames' | 'steps'>): FilmStep[] {
  const { fps } = trace;
  let at = 0;
  return trace.steps.map((s, index) => {
    const last = s.frame1 ?? trace.frames,
      moveEnd = s.hold == null ? last : Math.round(s.hold * fps);
    const motion = (moveEnd - s.frame0) / fps,
      count = words(s.meta.title) + words(s.meta.line);
    const beat = Math.round(beatSeconds(count, motion, index === trace.steps.length - 1) * fps);
    const t0 = at / fps;
    at += moveEnd - s.frame0;
    const rest = at / fps;
    at += beat;
    return { step: s.step, index, frame0: s.frame0, moveEnd, last, beat, t0, rest, t1: at / fps, words: count };
  });
}

/**
 * The ambient push-in at film frame `f` (0 none, 1 fully pushed): it rises over each beat with
 * an ease, and the next step's motion eases it back out over FILM.release seconds.
 */
export function pushAt(plan: readonly FilmStep[], fps: number, f: number): number {
  const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  for (const s of plan) {
    const start = Math.round(s.t0 * fps),
      rest = Math.round(s.rest * fps),
      end = Math.round(s.t1 * fps);
    if (f < start || f >= end) continue;
    // The larger of this rest's rise and the last rest's ease-out, so a step with no motion of
    // its own carries the push on instead of dropping it.
    const rise = f >= rest ? ease((f - rest + 1) / Math.max(1, s.beat)) : 0;
    const fall = s.index ? 1 - ease((f - start + 1) / Math.max(1, FILM.release * fps)) : 0;
    return Math.max(rise, fall);
  }
  return 0;
}

export interface Pacing {
  /** The film's length in seconds. */
  seconds: number;
  /** The longest run in which the scene's picture does not change, in seconds. */
  longestStill: number;
  /** The share of the scene's motion, rests left out, in which its picture does not change. */
  stillShare: number;
  /** The share of the film spent resting after each step's motion. */
  restShare: number;
  /** Words on the picture (titles and lines) per second of film. */
  wordsPerSecond: number;
  /** Steps with no `line`: the film shows only their title. */
  withoutLine: string[];
}

/**
 * Pacing from the plan and, for each scene frame, whether its picture differs from the
 * frame before (`changed[n]` for frame n; frame 0 is the first picture). A rest counts toward
 * the longest still stretch (its push-in is slight) but not toward the still share, which is the
 * scene's own pauses: a rest is capped, and a longer line should not cost a shorter one.
 */
export function pacing(trace: Pick<Trace, 'fps' | 'frames' | 'steps'>, changed: readonly boolean[]): Pacing {
  const plan = filmPlan(trace),
    { fps } = trace;
  let run = 0,
    longest = 0,
    still = 0,
    motion = 0,
    total = 0;
  const frame = (moving: boolean, resting: boolean) => {
    total++;
    if (!resting) motion++;
    if (moving) run = 0;
    else {
      if (!resting) still++;
      longest = Math.max(longest, ++run);
    }
  };
  for (const s of plan) {
    for (let n = s.frame0 + 1; n <= s.moveEnd; n++) frame(!!changed[n], false);
    for (let i = 0; i < s.beat; i++) frame(false, true);
  }
  const seconds = total / fps;
  return {
    seconds: Math.round(seconds * 100) / 100,
    longestStill: Math.round((longest / fps) * 100) / 100,
    stillShare: motion ? Math.round((still / motion) * 1000) / 1000 : 0,
    restShare: total ? Math.round(((total - motion) / total) * 1000) / 1000 : 0,
    wordsPerSecond: seconds ? Math.round((plan.reduce((n, s) => n + s.words, 0) / seconds) * 100) / 100 : 0,
    withoutLine: trace.steps.filter((s) => !(typeof s.meta.line === 'string' && s.meta.line.trim())).map((s) => s.step),
  };
}

/** What breaks the budgets, in words; empty when the film keeps them. */
export function pacingProblems(p: Pacing): string[] {
  const out: string[] = [];
  if (p.longestStill > PACING.longestStill)
    out.push(`the picture stands still for ${p.longestStill} s at once (budget ${PACING.longestStill} s): shorten a wait or give it motion`);
  if (p.seconds >= PACING.shareFrom && p.stillShare > PACING.stillShare)
    out.push(`the picture stands still for ${Math.round(p.stillShare * 100)}% of the scene's motion, rests aside (budget ${PACING.stillShare * 100}%): shorten a wait or give it motion`);
  if (p.seconds >= PACING.shareFrom && p.restShare > PACING.restShare)
    out.push(`the film rests for ${Math.round(p.restShare * 100)}% of its length (budget ${PACING.restShare * 100}%): give the steps more motion`);
  return out;
}
