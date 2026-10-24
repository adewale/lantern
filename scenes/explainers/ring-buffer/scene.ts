import { Scene, Circle, Text, Group, FadeIn, Transform, Indicate } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { ringStory } from '../lib/models.ts';
export default class RingBufferExplainer extends Scene {
  static meta = {
    id: 'ring-buffer',
    title: 'A full ring and a wrapped tail are different things',
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
      s = stage(this, { palette: palette('dusk'), title: 'Five slots. Two cursors. One count.' });
    await this.step('slots', {
      title: 'Read a ring clockwise',
      caption:
        'The head marks the next value to pop. The tail marks the next slot to write. A separate count distinguishes empty from full when both cursors coincide.',
    });
    const slots: Group[] = [],
      labels: Text[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI / 2 - (i * 2 * Math.PI) / 5,
        at: [number, number] = [Math.cos(angle) * 2.4, Math.sin(angle) * 2.4 - 0.15];
      const value = new Text('·', { fontSize: 0.4, color: s.palette.ink }).moveTo(at);
      labels.push(value);
      const slot = new Group(
        new Circle({
          radius: 0.62,
          fill: s.palette.paper,
          stroke: s.palette.accent,
          strokeWidth: 0.025,
        }).moveTo(at),
        value,
        new Text(String(i), { fontSize: 0.18, font: 'mono', color: s.palette.muted }).moveTo([
          at[0],
          at[1] + 0.85,
        ]),
      );
      slots.push(slot);
    }
    await this.play(...slots.map((m) => new FadeIn(m)));
    const readout = new Text('head 0 · tail 0 · count 0', {
      fontSize: 0.27,
      font: 'mono',
      color: s.palette.ink,
    }).moveTo([0, -3.65]);
    await this.play(new FadeIn(readout));
    const groups =
      which === 'wrap'
        ? [events.slice(0, 5), events.slice(5, 6), events.slice(6)]
        : [events.slice(0, 5), events.slice(5, 6), events.slice(6)];
    for (let g = 0; g < groups.length; g++) {
      await this.step(['fill', 'next', 'result'][g]!, {
        title:
          g === 0
            ? 'Fill all five slots'
            : which === 'wrap'
              ? g === 1
                ? 'Pop two values'
                : 'The tail wraps into freed slots'
              : g === 1
                ? 'The sixth push is Full'
                : 'A rejected push writes nothing',
        caption:
          g === 0
            ? 'Each push writes the current tail, advances it modulo five and increments the count. After five writes the tail returns to zero.'
            : which === 'wrap'
              ? g === 1
                ? 'Two pops free the first two slots. The head advances, but the tail is still zero: the ring has space at the beginning.'
                : 'The next pushes use slots zero and one. No values are shifted. Wrapping is just modulo arithmetic applied to the next write index.'
              : 'The model checks capacity before writing or advancing either cursor. Full is computed before any animation, so an animation stop signal cannot be swallowed as a model error.',
      });
      for (const event of groups[g]!) {
        const state = event.result;
        await this.play(
          ...labels.map(
            (label, i) =>
              new Transform(
                label,
                new Text(state.data[i] == null ? '·' : String(state.data[i]), {
                  fontSize: 0.4,
                  color: s.palette.ink,
                }).moveTo(label),
              ),
          ),
          new Transform(
            readout,
            new Text(
              `head ${state.head} · tail ${state.tail} · count ${state.length}${event.error ? ' · Full' : ''}`,
              { fontSize: 0.27, font: 'mono', color: s.palette.ink },
            ).moveTo(readout),
          ),
          { runTime: 0.35 },
        );
        this.state = { ...state, operation: event.operation, error: event.error ?? null };
      }
    }
  }
}
