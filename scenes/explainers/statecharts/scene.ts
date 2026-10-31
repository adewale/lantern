import { Scene } from 'rayner';
import { stage, settingsOf, regionBox } from 'rayner/explain';
import type { Diagram } from 'rayner/explain';
import {
  CONTROLS,
  player,
  flatten,
  run,
  chartCounts,
  flatCounts,
} from '../lib/statecharts.ts';
import type { StateNode, FlatMachine, Configuration } from '../lib/statecharts.ts';

// Diagram text at 18 px, so the labels stay readable at the stage's width.
const HEAD = '---\nconfig:\n  state:\n    fontSize: 18\n    compositTitleSize: 18\n    nodeSpacing: 24\n    rankSpacing: 36\n---\n';

/** The chart as Mermaid: nested states inside `state x { }`, parallel regions split by `--`. */
function chartSource(chart: StateNode): string {
  const lines = ['stateDiagram-v2', '  direction LR'];
  const body = (node: StateNode, pad: string) => {
    if (node.type === 'parallel') {
      node.children!.forEach((r, i) => {
        if (i) lines.push(`${pad}--`);
        body(r, pad);
      });
      return;
    }
    lines.push(`${pad}[*] --> ${node.initial}`);
    for (const c of node.children!)
      for (const [event, target] of Object.entries(c.on ?? {})) lines.push(`${pad}${c.id} --> ${target}: ${event}`);
    for (const c of node.children!)
      if (c.type !== 'atomic') {
        lines.push(`${pad}state ${c.id} {`);
        body(c, pad + '  ');
        lines.push(`${pad}}`);
      }
  };
  body(chart, '  ');
  return HEAD + lines.join('\n');
}

/** A flat state's label: the chart states it stands for. */
const label = (name: string) => name.split('_').join(' + ');

/** The flat machine as Mermaid, its POWER arrows back to off listed last. */
function flatSource(flat: FlatMachine): string {
  const lines = ['stateDiagram-v2', '  direction LR'];
  for (const s of flat.states) if (s.includes('_')) lines.push(`  state "${label(s)}" as ${s}`);
  lines.push(`  [*] --> ${flat.initial}`);
  const last = (t: FlatMachine['transitions'][number]) => (t.to === 'off' ? 1 : 0);
  for (const t of [...flat.transitions].sort((a, b) => last(a) - last(b))) lines.push(`  ${t.from} --> ${t.to}: ${t.event}`);
  return HEAD + lines.join('\n');
}

const edge = (from: string, to: string) => `edge:${from}->${to}#0`;

export default class Statecharts extends Scene {
  static meta = {
    id: 'statecharts',
    title: 'What does a statechart add to a state machine?',
    sources: [
      'https://x.com/DavidKPiano/status/2116523008323981315',
      'https://www.state-machine.com/doc/Harel87.pdf',
      'https://www.w3.org/TR/2015/REC-scxml-20150901/',
      'https://www.npmjs.com/package/xstate/v/5.33.3',
    ],
    watch: { active: 'Statechart', flat: 'Flat state' },
  };
  static settings = [
    {
      id: 'controls',
      label: 'Controls besides power',
      default: 'two',
      options: [
        { value: 'two', label: 'Play and mute' },
        { value: 'one', label: 'Play only' },
      ],
    },
  ];

  override async construct() {
    const n = settingsOf(this).controls === 'one' ? 1 : 2;
    const two = n === 2;
    const s = stage(this, { style: 'github-light', headingSize: 0.54 });
    const chart = player(n),
      flat = flatten(chart),
      chartN = chartCounts(chart),
      flatN = flatCounts(flat);
    const combos = flat.states.filter((x) => x !== 'off');
    const controlEvents = CONTROLS.slice(0, n).flatMap((c) => c.events);
    const powerOff = flat.transitions.filter((t) => t.event === 'POWER' && t.to === 'off');
    // Rows the counts card compares: the arrows for the controls, POWER back to off, all transitions, states.
    const flatControl = flat.transitions.filter((t) => controlEvents.includes(t.event)).length;
    const counts = {
      'Control arrows': [flatControl, 2 * n],
      'POWER to off': [powerOff.length, 1],
      Transitions: [flatN.transitions, chartN.transitions],
      States: [flatN.states, chartN.states],
    } as const;
    this.state = { controls: n, flat: 'off', active: ['off'], flatCounts: flatN, chartCounts: chartN };

    // 1. The flat machine: one state per combination, each with its own POWER arrow.
    await this.step('flat', {
      title: two ? 'Every combination needs its own POWER arrow' : 'Two states, two POWER arrows to off',
      line: two
        ? `Four combined states, so ${powerOff.length} marked POWER arrows back to off.`
        : `paused and playing each have a marked arrow back to off.`,
      caption: two
        ? `A flat machine needs a state for each combination of playback and volume, such as playing + muted. POWER must leave every one, so ${powerOff.length} arrows return to off, and each combination carries its own playback and volume arrows: ${flatN.transitions} transitions in all.`
        : `With play and pause alone, the flat machine has ${flatN.states} states. POWER must leave both paused and playing, so ${powerOff.length} arrows return to off: ${flatN.transitions} transitions in all.`,
    });
    const box = two ? regionBox('full', { bottom: -3.45 }) : regionBox('full', { left: -5.6, right: 5.6, bottom: -3.45 });
    const flatDiagram = await s.show({ source: flatSource(flat) }, { box });
    await flatDiagram.mark(powerOff.map((t) => edge(t.from, 'off')), { color: s.emphasis, as: 'POWER to off' });
    await s.note(`${flatN.states} states · ${flatN.transitions} transitions · ${combos.length} POWER arrows to off`, { size: 0.3 });

    // 2. Parallel regions (two controls only): one state per control instead of one per combination.
    let d: Diagram;
    const showChart = async () => {
      await s.clear({ runTime: 0.35 });
      d = await s.show({ source: chartSource(chart) }, { box: 'main' });
      return s.card(
        Object.entries(counts).map(([k, [f, c]]) => [k, f, c] as const),
        { at: 'side', columns: ['Flat', 'Chart'], fontSize: 0.3, width: 4.7 },
      );
    };
    let card;
    if (two) {
      await this.step('regions', {
        title: 'Two regions replace four combinations',
        line: 'PLAY, PAUSE, MUTE and UNMUTE are drawn once each.',
        caption: `Inside on, a dashed line splits two regions that are active at the same time: playback is paused or playing, and volume is unmuted or muted. A combination such as playing + muted is one state in each region, so the controls need ${counts['Control arrows'][1]} arrows, not ${counts['Control arrows'][0]}.`,
      });
      card = await showChart();
      const controlEdges = CONTROLS.slice(0, n).flatMap((c) => [edge(c.states[0], c.states[1]), edge(c.states[1], c.states[0])]);
      await d!.mark(controlEdges, { color: s.emphasis, as: 'control arrow' });
      await card.mark('Control arrows');
    }

    // 3. The compound state: POWER written once, on the parent.
    await this.step('parent', {
      title: 'One POWER arrow leaves on',
      line: two ? 'Drawn once on the parent, not on each of 4 states.' : 'Drawn once on the parent, not on paused and playing.',
      caption: two
        ? `POWER is drawn from the on box itself. No state inside on handles POWER, so on takes it whichever states are active: 1 arrow does the work of ${powerOff.length}. The chart has ${chartN.transitions} transitions to the flat machine's ${flatN.transitions}, and one more state, on.`
        : `Grouping paused and playing inside on lets POWER be drawn once, from on: 1 arrow instead of ${powerOff.length}. The chart has ${chartN.transitions} transitions to the flat machine's ${flatN.transitions}, but ${chartN.states} states to its ${flatN.states}, because on is a state too.`,
    });
    if (!card) card = await showChart();
    else await d!.unmark();
    await d!.mark([edge('on', 'off')], { color: s.emphasis, as: 'POWER to off' });
    await card.mark('POWER to off');

    // 4. The same events through the chart: several active states make one flat state.
    const events = two ? ['POWER', 'PLAY', 'MUTE', 'POWER'] : ['POWER', 'PLAY', 'POWER'];
    const steps = run(chart, events);
    const upTo = steps.length - 1;
    const words = (c: Configuration) => c.join(', ');
    await this.step('run', {
      title: two ? 'Two active states make one flat state' : 'One control, nothing to combine',
      line: two
        ? `${steps[upTo - 1]!.config.join(' and ')} are both active: flat ${label(steps[upTo - 1]!.config.join('_'))}.`
        : `Only playing is active, as in the flat machine.`,
      caption: two
        ? `From off, POWER enters on, which starts each region in its initial state: paused and unmuted. PLAY changes only playback and MUTE only volume. The chart now rests in playing and muted at once, the pair the flat machine calls playing + muted.`
        : `From off, POWER enters on, which starts in its initial state, paused, and PLAY moves it to playing. With one control only one state inside on is ever active, so there is no combination to name: the flat machine's state is playing too.`,
    });
    await d!.unmark();
    await s.clearOverlays();
    // What the card says after the first i + 1 events; before any, the chart is in off.
    const shown = (i: number) => ({
      Events: i < 0 ? '–' : events.slice(0, i + 1).join(' '),
      'Handled by': i < 0 ? '–' : steps[i]!.sources.join(', '),
      Statechart: i < 0 ? 'off' : words(steps[i]!.config),
      'Flat state': i < 0 ? 'off' : label(steps[i]!.config.join('_')),
    });
    const runCard = await s.card(Object.entries(shown(-1)), { at: 'side', fontSize: 0.3, width: 4.7, enter: false });
    await s.enter(runCard);
    const ACTIVE = { color: s.good, as: 'active' };
    let active: Configuration = ['off'];
    await d!.mark(active, ACTIVE);
    for (let i = 0; i < upTo; i++) {
      const st = steps[i]!;
      // The token rides the arrow the transition takes, off to on or within a region, and leaves it marked.
      const from = st.sources[0]!,
        to = st.event === 'POWER' ? 'on' : st.entered[0]!;
      await d!.unmark(active);
      await d!.walk([[from, to]], { trail: s.emphasis });
      active = st.config;
      await d!.mark(active, ACTIVE);
      await runCard.set(shown(i));
    }
    this.state = { ...this.state, events: events.slice(0, upTo), active, flat: label(active.join('_')), handledBy: steps[upTo - 1]!.sources };

    // 5. POWER from inside: no active state handles it, so the parent does and every region exits.
    const last = steps[upTo]!;
    await this.step('power', {
      title: two ? 'The parent on takes POWER for both regions' : 'The parent on takes POWER for playing',
      line: two ? 'Neither playing nor muted handles POWER, so on does.' : 'playing has no POWER arrow, so on handles it.',
      caption: two
        ? `POWER arrives in playing and muted. Neither state has a POWER arrow, so the transition on their parent, on, is taken: both regions are left and the chart rests in off. The flat machine reaches off by playing + muted's own POWER arrow, one of the ${powerOff.length} marked at the start.`
        : `POWER arrives in playing, which has no POWER arrow, so its parent on takes it and the chart rests in off. The flat machine reaches off by playing's own POWER arrow, one of the ${powerOff.length} marked at the start.`,
    });
    await d!.unmark();
    await d!.walk([['on', 'off']], { trail: s.emphasis });
    active = last.config;
    await d!.mark(active, ACTIVE);
    await runCard.set(shown(upTo));
    await runCard.mark('Handled by');
    this.state = { ...this.state, events, active, flat: label(active.join('_')), handledBy: last.sources };

    // 6. How the counts grow: flat states double with each control; the chart adds two.
    const table = CONTROLS.map((_, i) => {
      const c = player(i + 1);
      return { chart: chartCounts(c), flat: flatCounts(flatten(c)) };
    });
    await this.step('growth', {
      title: two ? 'Flat transitions multiply; the chart adds two' : 'One control saves an arrow and costs a state',
      line: two ? 'Each two-state control doubles the flat machine.' : 'The saving starts when there are combinations to replace.',
      caption: two
        ? `Counts for 1 to 4 two-state controls. Each control doubles the flat machine's combinations, each needing its own POWER and control arrows, while the chart gains two states and two arrows. From 3 controls the chart has fewer states too. The counts assume controls that never depend on each other.`
        : `With one control the chart has ${chartN.states} states to the flat machine's ${flatN.states} and ${chartN.transitions} transitions to its ${flatN.transitions}: on costs a state and saves one POWER arrow. Each further control doubles the flat machine, so from 3 controls the chart has fewer states too. The counts assume controls that never depend on each other.`,
    });
    await s.clear({ runTime: 0.35 });
    const row = (name: string, pick: (r: (typeof table)[number]) => number) =>
      [name, pick(table[0]!), ...table.slice(1).map(pick)] as const;
    const growth = await s.card(
      [
        row('Flat states', (r) => r.flat.states),
        row('Chart states', (r) => r.chart.states),
        row('Flat transitions', (r) => r.flat.transitions),
        row('Chart transitions', (r) => r.chart.transitions),
      ],
      { title: 'Controls besides power', columns: table.map((_, i) => String(i + 1)), fontSize: 0.28, width: 6.4 },
    );
    await growth.mark(two ? 'Flat transitions' : 'Chart states');
    this.state = { ...this.state, growth: table };
  }
}
