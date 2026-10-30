// Why Manhattanhenge falls on the evenings it does. One case: late May 2026,
// a flat western horizon. The solar model (scenes/lib/manhattanhenge.ts) is
// asked for every number; the scene draws what it answers.
import {
  Scene, Group, Circle, Line, Text, Polygon, Dot, Arc, Arrow, VMobject, StateReadout, FadeIn, FadeOut, Create, Write,
  WHITE, GREY, GREY_D, BLUE, GOLD, UP,
} from '../src/index.ts';
import type { Vec } from '../src/index.ts';
import * as M from './lib/manhattanhenge.ts';

const YEAR = 2026;
const RAD = Math.PI / 180;
const SUN = GOLD, TRACK = BLUE, GRID = '#ff9e64', SOFT = GREY, INK = WHITE, MUTED = GREY_D;
const HORIZON = 0;
const PUBLISHED = { half: { date: '28 May', time: '8:14 PM' }, full: { date: '29 May', time: '8:13 PM' } };
const CANYON_HALF_WIDTH = Math.atan(15 / 2000) / RAD;
const deg = (d: number, places = 2) => d.toFixed(places) + '°';
const minutes = (ms: number) => M.clock(ms).replace(/ (EDT|EST)$/, '');
const heading = (text: string) => new Text(text, { fontSize: 0.36, weight: 'bold', color: INK }).toEdge(UP, 0.45);
const label = (text: string, at: Vec, { size = 0.22, color = SOFT, edge = [0, 0] as Vec, font = 'sans' as 'sans' | 'mono' } = {}) =>
  new Text(text, { fontSize: size, color, font }).moveTo(at, edge);

export class ManhattanhengeScene extends Scene {
  override async construct() {
    const st = (this.state = {} as Record<string, unknown>);
    let title: Text | null = null;
    const retitle = async (text: string) => {
      const next = heading(text);
      if (title) await this.play(new FadeOut(title, { runTime: 0.3 }));
      await this.play(new FadeIn(next, { runTime: 0.5 }));
      title = next;
    };
    const clearAll = async (...keep: Group[]) => {
      const gone = this.mobjects.filter((m) => m !== title && !keep.includes(m as Group));
      if (gone.length) await this.play(...gone.map((m) => new FadeOut(m, { runTime: 0.4 })));
    };

    // ------------------------------------------------------------------ grid
    await this.step('grid', {
      caption: 'The 1811 grid is turned about 29° from the compass, so looking west along a cross-street you face bearing 299.1°, the figure the Hayden Planetarium uses for 42nd Street. The Sun sets due west only at the equinoxes. For a sunset to be framed by the street, the sunset point has to move 29° north of west along the horizon.',
    });
    await retitle('The cross-streets point 29.1° north of due west');
    {
      const c: Vec = [-3.7, -0.75], r = 2.3;
      const dir = (b: number): Vec => [Math.sin(b * RAD), Math.cos(b * RAD)];
      const ray = (b: number, len: number): Vec => [c[0] + len * dir(b)[0], c[1] + len * dir(b)[1]];
      const ring = new Circle({ radius: r, stroke: MUTED, strokeWidth: 0.025, fill: 'none' }).moveTo(c);
      const points = new Group(...(['N', 'E', 'S', 'W'] as const).map((p, i) => label(p, ray(i * 90, r + 0.32), { size: 0.26, color: INK })));
      const west = new Line(c, ray(270, r), { stroke: SOFT, strokeWidth: 0.03, strokeOpacity: 0.7 });
      const street = new Line(ray(119.1, 0.9), ray(299.1, r), { stroke: GRID, strokeWidth: 0.06 });
      const wedge = new Arc({ center: c, radius: 1.45, startAngle: (90 - 299.1 + 1.5) * RAD, angle: 26.1 * RAD, stroke: SUN, strokeWidth: 0.035, fill: 'none' });
      const words = new Group(
        label('due west, 270°', [c[0] - r - 0.1, c[1] - 0.5], { edge: [1, 0] }),
        label('cross-streets, 299.1°', [ray(299.1, r)[0] + 0.1, ray(299.1, r)[1] + 0.36], { color: GRID, edge: [-1, 0] }),
        label('29.1°', ray(284.5, 1.95), { size: 0.24, color: SUN, font: 'mono' }),
      );
      await this.play(new Create(ring), new FadeIn(points), { runTime: 0.8 });
      await this.play(new Create(west), new Create(street), new Create(wedge), new FadeIn(words), { runTime: 0.9 });
      const g: Vec = [3.9, -0.75];
      const along = dir(299.1), across = dir(29.1);
      const at = (u: number, v: number): Vec => [g[0] + u * along[0] + v * across[0], g[1] + u * along[1] + v * across[1]];
      const streets = new Group(
        ...[-2, -1, 0, 1, 2].map((k) => new Line(at(-2.4, k * 0.62), at(2.4, k * 0.62), { stroke: k === 0 ? GRID : MUTED, strokeWidth: k === 0 ? 0.05 : 0.03 })),
        ...[-1, 0, 1].map((k) => new Line(at(k * 1.5, -1.5), at(k * 1.5, 1.5), { stroke: MUTED, strokeWidth: 0.03 })),
      );
      const look = new Arrow(at(0.2, 0), at(2.9, 0), { stroke: SUN, strokeWidth: 0.05, tipLength: 0.25, tipWidth: 0.2 });
      const more = new Group(
        label('looking west along 42nd St', [at(2.9, 0)[0] - 0.2, at(2.9, 0)[1] + 0.42], { color: SUN, edge: [1, 0] }),
        new Arrow([6.9, 1.2], [6.9, 2.3], { stroke: INK, strokeWidth: 0.035, tipLength: 0.2, tipWidth: 0.16 }),
        label('N', [6.9, 2.6], { size: 0.24, color: INK }),
        label('Midtown from above', [g[0], g[1] - 2.55]),
      );
      await this.play(new FadeIn(streets), new FadeIn(more), { runTime: 0.7 });
      await this.play(new Create(look), { runTime: 0.6 });
      st.bearing = M.GRID_BEARING;
      st.northOfWest = +(M.GRID_BEARING - 270).toFixed(1);
      await this.wait(0.3);
    }

    // ------------------------------------------------------------------ year
    const year = M.sunsetYear(YEAR);
    const az = year.filter((a): a is number => a != null);
    const min = Math.min(...az), max = Math.max(...az);
    const crossDays: number[] = [];
    for (let i = 1; i < year.length; i++) {
      const a = year[i - 1]!, b = year[i]!;
      if ((a - M.GRID_BEARING) * (b - M.GRID_BEARING) < 0) crossDays.push(Math.abs(a - M.GRID_BEARING) < Math.abs(b - M.GRID_BEARING) ? i - 1 : i);
    }
    const crossNames = crossDays.map((d) => M.label(YEAR, d));
    await this.step('year', {
      caption: `Each evening's sunset bearing through ${YEAR}, with sunset taken as the Sun's upper edge touching a flat horizon. The curve runs from ${deg(min, 1)} in December to ${deg(max, 1)} in June and is above 299.1° only between ${crossNames[0]} and ${crossNames[1]}, either side of the solstice. On those evenings the Sun passes the street bearing while still above the horizon; on every other evening it has set before it gets there.`,
    });
    await clearAll();
    await retitle(`The sunset point swings ${Math.round(max - min)}° along the horizon in a year`);
    {
      const x0 = -6.5, x1 = 3.1, yB = -3.95, yT = 2.35, lo = 230, hi = 310;
      const cx = (doy: number) => x0 + (doy / year.length) * (x1 - x0);
      const cy = (b: number) => yB + ((b - lo) / (hi - lo)) * (yT - yB);
      const axes = new Group(
        new Line([x0, yB], [x1, yB], { stroke: MUTED, strokeWidth: 0.025 }),
        new Line([x0, yB], [x0, yT], { stroke: MUTED, strokeWidth: 0.025 }),
        ...Array.from({ length: 9 }, (_, i) => lo + 10 * i).flatMap((b) => [
          new Line([x0 - 0.1, cy(b)], [x0, cy(b)], { stroke: MUTED, strokeWidth: 0.025 }),
          label(String(b), [x0 - 0.2, cy(b)], { size: 0.2, edge: [1, 0], font: 'mono' }),
        ]),
        label('sunset bearing (°)', [x0 - 0.9, yT + 0.35], { size: 0.2, edge: [-1, 0] }),
      );
      const cum = [0];
      for (const d of [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]) cum.push(cum[cum.length - 1]! + d);
      const months = new Group(...M.MONTHS.map((m, i) => label(m, [cx((cum[i]! + cum[i + 1]!) / 2), yB - 0.3], { size: 0.2 })));
      await this.play(new FadeIn(axes), new FadeIn(months), { runTime: 0.9 });
      const west = new Line([x0, cy(270)], [x1, cy(270)], { stroke: SOFT, strokeWidth: 0.02, strokeOpacity: 0.7 });
      const grid = new Line([x0, cy(M.GRID_BEARING)], [x1, cy(M.GRID_BEARING)], { stroke: GRID, strokeWidth: 0.04 });
      const lines = new Group(
        label('due west, 270°', [x1 - 0.05, cy(270) + 0.24], { size: 0.2, edge: [1, 0] }),
        label('cross-streets, 299.1°', [x1 - 0.05, cy(M.GRID_BEARING) + 0.24], { size: 0.2, color: GRID, edge: [1, 0] }),
      );
      await this.play(new Create(west), new Create(grid), new FadeIn(lines), { runTime: 0.7 });
      const curve = new VMobject({ stroke: TRACK, strokeWidth: 0.05, fill: 'none' });
      year.forEach((b, i) => (i ? curve.addLineTo([cx(i), cy(b!)]) : curve.startNewPath([cx(i), cy(b!)])));
      await this.play(new Create(curve), { runTime: 2 });
      const dots = new Group(...crossDays.map((d) => new Dot({ radius: 0.09, color: SUN }).moveTo([cx(d), cy(M.GRID_BEARING)])));
      const said = new Group(
        ...crossDays.map((d, i) => new Line([cx(d), cy(M.GRID_BEARING) - 0.12], [cx(d), cy(M.GRID_BEARING) - 0.7], { stroke: SUN, strokeWidth: 0.02 })),
        ...crossDays.map((d, i) => label(crossNames[i]!, [cx(d), cy(M.GRID_BEARING) - 0.95], { size: 0.22, color: SUN })),
      );
      await this.play(new FadeIn(dots), new FadeIn(said), { runTime: 0.6 });
      const dx = x1 + 0.5;
      const range = new Group(
        new Line([dx, cy(min)], [dx, cy(max)], { stroke: INK, strokeWidth: 0.025 }),
        new Line([dx - 0.1, cy(min)], [dx + 0.1, cy(min)], { stroke: INK, strokeWidth: 0.025 }),
        new Line([dx - 0.1, cy(max)], [dx + 0.1, cy(max)], { stroke: INK, strokeWidth: 0.025 }),
        label(deg(max - min, 1), [dx + 0.2, cy((min + max) / 2)], { size: 0.22, color: INK, edge: [-1, 0], font: 'mono' }),
      );
      await this.play(new FadeIn(range), { runTime: 0.5 });
      st.sunsetRange = { min: +min.toFixed(1), max: +max.toFixed(1) };
      st.gridDays = crossNames;
      await this.wait(0.3);
    }

    // --------------------------------------------------------------- evening
    const days = M.span(YEAR, [5, 20], [6, 5]);
    const named = M.alignments(YEAR, days, HORIZON);
    const half = named.find((a) => a.event === 'half')!, full = named.find((a) => a.event === 'full')!;
    const first = Math.min(half.doy, full.doy) - 2;
    const ladder = Array.from({ length: 6 }, (_, i) => M.crossing(YEAR, first + i)!);
    const rate = (ladder[5]!.apparent - ladder[0]!.apparent) / 5;
    const K = 1.8, Y0 = -3.3, AZ = 3.2, FLOOR = -0.5;
    const vx = (a: number) => (a - M.GRID_BEARING) * K;
    const vy = (alt: number) => Y0 + alt * K;
    const clear = (y: number) => (Math.abs(y - vy(0)) < 0.24 ? vy(0) + (y >= vy(0) ? 0.24 : -0.24) : y);
    const disc = (alt: number, { outline = false, opacity = 1, edged = false } = {}) =>
      outline
        ? new Circle({ radius: M.SUN_RADIUS * K, stroke: SUN, strokeWidth: 0.025, fill: 'none' }).moveTo([0, vy(alt)])
        : new Circle({ radius: M.SUN_RADIUS * K, fill: SUN, fillOpacity: opacity, stroke: edged ? '#0a0a0a' : 'none', strokeWidth: edged ? 0.04 : 0 }).moveTo([0, vy(alt)]);
    await this.step('evening', {
      caption: `Looking west along the street on ${M.label(YEAR, half.doy)}: the Sun at five-minute intervals, compass bearing across and apparent altitude up, refraction included. It slides down and to the right, about 1° lower for every 1° further north. Its centre reaches 299.1° at ${M.clock(half.ms, { seconds: true })}, ${deg(half.apparent)} above a flat horizon. The buildings are schematic: a 30 m wide street seen from 2 km is an opening ${deg(2 * CANYON_HALF_WIDTH)} wide. The altitude at this one instant is what decides whether the evening gets a name.`,
    });
    await clearAll();
    await retitle(`On ${M.label(YEAR, half.doy)} the Sun crosses the bearing at ${minutes(half.ms)}`);
    const scenery = new Group(
      new Polygon([[vx(M.GRID_BEARING - AZ), vy(FLOOR)], [vx(M.GRID_BEARING + AZ), vy(FLOOR)], [vx(M.GRID_BEARING + AZ), vy(0)], [vx(M.GRID_BEARING - AZ), vy(0)]], { fill: MUTED, fillOpacity: 0.55, stroke: 'none' }),
      ...([-1, 1] as const).map((side) => new Polygon([
        [side * vx(M.GRID_BEARING + AZ), vy(2.2)], [side * vx(M.GRID_BEARING + AZ), vy(0)], [side * vx(M.GRID_BEARING + CANYON_HALF_WIDTH), vy(0)], [side * vx(M.GRID_BEARING + CANYON_HALF_WIDTH), vy(1.0)],
      ], { fill: MUTED, fillOpacity: 0.35, stroke: MUTED, strokeWidth: 0.02 })),
      new Line([vx(M.GRID_BEARING - AZ), vy(0)], [vx(M.GRID_BEARING + AZ), vy(0)], { stroke: INK, strokeWidth: 0.03 }),
      label('flat horizon, 0°', [vx(M.GRID_BEARING - AZ) + 0.1, vy(0) + 0.22], { size: 0.2, color: INK, edge: [-1, 0] }),
      new Line([0, vy(0)], [0, vy(3.0)], { stroke: GRID, strokeWidth: 0.02, strokeOpacity: 0.8 }),
      ...[297, 298, 299.1, 300, 301].map((b) => label(b === 299.1 ? '299.1°' : `${b}°`, [vx(b), vy(FLOOR) + 0.16], { size: 0.2, color: b === 299.1 ? GRID : SOFT, font: 'mono' })),
      ...[0, 1, 2].map((a) => label(`${a}°`, [vx(M.GRID_BEARING - AZ) - 0.3, vy(a)], { size: 0.2, edge: [1, 0], font: 'mono' })),
      ...[1, 2].map((a) => new Line([vx(M.GRID_BEARING - AZ), vy(a)], [vx(M.GRID_BEARING - AZ) + 0.2, vy(a)], { stroke: MUTED, strokeWidth: 0.02 })),
    );
    await this.play(new FadeIn(scenery), { runTime: 0.8 });
    {
      const track = new VMobject({ stroke: TRACK, strokeWidth: 0.03, strokeOpacity: 0.8, fill: 'none' });
      for (let m = -15; m <= 10; m++) {
        const p = M.sunAt(half.ms + m * 60000);
        if (p.apparent < FLOOR + 0.05) break;
        const at: Vec = [vx(p.azimuth), vy(p.apparent)];
        if (m === -15) track.startNewPath(at); else track.addLineTo(at);
      }
      const marks = [-15, -10, -5].map((m) => ({ p: M.sunAt(half.ms + m * 60000), time: minutes(half.ms + m * 60000) }));
      const ghosts = new Group(...marks.map(({ p }) => new Circle({ radius: M.SUN_RADIUS * K, fill: SUN, fillOpacity: 0.3, stroke: 'none' }).moveTo([vx(p.azimuth), vy(p.apparent)])));
      const times = new Group(...marks.map(({ p, time }) => label(time, [vx(p.azimuth), vy(p.apparent) - M.SUN_RADIUS * K - 0.22], { size: 0.2, font: 'mono' })));
      const sun = disc(half.apparent);
      const callout = new Group(
        new Line([M.SUN_RADIUS * K + 0.05, vy(half.apparent)], [M.SUN_RADIUS * K + 0.9, vy(half.apparent)], { stroke: SUN, strokeWidth: 0.02 }),
        label(`${minutes(half.ms)} · centre ${deg(half.apparent)} up`, [M.SUN_RADIUS * K + 1.0, clear(vy(half.apparent))], { size: 0.22, color: SUN, edge: [-1, 0], font: 'mono' }),
      );
      await this.play(new Create(track), { runTime: 1.2 });
      await this.play(new FadeIn(ghosts), new FadeIn(times), { runTime: 0.6 });
      await this.play(new FadeIn(sun), new FadeIn(callout), { runTime: 0.5 });
      st.evening = { date: M.label(YEAR, half.doy), time: M.clock(half.ms, { seconds: true }), apparent: +half.apparent.toFixed(3) };
      await this.wait(0.3);
    }

    // ---------------------------------------------------------------- ladder
    const names = ladder.map((c) => M.label(YEAR, c.doy));
    await this.step('ladder', {
      caption: `The same view, with the Sun drawn where its centre crosses 299.1° on six consecutive evenings. The crossing altitude rises ${deg(rate)} an evening, about two thirds of the disc's ${deg(2 * M.SUN_RADIUS)} diameter, because the Sun's declination is still increasing toward the June solstice. The disc goes from hidden to wholly clear of a flat horizon in about three evenings. The two evenings with a name are the ones whose disc sits on the horizon.`,
    });
    await clearAll(scenery);
    await retitle(`Each evening the crossing happens ${deg(rate)} higher`);
    const outlines = new Group(...ladder.map((c) => disc(c.apparent, { outline: true })));
    const centres = new Group(...ladder.map((c) => new Dot({ radius: 0.05, color: SUN }).moveTo([0, vy(c.apparent)])));
    const dates = new Group(...ladder.map((c, i) => label(names[i]!, [vx(M.GRID_BEARING - 0.56), clear(vy(c.apparent))], { size: 0.2, color: INK, edge: [1, 0], font: 'mono' })));
    await this.play(new FadeIn(outlines), new FadeIn(centres), new FadeIn(dates), { runTime: 1.2 });
    {
      const dx = vx(M.GRID_BEARING + 1.25);
      const dim = new Group(
        new Line([dx, vy(ladder[0]!.apparent)], [dx, vy(ladder[5]!.apparent)], { stroke: INK, strokeWidth: 0.025 }),
        new Line([dx - 0.1, vy(ladder[0]!.apparent)], [dx + 0.1, vy(ladder[0]!.apparent)], { stroke: INK, strokeWidth: 0.025 }),
        new Line([dx - 0.1, vy(ladder[5]!.apparent)], [dx + 0.1, vy(ladder[5]!.apparent)], { stroke: INK, strokeWidth: 0.025 }),
        label(`${deg(ladder[5]!.apparent - ladder[0]!.apparent)} over 5 evenings`, [dx + 0.2, vy((ladder[0]!.apparent + ladder[5]!.apparent) / 2)], { size: 0.2, color: INK, edge: [-1, 0], font: 'mono' }),
      );
      await this.play(new FadeIn(dim), { runTime: 0.5 });
      st.ladder = ladder.map((c, i) => ({ date: names[i], apparent: +c.apparent.toFixed(3) }));
      st.perEvening = +rate.toFixed(3);
      await this.wait(0.3);
      await this.step('names', {
        caption: `Half Sun on the Grid is the evening whose crossing puts the centre nearest a flat horizon: ${M.label(YEAR, half.doy)} at ${minutes(half.ms)}. Full Sun on the Grid puts the lower edge there, the centre one radius higher: ${M.label(YEAR, full.doy)} at ${minutes(full.ms)}. The Hayden Planetarium publishes ${PUBLISHED.half.date} and ${PUBLISHED.full.date}. Its minutes agree with this model's instants to within a minute, since the clock time of a crossing does not depend on the horizon. Its choice of evening does: a horizon about 0.4° high gives its May pair and about 0.7° its July pair, and no single height gives both. The height of the visible horizon is the one input this model does not measure.`,
      });
      await this.play(new FadeOut(dim, { runTime: 0.4 }));
      await retitle(`Half Sun on ${M.label(YEAR, half.doy)}, Full Sun on ${M.label(YEAR, full.doy)}`);
      const halfDisc = disc(half.apparent, { edged: true }), fullDisc = disc(full.apparent, { edged: true });
      await this.play(new FadeIn(fullDisc), new FadeIn(halfDisc), { runTime: 0.6 });
      // The lower callout goes under the horizon line when its disc sits on it, so the two labels never meet.
      const textY = (a: M.Alignment, lower: boolean) => (lower && Math.abs(vy(a.apparent) - vy(0)) < 0.3 ? vy(0) - 0.26 : clear(vy(a.apparent)));
      const callouts = new Group(
        ...[half, full].flatMap((a) => [
          new Line([M.SUN_RADIUS * K + 0.05, vy(a.apparent)], [M.SUN_RADIUS * K + 1.1, textY(a, a.apparent < Math.max(half.apparent, full.apparent))], { stroke: SUN, strokeWidth: 0.02 }),
          label(`${a.event === 'half' ? 'Half Sun' : 'Full Sun'} · ${M.label(YEAR, a.doy)} · ${minutes(a.ms)}`, [M.SUN_RADIUS * K + 1.2, textY(a, a.apparent < Math.max(half.apparent, full.apparent))], { size: 0.22, color: SUN, edge: [-1, 0], font: 'mono' }),
        ]),
      );
      await this.play(new FadeIn(callouts), { runTime: 0.5 });
      const card = new StateReadout([['Hayden, Half Sun', `${PUBLISHED.half.date} · ${PUBLISHED.half.time}`], ['Hayden, Full Sun', `${PUBLISHED.full.date} · ${PUBLISHED.full.time}`]], { fontSize: 0.24, at: [-4.6, 1.9], gap: 0.5 });
      await this.play(new FadeIn(card), { runTime: 0.5 });
      st.half = { date: M.label(YEAR, half.doy), time: M.clock(half.ms, { seconds: true }), apparent: +half.apparent.toFixed(3) };
      st.full = { date: M.label(YEAR, full.doy), time: M.clock(full.ms, { seconds: true }), apparent: +full.apparent.toFixed(3) };
      st.published = PUBLISHED;
      await this.wait(1.0);
    }
  }
}
