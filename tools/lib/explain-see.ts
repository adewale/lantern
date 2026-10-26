// One step's resting picture without a browser, for a person or an agent reading a terminal:
// the picture as text (src/ascii.ts), then the step's title, caption, what the picture shows
// in words, and what the step changed in scene.state. Lantern's `npm run see`, for one case.
import { writeFile } from 'node:fs/promises';
import { renderAt, renderText, toSvgString } from '../../src/index.ts';
import type { Scene, Sink } from '../../src/index.ts';
import { caseName } from '../../explain/index.ts';
import { pictureSummary, restingTime } from '../../explain/trace.ts';
import type { Project } from './explain-project.ts';

type Variant = Project['variants'][number];

/** `key: before → after` for each state value the step changed, the picture description aside. */
function changes(before: Record<string, unknown>, after: Record<string, unknown> = {}): string[] {
  return Object.keys({ ...before, ...after })
    .filter((k) => k !== 'picture' && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => `${k}: ${JSON.stringify(before[k]) ?? '—'} → ${JSON.stringify(after[k]) ?? '—'}`);
}

/** The text `explain see` prints for `step` (by name; the last step when omitted), and the resting SVG. */
export async function seeStep(project: Project, v: Variant, step?: string): Promise<{ text: string; svg: string }> {
  const { trace } = v,
    names = trace.steps.map((s) => s.step);
  const s = step == null ? trace.steps.at(-1) : trace.steps.find((x) => x.step === step);
  if (!s) throw new Error(`No step "${step}". Steps: ${names.join(', ')}`);
  const sink: Sink = { async frame() {} };
  const scene: Scene = await renderAt(v.Scene, restingTime(s, trace.fps), sink);
  // The resting picture without the heading that names the step, as `check` draws it.
  const all = scene.mobjects;
  scene.mobjects = all.filter((m) => m.key !== '__heading');
  const drawing = renderText(scene),
    svg = toSvgString(scene);
  scene.mobjects = all;
  const n = names.indexOf(s.step) + 1,
    which = caseName(project.Scene, v.values),
    picture = pictureSummary(s.after),
    changed = changes(s.before, s.after);
  const lines = [
    drawing,
    '',
    `${project.Scene.meta?.id ?? 'scene'} · step ${n} of ${names.length}: ${s.step}${which ? ` · ${which}` : ''}`,
    `Title: ${String(s.meta.title ?? s.step)}`,
    ...(s.meta.caption ? [`Caption: ${String(s.meta.caption)}`] : []),
    ...(picture ? [`Picture: ${picture}`] : []),
    changed.length ? `Changed: ${changed.join('; ')}` : 'Changed: nothing in scene.state',
  ];
  return { text: lines.join('\n'), svg };
}

/** Print the step; with `svgOut`, also write its resting picture as SVG. */
export async function see(project: Project, v: Variant, step: string | undefined, svgOut?: string): Promise<string> {
  const { text, svg } = await seeStep(project, v, step);
  if (svgOut) await writeFile(svgOut, svg);
  return svgOut ? `${text}\nWrote ${svgOut}` : text;
}
