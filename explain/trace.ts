import type { Scene, StepRecord } from '../src/index.ts';
import { wordsFor, describedIn, markHeading } from './words.ts';
import type { Words } from './words.ts';
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

/** A part of something on the stage, as a reader would name it, with its emphasis. */
export interface SeenPart {
  name: string;
  /** The word for its emphasis ("marked", "rejected", "focused", in the scene's language); absent when plain. */
  mark?: string;
  dimmed?: boolean;
}
/** One thing on the stage as its helper sees it: what it is, its parts, and anything drawn without words. */
export interface Seen {
  what: string;
  parts: SeenPart[];
  /** Drawn things with nothing to say for them (a part id, a kept drawing): `undescribed` reports these. */
  blank?: string[];
}
/** One thing on the stage as a reader would list it: what it is, its emphasised parts by their word, then the rest. */
export interface PictureEntry {
  what: string;
  /** Emphasised parts, grouped by the word for their emphasis ("marked", "focused", "note"). */
  marked?: Record<string, string[]>;
  /** The other parts in reading order, dimmed ones last. */
  items: string[];
}
/** What a step's resting picture shows; the stage records it in each step's state as `picture`. */
export interface Picture {
  entries: PictureEntry[];
  /** Parts that arrived or changed during the step; absent when everything did. */
  changed?: string[];
  undescribed?: string[];
  /** The language of its words when not English (explain/words.ts); the summary and list follow it. */
  lang?: string;
}
export const htmlEscape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const pictureOf = (state: unknown): Picture | undefined => (state as { picture?: Picture } | undefined)?.picture;
/**
 * Seen things as entries, emphasis first, and what is new since `before` (the names shown
 * when the step began), in the words of `lang`, the scene's language.
 */
export function picture(all: readonly Seen[], before: ReadonlySet<string>, lang?: string): Picture {
  const words = wordsFor(lang),
    said = describedIn(lang);
  const undescribed = all.flatMap((s) => s.blank ?? []);
  const seen = all.filter((s) => s.what);
  const entries = seen.map(({ what, parts }) => {
    const marked: Record<string, string[]> = {};
    for (const p of parts) if (p.mark) (marked[p.mark] ??= []).push(p.name);
    const rest = parts.filter((p) => !p.mark).sort((a, b) => +!!a.dimmed - +!!b.dimmed);
    const items = rest.map((p) => (p.dimmed ? words.dimmed(p.name) : p.name));
    return { what, ...(Object.keys(marked).length ? { marked } : {}), items };
  });
  // A thing wholly new is named once, by what it is; otherwise its new parts are.
  const fresh = seen.map(({ what, parts }) => {
    const names = parts.filter((p) => !before.has(p.name)).map((p) => p.name);
    return !parts.length ? (before.has(what) ? [] : [what]) : names.length === parts.length ? [what] : names;
  });
  // When everything is new (a first step, a clean slate), what is shown already says it.
  const changed = fresh.every((f, i) => f.length === 1 && f[0] === seen[i]!.what) ? [] : fresh.flat();
  return {
    entries,
    ...(changed.length ? { changed } : {}),
    ...(undescribed.length ? { undescribed } : {}),
    ...(said !== 'en' ? { lang: said } : {}),
  };
}
/** The names a picture shows, for the next step's `before`. */
export const shownNames = (seen: readonly Seen[]) =>
  new Set(seen.filter((s) => s.what).flatMap(({ what, parts }) => (parts.length ? parts.map((p) => p.name) : [what])));

/**
 * Up to `max` items joined with semicolons (code's column spacing closed up, and an item's own
 * trailing comma or semicolon dropped, as the join separates them), then how many more. No-break
 * spaces stay: French sets one before a colon, and in 30 000 €.
 */
function some(words: Words, items: readonly string[], max = 3): string {
  const shown = items
    .slice(0, max)
    .map((t) => t.trim().replace(/[^\S\u00a0\u2007\u202f]+/g, ' ').replace(/[,;]+$/, ''))
    .join(words.separator);
  return items.length > max ? `${shown}${words.separator}${words.more(items.length - max)}` : shown;
}
const end = (text: string, mark: string) => (/[.;:!?,…]$/.test(text) ? text : text + mark);
const sentence = (text: string) => end(text[0]!.toUpperCase() + text.slice(1), '.');
/**
 * A step's picture in two or three short sentences, for the stage's accessible
 * description: what is shown, what is emphasised, and what is new in this step.
 */
export function pictureSummary(state: unknown): string {
  const p = pictureOf(state);
  if (!p?.entries.length) return '';
  const w = wordsFor(p.lang);
  const words: Record<string, string[]> = {};
  for (const e of p.entries) for (const [word, names] of Object.entries(e.marked ?? {})) (words[word] ??= []).push(...names);
  // At most four emphasised parts in all and three under one word, those new in this step
  // first, so the description stays short and says what this step did; one count at the end
  // says how many it leaves to the full list.
  const fresh = new Set(p.changed);
  const first = (names: string[]) => names.filter((n) => fresh.has(n)).length;
  const groups = Object.entries(words)
    .map(([word, names]) => [word, [...names].sort((a, b) => +fresh.has(b) - +fresh.has(a))] as const)
    .sort((a, b) => first(b[1]) - first(a[1]));
  const named = groups.flatMap(([, names]) => names);
  let room = 4;
  const marked = groups.flatMap(([word, names]) => {
    const shown = names.slice(0, Math.min(3, room));
    room -= shown.length;
    return shown.length ? [w.pair(markHeading(w, word, names.length), some(w, shown))] : [];
  });
  const left = named.length - (4 - room);
  const changed = (p.changed ?? []).filter((c) => !named.includes(c));
  return [
    p.entries.map((e) => e.what).join(w.separator),
    ...(marked.length ? [marked.join(w.separator) + (left ? w.separator + w.more(left) : '')] : []),
    ...(changed.length ? [w.pair(w.newInStep, some(w, changed))] : []),
  ]
    .map(sentence)
    .join(' ');
}
/**
 * The picture as nested lists, each thing's emphasised parts first, punctuated so it
 * reads as sentences when flattened. Given the previous step's state, a thing whose
 * parts are all as they were lists only its emphasis.
 */
export function pictureHtml(state: unknown, previous?: unknown): string {
  const p = pictureOf(state);
  if (!p?.entries.length) return '';
  const w = wordsFor(p.lang);
  const marked = (e: PictureEntry) => Object.entries(e.marked ?? {}).flatMap(([word, names]) => names.map((n) => `${n} (${word})`));
  const key = (e: PictureEntry) => [...marked(e), ...e.items].sort().join('\n');
  const before = new Map((pictureOf(previous)?.entries ?? []).map((e) => [e.what, key(e)]));
  const li = (text: string, last: boolean, sub = '') =>
    `<li>${htmlEscape(end(text, sub ? w.colon : last ? '.' : w.semicolon))}${sub}</li>`;
  const ul = (texts: string[]) => `<ul>${texts.map((t, i) => li(t, i === texts.length - 1)).join('')}</ul>`;
  return `<ul>${p.entries
    .map((e, i) => {
      const same = e.items.length && before.get(e.what) === key(e);
      const items = [...marked(e), ...(same ? [w.restAsBefore] : e.items)];
      return li(e.what, i === p.entries.length - 1, items.length ? ul(items) : '');
    })
    .join('')}</ul>`;
}
/**
 * What a step's picture leaves unsaid: kept drawings and diagram parts with no words.
 * Empty when everything on the stage is described; `explain check` fails a step otherwise.
 */
export const undescribed = (state: unknown): string[] => pictureOf(state)?.undescribed ?? [];
