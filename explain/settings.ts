import type { Scene, SceneClass } from '../src/scene.ts';

export interface Setting {
  id: string;
  label: string;
  default: string;
  options: readonly { value: string; label: string }[];
}
export type Settings = Readonly<Record<string, string>>;
export type ExplainerClass = SceneClass & {
  meta?: { id?: string; title?: string; sources?: readonly string[] };
  settings?: readonly Setting[];
};
const selected = new WeakMap<Scene, Settings>();
const reserved = new Set(['scene', 'step', 't', 'perf', 'embed', 'parentOrigin', 'theme']);

/** Validate declarations and selections once, at the author/URL boundary. */
export function resolveSettings(Scene: ExplainerClass, values: Settings = {}): Settings {
  const result: Record<string, string> = Object.create(null);
  for (const s of Scene.settings ?? []) {
    if (!/^[a-z][a-z0-9_-]*$/i.test(s.id) || reserved.has(s.id) || s.id in result)
      throw new Error(`Invalid or duplicate setting id: ${s.id}`);
    const options = s.options.map((o) => o.value);
    if (!options.length || new Set(options).size !== options.length || !options.includes(s.default))
      throw new Error(`Invalid options/default for setting: ${s.id}`);
    const value = values[s.id] ?? s.default;
    if (!options.includes(value)) throw new Error(`Unknown ${s.id} option: ${value}`);
    result[s.id] = value;
  }
  for (const id of Object.keys(values)) if (!(id in result)) throw new Error(`Unknown setting: ${id}`);
  return Object.freeze(result);
}

export function settingsOf(scene: Scene): Settings {
  return selected.get(scene) ?? resolveSettings(scene.constructor as ExplainerClass);
}

/** Bind without mutating the source class or sharing state between readers. */
export function withSettings(Source: ExplainerClass, values: Settings = {}): ExplainerClass {
  const settings = resolveSettings(Source, values);
  return class extends Source {
    constructor(...args: ConstructorParameters<SceneClass>) {
      super(...args);
      selected.set(this, settings);
    }
  };
}

/** Finite cartesian product, in declaration order; refuse accidental build explosions. */
export function variantsOf(Scene: ExplainerClass, limit = 64): Settings[] {
  resolveSettings(Scene);
  let variants: Settings[] = [Object.freeze({})];
  for (const s of Scene.settings ?? []) {
    if (variants.length * s.options.length > limit) throw new Error(`Settings exceed ${limit} variants`);
    variants = variants.flatMap((v) => s.options.map((o) => Object.freeze({ ...v, [s.id]: o.value })));
  }
  return variants;
}
