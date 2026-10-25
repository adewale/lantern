import type { Scene, StepRecord } from '../src/index.ts';
interface WalkRecord {
  step?: string;
  from: string;
  to: string;
  edge: string;
}
const logs = new WeakMap<Scene, WalkRecord[]>();
/** Keep helper evidence even when an author replaces the program-state object. */
export function recordWalk(scene: Scene, walk: WalkRecord): void {
  let log = logs.get(scene);
  if (!log) {
    log = [];
    logs.set(scene, log);
    const entries = log;
    scene.addDescriber(() => ({ walks: entries.map((entry) => ({ ...entry })) }));
  }
  log.push(walk);
  scene.state.walks = log.map((entry) => ({ ...entry }));
}

type Timed = Pick<StepRecord, 't0' | 't1' | 'frame0' | 'frame1'>;
/** A step's resting frame, the last it draws: what a reader looks at while reading its caption. */
export const restingFrame = (s: Timed) => Math.max(s.frame0 + 1, s.frame1 ?? s.frame0 + 1);
/** A time inside the resting frame (half a frame before the step ends), for renderAt. */
export const restingTime = (s: Timed, fps: number) => Math.max(s.t0, (s.t1 ?? s.t0) - 0.5 / fps);

/** One thing on the stage as a reader would list it: what it is, then its parts. */
export interface PictureEntry {
  what: string;
  items: string[];
}
export const htmlEscape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
/** The description a stage records in a step's state (`picture`), as nested lists; empty when there is none. */
export function pictureHtml(state: unknown): string {
  const picture = ((state as { picture?: PictureEntry[] } | undefined)?.picture ?? []).filter((e) => e.items.length);
  if (!picture.length) return '';
  const list = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  return list(picture.map((e) => htmlEscape(e.what) + list(e.items.map(htmlEscape))));
}
