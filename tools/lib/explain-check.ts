import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import ts from 'typescript';
import {
  MotionSink,
  analyzeMotion,
  SnapshotSink,
  renderAt,
  toSvgString,
  traceScene,
  Text,
} from '../../src/index.ts';
import { ROOT, engineAlias, sceneSlug } from './explain-project.ts';
import type { Box, Mobject } from '../../src/index.ts';
import type { Project } from './explain-project.ts';

export function lintConstruct(source: string): string[] {
  const file = ts.createSourceFile('scene.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors: string[] = [];
  function walk(node: ts.Node, inConstruct = false) {
    if (ts.isMethodDeclaration(node) && node.name.getText(file) === 'construct') inConstruct = true;
    if (inConstruct && ts.isTryStatement(node) && node.catchClause) {
      let asynchronous = false;
      function find(n: ts.Node) {
        if (ts.isAwaitExpression(n)) asynchronous = true;
        ts.forEachChild(n, find);
      }
      find(node.tryBlock);
      if (asynchronous)
        errors.push(
          'Do not catch around awaited animation/step calls in construct(): a broad catch can swallow StopScene. Catch model errors before animation.',
        );
    }
    ts.forEachChild(node, (n) => walk(n, inConstruct));
  }
  walk(file);
  return errors;
}
export async function checkProject(
  project: Project,
  out = join(ROOT, 'out/checks', sceneSlug(project)),
): Promise<Record<string, unknown>> {
  const lint = lintConstruct(await readFile(project.file, 'utf8'));
  assert.deepEqual(lint, [], lint.join('\n'));
  await mkdir(out, { recursive: true });
  const variants = [];
  for (const v of project.variants) {
    const motion = new MotionSink(),
      frames = new Map<number, string>();
    const targets = new Set(
      v.trace.steps.flatMap((s) => [
        s.frame0 + Math.max(1, Math.floor(((s.frame1 ?? s.frame0 + 1) - s.frame0) / 2)),
        Math.max(s.frame0 + 1, (s.frame1 ?? s.frame0 + 1) - 1),
      ]),
    );
    const labels = new Map<string, number>();
    const completedFrames = new Set(
      v.trace.steps.map((s) => Math.max(s.frame0 + 1, (s.frame1 ?? s.frame0 + 1) - 1)),
    );
    const staticLabels = new Map<string, { text: string; px: number }>();
    await new v.Scene({
      async frame(scene) {
        await motion.frame(scene);
        if (targets.has(scene.frameCount)) frames.set(scene.frameCount, toSvgString(scene));
        for (const m of scene.familyMembers()) {
          const text = (m as unknown as { text?: string }).text;
          if (!text?.trim()) continue;
          const ratio =
            m instanceof Text
              ? m.run.fontSize / (m.run.ascent + m.run.descent)
              : (m as unknown as { emRatio?: number }).emRatio;
          if (!ratio) continue;
          const viewport: Box = [-8, -4.5, 8, 4.5];
          for (let ancestor: Mobject | null = m; ancestor; ancestor = ancestor.parent)
            if (ancestor.clipBox) {
              const clip = ancestor.clipBox;
              viewport[0] = Math.max(viewport[0], clip[0]);
              viewport[1] = Math.max(viewport[1], clip[1]);
              viewport[2] = Math.min(viewport[2], clip[2]);
              viewport[3] = Math.min(viewport[3], clip[3]);
            }
          // Imported semantic labels must be readable in a completed step, not
          // merely flash past at a readable size halfway through a camera move.
          if (!(m instanceof Text)) {
            let owner = m.parent;
            while (owner && !owner.key) owner = owner.parent;
            const size = (m as unknown as { fontSize: number }).fontSize;
            const key = `${owner?.key ?? text}@${Number(size).toPrecision(5)}`;
            if (!staticLabels.has(key)) staticLabels.set(key, { text, px: 0 });
            const box = (owner ?? m).box();
            if (
              completedFrames.has(scene.frameCount) &&
              box &&
              box[0] >= viewport[0] - 1e-5 &&
              box[2] <= viewport[2] + 1e-5 &&
              box[1] >= viewport[1] - 1e-5 &&
              box[3] <= viewport[3] + 1e-5 &&
              m.style.opacity >= 0.95 &&
              (m.style.drawFraction ?? 1) >= 0.95
            ) {
              const record = staticLabels.get(key)!;
              record.px = Math.max(record.px, m.height() * ratio * 80);
            }
          }
          if (!labels.has(text)) labels.set(text, 0);
          const box = m.box();
          if (
            !box ||
            box[0] < viewport[0] - 1e-5 ||
            box[2] > viewport[2] + 1e-5 ||
            box[1] < viewport[1] - 1e-5 ||
            box[3] > viewport[3] + 1e-5 ||
            m.style.opacity < 0.95 ||
            (m.style.drawFraction ?? 1) < 0.95
          )
            continue;
          labels.set(text, Math.max(labels.get(text) ?? 0, m.height() * ratio * 80));
        }
      },
    }).run();
    const events = analyzeMotion(motion);
    assert.equal(
      events.length,
      0,
      `Motion failures ${JSON.stringify(v.values)}: ${JSON.stringify(events.slice(0, 8))}`,
    );
    for (const [frame, svg] of frames) {
      const sink = new SnapshotSink();
      await renderAt(v.Scene, frame / v.trace.fps, sink);
      assert.equal(sink.svg, svg, `Seek mismatch at frame ${frame}`);
    }
    const skipped = await traceScene(v.Scene, { skipUntil: 0 });
    assert.deepEqual(skipped, v.trace, 'Skipped and played traces differ');
    const staticSmall = [...staticLabels.values()].filter((label) => label.px < 9);
    assert.deepEqual(
      staticSmall,
      [],
      `Imported labels need a readable completed-step view at 1280px: ${JSON.stringify(staticSmall)}`,
    );
    const small = [...labels].filter(([, px]) => px < 9);
    assert.deepEqual(small, [], `Labels never reach 9px at 1280px stage: ${JSON.stringify(small)}`);
    const contents = `import * as author from ${JSON.stringify(project.file)};import{bindSnapshots,withSettings}from ${JSON.stringify(join(ROOT, 'explain/index.ts'))};import{Scene,NullSink,toSvgString}from ${JSON.stringify(join(ROOT, 'src/index.ts'))};const Source=author.default??Object.values(author).find(v=>typeof v==='function'&&v.prototype instanceof Scene);export async function run(){const C=withSettings(bindSnapshots(Source,${JSON.stringify(project.store)}),${JSON.stringify(v.values)});const s=await new C(new NullSink(),{skipUntil:Infinity}).run();return{steps:s.steps.map(s=>s.name),state:s.describe(),svg:toSvgString(s)}}`;
    const b = await build({
      stdin: { contents, resolveDir: ROOT, loader: 'ts' },
      bundle: true,
      format: 'iife',
      globalName: 'bare',
      platform: 'neutral',
      target: 'es2022',
      write: false,
      plugins: [engineAlias()],
      logLevel: 'silent',
    });
    const context = vm.createContext({ TextEncoder, TextDecoder, atob });
    vm.runInContext(b.outputFiles[0]!.text + ';globalThis.result=bare.run()', context);
    const result = await context.result;
    assert.deepEqual(
      JSON.parse(JSON.stringify(result.steps)),
      v.trace.steps.map((s) => s.step),
    );
    assert.deepEqual(JSON.parse(JSON.stringify(result.state)), v.trace.steps.at(-1)!.after);
    assert.ok(result.svg.includes('<path'));
    variants.push({
      settings: v.values,
      trace: v.trace,
      steps: v.trace.steps.length,
      frames: motion.frames.length,
      seekFrames: frames.size,
      motionEvents: events.length,
      labels: labels.size,
      completedStepLabels: staticLabels.size,
      bareRuntime: true,
    });
  }
  const report = {
    scene: sceneSlug(project),
    variants,
    diagrams: Object.keys(project.store).length,
    replayedEdits: project.edits,
  };
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
