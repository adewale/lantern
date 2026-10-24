import { Scene, CodePanel, FadeIn, FadeOut } from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { reduceSession, sessionAttempt } from '../lib/models.ts';
const SOURCE =
  'stateDiagram-v2\n direction LR\n idle --> connecting: CONNECT\n connecting --> open: OPENED\n connecting --> closed: ERROR\n open --> closed: CLOSE';
export default class StateMachineExplainer extends Scene {
  static meta = {
    id: 'state-machine',
    title: 'One reducer, two session histories',
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
      s = stage(this, { palette: palette('dracula'), title: 'A state machine is a program you can follow' });
    await this.step('machine', {
      title: 'The possible transitions',
      caption:
        'A session can connect, open and close. A failed connection closes directly. The same reducer defines both histories.',
    });
    const d = await s.show({ source: SOURCE, style: 'dracula' }, { box: [-7, 0, 7, 3] });
    const code = new CodePanel(
      [
        'idle + CONNECT → connecting',
        'connecting + OPENED → open',
        'connecting + ERROR → closed',
        'open + CLOSE → closed',
      ],
      { at: [0, -1.75], fontSize: 0.25 },
    );
    await this.play(new FadeIn(code));
    let state = 'idle';
    this.state.session = state;
    const events = which === 'success' ? ['CONNECT', 'OPENED', 'CLOSE'] : ['CONNECT', 'ERROR'];
    for (const event of events) {
      const next = reduceSession(state, event);
      await this.step(event.toLowerCase(), {
        title: `${event}: ${state} → ${next}`,
        caption: `The reducer receives ${event} while the session is ${state}. It returns ${next}. The token follows that exact transition, not a hand-written animation path.`,
      });
      const line = event === 'CONNECT' ? 0 : event === 'OPENED' ? 1 : event === 'ERROR' ? 2 : 3;
      await this.play(code.focus(line, s.palette.accent));
      await d.walk([[state, next]]);
      state = next;
      this.state.session = state;
      this.state.event = event;
    }
    await this.step('terminal', {
      title: 'Closed is terminal',
      caption:
        'No outgoing transition exists from closed. An OPENED event here is rejected by the reducer. A plausible-looking arrow would be a lie.',
    });
    const invalid = sessionAttempt(state, 'OPENED');
    this.state.invalid = invalid;
    await this.play(new FadeOut(code));
    await s.card(
      [
        ['State', state],
        ['Next OPENED event', invalid.error ?? invalid.state],
      ],
      { at: [0, -1.75] },
    );
    this.state.terminal = true;
  }
}
