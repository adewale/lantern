import * as M from '../../../scenes/explainers/lib/manhattanhenge.ts';
const Y = 2026;
console.log('--- henge.nyc check, 30 Oct 2026 (their VSOP87 numbers: sunrise 7:24 AM, noon 12:39 PM, sunset 5:54 PM, sunset bearing 251.34°)');
const ss = M.sunset(Y, 10, 30)!, sr = M.sunrise(Y, 10, 30)!, noon = M.solarNoon(Y, 10, 30);
console.log('sunrise', M.clock(sr.ms, { seconds: true }), 'noon', M.clock(noon, { seconds: true }), 'sunset', M.clock(ss.ms, { seconds: true }), 'bearing', ss.azimuth.toFixed(2));
console.log('--- bearing crossings around the May and July cycles (apparent altitude of the centre, °)');
for (const [m, d] of [[5, 25], [5, 26], [5, 27], [5, 28], [5, 29], [5, 30], [5, 31], [6, 1], [7, 8], [7, 9], [7, 10], [7, 11], [7, 12], [7, 13], [7, 14], [7, 15]] as const) {
  const doy = M.span(Y, [m, d], [m, d])[0]!;
  const c = M.crossing(Y, doy)!;
  console.log(M.label(Y, doy).padEnd(7), M.clock(c.ms, { seconds: true }), 'apparent', c.apparent.toFixed(3).padStart(7), 'geometric', c.altitude.toFixed(3).padStart(7));
}
console.log('--- AMNH 2026 (via CBS/space.com/nyctourism): Half Thu 28 May 8:14 PM, Full Fri 29 May 8:13 PM, Full Sat 11 Jul 8:20 PM, Half Sun 12 Jul 8:21 PM');
console.log('--- henge.nyc: 8:13:16, 8:12:44, 8:19:46, 8:20:30');
for (const h of [0, 0.25, 0.5, 0.75]) {
  const may = M.alignments(Y, M.span(Y, [5, 20], [6, 5]), h), jul = M.alignments(Y, M.span(Y, [7, 5], [7, 20]), h);
  console.log(`horizon ${h}°:`, [...may, ...jul].map((a) => `${a.event} ${M.label(Y, a.doy)} ${M.clock(a.ms)} (${a.apparent.toFixed(2)}°)`).join(' | '));
}
console.log('--- sunset azimuth through the year, 1st of each month');
const yr = M.sunsetYear(Y);
for (let m = 0; m < 12; m++) { const doy = M.span(Y, [m + 1, 1], [m + 1, 1])[0]!; console.log(M.MONTHS[m], yr[doy]!.toFixed(2)); }
const max = Math.max(...(yr as number[])), min = Math.min(...(yr as number[]));
console.log('range', min.toFixed(2), max.toFixed(2), 'crosses 299.1 on days', yr.map((a, i) => [a!, i] as const).filter(([a], i, arr) => i > 0 && (arr[i - 1]![0] - 299.1) * (a - 299.1) < 0).map(([, i]) => M.label(Y, i)).join(', '));
// daily rise of the crossing altitude near the May event
const c27 = M.crossing(Y, M.span(Y, [5, 27], [5, 27])[0]!)!, c28 = M.crossing(Y, M.span(Y, [5, 28], [5, 28])[0]!)!;
console.log('per-day rise of crossing altitude late May', (c28.apparent - c27.apparent).toFixed(3));
// how fast the sun moves at the crossing: azimuth and altitude change per minute
const t = c28.ms; const a0 = M.sunAt(t), a1 = M.sunAt(t + 60000);
console.log('per minute at crossing: daz', (a1.azimuth - a0.azimuth).toFixed(3), 'dalt', (a1.altitude - a0.altitude).toFixed(3), 'slope deg alt per deg az', ((a1.altitude - a0.altitude) / (a1.azimuth - a0.azimuth)).toFixed(3));
