import { Scene, Circle, Text, Group, Arrow, FadeIn, FadeOut, Transform } from '../../../src/index.ts';
import type { Vec, Mobject } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
import { ringStory } from '../lib/models.ts';

type Snapshot = ReturnType<typeof ringStory>[number]['result'];
const SLOTS = 5,
  C: Vec = [-4.15, -0.45],
  R = 2.05,
  SLOT = 0.56;
const TAIL = '#7fc8b8';
// RingBuffer from scenes/explainers/lib/models.ts, without the `this.`s.
const CODE = [
  'push(v) {',
  '  if (length === capacity) throw new Full();',
  '  data[tail] = v;',
  '  tail = (tail + 1) % capacity;',
  '  length++;',
  '}',
  'pop() {',
  "  if (length === 0) throw new Error('Empty');",
  '  const v = data[head];',
  '  data[head] = null;',
  '  head = (head + 1) % capacity;',
  '  length--;',
  '  return v;',
  '}',
];
const angle = (i: number) => Math.PI / 2 - (i * 2 * Math.PI) / SLOTS;
const polar = (a: number, r: number): Vec => [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];

export default class RingBufferExplainer extends Scene {
  static meta = {
    id: 'ring-buffer',
    title: 'A ring buffer reuses freed slots and refuses a push when full',
    sources: ['https://github.com/ivarvong/lantern/blob/2c7bad5/scenes/ring-buffer.doc.json'],
  };
  static settings = [
    {
      id: 'operations',
      label: 'Operations',
      default: 'wrap',
      options: [
        { value: 'wrap', label: 'Push 5, pop 2, push 2' },
        { value: 'full', label: 'Push 7 into five slots' },
      ],
    },
  ];
  override async construct() {
    const which = settingsOf(this).operations!,
      events = ringStory(which),
      s = stage(this, { style: 'dusk' }),
      ink = s.palette.ink,
      soft = s.soft,
      head = s.emphasis;

    // Native pieces of the ring, rebuilt from a model snapshot.
    const slotCircle = (filled: boolean, fresh = false) =>
      new Circle({
        radius: SLOT,
        fill: filled ? ink : s.palette.paper,
        fillOpacity: filled ? 0.13 : 1,
        stroke: fresh ? TAIL : filled ? ink : soft,
        strokeWidth: fresh ? 0.05 : filled ? 0.035 : 0.025,
        ...(filled ? {} : { dashArray: '0.09 0.07' }),
      });
    const valueText = (v: number) => new Text(String(v), { fontSize: 0.44, color: ink });
    const pointer = (name: 'head' | 'tail', i: number) => {
      const a = angle(i) + (name === 'head' ? 0.22 : -0.22),
        color = name === 'head' ? head : TAIL;
      const start = polar(a, R + 1.12),
        slot = polar(angle(i), R),
        dir = [start[0] - slot[0], start[1] - slot[1]],
        len = Math.hypot(dir[0]!, dir[1]!),
        end: Vec = [slot[0] + (dir[0]! / len) * (SLOT + 0.07), slot[1] + (dir[1]! / len) * (SLOT + 0.07)];
      const label = new Text(name, { fontSize: 0.24, font: 'mono', color, weight: 'bold' }).moveTo(
        polar(a + (name === 'head' ? 0.06 : -0.06), R + 1.42),
      );
      return new Group(new Arrow(start, end, { stroke: color, strokeWidth: 0.035, tipLength: 0.16, tipWidth: 0.14 }), label);
    };
    const countText = (n: number) =>
      new Text(`count ${n} / ${SLOTS}`, { fontSize: 0.3, font: 'mono', color: ink }).moveTo(C);

    await this.step('slots', {
      title: 'Two cursors and a count on five slots',
      caption:
        'Head is the next value to pop; tail is the next slot to write. Both start at slot 0 and meet again when the ring is full, so count is what tells empty from full.',
    });
    let now: Snapshot = { head: 0, tail: 0, length: 0, data: Array(SLOTS).fill(null) };
    const circles = Array.from({ length: SLOTS }, (_, i) => slotCircle(false).moveTo(polar(angle(i), R)));
    const values: (Text | null)[] = Array(SLOTS).fill(null);
    const indices = Array.from({ length: SLOTS }, (_, i) =>
      new Text(String(i), { fontSize: 0.2, font: 'mono', color: soft }).moveTo(polar(angle(i), R - 0.86)),
    );
    let headPtr = pointer('head', 0),
      tailPtr = pointer('tail', 0),
      count = countText(0);
    await this.play(...circles.map((c) => new FadeIn(c)), ...indices.map((t) => new FadeIn(t)));
    await this.play(new FadeIn(headPtr), new FadeIn(tailPtr), new FadeIn(count));
    // The ring already shows head, tail and count; the code beside it is the only panel.
    const code = await s.code(CODE, { at: regionBox('full', { left: -0.25 }), fontSize: 0.22 });

    /** Animate the ring from `now` to `next`: slot values, cursors and count. */
    const show = async (next: Snapshot, runTime = 0.45, fresh = false): Promise<void> => {
      const anims = [];
      for (let i = 0; i < SLOTS; i++) {
        if (now.data[i] === next.data[i]) continue;
        const filled = next.data[i] != null;
        anims.push(new Transform(circles[i]!, slotCircle(filled, fresh && filled).moveTo(polar(angle(i), R)), { runTime }));
        if (values[i]) anims.push(new FadeOut(values[i]!, { runTime, shift: [0, -0.1] }));
        values[i] = filled ? valueText(next.data[i]!).moveTo(polar(angle(i), R)) : null;
        if (values[i]) anims.push(new FadeIn(values[i]!, { runTime, shift: [0, -0.1] }));
      }
      if (next.head !== now.head) {
        const p = pointer('head', next.head);
        anims.push(new Transform(headPtr, p, { runTime }));
      }
      if (next.tail !== now.tail) anims.push(new Transform(tailPtr, pointer('tail', next.tail), { runTime }));
      if (next.length !== now.length) {
        const c = countText(next.length);
        anims.push(new FadeOut(count, { runTime }), new FadeIn(c, { runTime }));
        count = c;
      }
      if (anims.length) await this.play(...anims);
      now = next;
    };
    // A row of tokens under the ring: values that left (pop) or never got in (Full).
    const tray: Mobject[] = [];
    let trayX = -5;
    const trayLabel = async (text: string) => {
      const t = new Text(text, { fontSize: 0.24, color: soft, anchor: 'start' }).moveTo([-7.35, -3.85], [-1, 0]);
      tray.push(t);
      trayX = t.box()![2] + 0.55;
      await this.play(new FadeIn(t));
    };
    const token = (v: number, refused: boolean) => {
      const color = refused ? s.bad : soft;
      const ring = new Circle({
        radius: 0.32,
        fill: s.palette.paper,
        stroke: color,
        strokeWidth: 0.03,
        ...(refused ? { dashArray: '0.08 0.06' } : {}),
      });
      const g = new Group(
        ring,
        new Text(String(v), { fontSize: 0.28, color: refused ? s.bad : ink }).moveTo(ring.center()),
      );
      return g;
    };
    const trayAt = (k: number): Vec => [trayX + k * 0.95, -3.85];

    const groups = [events.slice(0, 5), events.slice(5, 6), events.slice(6)];
    let refused = 0,
      marker: Circle | null = null;
    for (let g = 0; g < groups.length; g++) {
      await this.step(['fill', 'next', 'result'][g]!, {
        title:
          g === 0
            ? 'Five pushes fill the ring'
            : which === 'wrap'
              ? g === 1
                ? 'Two pops free slots 0 and 1'
                : 'The tail wraps into freed slots'
              : g === 1
                ? 'push 6 throws Full before changing anything'
                : 'push 7 is refused and the ring is unchanged',
        caption:
          g === 0
            ? 'Each push writes at tail, moves tail on modulo five and adds one to count. After five, tail is back at 0 and count is 5.'
            : which === 'wrap'
              ? g === 1
                ? 'Each pop takes the value at head, clears the slot and moves head on. Tail stays at 0, so the next push goes into slot 0, the first slot a pop freed.'
                : 'Tail wrapped to 0 after the fifth push, so pushes 6 and 7 land in slots 0 and 1 and no stored value moves. Count is back to 5, with head and tail both at 2.'
              : g === 1
                ? 'push checks length === capacity on its first line, so with count 5 it throws Full before writing a slot or moving either cursor.'
                : 'push 7 is refused the same way and joins 6 in the refused tray. The ring still holds 1 to 5, with head, tail and count unchanged at 0, 0 and 5.',
      });
      for (const event of groups[g]!) {
        const r = event.result;
        if (event.error) {
          await code.focus(1);
          const t = token(Number(event.operation.split(' ')[1]), false).moveTo([-0.9, 1.9]);
          await this.play(new FadeIn(t, { runTime: 0.25 }));
          const slot = polar(angle(r.tail), R + SLOT + 0.35);
          await this.play(t.animate.moveTo(slot), { runTime: 0.45 });
          if (!marker) {
            marker = new Circle({ radius: SLOT + 0.12, fill: 'none', stroke: s.bad, strokeWidth: 0.04 }).moveTo(
              polar(angle(r.tail), R),
            );
            await this.play(new FadeIn(marker, { runTime: 0.3 }));
            await trayLabel('refused, Full:');
          }
          // Placed after the tray label exists, so it lines up after the label.
          const bad = token(Number(event.operation.split(' ')[1]), true).moveTo(trayAt(refused));
          await this.play(new Transform(t, bad, { runTime: 0.5 }));
          refused++;
        } else if (event.operation.startsWith('pop')) {
          await code.focus([8, 12]);
          const gone = now.data.flatMap((v, i) => (v != null && r.data[i] == null ? [i] : [])),
            popped = gone.map((i) => now.data[i]!);
          await trayLabel('popped:');
          const out = gone.map((i, k) => {
            const t = token(popped[k]!, false).moveTo(polar(angle(i), R));
            return { t, to: trayAt(k) };
          });
          await this.play(...out.map(({ t }) => new FadeIn(t, { runTime: 0.2 })));
          await show(r);
          await this.play(...out.map(({ t, to }) => t.animate.moveTo(to)), { runTime: 0.5 });
        } else {
          await code.focus([2, 4]);
          // Slots written after the first fill keep a tail-coloured ring.
          await show(r, 0.35, g > 0);
        }
        this.state = { ...r, operation: event.operation, error: event.error ?? null };
      }
    }
  }
}
