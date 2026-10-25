// When Certbot renews a certificate, under two rules, run by a twice-daily timer against
// Let's Encrypt's per-identifier-set rate limit. Pure TypeScript: the scene and the tests
// both read their numbers from here. Times are hours after the first certificate's notBefore.

export const DAY = 24;
export const YEAR = 365 * DAY;

/**
 * Certificate lifetimes the explainer offers, with where each comes from.
 * - 90 days: Let's Encrypt's classic profile today (docs/profiles.md, "Validity Period | 90 days").
 * - 64 days: classic from 2027-02-10; 45 days: tlsserver since 2026-05-13 and classic from
 *   2028-02-16 (letsencrypt.org/2025/12/02/from-90-to-45, lines 23–25).
 * - 160 hours: the shortlived profile (docs/profiles.md, "Validity Period | 160 hours").
 */
export const LIFETIMES = {
  '90d': { hours: 90 * DAY, label: '90 days' },
  '64d': { hours: 64 * DAY, label: '64 days' },
  '45d': { hours: 45 * DAY, label: '45 days' },
  '160h': { hours: 160, label: '160 hours' },
} as const;
export type LifetimeKey = keyof typeof LIFETIMES;

/**
 * - `fraction`: Certbot 4.1.0 and later with no renew_before_expiry and no ARI answer
 *   (certbot v5.8.0, src/certbot/_internal/renewal.py:425–429 and 484–487).
 * - `fixed30`: renew when notAfter < now + 30 days. Certbot 3.3.0 did this for every
 *   certificate (storage.py:1005–1010, constants.py:155); 4.1.0 and later do it when the
 *   renewal config sets renew_before_expiry = 30 days (renewal.py:475–482).
 * Why 4.1 and not 4.0, which the CHANGELOG and docs name: 4.0.0 read the setting through
 * config_with_defaults (storage.py:485), which merges RENEWER_DEFAULTS' "30 days" into every
 * lineage, so for lifetimes up to 90 days the 30-day test still fired first. Commit 3cbe1288c
 * ("Clean up renew_before_expiry default behavior", first in v4.1.0) removed that merge.
 */
export type Rule = 'fraction' | 'fixed30';
export const FIXED_INTERVAL = 30 * DAY;

/** Certbot's `_default_renewal_time` offset from notBefore: half the lifetime under 10 days, else two thirds. */
export function defaultRenewalOffset(lifetimeHours: number): number {
  // renewal.py:426: `if lifetime.total_seconds() < 10 * 86400`
  return lifetimeHours * 3600 < 10 * 86400 ? lifetimeHours / 2 : (lifetimeHours * 2) / 3;
}

/** Hours after notBefore at which the rule says "renew", for a certificate of this nominal lifetime. Negative: from issue. */
export function dueOffset(rule: Rule, lifetimeHours: number): number {
  const c = issue(0, lifetimeHours);
  return dueAt(rule, c) - c.notBefore;
}

/** renew_before_expiry: renew when notAfter < now + interval (3.3.0 storage.py:1010; 5.8.0 renewal.py:478). */
export function dueByInterval(notAfter: number, now: number, intervalHours: number): boolean {
  return notAfter < now + intervalHours;
}
/** The default since 4.1: renew when now > _default_renewal_time (5.8.0 renewal.py:484–487). */
export function dueByDefault(notBefore: number, notAfter: number, now: number): boolean {
  return now > notBefore + defaultRenewalOffset(notAfter - notBefore);
}

/** The documented cron line runs `certbot renew` at 00:00 and 12:00 (using.rst:965, "0 0,12 * * *"). */
export const RUN_EVERY = 12;

/**
 * Let's Encrypt's validity window for a certificate issued at `issued`: Boulder's
 * GenerateValidity (issuance/cert.go:127–135) backdates notBefore by 0.9 × maxBackdate and
 * ends one second short of the profile's validity, because the last second counts. Its
 * configuration (test/config-next/ca.json) sets maxBackdate to 1h5m, so the backdate is
 * 58.5 minutes; Let's Encrypt staff describe it as about an hour.
 */
export const BACKDATE = 0.9 * (65 / 60);
export const SECOND = 1 / 3600;
export interface Cert {
  issued: number;
  notBefore: number;
  notAfter: number;
}
export function issue(issued: number, lifetimeHours: number): Cert {
  const notBefore = issued - BACKDATE;
  return { issued, notBefore, notAfter: notBefore + lifetimeHours - SECOND };
}
/** The instant after which the rule says "renew". */
export function dueAt(rule: Rule, c: Cert): number {
  return rule === 'fraction' ? c.notBefore + defaultRenewalOffset(c.notAfter - c.notBefore) : c.notAfter - FIXED_INTERVAL;
}
/** One run of `certbot renew` at `now`, with no ARI answer. */
export function shouldRenew(rule: Rule, c: Cert, now: number): boolean {
  return rule === 'fraction' ? dueByDefault(c.notBefore, c.notAfter, now) : dueByInterval(c.notAfter, now, FIXED_INTERVAL);
}

/**
 * Let's Encrypt's "New Certificates per Exact Set of Identifiers": up to 5 every 7 days,
 * refilling one every 34 hours, computed as a token bucket (docs/rate-limits.md, lines
 * 20–26 and 145–149). Certbot 5.8.0 sends no `replaces` field in its new order
 * (acme/src/acme/client.py new_order), so its renewals are not ARI renewals and count.
 */
export const LIMIT = { capacity: 5, refillHours: 34 } as const;

export interface Run {
  /** Hours of the runs that issued a certificate; the first is hour 0. */
  readonly issued: number[];
  /** Hours of the runs whose renewal the limit refused. */
  readonly refused: number[];
}

/**
 * Issue a certificate at hour 0, then run `certbot renew` every RUN_EVERY hours until
 * `horizon` (exclusive). A renewal the limit refuses leaves the current certificate in
 * place, and the next run tries again.
 */
export function simulate(rule: Rule, lifetimeHours: number, horizon: number): Run {
  let current = issue(0, lifetimeHours);
  const issued = [0],
    refused: number[] = [];
  let tokens: number = LIMIT.capacity - 1,
    last = 0;
  for (let now = RUN_EVERY; now < horizon; now += RUN_EVERY) {
    tokens = Math.min(LIMIT.capacity, tokens + (now - last) / LIMIT.refillHours);
    last = now;
    if (!shouldRenew(rule, current, now)) continue;
    if (tokens < 1) {
      refused.push(now);
      continue;
    }
    tokens -= 1;
    issued.push(now);
    current = issue(now, lifetimeHours);
  }
  return { issued, refused };
}

export interface CaseSummary {
  lifetime: number;
  /** Hours after notBefore when the rule says "renew", clamped to 0 ("from issue"). */
  due: number;
  /** Hours after the issuing run of the first run that renews (ignoring the limit). */
  renewsAt: number;
  /** Hours from falling due to notAfter: the time left to retry a failed renewal. */
  slack: number;
  /** Runs inside that time: chances to renew if each run fails. */
  retries: number;
  /** Renewals in the 365 days after the first certificate (the first is not counted). */
  renewalsPerYear: number;
  /** Renewals the limit refused in those 365 days. */
  refusedPerYear: number;
  /** The first refused renewal, or null. */
  firstRefused: number | null;
}

export function summarize(rule: Rule, key: LifetimeKey): CaseSummary {
  const lifetime = LIFETIMES[key].hours,
    c = issue(0, lifetime),
    due = Math.max(c.notBefore, dueAt(rule, c));
  let renewsAt = RUN_EVERY;
  while (!shouldRenew(rule, c, renewsAt)) renewsAt += RUN_EVERY;
  const year = simulate(rule, lifetime, YEAR);
  let retries = 0;
  for (let t = RUN_EVERY; t < c.notAfter; t += RUN_EVERY) if (t > due) retries++;
  // Rounded to the second, the model's resolution: the backdate and the last second are exact.
  const round = (h: number) => Math.round(h * 3600) / 3600;
  return {
    lifetime,
    due: round(due - c.notBefore),
    renewsAt,
    slack: round(c.notAfter - due),
    retries,
    renewalsPerYear: year.issued.length - 1,
    refusedPerYear: year.refused.length,
    firstRefused: year.refused[0] ?? null,
  };
}

/** The window the year step draws: a year, or two weeks for 160-hour certificates. */
export function windowFor(key: LifetimeKey): number {
  return key === '160h' ? 14 * DAY : YEAR;
}

/**
 * Maximum validity periods, Baseline Requirements 2.3.1 §6.3.2
 * (cabforum/servercert docs/BR.md:2183–2199).
 */
export const BR_PHASES = [
  { from: null, before: '2026-03-15', days: 398 },
  { from: '2026-03-15', before: '2027-03-15', days: 200 },
  { from: '2027-03-15', before: '2029-03-15', days: 100 },
  { from: '2029-03-15', before: null, days: 47 },
] as const;

/** Let's Encrypt's schedule (letsencrypt.org/2025/12/02/from-90-to-45, lines 23–25). */
export const LE_DATES = [
  { date: '2026-05-13', profile: 'tlsserver', days: 45 },
  { date: '2027-02-10', profile: 'classic', days: 64 },
  { date: '2028-02-16', profile: 'classic', days: 45 },
] as const;
