// Served-story evidence: Node declares the expected objects; native SVG geometry
// establishes which of their actual painted paths the reader can see.
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { renderElements, VMobject } from '../../src/index.ts';
import type { SceneClass, Mobject, ElementRecord } from '../../src/index.ts';
import { emphasisOf } from '../../explain/look.ts';
import { labelOf } from '../../explain/diagrams.ts';
import { isHeading } from '../../explain/stage.ts';
import { stepWords } from '../../explain/trace.ts';
import type { Project } from './explain-project.ts';
import { join } from 'node:path';

export interface StoryClaim {
  step: string;
  settings?: Record<string, string>;
  opening?: boolean;
  targets: readonly ({ key: string } | { text: string })[];
}
// These expectations are written from the captions, independently of the
// close-up planner. Automatic helper-emphasis checks below cover every step.
export const STORY_CLAIMS: Readonly<Record<string, readonly StoryClaim[]>> = {
  'oauth-pkce': [
    {
      step: 'attack',
      settings: { attacker: 'yes' },
      opening: true,
      targets: [{ key: 'message:S->X#0' }, { key: 'message:X->S#0' }, { key: 'message:S->X#1' }],
    },
    {
      step: 'secret',
      targets: [{ key: 'V' }, { key: 'H' }, { key: 'C' }, { text: 'code_verifier' }, { text: 'code_challenge' }],
    },
    { step: 'authorize', targets: [{ key: 'message:C->S#0' }, { text: 'challenge + S256; verifier not sent' }] },
    { step: 'exchange', targets: [{ key: 'message:C->S#1' }, { key: 'message:S->C#1' }] },
  ],
  lantern: [{ step: 'objects', targets: [{ text: 'owns' }, { text: 'plays' }, { text: 'emits' }] }],
  'mr-cache': ['after', 'request'].map((step) => ({ step, targets: [{ text: 'hit' }, { text: 'miss' }] })),
  'token-bucket': [
    { step: 'balance', targets: [{ text: 'bucket' }, { text: 'Tokens left' }] },
    { step: 'trace', targets: [{ text: '1 / s' }, { text: '2 / s' }, { text: '4 / s' }] },
  ],
  'wcag-map': ['AA', 'AAA'].map((level) => ({
    step: 'focus-visible',
    settings: { level, guideline: '2.4' },
    opening: true,
    targets: [{ key: 'c2_4_7' }],
  })),
};
interface Target {
  name: string;
  indices: number[];
  opening: boolean;
  camera?: boolean;
}
export interface StoryFrame {
  records: ElementRecord[];
  targets: Target[];
  camera: number[];
}

export async function storyFrames(
  Source: SceneClass,
  claims: readonly StoryClaim[] = [],
): Promise<Map<string, StoryFrame>> {
  const frames = new Map<string, StoryFrame>();
  let previous = new Map<Mobject, string>();
  let previousPaint = new Map<number, string>();
  await new Source(
    {
      async frame() {},
      async stepEnd(scene, step) {
        const records = renderElements(scene, { relative: false });
        const members = [...new Set(scene.familyMembers())];
        const byId = new Map(members.map((m) => [m.id, m]));
        const realInk = (r: ElementRecord) => {
          if (!r.attrs.d || Number(r.attrs.opacity ?? 1) <= 0.01) return false;
          if (
            r.attrs.stroke !== 'none' &&
            Number(r.attrs['stroke-width'] ?? 0) > 0 &&
            Number(r.attrs['stroke-opacity'] ?? 1) > 0
          )
            return true;
          if (r.attrs.fill === 'none' || Number(r.attrs['fill-opacity'] ?? 1) === 0) return false;
          const m = byId.get(r.id),
            b = m?.box();
          if (!b || b[2] <= b[0] || b[3] <= b[1]) return false;
          // SVG closes open paths for fill. A straight carrier with its stroke
          // disabled has zero filled area; a curved open fill may still paint.
          if (m instanceof VMobject && !m.closed.some(Boolean)) {
            const points = m.subpaths.flatMap((p) =>
              Array.from({ length: p.length / 2 }, (_, i) => [p[2 * i]!, p[2 * i + 1]!]),
            );
            const a = points[0],
              z = points.find((p) => a && (p[0] !== a[0] || p[1] !== a[1]));
            if (
              !a ||
              !z ||
              points.every((p) => (p[0]! - a[0]!) * (z[1]! - a[1]!) - (p[1]! - a[1]!) * (z[0]! - a[0]!) === 0)
            )
              return false;
          }
          return true;
        };
        const now = emphasisOf(scene),
          targets: Target[] = [];
        const add = (name: string, objects: Mobject[], opening: boolean, context = false) => {
          assert.ok(objects.length, `${step.name}: story target ${name} is missing`);
          // A surviving half-word cannot stand in for the complete named label.
          // renderElements legitimately drops invisible/clipped leaves, so inspect
          // the logical glyphs before accepting only the surviving records.
          for (const object of objects)
            for (const label of object.family().filter((m) => labelOf(m)?.text.trim()))
              for (const glyph of label.family().filter((m): m is VMobject => m instanceof VMobject && m.hasPoints())) {
                assert.ok(
                  glyph.style.opacity > 0.01 &&
                    (glyph.style.drawFraction ?? 1) >= 0.95 &&
                    ((glyph.style.fill !== 'none' && glyph.style.fillOpacity > 0) ||
                      (glyph.style.stroke !== 'none' && glyph.style.strokeWidth > 0 && glyph.style.strokeOpacity > 0)),
                  `${step.name}: ${name} has missing glyph ink`,
                );
                const b = glyph.box()!;
                for (let a: Mobject | null = glyph; a; a = a.parent)
                  if (a.clipBox && !context)
                    assert.ok(
                      b[0] >= a.clipBox[0] - 0.001 &&
                        b[1] >= a.clipBox[1] - 0.001 &&
                        b[2] <= a.clipBox[2] + 0.001 &&
                        b[3] <= a.clipBox[3] + 0.001,
                      `${step.name}: ${name} has clipped glyph ink`,
                    );
              }
          const ids = new Set(objects.flatMap((m) => m.family().map((f) => f.id)));
          const geometry = new Set(records.filter((r) => ids.has(r.id)).map((r) => r.attrs.d));
          // Marks/trails can replace a carrier with a separately painted copy.
          // Bind that actual ink too, rather than crediting the invisible carrier.
          const indices = records.flatMap((r, i) =>
            (ids.has(r.id) || geometry.has(r.attrs.d)) && realInk(r) ? [i] : [],
          );
          assert.ok(indices.length, `${step.name}: story target ${name} has no painted paths`);
          targets.push({ name, indices, opening, ...(context ? { camera: true } : {}) });
        };
        for (const [m, what] of now)
          if (previous.get(m) !== what) {
            assert.ok(members.includes(m), `${step.name}: newly emphasised ${m.key ?? what} is absent from the stage`);
            add(`emphasis: ${m.key ?? what}`, [m], false);
          }
        previous = now;
        const paint = new Map(records.map((r) => [r.id, JSON.stringify([r.attrs, r.transform])]));
        const added = new Set<Mobject>();
        for (const r of records) {
          if (previousPaint.get(r.id) === paint.get(r.id) || Number(r.attrs.opacity ?? 1) < 0.95) continue;
          const m = byId.get(r.id);
          if (!m) continue;
          let fixed = false,
            subject = m;
          for (let a: Mobject | null = m; a; a = a.parent) {
            if (a.key === '__paper' || isHeading(a)) fixed = true;
            if (labelOf(a)) subject = a;
          }
          if (fixed || added.has(subject)) continue;
          // Invisible route helpers are not narrative artwork.
          if (!realInk(r)) continue;
          add(`changed: ${labelOf(subject)?.text ?? subject.key ?? 'drawing'}`, [subject], false, true);
          added.add(subject);
        }
        previousPaint = paint;
        for (const claim of claims.filter((c) => c.step === step.name))
          for (const target of claim.targets) {
            const name = 'key' in target ? target.key : target.text;
            add(
              name,
              members.filter((m) => ('key' in target ? m.key === target.key : labelOf(m)?.text === target.text)),
              !!claim.opening,
            );
          }
        assert.ok(targets.length, `${step.name}: unchanged artwork needs a declared story subject`);
        frames.set(step.name, { records, targets, camera: [...scene.frame.box()!] });
      },
    },
    { skipUntil: Infinity },
  ).run();
  for (const c of claims) assert.ok(frames.has(c.step), `story claim names missing step ${c.step}`);
  return frames;
}

type Rect = [number, number, number, number];
/** Whether actual viewport rectangles cover a target; supports targets spanning several views. */
export function covered(target: Rect, views: readonly Rect[]): boolean {
  let left = [target];
  for (const v of views)
    left = left.flatMap((r): Rect[] => {
      const x = Math.max(r[0], v[0]),
        y = Math.max(r[1], v[1]),
        right = Math.min(r[2], v[2]),
        bottom = Math.min(r[3], v[3]);
      if (right <= x || bottom <= y) return [r];
      return [
        [r[0], r[1], x, r[3]],
        [right, r[1], r[2], r[3]],
        [x, r[1], right, y],
        [x, bottom, right, r[3]],
      ].filter((b) => b[2]! > b[0]! && b[3]! > b[1]!) as Rect[];
    });
  return left.length === 0;
}

/** Inspect actual DOM paths, rather than projecting an expected box over potentially absent artwork. */
export async function inspectStoryFrame(page: Page, frame: StoryFrame) {
  return page.locator('.stage svg:not(.leaving)').evaluate((node, expected) => {
    const svg = node as SVGSVGElement,
      stage = svg.parentElement!.getBoundingClientRect();
    const elements = [...svg.children].filter((e) => e.tagName.toLowerCase() !== 'defs') as SVGGraphicsElement[];
    if (elements.length !== expected.records.length)
      throw new Error(`painted record count: ${elements.length}, expected ${expected.records.length}`);
    for (const [i, r] of expected.records.entries()) {
      const e = elements[i]!;
      if (
        e.tagName.toLowerCase() !== r.tag ||
        Object.entries(r.attrs).some(([k, v]) => e.getAttribute(k) !== v) ||
        (e.getAttribute('transform') ?? null) !== r.transform
      )
        throw new Error(`painted record ${i} differs from the resting scene`);
    }
    const rect = (r: DOMRect): [number, number, number, number] => [r.left, r.top, r.right, r.bottom];
    const camera = expected.camera;
    const author: [number, number, number, number] = [
      camera[0]! * 1000,
      -camera[3]! * 1000,
      camera[2]! * 1000,
      -camera[1]! * 1000,
    ];
    const points = (b: number[], matrix: DOMMatrix) => [
      new DOMPoint(b[0], b[1]).matrixTransform(matrix),
      new DOMPoint(b[2], b[3]).matrixTransform(matrix),
    ];
    // Match the existing PKCE screen-space contract: one CSS pixel for
    // antialias/stroke-edge rounding. Rectangle union itself remains exact.
    const viewportPoints = points(
      [stage.left - 1, stage.top - 1, stage.right + 1, stage.bottom + 1],
      svg.getScreenCTM()!.inverse(),
    );
    const viewport: [number, number, number, number] = [
      viewportPoints[0]!.x,
      viewportPoints[0]!.y,
      viewportPoints[1]!.x,
      viewportPoints[1]!.y,
    ];
    const ink = [...new Set(expected.targets.flatMap((t) => t.indices))].map((index) => {
      const e = elements[index]!,
        b = e.getBBox(),
        matrix = svg.getScreenCTM()!.inverse().multiply(e.getScreenCTM()!);
      const paint = getComputedStyle(e),
        half = paint.stroke !== 'none' && Number(paint.strokeOpacity) > 0 ? parseFloat(paint.strokeWidth) / 2 : 0;
      let box = [b.x - half, b.y - half, b.x + b.width + half, b.y + b.height + half];
      const p = points(box, matrix);
      box = [p[0]!.x, p[0]!.y, p[1]!.x, p[1]!.y];
      const alphaZero = (p: string) =>
        p === 'none' ||
        p === 'transparent' ||
        /\/\s*0(?:\.0+)?\s*\)$/.test(p) ||
        /^(?:rgba|hsla)\([^,]*,[^,]*,[^,]*,\s*0(?:\.0+)?\s*\)$/.test(p);
      let visible =
        (!alphaZero(paint.fill) && Number(paint.fillOpacity) > 0) ||
        (!alphaZero(paint.stroke) && Number(paint.strokeOpacity) > 0 && parseFloat(paint.strokeWidth) > 0);
      let opacity = 1;
      for (let a: Element | null = e; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        opacity *= Number(s.opacity);
        if (s.display === 'none' || s.visibility !== 'visible') visible = false;
        if (s.clipPath !== 'none') {
          const declared = /^url\(#([^)]*)\)$/.exec(e.getAttribute('clip-path') ?? '')?.[1];
          const effective = /^url\(["']?([^"')]+)["']?\)$/.exec(s.clipPath)?.[1]?.split('#').at(-1);
          if (a !== e || !declared || effective !== declared) visible = false;
        }
      }
      visible &&= opacity > 0.01;
      // A target clipped by its own viewport must not earn coverage for the missing ink.
      const clip = e.getAttribute('clip-path');
      let complete = true,
        shown = [...box];
      if (clip) {
        const id = /^url\(#([^)]*)\)$/.exec(clip)?.[1];
        const definition = id ? svg.querySelector(`[id="${id}"]`) : null;
        const r = definition?.firstElementChild as SVGGraphicsElement | null;
        if (!definition || !r) throw new Error(`unresolved target clip ${clip}`);
        // The renderer emits one rectangular user-space clip. Other shapes,
        // units or transforms cannot be credited using an axis-aligned rect.
        const rectangular =
          definition.tagName.toLowerCase() === 'clippath' &&
          definition.children.length === 1 &&
          r.tagName.toLowerCase() === 'rect' &&
          definition.getAttribute('clipPathUnits') === 'userSpaceOnUse' &&
          [definition, r].every((n) => !n.hasAttribute('transform') && getComputedStyle(n).transform === 'none') &&
          Number(r.getAttribute('rx') ?? 0) === 0 &&
          Number(r.getAttribute('ry') ?? 0) === 0;
        if (!rectangular) visible = false;
        // Native geometry also observes CSS x/y/width/height overrides.
        const bounds = r.getBBox();
        const c = [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height];
        complete = box[0]! >= c[0]! - 1 && box[1]! >= c[1]! - 1 && box[2]! <= c[2]! + 1 && box[3]! <= c[3]! + 1;
        shown = [
          Math.max(box[0]!, c[0]!),
          Math.max(box[1]!, c[1]!),
          Math.min(box[2]!, c[2]!),
          Math.min(box[3]!, c[3]!),
        ];
      }
      // One SVG unit is 0.001 scene units: accommodate path formatting at its
      // declared precision, not a percentage of an arbitrarily cropped target.
      const epsilon = Math.min(1, (box[2]! - box[0]!) / 4, (box[3]! - box[1]!) / 4);
      return {
        index,
        visible,
        complete,
        shown: shown as [number, number, number, number],
        box: [box[0]! + epsilon, box[1]! + epsilon, box[2]! - epsilon, box[3]! - epsilon] as [
          number,
          number,
          number,
          number,
        ],
        author,
      };
    });
    return { viewport, ink, stage: rect(stage), viewBox: svg.getAttribute('viewBox') };
  }, frame);
}

/** Visit every step at a real viewport width, with a fresh reader opening per width. */
const initialized = new WeakSet<Page>();
export async function reviewStoryVariant(
  page: Page,
  url: string,
  variant: Project['variants'][number],
  claims: readonly StoryClaim[] = [],
  directory?: string,
) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (!initialized.has(page)) {
    await page.addInitScript(() => {
      const w = window as unknown as { raynerReviewStep: string | null };
      w.raynerReviewStep = null;
      document.addEventListener('rayner:step', (e) => {
        w.raynerReviewStep = (e as CustomEvent).detail.step;
      });
    });
    initialized.add(page);
  }
  const applicable = claims.filter((c) => Object.entries(c.settings ?? {}).every(([k, v]) => variant.values[k] === v));
  const frames = await storyFrames(variant.Scene, applicable),
    results = [];
  assert.equal(frames.size, variant.trace.steps.length, 'every traced step has a resting frame');
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1180, height: 980 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [index, step] of variant.trace.steps.entries()) {
      const query = new URLSearchParams({ ...variant.values, step: step.step });
      // Start each width as a fresh reader. Then use the real step buttons:
      // Next view preserves automatic following, and each step must reset its
      // tour to the opening. This also exercises retained/restored DOM frames.
      if (index === 0) await page.goto(`${url}?${query}`);
      else
        await page.locator('button[data-step]').evaluateAll((buttons, name) => {
          const button = buttons.find((b) => b.getAttribute('data-step') === name) as HTMLButtonElement | undefined;
          if (!button) throw new Error(`missing step button ${name}`);
          button.click();
        }, step.step);
      await page.waitForSelector('[data-ready=true]');
      await page.waitForFunction(
        (name) =>
          (window as unknown as { raynerReviewStep?: string }).raynerReviewStep === name &&
          document.querySelector('[aria-current=step]')?.getAttribute('data-step') === name &&
          !document.querySelector('#content.loading'),
        step.step,
      );
      await page.locator('.leaving').waitFor({ state: 'detached' });
      await page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );
      assert.equal(await page.evaluate(() => innerWidth), viewport.width, 'review must use the declared viewport');
      assert.equal(await page.locator('.caption').innerText(), stepWords(step).caption);
      assert.ok(await page.locator('.stage path').count(), `${step.step}: no artwork`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${step.step}: page overflows`,
      );
      const frame = frames.get(step.step)!;
      const opening = await inspectStoryFrame(page, frame),
        views = [opening];
      if (directory)
        await page
          .locator('.stage')
          .screenshot({
            path: join(directory, `${encodeURIComponent(step.step)}.${viewport.width}.png`),
            animations: 'disabled',
          });
      const next = page.locator('.view-controls > button').first();
      const visited = new Set([opening.viewBox]);
      if ((await next.isVisible()) && (await next.isEnabled()))
        for (let n = 0; n < frame.records.length + 1; n++) {
          await next.click();
          await page.evaluate(
            () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
          );
          const view = await inspectStoryFrame(page, frame),
            key = view.viewBox;
          if (visited.has(key)) break;
          visited.add(key);
          views.push(view);
          assert.ok(n < frame.records.length, `${step.step}: close-up tour did not terminate`);
        }
      const verified = new Set<string>();
      for (const target of frame.targets)
        for (const index of target.indices) {
          const original = opening.ink.find((p) => p.index === index)!;
          // The obligation comes from the authored frame, never from a possibly
          // damaged live clip. Each stop contributes only its actual shown ink.
          const authoredClip = frame.records[index]!.clipBox;
          const expectedClip: Rect = authoredClip
            ? [authoredClip[0] * 1000, -authoredClip[3] * 1000, authoredClip[2] * 1000, -authoredClip[1] * 1000]
            : (original.author as Rect);
          const box: Rect = target.camera
            ? [
                Math.max(original.box[0], expectedClip[0], original.author[0]),
                Math.max(original.box[1], expectedClip[1], original.author[1]),
                Math.min(original.box[2], expectedClip[2], original.author[2]),
                Math.min(original.box[3], expectedClip[3], original.author[3]),
              ]
            : original.box;
          if (target.camera && (box[2] <= box[0] || box[3] <= box[1])) continue; // context outside an authored viewport is not newly shown ink
          const eligible = (target.opening ? [opening] : views).filter((v) => {
            const ink = v.ink.find((p) => p.index === index);
            return ink?.visible && (target.camera || ink.complete);
          });
          assert.ok(eligible.length, `${step.step}: ${target.name} has hidden or clipped ink`);
          const ink = eligible[0]!.ink.find((p) => p.index === index)!;
          assert.ok(ink.box[2] > ink.box[0] && ink.box[3] > ink.box[1], `${step.step}: ${target.name} has empty ink`);
          const coverage = eligible.map((v) => {
            if (!target.camera) return v.viewport;
            const shown = v.ink.find((p) => p.index === index)!.shown;
            return [
              Math.max(v.viewport[0], shown[0]),
              Math.max(v.viewport[1], shown[1]),
              Math.min(v.viewport[2], shown[2]),
              Math.min(v.viewport[3], shown[3]),
            ] as Rect;
          });
          assert.ok(
            covered(box, coverage),
            `${step.step} at ${viewport.width}px: ${target.name} is missing from ${target.opening ? 'the opening' : 'the close-up tour'}: ${JSON.stringify({ box, views: coverage })}`,
          );
          verified.add(target.name);
        }
      assert.ok(verified.size, `${step.step}: no story subject is painted in a reader view`);
      results.push({ step: step.step, width: viewport.width, views: views.length, targets: [...verified] });
    }
  }
  assert.deepEqual(
    results.map(({ step, width }) => ({ step, width })),
    [390, 1180].flatMap((width) => variant.trace.steps.map((step) => ({ step: step.step, width }))),
    'every traced step must be reviewed exactly once at each width',
  );
  return results;
}
