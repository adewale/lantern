// Panels: a key/value state readout (stateView builds one).
import { Group } from './mobject.ts';
import { Text } from './text.ts';
import type { Vec } from './vec.ts';
import { GREY, WHITE } from './color.ts';

/** `label: value` pairs stacked vertically; values are Text you can Transform. */
export class StateReadout extends Group {
  /** The keys, in order: row i is children 2i (the label) and 2i + 1 (the value). */
  keys: string[];

  constructor(entries: ReadonlyArray<readonly [key: string, value: unknown]>, { fontSize = 0.3, at = [0, 0], gap = 0.5 }: { fontSize?: number; at?: Vec; gap?: number } = {}) {
    super();
    this.keys = entries.map(([k]) => k);
    entries.forEach(([k, v], i) => {
      const key = new Text(k, { fontSize, font: 'mono', color: GREY, anchor: 'end' });
      const val = new Text(String(v), { fontSize, font: 'mono', color: WHITE, anchor: 'start' });
      key.moveTo([at[0] - 0.15, at[1] - i * gap], [1, 0]);
      val.moveTo([at[0] + 0.15, at[1] - i * gap], [-1, 0]);
      this.add(key, val);
    });
  }

  /** Each key's value Text, read from the children, so a copy() answers with its own. */
  get values(): Record<string, Text> {
    const out: Record<string, Text> = {};
    this.keys.forEach((k, i) => { out[k] = this.children[2 * i + 1] as Text; });
    return out;
  }
}
