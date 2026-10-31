import { Group, Rectangle, Line } from '../../../../src/index.ts';
import { summarize, LIFETIMES, DAY } from '../cert-renewal.ts';
import type { LifetimeKey, Rule } from '../cert-renewal.ts';
import { bars, label } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(key: LifetimeKey, rule: Rule): ReaderFrame[] {
  const life = LIFETIMES[key],
    fixed = summarize('fixed30', key),
    fraction = summarize('fraction', key),
    selected = rule === 'fixed30' ? fixed : fraction;
  const units = key === '160h' ? 1 : DAY,
    unit = key === '160h' ? 'h' : 'days',
    f = (h: number) => `${+(h / units).toFixed(1)} ${unit}`;
  return [
    {
      id: 'reader-due',
      title: 'When does “30 days before” fire?',
      line: `Certificate lifetime: ${life.label}.`,
      caption: `Both bars start at notBefore and end at expiry. The ticks mark when each rule becomes due. The fixed interval becomes due after ${f(fixed.due)}; the current default after ${f(fraction.due)}. A 30-day interval can cover almost the entire life of a short certificate. This comparison assumes no ARI answer.`,
      values: { key, fixed, fraction },
      draw: (s) => {
        const g = new Group();
        for (const [i, r] of [fixed, fraction].entries()) {
          const y = 1.9 - i * 2.8,
            x = -6 + (r.due / life.hours) * 12;
          g.add(
            label(i === 0 ? 'Fixed: 30 days before' : 'Default: lifetime fraction', 0, y + 0.65, s.palette.ink, 0.66),
            new Rectangle({
              width: 12,
              height: 0.6,
              fill: s.emphasis,
              fillOpacity: 0.18,
              stroke: s.soft,
              strokeWidth: 0.03,
            }).moveTo([0, y - 0.25]),
            new Line([x, y - 0.85], [x, y + 0.1], { stroke: s.bad, strokeWidth: 0.06 }),
            label(f(r.due), x, y - 1.35, s.palette.ink, 0.65, `due:${i}`),
          );
        }
        return g;
      },
    },
    {
      id: 'reader-retries',
      title: 'How much retry time remains?',
      line: `Selected: ${rule === 'fixed30' ? 'fixed interval' : 'current default'}; timer runs twice a day.`,
      caption: `After the selected rule becomes due, ${f(selected.slack)} remain until expiry. The model gives ${selected.retries} scheduled chances before that expiry. Shortening a lifetime changes both renewal frequency and the time available to recover from a failed renewal. The source walkthrough adds ARI and the issuance rate limit.`,
      values: { key, rule, retries: selected.retries, slack: selected.slack },
      draw: (s) =>
        bars(
          s,
          [
            { label: 'Time before renewal is due', value: selected.due, display: f(selected.due) },
            { label: 'Time left to retry', value: selected.slack, display: f(selected.slack) },
          ],
          life.hours,
        ),
    },
  ];
}
