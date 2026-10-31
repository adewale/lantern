import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, NullSink, Text } from '../src/index.ts';
import { bindLettering } from '../src/lettering-outlines.ts';
import type { LetteringProvider } from '../src/lettering-outlines.ts';
// The tools install outline lettering when they load, before any scene runs.
import '../tools/lib/explain-project.ts';

// Outline lettering swaps the shared font shapers while a lettered scene holds its lease. In the
// tools, which load lettering before any scene runs, a plain scene's run is leased too, so a
// lettered scene bound and run while it is still building text waits for it, and its text is never
// shaped by the lettered scene's provider. (Seen in CI as "Lettering snapshot has no run for …"
// when a test collected every catalog project at once.)
test('in the tools, a plain run started before a lettered scene is bound never shapes text with its provider', async () => {
  const shapedByProvider: string[] = [];
  const provider: LetteringProvider = {
    shape(_font, text, size, fallback) {
      shapedByProvider.push(text);
      return fallback(text, size);
    },
    math() {
      throw new Error('no maths here');
    },
  };
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let started!: () => void;
  const running = new Promise<void>((r) => (started = r));
  // The lettered scene holds its lease across the plain scene's second Text, as a long run does.
  let releaseLettered!: () => void;
  const letteredGate = new Promise<void>((r) => (releaseLettered = r));

  class Plain extends Scene {
    override async construct() {
      new Text('before the lease', { fontSize: 0.4 });
      started();
      await gate;
      // Built while the lettered scene below is waiting for, or holding, its lease.
      new Text('plain words', { fontSize: 0.4 });
    }
  }
  class Lettered extends Scene {
    override async construct() {
      new Text('lettered words', { fontSize: 0.4 });
      await letteredGate;
    }
  }

  const plain = new Plain(new NullSink(), { skipUntil: Infinity }).run();
  await running;
  // Binding a lettered scene while Plain is mid-run.
  const Bound = bindLettering(Lettered, provider);
  const lettered = new Bound(new NullSink(), { skipUntil: Infinity }).run();
  // Let the lettered run reach its lease before Plain builds its second Text.
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  release();
  await plain;
  releaseLettered();
  await lettered;

  assert.ok(shapedByProvider.includes('lettered words'), 'the lettered scene used its provider');
  assert.deepEqual(shapedByProvider.filter((t) => t !== 'lettered words'), [], 'the plain scene never used the lettered provider');
});
