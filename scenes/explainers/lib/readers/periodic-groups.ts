import { Group, Circle } from '../../../../src/index.ts';
import {
  atomicNumber,
  position,
  coreOf,
  listed,
  predicted,
  beyondCore,
  counted,
  configText,
  CAPACITY,
  symbolOf,
  NAMES,
} from '../periodic-groups.ts';
import type { Symbol } from '../periodic-groups.ts';
import { label, tile, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(symbol: Symbol): ReaderFrame[] {
  const z = atomicNumber(symbol),
    p = position(z),
    core = coreOf(z),
    actual = listed(z),
    past = beyondCore(actual, z),
    prediction = predicted(z),
    exception = configText(actual) !== configText(prediction);
  return [
    {
      id: 'reader-electrons',
      title: 'Which electrons help locate the group?',
      line: `${NAMES[symbol]}: atomic number ${z}.`,
      caption: `A neutral ${symbol} atom has ${z} electrons. ${core ? `The preceding noble gas, ${symbolOf(core)}, accounts for ${core} of them.` : 'There is no preceding noble-gas core.'} Count s, p and d electrons beyond that core; f electrons are left out of this group count. The table’s column is a convention with visible adjustments, not simply the total number of electrons.`,
      values: { symbol, z, core, count: counted(actual, z), group: p.group },
      draw: (s) =>
        new Group(
          tile(core ? `${symbolOf(core)} core: ${core}` : 'No prior core', -3.9, 1.3, 6.6, 1.4, s),
          tile(`Beyond core: ${z - core}`, 3.9, 1.3, 6.6, 1.4, s, { active: true }),
          label(configText(past), 0, -1.2, s.palette.ink, 0.85, 'outer-configuration'),
          label(`Group count: ${counted(actual, z)}; column: ${p.group}`, 0, -3, s.palette.ink, 0.75, 'group-count'),
        ),
    },
    {
      id: 'reader-filling',
      title: exception ? 'Does the filling rule always predict the ground state?' : 'How does a subshell fill?',
      line: exception
        ? 'Compare the filling prediction with the captured reference.'
        : 'Each dot is one electron; outlines show the remaining capacity.',
      caption: exception
        ? `The filling rule predicts ${configText(beyondCore(prediction, z))} beyond the core. The reference lists ${configText(past)}. Both give the same s/p/d count here, but that agreement does not make the configurations identical. The family and count pictures next show how the column is assigned.`
        : `The subshell labels give shell number and s/p/d/f type. Each has a fixed capacity: s holds 2, p 6, d 10 and f 14. The drawn rows keep each electron and its capacity together. ${symbol === 'He' ? 'Helium has a filled first shell and is placed with the noble gases in group 18, although its electron count is 2.' : 'The next pictures compare the whole family and its group count.'}`,
      values: { symbol, prediction: configText(prediction), actual: configText(actual), exception },
      draw: (s) =>
        exception
          ? table(
              ['', 'Beyond core'],
              [
                ['Predicted', configText(beyondCore(prediction, z))],
                ['Reference', configText(past)],
              ],
              s,
              { xs: [-4.8, 3.2], y: 2, gap: 1.7 },
            )
          : new Group(
              ...past.map((sub, i) => {
                const y = 2 - i * 1.7,
                  n = CAPACITY[sub.l];
                return new Group(
                  label(`${sub.n}${sub.l}`, -6.6, y, s.palette.ink, 0.75),
                  ...Array.from({ length: n }, (_, j) =>
                    new Circle({
                      radius: 0.22,
                      fill: j < sub.electrons ? s.emphasis : s.palette.paper,
                      stroke: s.soft,
                      strokeWidth: 0.035,
                    }).moveTo([-4.8 + j * 0.8, y]),
                  ),
                );
              }),
            ),
    },
  ];
}
