import type { Scene } from '../src/scene.ts';
export interface WalkRecord {
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
    const describe = scene.describe.bind(scene),
      entries = log;
    scene.describe = () => ({ ...describe(), walks: entries.map((entry) => ({ ...entry })) });
  }
  log.push(walk);
  scene.state.walks = log.map((entry) => ({ ...entry }));
}
