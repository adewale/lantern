import {
  Scene,
  Circle,
  Line,
  Text,
  Group,
  Polygon,
  Dot,
  Arc,
  Arrow,
  FadeIn,
  FadeOut,
  Create,
} from '../../../src/index.ts';
import type { Vec } from '../../../src/index.ts';
import { stage, settingsOf } from '../../../explain/index.ts';
import type { Diagram } from '../../../explain/index.ts';
import { sunlight, daylightYear } from '../lib/models.ts';

const PLACES: Record<string, { name: string; lat: number }> = {
  tromso: { name: 'Tromsø', lat: 69.65 },
  london: { name: 'London', lat: 51.5 },
  quito: { name: 'Quito', lat: 0 },
  sydney: { name: 'Sydney', lat: -33.87 },
};
const ORDER = ['tromso', 'london', 'quito', 'sydney'] as const;
const TILT = 23.44;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUN = '#e0af68',
  EARTH = '#3d59a1',
  NIGHT = '#16161e',
  AXIS = '#9ece6a',
  PLACE = '#f7768e',
  DIMLINE = '#565f89';
const RAD = Math.PI / 180;
const hours = (h: number) => h.toFixed(1) + ' h';
const degrees = (d: number) => d.toFixed(1) + '°';
const chartSource = (series: readonly (readonly number[])[]) =>
  'xychart-beta\n x-axis [' +
  MONTHS.join(',') +
  ']\n y-axis "Daylight hours" 0 --> 24\n' +
  series.map((s) => ' line [' + s.join(',') + ']').join('\n');

/**
 * Side view of Earth at noon for one season. The drawing plane holds the
 * rotation axis and the Sun direction, so a latitude circle projects to a
 * chord and the terminator is the line through the centre facing the Sun.
 * `side` is the Sun's direction from this Earth (+1 = Sun to the right).
 */
function sideView(center: Vec, radius: number, side: 1 | -1) {
  const e = TILT * RAD;
  // The axis keeps one direction in space: north leans toward −x.
  const a: Vec = [-Math.sin(e), Math.cos(e)];
  // The equator direction on the noon meridian, pointing toward the Sun.
  const eq: Vec = side < 0 ? [-Math.cos(e), -Math.sin(e)] : [Math.cos(e), Math.sin(e)];
  const at = (u: number, v: number): Vec => [
    center[0] + radius * (u * eq[0] + v * a[0]),
    center[1] + radius * (u * eq[1] + v * a[1]),
  ];
  /** The noon point at a latitude: cos φ along the equator, sin φ along the axis. */
  const noon = (lat: number) => at(Math.cos(lat * RAD), Math.sin(lat * RAD));
  /** A latitude circle's chord, split where it crosses the terminator. */
  const chord = (lat: number) => {
    const c = Math.cos(lat * RAD),
      sn = Math.sin(lat * RAD);
    // Sun-side component of a point: sn·(a·s) + t·(eq·s); eq·s = cos ε.
    const as = a[0] * side;
    const t0 = Math.max(-c, Math.min(c, (-sn * as) / Math.cos(e)));
    return {
      day: [at(t0, sn), at(c, sn)] as [Vec, Vec],
      night: [at(-c, sn), at(t0, sn)] as [Vec, Vec],
      far: at(-c - 0.16, sn),
    };
  };
  return { a, eq, at, noon, chord };
}

export default class SeasonsExplainer extends Scene {
  static meta = {
    id: 'seasons',
    title: 'Why June brings polar day to Tromsø and winter to Sydney',
    sources: [
      'https://spaceplace.nasa.gov/seasons/en/',
      'https://gml.noaa.gov/grad/solcalc/calcdetails.html',
      'https://en.wikipedia.org/wiki/Position_of_the_Sun#Declination_of_the_Sun_as_seen_from_Earth',
    ],
  };
  static settings = [
    {
      id: 'place',
      label: 'Observe from',
      default: 'london',
      options: [
        { value: 'tromso', label: 'Tromsø' },
        { value: 'london', label: 'London' },
        { value: 'quito', label: 'Quito' },
        { value: 'sydney', label: 'Sydney' },
      ],
    },
  ];
  override async construct() {
    const key = settingsOf(this).place!,
      place = PLACES[key]!,
      s = stage(this, { style: 'tokyo-night' });
    const ink = s.palette.ink,
      soft = s.soft;
    const label = (text: string, at: Vec, opts: { size?: number; color?: string; edge?: Vec } = {}) =>
      new Text(text, {
        fontSize: opts.size ?? 0.22,
        color: opts.color ?? soft,
      }).moveTo(at, opts.edge ?? [0, 0]);

    // ---------------------------------------------------------------- tilt
    await this.step('tilt', {
      title: 'The axis keeps its direction all year',
      caption:
        'Earth’s axis is tilted 23.44° from the normal to its orbit and points the same way all year, so the north end leans toward the Sun in June and away from it in December. Sizes and distances are not to scale.',
    });
    {
      const c: Vec = [0, -0.45],
        rx = 5.6,
        ry = 2.2;
      const orbit = new Circle({
        radius: 1,
        stroke: s.palette.muted,
        strokeWidth: 0.02,
      })
        .stretch(rx, 0)
        .stretch(ry, 1)
        .moveTo(c);
      const sun = new Circle({ radius: 0.5, fill: SUN, stroke: 'none' }).moveTo(c);
      const earth = (x: number, y: number, name: string, below: boolean, bright: boolean) => {
        const e = TILT * RAD,
          r = 0.36,
          len = 0.62;
        const g = new Group(
          new Circle({
            radius: r,
            fill: bright ? '#7aa2f7' : EARTH,
            stroke: 'none',
          }).moveTo([x, y]),
          new Line(
            [x + len * Math.sin(e), y - len * Math.cos(e)],
            [x - len * Math.sin(e), y + len * Math.cos(e)],
            { stroke: AXIS, strokeWidth: 0.04 },
          ),
          label('N', [x - (len + 0.16) * Math.sin(e), y + (len + 0.16) * Math.cos(e)], {
            size: 0.2,
            color: AXIS,
          }),
          label(name, [x, below ? y - 0.95 : y + 1.05], {
            size: bright ? 0.26 : 0.22,
            color: bright ? ink : soft,
          }),
        );
        return g;
      };
      const june = earth(c[0] + rx, c[1], 'June', true, true),
        december = earth(c[0] - rx, c[1], 'December', true, true),
        september = earth(c[0], c[1] + ry, 'September', false, false),
        march = earth(c[0], c[1] - ry, 'March', true, false);
      await this.play(new Create(s.keep(orbit)), new FadeIn(s.keep(sun)));
      await s.enter(june, december, september, march);
    }

    // ---------------------------------------------------------------- june
    const R = 1.7,
      CY = 0.95,
      JUNE_C: Vec = [4.3, CY],
      DEC_C: Vec = [-4.3, CY];
    const june = sunlight(place.lat, TILT),
      december = sunlight(place.lat, -TILT);
    /** One season: Earth, night half, axis, the place's latitude circle and the noon ray. */
    const season = (center: Vec, side: 1 | -1, result: { altitude: number; daylight: number }) => {
      const v = sideView(center, R, side);
      const ball = new Circle({
        radius: R,
        fill: EARTH,
        stroke: 'none',
      }).moveTo(center);
      const half: Vec[] = [];
      for (let i = 0; i <= 40; i++) {
        const th = -Math.PI / 2 + (Math.PI * i) / 40;
        half.push([center[0] - side * R * Math.cos(th), center[1] + R * Math.sin(th)]);
      }
      const night = new Polygon(half, {
        fill: NIGHT,
        fillOpacity: 0.62,
        stroke: 'none',
      });
      const tip = 1.28 * R;
      const axis = new Line(
        [center[0] - tip * v.a[0], center[1] - tip * v.a[1]],
        [center[0] + tip * v.a[0], center[1] + tip * v.a[1]],
        { stroke: AXIS, strokeWidth: 0.035 },
      );
      const north = label('N', [center[0] + (tip + 0.18) * v.a[0], center[1] + (tip + 0.18) * v.a[1]], {
        size: 0.22,
        color: AXIS,
      });
      const equator = new Line(v.at(-1, 0), v.at(1, 0), {
        stroke: s.palette.muted,
        strokeWidth: 0.02,
        dashArray: '0.08 0.06',
      });
      const ch = v.chord(place.lat);
      const dayLine = new Line(ch.day[0], ch.day[1], {
        stroke: SUN,
        strokeWidth: 0.07,
      });
      const nightLine = new Line(ch.night[0], ch.night[1], {
        stroke: DIMLINE,
        strokeWidth: 0.05,
      });
      const p = v.noon(place.lat);
      const zen: Vec = [(p[0] - center[0]) / R, (p[1] - center[1]) / R];
      const tangent: Vec = [-zen[1], zen[0]];
      const horizon = new Line(
        [p[0] - 0.55 * tangent[0], p[1] - 0.55 * tangent[1]],
        [p[0] + 0.55 * tangent[0], p[1] + 0.55 * tangent[1]],
        { stroke: ink, strokeWidth: 0.025 },
      );
      const dot = new Dot({ radius: 0.09, color: PLACE }).moveTo(p);
      const drawing = new Group(ball, night, equator, nightLine, dayLine, axis, north, horizon, dot);
      const ray = new Group();
      if (result.altitude > 0) {
        // The noon ray arrives parallel to the Sun direction; its angle to the
        // local horizon is the model's altitude (90° − |latitude − declination|).
        const start: Vec = [side > 0 ? center[0] + R + 1.15 : center[0] - R - 1.15, p[1]];
        ray.add(
          new Arrow([side > 0 ? Math.max(start[0], p[0] + 0.9) : Math.min(start[0], p[0] - 0.9), p[1]], p, {
            stroke: SUN,
            strokeWidth: 0.035,
            tipLength: 0.2,
            tipWidth: 0.16,
          }),
        );
        // Arc between the sunward horizon direction and the ray direction.
        const hz = tangent[0] * side >= 0 ? tangent : ([-tangent[0], -tangent[1]] as Vec);
        const a0 = Math.atan2(hz[1], hz[0]),
          a1 = side > 0 ? 0 : Math.PI;
        let sweep = a1 - a0;
        while (sweep > Math.PI) sweep -= 2 * Math.PI;
        while (sweep < -Math.PI) sweep += 2 * Math.PI;
        ray.add(
          new Arc({
            center: p,
            radius: 0.5,
            startAngle: a0,
            angle: sweep,
            stroke: SUN,
            strokeWidth: 0.025,
          }),
        );
        const mid = a0 + sweep / 2;
        ray.add(
          label(degrees(result.altitude), [p[0] + 0.95 * Math.cos(mid), p[1] + 0.95 * Math.sin(mid)], {
            size: 0.24,
            color: SUN,
          }),
        );
      } else {
        // The model puts the noon Sun below the horizon: a ray at the place's
        // height meets the day side of the globe first and never reaches it.
        const dy = p[1] - center[1],
          hit: Vec = [center[0] + side * Math.sqrt(Math.max(0, R * R - dy * dy)), p[1]];
        ray.add(
          new Arrow([center[0] + side * (R + 1.15), p[1]], hit, {
            stroke: SUN,
            strokeWidth: 0.035,
            tipLength: 0.2,
            tipWidth: 0.16,
          }),
        );
      }
      return { view: v, drawing, ray, dayLine, nightLine };
    };
    const sun = new Circle({ radius: 0.55, fill: SUN, stroke: 'none' }).moveTo([0, CY]);
    const seasonCard = (
      title: string,
      r: { altitude: number; daylight: number },
      box: [number, number, number, number],
    ) =>
      s.card(
        [
          [
            'Noon Sun altitude',
            r.altitude > 0 ? degrees(r.altitude) : degrees(r.altitude) + ', below horizon',
          ],
          ['Daylight', hours(r.daylight)],
        ],
        { at: box, title, fontSize: 0.24 },
      );
    const RIGHT_CARD: [number, number, number, number] = [1.7, -4.2, 7.3, -1.05],
      LEFT_CARD: [number, number, number, number] = [-7.3, -4.2, -1.7, -1.05];

    await this.step('june', {
      title: `June: ${place.name}’s noon Sun at ${degrees(june.altitude)}`,
      caption:
        place.lat < 0
          ? `In June the north end of the axis leans toward the Sun. Sydney is south of the equator, so its noon Sun is low and most of its latitude circle, the line through the dot, is on the night side: ${hours(june.daylight)} of daylight in its winter.`
          : place.lat > 60
            ? 'In June the north end leans toward the Sun far enough that Tromsø’s whole latitude circle sits on the day side. As Earth turns, Tromsø never enters the night half, so the Sun stays up for all 24 hours.'
            : place.lat === 0
              ? 'In June the north end leans toward the Sun, but the day–night line still cuts the equator exactly in half. Quito’s circle is half day and half night, so it gets 12 hours of daylight.'
              : `In June the north end leans toward the Sun. London’s noon Sun is high, and about two thirds of its latitude circle, the line through the dot, is on the day side, which gives ${hours(june.daylight)} of daylight.`,
    });
    await s.clear();
    const J = season(JUNE_C, -1, june);
    await s.enter(sun, J.drawing);
    await s.enter(J.ray);
    const juneCard = await seasonCard('June', june, RIGHT_CARD);
    this.state = { place: place.name, latitude: place.lat, june };

    // ------------------------------------------------------------ december
    await this.step('december', {
      title: `December: the same axis, ${place.name}’s Sun at ${degrees(december.altitude)}`,
      caption:
        'Half an orbit later Earth is on the far side of the Sun, but the axis still points the same way, so the south end now leans sunward and the hemispheres swap seasons. ' +
        (Math.abs(june.daylight - december.daylight) > 0.05
          ? `In the marked row, ${place.name}’s daylight ${december.daylight > june.daylight ? 'rises' : 'drops'} from ${hours(june.daylight)} in June to ${hours(december.daylight)}.`
          : `${place.name}’s noon Sun stands at the same ${degrees(december.altitude)}, now to the south, and its daylight stays at ${hours(december.daylight)}.`),
    });
    const D = season(DEC_C, 1, december);
    await s.enter(D.drawing);
    await s.enter(D.ray);
    const decCard = await seasonCard('December', december, LEFT_CARD);
    await (Math.abs(june.daylight - december.daylight) > 0.05
      ? decCard.mark('Daylight')
      : decCard.mark('Noon Sun altitude'));
    this.state.december = december;

    // ------------------------------------------------------------ latitude
    await this.step('latitude', {
      title: 'Latitude sets how much of each circle is lit',
      caption:
        'Each line is one place’s latitude circle, yellow where it is in daylight. Tromsø’s circle is all day in June and all night in December, while the equator’s is always cut in half. The model’s day length in hours is acos(−tan latitude × tan declination) in degrees, divided by 7.5.',
    });
    await this.play(...[juneCard, decCard].map((c) => new FadeOut(c, { runTime: 0.3 })));
    const others = ORDER.filter((k) => k !== key);
    const extra = new Group();
    for (const [center, side] of [
      [JUNE_C, -1],
      [DEC_C, 1],
    ] as const) {
      const v = sideView(center, R, side);
      for (const k of others) {
        const ch = v.chord(PLACES[k]!.lat);
        extra.add(
          new Line(ch.night[0], ch.night[1], {
            stroke: DIMLINE,
            strokeWidth: 0.035,
          }),
          new Line(ch.day[0], ch.day[1], {
            stroke: SUN,
            strokeWidth: 0.035,
            strokeOpacity: 0.75,
          }),
        );
      }
      // Name the circles once, on the December side, where their ends are well apart.
      if (side > 0)
        for (const k of ORDER) {
          const ch = v.chord(PLACES[k]!.lat);
          extra.add(
            label(PLACES[k]!.name, ch.far, {
              size: 0.2,
              color: k === key ? PLACE : soft,
              edge: side < 0 ? [-1, 0] : [1, 0],
            }),
          );
        }
    }
    await s.enter(extra);
    const table = (title: string, decl: number, box: [number, number, number, number]) =>
      s.card(
        ORDER.map((k) => [PLACES[k]!.name, hours(sunlight(PLACES[k]!.lat, decl).daylight)] as const),
        { at: box, title, fontSize: 0.24 },
      );
    const juneTable = await table('June', TILT, RIGHT_CARD);
    const decTable = await table('December', -TILT, LEFT_CARD);
    await juneTable.mark(place.name);
    await decTable.mark(place.name);

    // ---------------------------------------------------------------- year
    const year = daylightYear(place.lat);
    await this.step('year', {
      title: `A computed year of daylight in ${place.name}`,
      caption:
        'The chart runs the same model on the 15th of each month, with the Sun’s declination for that day. The two dots are mid-June and mid-December, within a week of the solstices in the side views, and the card marks the gap between the longest and shortest.',
    });
    await s.clear();
    this.state.daylight = year;
    const CHART: [number, number, number, number] = [-7.55, -4.25, 1.6, 3.25];
    const chart = await s.show({ source: chartSource([year]) }, { box: CHART });
    const plot = (d: Diagram, month: number, value: number): Vec => {
      const x = d.get('axis:x:tick:' + MONTHS[month]).center()[0];
      const y0 = d.get('axis:y:tick:0').center()[1],
        y24 = d.get('axis:y:tick:24').center()[1];
      return [x, y0 + (value / 24) * (y24 - y0)];
    };
    const pin = (month: number, value: number, color: string, above: boolean) => {
      const p = plot(chart, month, value);
      const g = new Group(
        new Dot({ radius: 0.1, color }).moveTo(p),
        label(hours(value), [p[0], p[1] + (above ? 0.36 : -0.36)], {
          size: 0.22,
          color,
        }),
      );
      return g;
    };
    const juneHigh = year[5]! >= year[11]!;
    const pins = [
      pin(5, year[5]!, SUN, juneHigh || year[5]! < 2),
      pin(11, year[11]!, '#7dcfff', !juneHigh || year[11]! < 2),
    ];
    await s.enter(...pins);
    const yearCard = await s.card(
      [
        ['Latitude', degrees(place.lat)],
        ['Longest − shortest', hours(Math.max(...year) - Math.min(...year))],
      ],
      { at: [2.2, -2.5, 7.45, 2.8], fontSize: 0.24 },
    );
    await yearCard.mark('Longest − shortest');

    // ------------------------------------------------------------ distance
    const mirror = daylightYear(-place.lat);
    await this.step('distance', {
      title: 'Earth is nearest the Sun in January, during the northern winter',
      caption:
        place.lat !== 0
          ? `Earth is nearest the Sun in early January. On 15 January ${place.name} gets ${hours(year[0]!)} of daylight and the card’s last row, latitude ${degrees(-place.lat)}, gets ${hours(mirror[0]!)}. Both are the same distance from the Sun that day, so the opposite seasons must come from the tilt.`
          : `Earth is nearest the Sun in early January, yet the card shows Quito with ${hours(year[0]!)} of daylight in January and in July. The model has no distance term: day length depends only on latitude and the Sun’s declination, which the tilt sets.`,
    });
    await this.play(new FadeOut(yearCard, { runTime: 0.3 }));
    const jan = plot(chart, 0, year[0]!),
      top = plot(chart, 0, 24);
    const marker = new Group(
      new Line([jan[0], plot(chart, 0, 0)[1]], top, {
        stroke: SUN,
        strokeWidth: 0.025,
        dashArray: '0.1 0.08',
      }),
      new Dot({ radius: 0.1, color: SUN }).moveTo(jan),
    );
    await s.enter(marker);
    // Exaggerated eccentric orbit: Sun off-centre, Earth nearest at one end.
    {
      const oc: Vec = [5.1, 1.35],
        orx = 1.9,
        ory = 1.0,
        sunX = oc[0] + 0.85;
      const orbit = new Circle({
        radius: 1,
        stroke: s.palette.muted,
        strokeWidth: 0.02,
      })
        .stretch(orx, 0)
        .stretch(ory, 1)
        .moveTo(oc);
      const near = new Group(
        new Circle({ radius: 0.16, fill: '#7aa2f7', stroke: 'none' }).moveTo([oc[0] + orx, oc[1]]),
        label('January', [oc[0] + orx + 0.2, oc[1] - 0.5], {
          size: 0.22,
          color: ink,
          edge: [1, 0],
        }),
      );
      const far = new Group(
        new Circle({ radius: 0.16, fill: EARTH, stroke: 'none' }).moveTo([oc[0] - orx, oc[1]]),
        label('July', [oc[0] - orx - 0.15, oc[1] - 0.5], {
          size: 0.22,
          color: soft,
          edge: [-1, 0],
        }),
      );
      const sketch = new Group(
        orbit,
        new Circle({ radius: 0.28, fill: SUN, stroke: 'none' }).moveTo([sunX, oc[1]]),
        near,
        far,
      );
      await s.enter(sketch);
    }
    const distanceCard = await s.card(
      [
        [place.name + ', January', hours(year[0]!)],
        [place.name + ', July', hours(year[6]!)],
        [`At ${degrees(-place.lat)}, January`, hours(mirror[0]!)],
      ],
      {
        at: [2.2, -3.4, 7.45, -0.1],
        fontSize: 0.24,
      },
    );
    await distanceCard.mark(place.name + ', January');

    // ------------------------------------------------------------- compare
    await this.step('compare', {
      title: 'The same formula draws all four daylight curves',
      caption:
        'The chart runs the same model at four latitudes. Tromsø swings between polar night and polar day, London and Sydney peak six months apart, and Quito stays at 12 hours.',
    });
    await s.clear();
    const all = ORDER.map((k) => daylightYear(PLACES[k]!.lat));
    const CMP: [number, number, number, number] = [-5.7, -4.25, 6.3, 3.25];
    // Build without the renderer's legend: the native labels at each line's end name the lines.
    const cmp = await s.show({ source: chartSource(all) }, { box: CMP, build: 'frame' });
    await cmp.reveal(cmp.order.filter((id) => id !== 'legend' && !cmp.visible.has(id)));
    const mine = 'series:line-' + ORDER.indexOf(key as (typeof ORDER)[number]);
    await cmp.dim([mine]);
    await cmp.mark([mine], { color: PLACE });
    const ends = new Group();
    ORDER.forEach((k, i) => {
      const p = plot(cmp, 11, all[i]![11]!);
      ends.add(
        label(PLACES[k]!.name, [p[0] + 0.25, p[1]], {
          size: 0.22,
          color: k === key ? PLACE : soft,
          edge: [-1, 0],
        }),
      );
    });
    await s.enter(ends);
  }
}
