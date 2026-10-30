import { Scene, Circle, Line, Text, Group, Polygon, Rectangle, Dot, Arc, Arrow, Axes, VMobject, FadeIn, FadeOut, Create } from '../../../src/index.ts';
import type { Mobject, Vec } from '../../../src/index.ts';
import { stage, settingsOf } from '../../../explain/index.ts';
import * as M from '../lib/manhattanhenge.ts';

const YEAR = 2026;
const RAD = Math.PI / 180;
const SUN = '#e0af68';
const TRACK = '#7aa2f7';
const CYCLES = {
  may: { from: [5, 20], to: [6, 5], name: 'late May' },
  july: { from: [7, 5], to: [7, 20], name: 'mid July' },
} as const satisfies Record<string, { from: [number, number]; to: [number, number]; name: string }>;
const HORIZONS = { flat: 0, raised: 0.5 } as const;
/**
 * The Hayden Planetarium's published 2026 evenings, as reported by CBS News,
 * space.com and NYC Tourism (the planetarium's own page refuses automated
 * readers). Minutes only; the planetarium does not publish its method.
 */
export const PUBLISHED = {
  may: { half: { date: '28 May', time: '8:14 PM EDT' }, full: { date: '29 May', time: '8:13 PM EDT' } },
  july: { full: { date: '11 Jul', time: '8:20 PM EDT' }, half: { date: '12 Jul', time: '8:21 PM EDT' } },
} as const;
/** A 30 m wide street seen from 2 km away: the opening's half-width in degrees. */
export const CANYON_HALF_WIDTH = Math.atan(15 / 2000) / RAD;
const deg = (d: number, places = 2) => d.toFixed(places) + '°';
const minutes = (ms: number) => M.clock(ms).replace(/ (EDT|EST)$/, '');
/** The two named evenings of a cycle and the six consecutive evenings drawn around them. */
export function cycleOf(cycle: keyof typeof CYCLES, horizon: number) {
  const c = CYCLES[cycle];
  const days = M.span(YEAR, c.from, c.to);
  const named = M.alignments(YEAR, days, horizon);
  const first = Math.min(...named.map((a) => a.doy)) - 2;
  const ladder = Array.from({ length: 6 }, (_, i) => M.crossing(YEAR, first + i)!);
  const half = named.find((a) => a.event === 'half')!, full = named.find((a) => a.event === 'full')!;
  return { days, named, ladder, half, full, rate: (ladder[5]!.apparent - ladder[0]!.apparent) / 5 };
}
/** The days of the year on which the sunset bearing passes the grid bearing, up in spring and down in summer. */
export function gridDays(year: (number | null)[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < year.length; i++) {
    const a = year[i - 1]!, b = year[i]!;
    if ((a - M.GRID_BEARING) * (b - M.GRID_BEARING) < 0) out.push(Math.abs(a - M.GRID_BEARING) < Math.abs(b - M.GRID_BEARING) ? i - 1 : i);
  }
  return out;
}

export default class ManhattanhengeExplainer extends Scene {
  static meta = {
    id: 'manhattanhenge',
    title: 'Why Manhattanhenge falls on the evenings it does',
    sources: [
      'https://www.amnh.org/research/hayden-planetarium/resources/manhattanhenge',
      'https://www.cbsnews.com/newyork/news/manhattanhenge-2026-nyc-dates/',
      'https://gml.noaa.gov/grad/solcalc/calcdetails.html',
      'https://archive.org/details/astronomicalalgorithmsjeanmeeus1991',
    ],
  };
  static settings = [
    { id: 'cycle', label: 'Cycle', default: 'may', options: [{ value: 'may', label: 'Late May' }, { value: 'july', label: 'Mid July' }] },
    { id: 'horizon', label: 'Western horizon', default: 'flat', options: [{ value: 'flat', label: 'Flat, 0°' }, { value: 'raised', label: 'Raised 0.5°' }] },
  ];

  override async construct() {
    const cycle = settingsOf(this).cycle as keyof typeof CYCLES;
    const horizonKey = settingsOf(this).horizon as keyof typeof HORIZONS;
    const horizon = HORIZONS[horizonKey];
    const s = stage(this, { style: 'tokyo-night' });
    const ink = s.palette.ink, soft = s.soft, muted = s.palette.muted;
    const label = (text: string, at: Vec, opts: { size?: number; color?: string; edge?: Vec } = {}) =>
      new Text(text, { fontSize: opts.size ?? 0.22, color: opts.color ?? soft }).moveTo(at, opts.edge ?? [0, 0]);

    // ------------------------------------------------------------------ grid
    await this.step('grid', {
      title: 'The cross-streets point 29.1° north of due west',
      line: 'Looking west along 42nd Street you face compass bearing 299.1°.',
      caption:
        'The 1811 grid is turned about 29° from the compass, so looking west along a cross-street you face bearing 299.1°, the figure the Hayden Planetarium uses for 42nd Street. The Sun sets due west only at the equinoxes. For a sunset to be framed by the street, the sunset point has to move 29° north of west along the horizon.',
    });
    {
      const c: Vec = [-3.7, -0.75], r = 2.3;
      const dir = (bearing: number): Vec => [Math.sin(bearing * RAD), Math.cos(bearing * RAD)];
      const ray = (bearing: number, len: number): Vec => [c[0] + len * dir(bearing)[0], c[1] + len * dir(bearing)[1]];
      const ring = new Circle({ radius: r, stroke: muted, strokeWidth: 0.025 }).moveTo(c);
      const points = new Group(
        ...(['N', 'E', 'S', 'W'] as const).map((p, i) => label(p, ray(i * 90, r + 0.32), { size: 0.26, color: ink })),
      );
      const west = new Line(c, ray(270, r), { stroke: soft, strokeWidth: 0.035, dashArray: '0.12 0.1' });
      const street = new Line(ray(119.1, 0.9), ray(299.1, r), { stroke: s.emphasis, strokeWidth: 0.06 });
      const wedge = new Arc({ center: c, radius: 1.45, startAngle: (90 - 299.1) * RAD, angle: 29.1 * RAD, stroke: SUN, strokeWidth: 0.035 });
      const westSaid = label('due west, 270°', [c[0] - r - 0.1, c[1] - 0.3], { size: 0.22, edge: [1, 0] });
      const streetSaid = label('cross-streets, 299.1°', [ray(299.1, r)[0] + 0.1, ray(299.1, r)[1] + 0.36], { size: 0.22, color: s.emphasis, edge: [-1, 0] });
      const wedgeSaid = label('29.1°', ray(284.5, 1.95), { size: 0.24, color: SUN });
      s.keep(ring, points, west, street, wedge, westSaid, streetSaid, wedgeSaid, {
        describe: 'A compass rose. A dashed line runs from its centre due west, 270°. A solid line runs to bearing 299.1°, the direction of the cross-streets, 29.1° north of west, with the angle between them marked.',
      });
      await this.play(new Create(ring), new FadeIn(points), { runTime: 0.8 });
      await this.play(new Create(west), new FadeIn(westSaid), { runTime: 0.6 });
      await this.play(new Create(street), new FadeIn(streetSaid), { runTime: 0.7 });
      await this.play(new Create(wedge), new FadeIn(wedgeSaid), { runTime: 0.6 });
      // Midtown from above: cross-streets at 299.1°, avenues at 29.1°.
      const g: Vec = [3.9, -0.75];
      const along = dir(299.1), across = dir(29.1);
      const at = (u: number, v: number): Vec => [g[0] + u * along[0] + v * across[0], g[1] + u * along[1] + v * across[1]];
      const streets = new Group(
        ...[-2, -1, 0, 1, 2].map((k) => new Line(at(-2.4, k * 0.62), at(2.4, k * 0.62), { stroke: k === 0 ? s.emphasis : muted, strokeWidth: k === 0 ? 0.05 : 0.03 })),
        ...[-1, 0, 1].map((k) => new Line(at(k * 1.5, -1.5), at(k * 1.5, 1.5), { stroke: muted, strokeWidth: 0.03 })),
      );
      const look = new Arrow(at(0.2, 0), at(2.9, 0), { stroke: SUN, strokeWidth: 0.05, tipLength: 0.25, tipWidth: 0.2 });
      const lookSaid = label('looking west along 42nd St', [at(2.9, 0)[0] - 0.2, at(2.9, 0)[1] + 0.42], { size: 0.22, color: SUN, edge: [1, 0] });
      const north = new Group(new Arrow([6.9, 1.2], [6.9, 2.3], { stroke: ink, strokeWidth: 0.035, tipLength: 0.2, tipWidth: 0.16 }), label('N', [6.9, 2.6], { size: 0.24, color: ink }));
      const blockSaid = label('Midtown from above', [g[0], g[1] - 2.55], { size: 0.22 });
      s.keep(streets, look, lookSaid, north, blockSaid, {
        describe: 'Midtown from above: five cross-streets drawn at bearing 299.1° and three avenues at right angles to them, with north straight up. An arrow along 42nd Street points west-north-west.',
      });
      await this.play(new FadeIn(streets), new FadeIn(north), new FadeIn(blockSaid), { runTime: 0.7 });
      await this.play(new Create(look), new FadeIn(lookSaid), { runTime: 0.6 });
      this.state.bearing = M.GRID_BEARING;
      this.state.northOfWest = +(M.GRID_BEARING - 270).toFixed(1);
    }

    // ------------------------------------------------------------------ year
    const year = M.sunsetYear(YEAR);
    const azimuths = year.filter((a): a is number => a != null);
    const min = Math.min(...azimuths), max = Math.max(...azimuths);
    const crossDays = gridDays(year);
    const crossNames = crossDays.map((d) => M.label(YEAR, d));
    await this.step('year', {
      title: `The sunset point swings ${Math.round(max - min)}° along the horizon in a year`,
      line: `It is north of the street bearing only from ${crossNames[0]} to ${crossNames[1]}.`,
      caption:
        `Each evening's sunset bearing through ${YEAR}, with sunset taken as the Sun's upper edge touching a flat horizon. The curve runs from ${deg(min, 1)} in December to ${deg(max, 1)} in June and is above 299.1° only between ${crossNames[0]} and ${crossNames[1]}, either side of the solstice. On those evenings the Sun passes the street bearing while still above the horizon; on every other evening it has set before it gets there.`,
    });
    await s.clear();
    {
      const axes = new Axes({
        xRange: [0, 12, 1],
        yRange: [230, 310, 10],
        width: 9.6,
        height: 6.3,
        axisStyle: { stroke: muted, labelColor: soft, labelFontSize: 0.2 },
        yAxisStyle: { includeNumbers: true },
        yLabel: 'sunset bearing (°)',
        axisLabelFontSize: 0.2,
      });
      axes.shift([-6.5 - axes.c2p(0, 230)[0], -3.95 - axes.c2p(0, 230)[1]]);
      const months = new Group(...M.MONTHS.map((m, i) => label(m, [axes.c2p(i + 0.5, 230)[0], axes.c2p(0, 230)[1] - 0.3], { size: 0.2 })));
      s.keep(axes, months, { describe: 'A chart of sunset bearing in degrees, 230 to 310, through the months January to December' });
      await this.play(new Create(axes, { lagRatio: 0.05 }), new FadeIn(months), { runTime: 2.4 });
      const dayAt = (x: number) => Math.min(year.length - 1, Math.max(0, (x / 12) * year.length));
      const bearingAt = (x: number) => {
        const d = dayAt(x), i = Math.floor(d), f = d - i;
        const a = year[i]!, b = year[Math.min(year.length - 1, i + 1)]!;
        return a + (b - a) * f;
      };
      const xOf = (doy: number) => (doy / year.length) * 12;
      const west = axes.horizontalLine(270, { stroke: soft, strokeWidth: 0.02, dashArray: '0.1 0.08' });
      const westSaid = label('due west, 270°', [axes.c2p(11.9, 270)[0], axes.c2p(11.9, 270)[1] + 0.24], { size: 0.2, edge: [1, 0] });
      const grid = axes.horizontalLine(M.GRID_BEARING, { stroke: s.emphasis, strokeWidth: 0.04 });
      const gridSaid = label('cross-streets, 299.1°', [axes.c2p(11.9, M.GRID_BEARING)[0], axes.c2p(11.9, M.GRID_BEARING)[1] + 0.24], { size: 0.2, color: s.emphasis, edge: [1, 0] });
      await s.enter(west, westSaid, grid, gridSaid, { describe: 'A dashed line at 270°, due west, and a solid line at 299.1°, the cross-streets' });
      const curve = axes.plot(bearingAt, { samples: 183, color: TRACK, strokeWidth: 0.05 });
      await s.draw(curve, { tool: 'pen', runTime: 2, describe: `The sunset bearing through the year: lowest in December at ${deg(min, 1)}, highest in June at ${deg(max, 1)}` });
      const dots = crossDays.map((d) => axes.dot(xOf(d), M.GRID_BEARING, { radius: 0.09, color: SUN }));
      s.keep(dots[0]!, ...dots.slice(1), { describe: `Dots where the curve crosses 299.1°: ${crossNames.join(' and ')}` });
      await this.play(...dots.map((d) => new FadeIn(d)), { runTime: 0.4 });
      await s.callout(dots[0]!, crossNames[0]!, { side: 'below', gap: 0.8, color: SUN, size: 0.22 });
      await s.callout(dots[1]!, crossNames[1]!, { side: 'below', gap: 0.8, color: SUN, size: 0.22 });
      const X = 13.1;
      await s.dimension(axes.c2p(X, min), axes.c2p(X, max), `${deg(max - min, 1)}`, { offset: 0, size: 0.22 });
      this.state.sunsetRange = { min: +min.toFixed(1), max: +max.toFixed(1) };
      this.state.gridDays = crossNames;
    }

    // --------------------------------------------------------------- evening
    const cyc = cycleOf(cycle, horizon);
    const named = cyc.half.doy < cyc.full.doy ? [cyc.half, cyc.full] : [cyc.full, cyc.half];
    const evening = cyc.half;
    const K = 1.8, Y0 = -3.3;
    const vx = (az: number) => (az - M.GRID_BEARING) * K;
    const vy = (alt: number) => Y0 + alt * K;
    const AZ = 3.2, ALT_TOP = 3.0, ALT_FLOOR = -0.5;
    const disc = (az: number, alt: number, opts: { fillOpacity?: number; outline?: boolean; edged?: boolean } = {}) =>
      opts.outline
        ? new Circle({ radius: M.SUN_RADIUS * K, stroke: SUN, strokeWidth: 0.025, fill: 'none' }).moveTo([vx(az), vy(alt)])
        : new Circle({ radius: M.SUN_RADIUS * K, fill: SUN, fillOpacity: opts.fillOpacity ?? 1, stroke: opts.edged ? s.palette.paper : 'none', strokeWidth: opts.edged ? 0.04 : 0 }).moveTo([vx(az), vy(alt)]);
    const horizonWord = horizon === 0 ? 'a flat horizon' : `a horizon ${deg(horizon, 1)} high`;
    const eveningInk: Mobject[] = [];
    await this.step('evening', {
      title: `On ${M.label(YEAR, evening.doy)} the Sun crosses the bearing at ${minutes(evening.ms)}`,
      line: 'It slides down and to the right, about 1° lower for every 1° further north.',
      caption:
        `Looking west along the street on ${M.label(YEAR, evening.doy)}: the Sun at five-minute intervals, compass bearing across and apparent altitude up, refraction included. Its centre reaches 299.1° at ${M.clock(evening.ms, { seconds: true })}, ${deg(evening.apparent)} above ${horizonWord}. The buildings are schematic: a 30 m wide street seen from 2 km is an opening ${deg(2 * CANYON_HALF_WIDTH)} wide. The altitude at this one instant is what decides whether the evening gets a name.`,
    });
    await s.clear();
    {
      const ground = new Rectangle({ width: 2 * AZ * K, height: (0 - ALT_FLOOR) * K, fill: muted, fillOpacity: 0.55, stroke: 'none' }).moveTo([0, vy(ALT_FLOOR / 2)]);
      const wall = (side: 1 | -1) =>
        new Polygon(
          [
            [side * vx(M.GRID_BEARING + AZ), vy(2.2)],
            [side * vx(M.GRID_BEARING + AZ), vy(0)],
            [side * vx(M.GRID_BEARING + CANYON_HALF_WIDTH), vy(0)],
            [side * vx(M.GRID_BEARING + CANYON_HALF_WIDTH), vy(1.0)],
          ],
          { fill: muted, fillOpacity: 0.35, stroke: muted, strokeWidth: 0.02 },
        );
      const walls = new Group(wall(-1), wall(1));
      const flat = new Line([vx(M.GRID_BEARING - AZ), vy(0)], [vx(M.GRID_BEARING + AZ), vy(0)], { stroke: ink, strokeWidth: 0.03 });
      const bearings = new Group(
        ...[297, 298, 299.1, 300, 301].map((b) => label(b === 299.1 ? '299.1°' : `${b}°`, [vx(b), vy(ALT_FLOOR) + 0.16], { size: 0.2, color: b === 299.1 ? s.emphasis : soft })),
      );
      const centreLine = new Line([0, vy(0)], [0, vy(ALT_TOP)], { stroke: s.emphasis, strokeWidth: 0.025, dashArray: '0.12 0.1' });
      const altitudes = new Group(
        ...[0, 1, 2].map((a) => label(`${a}°`, [vx(M.GRID_BEARING - AZ) - 0.3, vy(a)], { size: 0.2, edge: [1, 0] })),
        ...[1, 2].map((a) => new Line([vx(M.GRID_BEARING - AZ), vy(a)], [vx(M.GRID_BEARING - AZ) + 0.2, vy(a)], { stroke: muted, strokeWidth: 0.02 })),
      );
      const raised = horizon > 0
        ? new Group(
            new Rectangle({ width: 2 * AZ * K, height: horizon * K, fill: muted, fillOpacity: 0.3, stroke: 'none' }).moveTo([0, vy(horizon / 2)]),
            new Line([vx(M.GRID_BEARING - AZ), vy(horizon)], [vx(M.GRID_BEARING + AZ), vy(horizon)], { stroke: ink, strokeWidth: 0.03 }),
          )
        : null;
      const horizonSaid = label(horizon > 0 ? `visible horizon, ${deg(horizon, 1)}` : 'flat horizon, 0°', [vx(M.GRID_BEARING - AZ) + 0.1, vy(horizon) + 0.22], { size: 0.2, color: ink, edge: [-1, 0] });
      s.keep(ground, flat, ...(raised ? [raised] : []), horizonSaid, bearings, altitudes, centreLine, walls, {
        describe: `The view west along a cross-street: a horizon line${horizon > 0 ? ` with the visible horizon drawn ${deg(horizon, 1)} above it` : ''}, compass bearings 297° to 301° along the bottom with 299.1° in the middle, altitudes 0° to 2° up the left, a dashed vertical line at 299.1°, and schematic buildings on both sides leaving an opening ${deg(2 * CANYON_HALF_WIDTH)} wide.`,
      });
      await this.play(new FadeIn(ground), new Create(flat), ...(raised ? [new FadeIn(raised)] : []), new FadeIn(horizonSaid), new FadeIn(bearings), new FadeIn(altitudes), { runTime: 0.8 });
      await this.play(new FadeIn(walls), new Create(centreLine), { runTime: 0.7 });
      // The track: one minute at a time from 15 minutes before the crossing to 10 after.
      const track = new VMobject({ stroke: TRACK, strokeWidth: 0.03, dashArray: '0.1 0.08' });
      for (let m = -15; m <= 10; m++) {
        const p = M.sunAt(evening.ms + m * 60000);
        if (p.apparent < ALT_FLOOR + 0.05) break;
        const at: Vec = [vx(p.azimuth), vy(p.apparent)];
        if (m === -15) track.startNewPath(at); else track.addLineTo(at);
      }
      const marks = [-15, -10, -5].map((m) => {
        const p = M.sunAt(evening.ms + m * 60000);
        return { m, az: p.azimuth, alt: p.apparent, at: [vx(p.azimuth), vy(p.apparent)] as Vec, time: minutes(evening.ms + m * 60000) };
      });
      const ghosts = new Group(...marks.map((k) => disc(k.az, k.alt, { fillOpacity: 0.3 })));
      const times = new Group(...marks.map((k) => label(k.time, [k.at[0], k.at[1] - M.SUN_RADIUS * K - 0.22], { size: 0.2 })));
      const sun = disc(M.GRID_BEARING, evening.apparent);
      s.keep(track, ghosts, times, sun, {
        describe: `The Sun's dashed track down and to the right, with faint discs at ${marks.map((k) => k.time).join(', ')} and a full disc where its centre crosses 299.1° at ${minutes(evening.ms)}, ${deg(evening.apparent)} up.`,
      });
      await this.play(new Create(track), { runTime: 1.2 });
      await this.play(new FadeIn(ghosts), new FadeIn(times), { runTime: 0.6 });
      await this.play(new FadeIn(sun), { runTime: 0.5 });
      const said = await s.callout(sun, `${minutes(evening.ms)} · centre ${deg(evening.apparent)} up`, { side: 'right', gap: 1.1, color: SUN, size: 0.22 });
      eveningInk.push(track, ghosts, times, sun, said);
      this.state.evening = { date: M.label(YEAR, evening.doy), time: M.clock(evening.ms, { seconds: true }), apparent: +evening.apparent.toFixed(3) };
      this.state.track = marks.map((k) => ({ time: k.time, azimuth: +k.az.toFixed(2), apparent: +k.alt.toFixed(2) }));
    }

    // ---------------------------------------------------------------- ladder
    const rising = cyc.rate > 0;
    const ladderInk: Mobject[] = [];
    const ladderNames = cyc.ladder.map((c) => M.label(YEAR, c.doy));
    await this.step('ladder', {
      title: `Each evening the crossing happens ${deg(Math.abs(cyc.rate))} ${rising ? 'higher' : 'lower'}`,
      line: `${ladderNames[0]} to ${ladderNames[5]}: the centre ${rising ? 'climbs from below the horizon to a diameter above it' : 'sinks from a diameter above the horizon to below it'}.`,
      caption:
        `The same view, with the Sun drawn where its centre crosses 299.1° on six consecutive evenings. The crossing altitude ${rising ? 'rises' : 'falls'} ${deg(Math.abs(cyc.rate))} an evening, about two thirds of the disc's ${deg(2 * M.SUN_RADIUS)} diameter, because the Sun's declination is still ${rising ? 'increasing toward' : 'decreasing after'} the June solstice. The disc goes from hidden to wholly clear of ${horizonWord} in about three evenings. The two evenings with a name are the ones whose disc sits on the horizon.`,
    });
    {
      await this.play(...eveningInk.map((m) => new FadeOut(m, { runTime: 0.4 })));
      const outlines = new Group(...cyc.ladder.map((c) => disc(M.GRID_BEARING, c.apparent, { outline: true })));
      const centres = new Group(...cyc.ladder.map((c) => new Dot({ radius: 0.05, color: SUN }).moveTo([0, vy(c.apparent)])));
      // A date label sits at its disc's height, nudged off the horizon lines so the line never runs through its letters.
      const clear = (y: number) => {
        for (const h of horizon > 0 ? [0, horizon] : [0]) {
          const d = y - vy(h);
          if (Math.abs(d) < 0.15) return vy(h) + (d >= 0 ? 0.15 : -0.15);
        }
        return y;
      };
      const dates = new Group(...cyc.ladder.map((c, i) => label(ladderNames[i]!, [vx(M.GRID_BEARING - 0.56), clear(vy(c.apparent))], { size: 0.2, color: ink, edge: [1, 0] })));
      s.keep(outlines, centres, dates, {
        describe: `Six outlined discs stacked at 299.1°, one per evening, their centres ${cyc.ladder.map((c, i) => `${ladderNames[i]} at ${deg(c.apparent)}`).join(', ')}.`,
      });
      await this.play(new FadeIn(outlines), new FadeIn(centres), new FadeIn(dates), { runTime: 1.2 });
      ladderInk.push(await s.dimension([vx(M.GRID_BEARING + 1.25), vy(cyc.ladder[0]!.apparent)], [vx(M.GRID_BEARING + 1.25), vy(cyc.ladder[5]!.apparent)], `${deg(Math.abs(cyc.ladder[5]!.apparent - cyc.ladder[0]!.apparent))} over 5 evenings`, { offset: 0, size: 0.2 }));
      this.state.ladder = cyc.ladder.map((c, i) => ({ date: ladderNames[i], apparent: +c.apparent.toFixed(3) }));
      this.state.perEvening = +cyc.rate.toFixed(3);
    }

    // ----------------------------------------------------------------- names
    const pub = PUBLISHED[cycle];
    const say = (a: M.Alignment) => `${M.label(YEAR, a.doy)} · ${minutes(a.ms)}`;
    const word = { half: 'Half Sun', full: 'Full Sun' } as const;
    const agree = M.label(YEAR, cyc.half.doy) === pub.half.date && M.label(YEAR, cyc.full.doy) === pub.full.date;
    await this.step('names', {
      title: `${word[named[0]!.event]} on ${M.label(YEAR, named[0]!.doy)}, ${word[named[1]!.event]} on ${M.label(YEAR, named[1]!.doy)}`,
      line: rising ? 'Centre on the horizon first, then the lower edge: half, then full.' : 'Lower edge on the horizon first, then the centre: full, then half.',
      caption:
        `Half Sun on the Grid is the evening whose crossing puts the centre nearest ${horizonWord}: ${say(cyc.half)}. Full Sun on the Grid puts the lower edge there, the centre one radius higher: ${say(cyc.full)}. The Hayden Planetarium publishes ${pub.half.date} and ${pub.full.date} for ${CYCLES[cycle].name}. ` +
        (agree
          ? 'With this horizon the model names the same evenings, and its instants fall inside the published minutes.'
          : `Its minutes agree with this model's instants to within a minute, since the clock time of a crossing does not depend on the horizon. Its choice of evening does: a horizon about 0.4° high gives its May pair and about 0.7° its July pair, and no single height gives both. The height of the visible horizon is the one input this model does not measure${horizon === 0 ? '; the raised setting shows what half a degree does' : ''}.`),
    });
    {
      await this.play(...ladderInk.map((m) => new FadeOut(m, { runTime: 0.4 })));
      const halfDisc = disc(M.GRID_BEARING, cyc.half.apparent, { edged: true }), fullDisc = disc(M.GRID_BEARING, cyc.full.apparent, { edged: true });
      s.keep(halfDisc, fullDisc, { describe: `Two discs filled in: Half Sun at ${deg(cyc.half.apparent)}, Full Sun at ${deg(cyc.full.apparent)}` });
      await this.play(new FadeIn(halfDisc), new FadeIn(fullDisc), { runTime: 0.6 });
      const lower = cyc.half.apparent < cyc.full.apparent ? cyc.half : cyc.full;
      const upper = lower === cyc.half ? cyc.full : cyc.half;
      await s.callout(lower === cyc.half ? halfDisc : fullDisc, `${word[lower.event]} · ${say(lower)}`, { side: 'right', gap: 1.3, color: SUN, size: 0.22 });
      await s.callout(upper === cyc.half ? halfDisc : fullDisc, `${word[upper.event]} · ${say(upper)}`, { side: 'right', gap: 1.3, color: SUN, size: 0.22 });
      await s.card(
        [
          ['Half Sun', `${pub.half.date} · ${pub.half.time.replace(' EDT', '')}`],
          ['Full Sun', `${pub.full.date} · ${pub.full.time.replace(' EDT', '')}`],
        ],
        { at: [-7.3, 0.9, -1.3, 2.7], title: `Hayden Planetarium, ${YEAR}`, fontSize: 0.22 },
      );
      this.state.half = { date: M.label(YEAR, cyc.half.doy), time: M.clock(cyc.half.ms, { seconds: true }), apparent: +cyc.half.apparent.toFixed(3) };
      this.state.full = { date: M.label(YEAR, cyc.full.doy), time: M.clock(cyc.full.ms, { seconds: true }), apparent: +cyc.full.apparent.toFixed(3) };
      this.state.published = pub;
      this.state.horizon = horizon;
      this.state.agree = agree;
    }
  }
}
