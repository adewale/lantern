// Manhattanhenge as a small solar model. Sun positions follow Meeus,
// *Astronomical Algorithms* (2nd ed.), chapter 25 "Solar coordinates" (the
// low-accuracy method, good to about 0.01°), chapter 13 for altitude and
// azimuth, and formula 16.4 (Saemundsson) for refraction at a standard
// atmosphere. Nothing here draws; the scenes and the test ask it questions.

/** 5th Avenue at 42nd Street, the Hayden Planetarium's reference point. */
export const OBSERVER = { lat: 40.7534, lon: -73.9807 } as const;
/** The compass bearing of Manhattan's cross-streets looking west (AMNH). */
export const GRID_BEARING = 299.1;
/** The Sun's mean angular radius, degrees. */
export const SUN_RADIUS = 0.2666;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const norm360 = (d: number) => ((d % 360) + 360) % 360;

/** Julian day of a UTC instant. */
export function julianDay(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

export interface SunPlace {
  /** Degrees from north through east, 0..360. */
  azimuth: number;
  /** Geometric altitude of the Sun's centre, degrees. */
  altitude: number;
  /** Apparent altitude of the centre after refraction, degrees. */
  apparent: number;
  declination: number;
}

/** Refraction to add to a true altitude (Meeus 16.4, Saemundsson 1986), degrees. */
export function refraction(trueAltitude: number): number {
  const h = trueAltitude;
  return 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RAD) / 60;
}

/** Where the Sun is, from an observer, at a UTC instant in milliseconds. */
export function sunAt(ms: number, observer = OBSERVER): SunPlace {
  const jd = julianDay(ms);
  const T = (jd - 2451545) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr);
  const trueLon = L0 + C;
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = (trueLon - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;
  const eps0 = 23 + 26 / 60 + 21.448 / 3600 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000);
  const H = (norm360(gmst + observer.lon) - ra * DEG) * RAD;
  const phi = observer.lat * RAD;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) * DEG;
  const azimuth = norm360(Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) * DEG + 180);
  return { azimuth, altitude, apparent: altitude + refraction(altitude), declination: dec * DEG };
}

/** New York civil time for a UTC instant: EDT (UTC−4) between the second Sunday of March and the first Sunday of November, else EST. */
export function newYorkOffsetHours(ms: number): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1));
    const day = 1 + ((7 - first.getUTCDay()) % 7) + (n - 1) * 7;
    return Date.UTC(y, month, day, 2 + 5, 0, 0); // 02:00 local standard time
  };
  const start = nthSunday(2, 2), end = nthSunday(10, 1) - 3600000; // 02:00 EDT = 06:00 UTC
  return ms >= start && ms < end ? -4 : -5;
}

/** A UTC instant from a New York civil date and decimal hour. */
export function newYork(y: number, month: number, day: number, hour: number): number {
  const guess = Date.UTC(y, month - 1, day, 0, 0, 0) + (hour + 5) * 3600000;
  return Date.UTC(y, month - 1, day, 0, 0, 0) + (hour - newYorkOffsetHours(guess)) * 3600000;
}

/** "8:13 PM EDT" for a UTC instant. */
export function clock(ms: number, { seconds = false } = {}): string {
  const off = newYorkOffsetHours(ms);
  const local = new Date(ms + off * 3600000);
  let h = local.getUTCHours();
  const m = local.getUTCMinutes(), s = local.getUTCSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = String(m).padStart(2, '0');
  return `${h}:${mm}${seconds ? ':' + String(s).padStart(2, '0') : ''} ${ampm} ${off === -4 ? 'EDT' : 'EST'}`;
}

/** Day of the year, 1 January = 0, for a New York civil date. */
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function dateOf(y: number, doy: number): { month: number; day: number } {
  let month = 0, d = doy;
  const days = [...DAYS];
  if ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) days[1] = 29;
  while (d >= days[month]!) d -= days[month++]!;
  return { month: month + 1, day: d + 1 };
}
export function label(y: number, doy: number): string {
  const { month, day } = dateOf(y, doy);
  return `${day} ${MONTHS[month - 1]}`;
}

/** The first instant in [a, b] where f crosses zero, by bisection; f(a) and f(b) must differ in sign. */
function solve(f: (ms: number) => number, a: number, b: number): number | null {
  let fa = f(a), fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) return null;
  for (let i = 0; i < 60 && b - a > 1; i++) {
    const m = Math.floor((a + b) / 2), fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else { b = m; fb = fm; }
  }
  return b;
}

/** Sunset (upper limb at the flat horizon: true centre altitude −0.8333°) on a New York civil date, or null when the Sun does not set. */
export function sunset(y: number, month: number, day: number, observer = OBSERVER): { ms: number; azimuth: number } | null {
  const from = newYork(y, month, day, 15), to = newYork(y, month, day, 22);
  const ms = solve((t) => sunAt(t, observer).altitude + 0.8333, from, to);
  return ms == null ? null : { ms, azimuth: sunAt(ms, observer).azimuth };
}

/** Sunrise (upper limb at the flat horizon) on a New York civil date. */
export function sunrise(y: number, month: number, day: number, observer = OBSERVER): { ms: number; azimuth: number } | null {
  const from = newYork(y, month, day, 3), to = newYork(y, month, day, 10);
  const ms = solve((t) => -(sunAt(t, observer).altitude + 0.8333), from, to);
  return ms == null ? null : { ms, azimuth: sunAt(ms, observer).azimuth };
}

/** Solar noon: the instant the Sun's azimuth passes due south. */
export function solarNoon(y: number, month: number, day: number, observer = OBSERVER): number {
  const from = newYork(y, month, day, 9), to = newYork(y, month, day, 15);
  return solve((t) => sunAt(t, observer).azimuth - 180, from, to)!;
}

export interface Crossing {
  /** Day of the year, 1 January = 0. */
  doy: number;
  /** The UTC instant the Sun's azimuth reaches the grid bearing on its way down. */
  ms: number;
  /** Apparent altitude of the Sun's centre at that instant, degrees. Negative: already set. */
  apparent: number;
  /** Geometric altitude of the centre, degrees. */
  altitude: number;
}

/**
 * The evening the Sun's compass bearing passes `bearing` while descending, on a
 * day of the year, and how high the centre of the disc stands then. Null when
 * the Sun never reaches that bearing (it sets too far south).
 */
export function crossing(y: number, doy: number, bearing = GRID_BEARING, observer = OBSERVER): Crossing | null {
  const { month, day } = dateOf(y, doy);
  const from = newYork(y, month, day, 15), to = newYork(y, month, day, 23.5);
  const ms = solve((t) => sunAt(t, observer).azimuth - bearing, from, to);
  if (ms == null) return null;
  const at = sunAt(ms, observer);
  return { doy, ms, apparent: at.apparent, altitude: at.altitude };
}

/** The sunset azimuth on every day of a year; null entries are days the Sun does not set (none at this latitude). */
export function sunsetYear(y: number, observer = OBSERVER): (number | null)[] {
  const n = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  return Array.from({ length: n }, (_, doy) => {
    const { month, day } = dateOf(y, doy);
    return sunset(y, month, day, observer)?.azimuth ?? null;
  });
}

export type Event = 'half' | 'full';
export interface Alignment {
  event: Event;
  doy: number;
  ms: number;
  /** Apparent altitude of the centre at the crossing, degrees. */
  apparent: number;
}

/**
 * The named evenings of one cycle. `horizon` is the apparent altitude of the
 * visible western horizon in degrees: 0 is a flat sea horizon. "Half Sun" is the
 * evening whose crossing puts the disc's centre nearest the horizon; "Full Sun"
 * the evening whose crossing puts the disc's lower edge nearest it (centre one
 * radius higher). `days` is the run of consecutive days of the year to search.
 */
export function alignments(y: number, days: readonly number[], horizon = 0, bearing = GRID_BEARING, observer = OBSERVER): Alignment[] {
  const xs = days.map((doy) => crossing(y, doy, bearing, observer)).filter((c): c is Crossing => c != null);
  const nearest = (target: number) => xs.reduce((best, c) => (Math.abs(c.apparent - target) < Math.abs(best.apparent - target) ? c : best));
  const half = nearest(horizon), full = nearest(horizon + SUN_RADIUS);
  const out: Alignment[] = [
    { event: 'half', doy: half.doy, ms: half.ms, apparent: half.apparent },
    { event: 'full', doy: full.doy, ms: full.ms, apparent: full.apparent },
  ];
  return out.sort((a, b) => a.doy - b.doy);
}

/** Days of the year (0-based) from one New York civil date to another, inclusive. */
export function span(y: number, from: [month: number, day: number], to: [month: number, day: number]): number[] {
  const doy = (month: number, day: number) => {
    const days = [...DAYS];
    if ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) days[1] = 29;
    return days.slice(0, month - 1).reduce((a, b) => a + b, 0) + day - 1;
  };
  const a = doy(...from), b = doy(...to);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
