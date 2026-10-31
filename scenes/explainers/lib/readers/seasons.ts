import { Group, Circle, Line, Axes } from '../../../../src/index.ts';
import { sunlight, daylightYear } from '../models.ts';
import { label, bars } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(place: { name: string; lat: number }): ReaderFrame[] {
  const june = sunlight(place.lat, 23.44),
    dec = sunlight(place.lat, -23.44),
    year = daylightYear(place.lat);
  return [
    {
      id: 'reader-tilt',
      title: 'Why does the same place change season?',
      line: `${place.name}, latitude ${place.lat}°.`,
      caption:
        'Earth’s axis keeps roughly the same direction as Earth orbits the Sun. The two parallel axis lines show that fixed direction. Six months later the same hemisphere leans away instead of toward the Sun, changing both noon altitude and hours of daylight. The sketch is not to scale.',
      values: { latitude: place.lat, june, dec },
      draw: (s) => {
        const g = new Group(
          new Circle({ radius: 0.8, fill: s.emphasis, stroke: 'none' }),
          label('Sun', 0, -1.5, s.palette.ink, 0.7),
        );
        for (const [x, title] of [
          [-5, 'June'],
          [5, 'December'],
        ] as const)
          g.add(
            new Circle({ radius: 1, fill: s.palette.paper, stroke: s.soft, strokeWidth: 0.05 }).moveTo([x, 0]),
            new Line([x - 0.7, -1.6], [x + 0.7, 1.6], { stroke: s.emphasis, strokeWidth: 0.07 }),
            label('N', x + 0.9, 1.9, s.palette.ink, 0.7),
            label(title, x, -2, s.palette.ink, 0.7),
          );
        return g;
      },
    },
    {
      id: 'reader-solstices',
      title: 'Compare June with December',
      line: 'Same latitude; opposite solar declinations.',
      caption: `At ${place.name}, the model gives ${june.daylight.toFixed(1)} hours of daylight in June and ${dec.daylight.toFixed(1)} in December. Noon altitude is ${june.altitude.toFixed(1)}° versus ${dec.altitude.toFixed(1)}°. Higher sunlight and longer days change the energy received; distance from the Sun does not explain opposite seasons in opposite hemispheres.`,
      values: { june, dec },
      draw: (s) =>
        bars(
          s,
          [
            { label: 'June daylight', value: june.daylight, display: june.daylight.toFixed(1) + ' h' },
            { label: 'December daylight', value: dec.daylight, display: dec.daylight.toFixed(1) + ' h' },
          ],
          24,
        ),
    },
    {
      id: 'reader-year',
      title: 'What happens between the solstices?',
      line: 'Twelve monthly samples on one fixed 0–24 hour scale.',
      caption:
        'The whole annual daylight curve stays in one view. The model samples the fifteenth of each month using a cosine approximation for declination, rather than an astronomical ephemeris. Compare latitudes above: the equator stays near twelve hours; polar places can reach an entire day or night.',
      values: { year, latitude: place.lat },
      draw: (s) => {
        const axes = new Axes({
          xRange: [0, 11, 11],
          yRange: [0, 24, 12],
          width: 12,
          height: 4,
          yAxisStyle: {includeNumbers:true},
          axisStyle: { stroke: s.soft, labelColor: s.palette.ink, labelFontSize: 0.65, includeNumbers: false },
        }).moveTo([0.2, -0.1]);
        return new Group(
          axes,
          axes.lineGraph(
            year.map((v, i) => [i, v] as [number, number]),
            { color: s.emphasis, strokeWidth: 0.07 },
          ),
          label('Jan', -5.7, -3, s.palette.ink, 0.7),
          label('Dec', 6.1, -3, s.palette.ink, 0.7),
          label('Hours of daylight', 0, 2.8, s.palette.ink, 0.7),
        );
      },
    },
  ];
}
