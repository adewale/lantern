import type { LetteringRequest } from '../src/lettering-outlines.ts';
import type { Scene, SceneClass } from '../src/index.ts';

export interface Setting {
  id: string;
  label: string;
  default: string;
  options: readonly { value: string; label: string }[];
  /**
   * A dial varies one value inside a step rather than choosing a case: the reader turns it
   * under the picture and the step is drawn again with the new value, without leaving the step.
   * Cases, the page's transcript and its links are built from the other settings, with every
   * dial at its default; `rayner check` runs every dial value of every case.
   */
  dial?: boolean;
}
export const isDial = (s: Setting) => s.dial === true;
export type Settings = Readonly<Record<string, string>>;
export type ExplainerClass = SceneClass & {
  /** `lang` is the BCP 47 language of titles, captions and on-stage text (default `en`). */
  meta?: { id?: string; title?: string; lang?: string; sources?: readonly string[]; lettering?: LetteringRequest };
  settings?: readonly Setting[];
};
/** Settings bound by `withSettings`, per bound class: visible from the first line of any constructor. */
const bound = new WeakMap<object, Settings>();
// Query parameters the embed reads itself.
const reserved = new Set(['step', 'parentOrigin', 'theme']);

/** Validate declarations and selections once, at the author/URL boundary. */
export function resolveSettings(Scene: ExplainerClass, values: Settings = {}): Settings {
  const result: Record<string, string> = Object.create(null);
  for (const s of Scene.settings ?? []) {
    if (!/^[a-z][a-z0-9_-]*$/i.test(s.id) || reserved.has(s.id) || s.id in result)
      throw new Error(`Invalid or duplicate setting id: ${s.id}`);
    const options = s.options.map((o) => o.value);
    if (!options.length || new Set(options).size !== options.length || !options.includes(s.default))
      throw new Error(`Invalid options/default for setting: ${s.id}`);
    // Own keys only: an id such as `constructor` must not read Object.prototype.
    const value = Object.hasOwn(values, s.id) ? values[s.id]! : s.default;
    if (!options.includes(value)) throw new Error(`Unknown ${s.id} option: ${value}`);
    result[s.id] = value;
  }
  for (const id of Object.keys(values)) if (!(id in result)) throw new Error(`Unknown setting: ${id}`);
  return Object.freeze(result);
}

export function settingsOf(scene: Scene): Settings {
  for (let c: object | null = scene.constructor; c && c !== Function.prototype; c = Object.getPrototypeOf(c)) {
    const settings = bound.get(c);
    if (settings) return settings;
  }
  return resolveSettings(scene.constructor as ExplainerClass);
}

/** Bind without mutating the source class or sharing state between readers. */
export function withSettings(Source: ExplainerClass, values: Settings = {}): ExplainerClass {
  const settings = resolveSettings(Source, values);
  const Bound = class extends Source {};
  bound.set(Bound, settings);
  return Bound;
}

/** A case as readers see it, "Label: option · Label: option"; empty for a scene without settings. A dial is named only when `values` holds it. */
export function caseName(Scene: ExplainerClass, values: Settings): string {
  return (Scene.settings ?? [])
    .filter((s) => !isDial(s) || Object.hasOwn(values, s.id))
    .map((s) => `${s.label}: ${s.options.find((o) => o.value === values[s.id])?.label ?? values[s.id]}`)
    .join(' · ');
}

/** The values that name a case: every setting that is not a dial. Dials vary inside a step, not between cases. */
export function caseValues(Scene: ExplainerClass, values: Settings): Settings {
  const out: Record<string, string> = {};
  for (const s of Scene.settings ?? []) if (!isDial(s) && Object.hasOwn(values, s.id)) out[s.id] = values[s.id]!;
  return Object.freeze(out);
}
/** Finite cartesian product of the settings in `pick`, in declaration order, the rest at their defaults. */
function product(Scene: ExplainerClass, pick: (s: Setting) => boolean, limit: number, what: string): Settings[] {
  resolveSettings(Scene);
  const settings = Scene.settings ?? [];
  const total = settings.filter(pick).reduce((n, s) => n * s.options.length, 1);
  if (!(total <= limit)) throw new Error(`Settings exceed ${limit} ${what}`);
  let variants: Settings[] = [Object.freeze({})];
  for (const s of settings)
    variants = pick(s)
      ? variants.flatMap((v) => s.options.map((o) => Object.freeze({ ...v, [s.id]: o.value })))
      : variants.map((v) => Object.freeze({ ...v, [s.id]: s.default }));
  return variants;
}
/** The cases: every combination of the settings that are not dials, dials at their defaults; refuse accidental build explosions. */
export function variantsOf(Scene: ExplainerClass, limit = 64): Settings[] {
  return product(Scene, (s) => !isDial(s), limit, 'cases');
}
/** Every combination of cases and dial values: what `rayner check` runs. */
export function sweepsOf(Scene: ExplainerClass, limit = 256): Settings[] {
  return product(Scene, () => true, limit, 'checked combinations');
}
