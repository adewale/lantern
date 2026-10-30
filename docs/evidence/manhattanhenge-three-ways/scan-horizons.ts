import * as M from '../../../scenes/explainers/lib/manhattanhenge.ts';
const Y = 2026;
const want = { may: ['28 May', '29 May'], jul: ['11 Jul', '12 Jul'] };
const mayDays = M.span(Y, [5, 20], [6, 5]), julDays = M.span(Y, [7, 5], [7, 20]);
const xs = (days: number[]) => days.map((d) => M.crossing(Y, d)!);
const may = xs(mayDays), jul = xs(julDays);
// rule A: nearest; rule B: first/last day at or above threshold
const nearest = (c: M.Crossing[], t: number) => c.reduce((b, x) => (Math.abs(x.apparent - t) < Math.abs(b.apparent - t) ? x : b));
const firstAbove = (c: M.Crossing[], t: number) => c.find((x) => x.apparent >= t)!;
const lastAbove = (c: M.Crossing[], t: number) => [...c].reverse().find((x) => x.apparent >= t)!;
const L = (c: M.Crossing) => M.label(Y, c.doy);
const R = M.SUN_RADIUS;
const ok: string[] = [];
for (let h = -0.3; h <= 1.2; h += 0.01) {
  const hh = +h.toFixed(2);
  const a = [nearest(may, hh), nearest(may, hh + R), nearest(jul, hh + R), nearest(jul, hh)].map(L);
  const b = [firstAbove(may, hh), firstAbove(may, hh + R), lastAbove(jul, hh + R), lastAbove(jul, hh)].map(L);
  const okA = a[0] === want.may[0] && a[1] === want.may[1] && a[2] === want.jul[0] && a[3] === want.jul[1];
  const okB = b[0] === want.may[0] && b[1] === want.may[1] && b[2] === want.jul[0] && b[3] === want.jul[1];
  const okAmay = a[0] === want.may[0] && a[1] === want.may[1], okAjul = a[2] === want.jul[0] && a[3] === want.jul[1];
  const okBmay = b[0] === want.may[0] && b[1] === want.may[1], okBjul = b[2] === want.jul[0] && b[3] === want.jul[1];
  if (okA || okB || okAmay || okAjul || okBmay || okBjul) ok.push(`${hh}: nearest ${a.join(',')} ${okA ? 'ALL' : okAmay ? 'may' : okAjul ? 'jul' : ''} | threshold ${b.join(',')} ${okB ? 'ALL' : okBmay ? 'may' : okBjul ? 'jul' : ''}`);
}
console.log(ok.join('\n'));
// sunset azimuth on the AMNH dates
for (const [m, d] of [[5, 28], [5, 29], [7, 11], [7, 12]] as const) console.log(m, d, 'sunset az', M.sunset(Y, m, d)!.azimuth.toFixed(2), M.clock(M.sunset(Y, m, d)!.ms));
