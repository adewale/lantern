import { Scene } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import type { Box } from '../../../src/index.ts';
import { reduceSession, sessionAttempt } from '../lib/models.ts';
const SOURCE =
  'stateDiagram-v2\n direction LR\n idle --> connecting: CONNECT\n connecting --> open: OPENED\n connecting --> closed: ERROR\n open --> closed: CLOSE';
// The reducer in scenes/explainers/lib/models.ts, as the reader sees it.
const REDUCER = [
  'const next = {',
  "  'idle:CONNECT':      'connecting',",
  "  'connecting:OPENED': 'open',",
  "  'connecting:ERROR':  'closed',",
  "  'open:CLOSE':        'closed',",
  '};',
  'function reduceSession(state, event) {',
  '  const result = next[`${state}:${event}`];',
  '  if (!result) throw new InvalidTransition();',
  '  return result;',
  '}',
];
const LINE: Record<string, number> = { CONNECT: 1, OPENED: 2, ERROR: 3, CLOSE: 4 };
const DIAGRAM: Box = [-7.55, 0.2, 7.55, 3.25],
  CODE: Box = [-7.55, -4.25, 2.05, -0.05],
  CARD: Box = [2.35, -4.25, 7.55, -0.05];
export default class StateMachineExplainer extends Scene {
  static meta = {
    id: 'state-machine',
    title: 'One transition table drives both session histories',
    sources: ['https://github.com/ivarvong/lantern/blob/2c7bad5/scenes/state-machine.ts'],
  };
  static settings = [
    {
      id: 'events',
      label: 'Session history',
      default: 'success',
      options: [
        { value: 'success', label: 'Connect then close' },
        { value: 'failure', label: 'Connection fails' },
      ],
    },
  ];
  override async construct() {
    const which = settingsOf(this).events,
      s = stage(this, { palette: palette('dracula') });
    await this.step('machine', {
      title: 'Four reducer rows, one per arrow',
      caption:
        'A session starts idle. Each arrow in the diagram is one row of the table named next in reducer.js, and reduceSession throws for any state and event pair without a row.',
    });
    const d = await s.show({ source: SOURCE, style: 'dracula' }, { box: DIAGRAM });
    const code = await s.code(REDUCER, { at: CODE, fontSize: 0.195 });
    let state = 'idle';
    const card = await s.card(
      [
        ['State', state],
        ['Event', '–'],
        ['Returns', '–'],
      ],
      { at: CARD, fontSize: 0.28, width: 4.8 },
    );
    await d.mark([state]);
    await code.focus([1, 4]);
    this.state.session = state;
    const events = which === 'success' ? ['CONNECT', 'OPENED', 'CLOSE'] : ['CONNECT', 'ERROR'];
    for (const event of events) {
      const next = reduceSession(state, event);
      await this.step(event.toLowerCase(), {
        title: `${event}: ${state} → ${next}`,
        caption: `The session is ${state} and ${event} arrives. The reducer finds the row ${state}:${event} and returns ${next}.`,
      });
      await card.set({ Event: event, Returns: '…' });
      await code.focus(LINE[event]!);
      await d.unmark([state]);
      await d.walk([[state, next]], { trail: true });
      await d.mark([next]);
      await card.set({ State: next, Returns: next });
      await card.mark('State');
      state = next;
      this.state.session = state;
      this.state.event = event;
    }
    await this.step('terminal', {
      title: 'Closed has no row, so OPENED throws',
      caption:
        'No row starts at closed. A late OPENED finds no closed:OPENED entry, so reduceSession throws InvalidTransition, which the card shows under Returns.',
    });
    const invalid = sessionAttempt(state, 'OPENED');
    this.state.invalid = invalid;
    await card.set({ Event: 'OPENED', Returns: invalid.error ?? invalid.state });
    await card.mark('Returns');
    await code.focus([7, 8]);
    this.state.terminal = true;
  }
}
