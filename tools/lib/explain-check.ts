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
  renderText,
  Text,
} from '../../src/index.ts';
import { ROOT, engineAlias, sceneSlug } from './explain-project.ts';
import { caseName } from '../../explain/index.ts';
import { restingFrame } from '../../explain/trace.ts';
import type { Box, Mobject } from '../../src/index.ts';
import type { Project } from './explain-project.ts';

const SWALLOW =
  'Do not catch around awaited animation/step calls in construct(): a broad catch can swallow StopScene. Catch model errors before animation.';
export function lintConstruct(source: string): string[] {
  const file = ts.createSourceFile('scene.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors: string[] = [];
  const named = (name: ts.PropertyName | ts.BindingName | undefined) =>
    !!name &&
    ((ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)
      ? name.text
      : ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)
        ? name.expression.text
        : '') === 'construct');
  // `async construct() {}`, `'construct'() {}`, `['construct']() {}` and `construct = async () => {}`.
  const isConstruct = (node: ts.Node) =>
    (ts.isMethodDeclaration(node) && named(node.name)) ||
    (ts.isPropertyDeclaration(node) && named(node.name) && !!node.initializer && ts.isFunctionLike(node.initializer));
  /** Awaited in this function body: `await`, `for await`; nested functions are not awaited by the try. */
  function awaits(n: ts.Node): boolean {
    if (ts.isAwaitExpression(n) || (ts.isForOfStatement(n) && n.awaitModifier)) return true;
    if (ts.isFunctionLike(n)) return false;
    return !!ts.forEachChild(n, (c) => awaits(c) || undefined);
  }
  function walk(node: ts.Node, inConstruct = false) {
    if (isConstruct(node)) inConstruct = true;
    if (inConstruct && ts.isTryStatement(node) && node.catchClause && awaits(node.tryBlock)) errors.push(SWALLOW);
    // A promise's own `.catch()` on awaited work swallows StopScene the same way.
    if (
      inConstruct &&
      ts.isAwaitExpression(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'catch'
    )
      errors.push(SWALLOW);
    ts.forEachChild(node, (n) => walk(n, inConstruct));
  }
  walk(file);
  return errors;
}
/** Smallest label, in CSS pixels at a 1280-pixel stage, a reader must be able to see. */
const MIN_PX = 14;
/** Reader CSS pixels per scene unit on a 1280-pixel stage. */
const STAGE_PX_PER_UNIT = 1280 / 16;
const FRAME: Box = [-8, -4.5, 8, 4.5];
/** Fully drawn and inside the viewport: a label a reader can see at its size. */
const readable = (m: Mobject, box: Box | null, viewport: Box) =>
  !!box &&
  box[0] >= viewport[0] - 1e-5 &&
  box[2] <= viewport[2] + 1e-5 &&
  box[1] >= viewport[1] - 1e-5 &&
  box[3] <= viewport[3] + 1e-5 &&
  m.style.opacity >= 0.95 &&
  (m.style.drawFraction ?? 1) >= 0.95;

/**
 * Text a reader would see colliding: a native Text overlapping any other
 * visible text, or a native Text crossing the stage edge. Diagram-internal label
 * placement is Agentic Mermaid's; native text placed over it is the author's.
 */
export function restingTextProblems(scene: { familyMembers(): Mobject[] }): string[] {
  const texts: { m: Mobject; box: Box; native: boolean; text: string }[] = [];
  const visible = (m: Mobject) => {
    for (let a: Mobject | null = m; a; a = a.parent) if ((a.style.opacity ?? 1) < 0.5) return false;
    // Text is drawn by the fill (and any stroke) of its paths: with neither it shows nothing.
    // A group's own paint is never drawn, so look at the paths it holds.
    const painted = (x: Mobject) =>
      (x.style.opacity ?? 1) >= 0.5 &&
      ((!!x.style.fill && x.style.fill !== 'none' && (x.style.fillOpacity ?? 1) >= 0.5) ||
        (!!x.style.stroke && x.style.stroke !== 'none' && (x.style.strokeOpacity ?? 1) >= 0.5 && (x.style.strokeWidth ?? 0) > 0));
    return m.family().some((x) => !x.children.length && painted(x));
  };
  const seen = new Set<Mobject>();
  for (const m of scene.familyMembers()) {
    // A mobject listed twice (added on its own and inside a group) is still one text.
    if (seen.has(m)) continue;
    seen.add(m);
    const text = (m as unknown as { text?: unknown }).text;
    if (typeof text !== 'string' || !text.trim() || !visible(m)) continue;
    if (m.key === '__heading') continue;
    let nested = false;
    for (let a = m.parent; a; a = a.parent) if (typeof (a as unknown as { text?: unknown }).text === 'string') nested = true;
    if (nested) continue;
    const box = m.box();
    if (box) texts.push({ m, box, native: m instanceof Text, text });
  }
  const problems: string[] = [];
  for (const t of texts)
    if (t.native && (t.box[0] < FRAME[0] || t.box[1] < FRAME[1] || t.box[2] > FRAME[2] || t.box[3] > FRAME[3]))
      problems.push(`"${t.text}" crosses the stage edge`);
  const area = (b: Box) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!,
        b = texts[j]!;
      if (!a.native && !b.native) continue;
      const overlap: Box = [
        Math.max(a.box[0], b.box[0]),
        Math.max(a.box[1], b.box[1]),
        Math.min(a.box[2], b.box[2]),
        Math.min(a.box[3], b.box[3]),
      ];
      if (overlap[2] <= overlap[0] || overlap[3] <= overlap[1]) continue;
      if (area(overlap) > 0.12 * Math.min(area(a.box), area(b.box)))
        problems.push(`"${a.text}" overlaps "${b.text}"`);
    }
  return problems;
}

/** Smallest label sizes at a 1280 px stage and, scaled, on a 390 px phone before zooming. */
function legibilityReport(px: number[]) {
  const sizes = px.filter((p) => p > 0);
  const min = sizes.length ? Math.min(...sizes) : null;
  const phone = (p: number) => Math.round(((p * 390) / 1280) * 10) / 10;
  return {
    minLabelPx1280: min == null ? null : Math.round(min * 10) / 10,
    minLabelPx390: min == null ? null : phone(min),
    labelsUnder12PxAt390: sizes.filter((p) => phone(p) < 12).length,
    labels: sizes.length,
  };
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
    const where = `in ${caseName(project.Scene, v.values) || 'the scene'}`;
    const motion = new MotionSink(),
      frames = new Map<number, string>();
    const targets = new Set(
      v.trace.steps.flatMap((s) => [
        s.frame0 + Math.max(1, Math.floor(((s.frame1 ?? s.frame0 + 1) - s.frame0) / 2)),
        Math.max(s.frame0 + 1, (s.frame1 ?? s.frame0 + 1) - 1),
      ]),
    );
    const labels = new Map<string, number>();
    const completedFrames = new Set(v.trace.steps.map(restingFrame));
    const staticLabels = new Map<string, { text: string; px: number }>();
    const resting = new Map<number, string>();
    const restingText = new Map<number, string>();
    const collisions: string[] = [];
    await new v.Scene({
      async frame(scene) {
        await motion.frame(scene);
        if (targets.has(scene.frameCount)) frames.set(scene.frameCount, toSvgString(scene));
        if (completedFrames.has(scene.frameCount)) {
          // The resting picture of a step, without the heading that names it.
          const all = scene.mobjects;
          scene.mobjects = all.filter((m) => m.key !== '__heading');
          resting.set(scene.frameCount, toSvgString(scene));
          scene.mobjects = all;
          restingText.set(scene.frameCount, renderText(scene));
          collisions.push(...restingTextProblems(scene).map((p) => `${scene.currentStep?.name}: ${p}`));
        }
        for (const m of scene.familyMembers()) {
          const text = (m as unknown as { text?: string }).text;
          if (!text?.trim()) continue;
          const ratio =
            m instanceof Text
              ? m.run.fontSize / (m.run.ascent + m.run.descent)
              : (m as unknown as { emRatio?: number }).emRatio;
          if (!ratio) continue;
          const viewport: Box = [...FRAME],
            px = m.height() * ratio * STAGE_PX_PER_UNIT;
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
            const record = staticLabels.get(key)!;
            if (completedFrames.has(scene.frameCount) && readable(m, (owner ?? m).box(), viewport))
              record.px = Math.max(record.px, px);
          }
          if (!labels.has(text)) labels.set(text, 0);
          if (readable(m, m.box(), viewport)) labels.set(text, Math.max(labels.get(text)!, px));
        }
      },
    }).run();
    const events = analyzeMotion(motion);
    assert.equal(
      events.length,
      0,
      `Motion failures ${where}: ${JSON.stringify(events.slice(0, 8))}`,
    );
    for (const [frame, svg] of frames) {
      const sink = new SnapshotSink();
      await renderAt(v.Scene, frame / v.trace.fps, sink);
      assert.equal(sink.svg, svg, `Seek mismatch at frame ${frame} ${where}`);
    }
    const skipped = await traceScene(v.Scene, { skipUntil: 0 });
    assert.deepEqual(skipped, v.trace, `Skipped and played traces differ ${where}`);
    const still = v.trace.steps.filter(
      (step, i) => i > 0 && resting.get(restingFrame(step)) === resting.get(restingFrame(v.trace.steps[i - 1]!)),
    );
    assert.deepEqual(
      still.map((s) => s.step),
      [],
      `Each step must change the picture; these end exactly as the step before ${where}`,
    );
    assert.deepEqual(
      [...new Set(collisions)],
      [],
      `Resting frames have colliding or cut-off text ${where}`,
    );
    const staticSmall = [...staticLabels.values()].filter((label) => label.px < MIN_PX);
    assert.deepEqual(
      staticSmall,
      [],
      `Imported labels need a readable completed-step view at 1280px ${where}: ${JSON.stringify(staticSmall)}`,
    );
    const small = [...labels].filter(([, px]) => px < MIN_PX);
    assert.deepEqual(small, [], `Labels never reach ${MIN_PX}px at 1280px stage ${where}: ${JSON.stringify(small)}`);
    const contents = `import * as author from ${JSON.stringify(project.file)};import{bindSnapshots,withSettings}from ${JSON.stringify(join(ROOT, 'explain/index.ts'))};import{Scene,NullSink,toSvgString}from ${JSON.stringify(join(ROOT, 'src/index.ts'))};const Source=author[${JSON.stringify(project.exportName)}];export async function run(){const C=withSettings(bindSnapshots(Source,${JSON.stringify(project.store)}),${JSON.stringify(v.values)});const s=await new C(new NullSink(),{skipUntil:Infinity}).run();return{steps:s.steps.map(s=>s.name),state:s.describe(),svg:toSvgString(s)}}`;
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
    const bare = `The bare runtime (no DOM, no Node) disagrees with the trace ${where}`;
    assert.deepEqual(JSON.parse(JSON.stringify(result.steps)), v.trace.steps.map((s) => s.step), bare);
    assert.deepEqual(JSON.parse(JSON.stringify(result.state)), v.trace.steps.at(-1)!.after, bare);
    assert.ok(result.svg.includes('<path'), bare);
    variants.push({
      settings: v.values,
      trace: v.trace,
      steps: v.trace.steps.length,
      frames: motion.frames.length,
      seekFrames: frames.size,
      motionEvents: events.length,
      labels: labels.size,
      completedStepLabels: staticLabels.size,
      // What a reader sees before zooming: the same labels on a 390 px phone.
      legibility: legibilityReport([...labels.values(), ...[...staticLabels.values()].map((l) => l.px)]),
      // Each step's resting frame as text, so an author can read it without a browser.
      restingFrames: Object.fromEntries(v.trace.steps.map((step) => [step.step, restingText.get(restingFrame(step)) ?? ''])),
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
