export { stage } from './stage.ts';
export type { StageOptions, Stage } from './stage.ts';
export { Diagram } from './diagrams.ts';
export type { ShowOptions, NoteSide } from './diagrams.ts';
export { Card, CodeBlock } from './panels.ts';
export type { CardRow, CardOptions, CodeOptions } from './panels.ts';
export { REGIONS, regionBox, emphasis, soft } from './look.ts';
export type { Region } from './look.ts';
export { palette, PALETTES } from './palettes.ts';
export { settingsOf, withSettings, resolveSettings, variantsOf } from './settings.ts';
export type { Setting, Settings, ExplainerClass } from './settings.ts';
export { diagramKey, useDiagrams, snapshotResolver, findingsOf, edgePartOf } from '../integrations/agentic-mermaid/snapshot.ts';
export type {
  DiagramSpec,
  DiagramSnapshot,
  SnapshotStore,
  Palette,
  Finding,
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
