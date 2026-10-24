import {
  Scene,
  Circle,
  Line,
  Text,
  Group,
  FadeIn,
  FadeOut,
  Transform,
  Indicate,
} from '../../../src/index.ts';
import { stage, palette, settingsOf } from '../../../explain/index.ts';
import { sunlight, daylightYear } from '../lib/models.ts';
const PLACES: Record<string, { name: string; lat: number }> = {
  tromso: { name: 'Tromsø', lat: 69.65 },
  london: { name: 'London', lat: 51.5 },
  quito: { name: 'Quito', lat: 0 },
  sydney: { name: 'Sydney', lat: -33.87 },
};
export default class SeasonsExplainer extends Scene {
  static meta = {
    id: 'seasons',
    title: 'The same June Sun, four different summers',
    sources: [
      'https://spaceplace.nasa.gov/seasons/en/',
      'https://gml.noaa.gov/grad/solcalc/calcdetails.html',
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
    const place = PLACES[settingsOf(this).place!]!,
      s = stage(this, {
        palette: palette('tokyo-night'),
        title: 'Tilt changes the angle and length of daylight',
      });
    await this.step('tilt', {
      title: 'The axis keeps its direction',
      caption:
        'Earth’s rotation axis is tilted about 23.44 degrees relative to its orbital normal. As Earth travels around the Sun, that axis points approximately the same way. This drawing is schematic, not to scale.',
    });
    const sun = new Circle({ radius: 0.6, fill: '#e0af68', stroke: 'none' }),
      orbit = new Circle({ radius: 3.6, stroke: s.palette.muted, strokeWidth: 0.015 }).stretch(0.5, 1);
    const earthAt = (x: number) => {
      const earth = new Circle({ radius: 0.6, fill: '#7aa2f7', stroke: 'none' }).moveTo([x, 0]);
      const axis = new Line([x - 0.4, 0.95], [x + 0.4, -0.95], { stroke: '#9ece6a', strokeWidth: 0.04 });
      return new Group(
        earth,
        axis,
        new Text('N', { fontSize: 0.2, color: '#9ece6a' }).moveTo([x - 0.5, 1.2]),
      );
    };
    const earth = earthAt(3.6),
      tag = new Text('not to scale', { fontSize: 0.2, color: s.palette.muted }).moveTo([0, -2.5]);
    await this.play(new FadeIn(orbit), new FadeIn(sun), new FadeIn(earth), new FadeIn(tag));
    await this.step('june', {
      title: `June in ${place.name}`,
      caption:
        place.lat < 0
          ? 'In June the northern hemisphere tilts toward the Sun. Sydney is in the southern hemisphere, so its Sun is lower and its daylight shorter. June is winter there.'
          : place.lat > 60
            ? 'At Tromsø’s latitude the June tilt keeps the Sun above the horizon through the whole day. Polar day is a geometry result, not a hotter or closer Sun.'
            : place.lat === 0
              ? 'At the equator the length of daylight stays close to twelve hours through the year. The familiar northern summer-versus-winter pattern is much weaker.'
              : 'London’s June Sun is higher at noon and stays above the horizon longer. More concentrated sunlight and longer days are the main seasonal effects of the tilt.',
    });
    const june = sunlight(place.lat, 23.44);
    await s.card(
      [
        ['Place', place.name],
        ['Latitude', place.lat + '°'],
        ['June noon altitude', june.altitude.toFixed(1) + '°'],
        ['Daylight', june.daylight.toFixed(1) + ' hours'],
      ],
      { at: [-4.6, -0.3], width: 5.3 },
    );
    this.state = { place: place.name, latitude: place.lat, june };
    await this.step('december', {
      title: 'Half an orbit later, the axis still points the same way',
      caption:
        'In December the southern hemisphere tilts toward the Sun. The hemispheres exchange their seasonal roles. The axis has not flipped to chase the Sun.',
    });
    await s.clearOverlays();
    await this.play(new Transform(earth, earthAt(-3.6)), { runTime: 1.5 });
    const december = sunlight(place.lat, -23.44);
    await s.card(
      [
        ['December noon altitude', december.altitude.toFixed(1) + '°'],
        ['Daylight', december.daylight.toFixed(1) + ' hours'],
      ],
      { at: [4.4, 0], width: 5.8 },
    );
    this.state.december = december;
    await this.step('latitude', {
      title: 'Latitude changes the size of the effect',
      caption:
        'The simplified model uses solar declination and latitude to compute noon altitude and day length. It omits atmospheric refraction, terrain and the exact calendar ephemeris. The chart is an explanatory approximation.',
    });
    await s.clearOverlays();
    await this.play(...[orbit, sun, earth, tag].map((m) => new FadeOut(m)));
    await s.card(
      [
        ['Noon altitude', '90° − |latitude − declination|'],
        ['Day length', 'acos(−tan(latitude) × tan(declination))'],
        ['Polar cases', 'Clamp to 0 or 24 hours'],
      ],
      { at: [0, 0], width: 13 },
    );
    await this.step('year', {
      title: `A computed year in ${place.name}`,
      caption:
        'Every plotted value comes from the daylight model, sampled across twelve equally spaced seasonal positions. Switch place to compare opposite hemispheres, the equator and polar day or night.',
    });
    await s.clearOverlays();
    const year = daylightYear(place.lat);
    this.state.daylight = year;
    const chart = await s.show({
      source:
        'xychart-beta\n x-axis [Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec]\n y-axis "Daylight hours" 0 --> 24\n line [' +
        year.join(',') +
        ']',
      style: 'tokyo-night',
    });
    await this.step('distance', {
      title: 'Distance cannot explain opposite seasons',
      caption:
        'Earth is actually nearest the Sun in early January. A distance-only story cannot explain why one hemisphere has summer while the other has winter on the same day.',
    });
    await chart.highlight(chart.order.filter((id) => id.includes('line')).slice(0, 1));
    await this.step('compare', {
      title: 'Change the place, keep the physics',
      caption:
        'The useful reader setting changes the lesson: Sydney reverses London’s seasons, Tromsø reaches polar day and night, and Quito stays near twelve hours. The diagram’s visual style stays the same.',
    });
    await s.chip(`${place.name} · ${place.lat}° latitude`);
  }
}
