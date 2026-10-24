export { stage } from './stage.ts';
export type { StageOptions } from './stage.ts';
export { Diagram } from './diagrams.ts';
export type { ShowOptions } from './diagrams.ts';
export { palette, PALETTES } from './palettes.ts';
export { settingsOf, withSettings, resolveSettings, variantsOf } from './settings.ts';
export type { Setting, Settings, ExplainerClass } from './settings.ts';
export { diagramKey, useDiagrams, snapshotResolver } from '../integrations/agentic-mermaid/snapshot.ts';
export type {
  DiagramSpec,
  DiagramSnapshot,
  SnapshotStore,
  Palette,
} from '../integrations/agentic-mermaid/snapshot.ts';
import type { ExplainerClass } from './settings.ts';
import type { SceneClass } from '../src/scene.ts';
import type { SnapshotStore } from '../integrations/agentic-mermaid/snapshot.ts';
import { useDiagrams, snapshotResolver } from '../integrations/agentic-mermaid/snapshot.ts';

export function bindSnapshots(Source: ExplainerClass, store: SnapshotStore): ExplainerClass {
  return class extends Source {
    constructor(...args: ConstructorParameters<SceneClass>) {
      super(...args);
      useDiagrams(this, snapshotResolver(store));
    }
  };
}
