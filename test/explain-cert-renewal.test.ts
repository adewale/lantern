import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fc, params } from './lib/pbt.ts';
import {
  BACKDATE,
  BR_PHASES,
  DAY,
  FIXED_INTERVAL,
  LE_DATES,
  LIFETIMES,
  LIMIT,
  RUN_EVERY,
  YEAR,
  defaultRenewalOffset,
  dueByDefault,
  dueByInterval,
  issue,
  shouldRenew,
  simulate,
  summarize,
} from '../scenes/explainers/lib/cert-renewal.ts';
import type { LifetimeKey, Rule } from '../scenes/explainers/lib/cert-renewal.ts';

const hours = (ms: number) => ms / 3600e3;

test('the default renewal time matches certbot’s own test vectors', () => {
  // certbot v5.8.0 renewal_test.py:272–280: certificates issued 2025-03-12 00:00 for 8 and 18 days.
  const issued = Date.UTC(2025, 2, 12);
  for (const [lifetimeDays, expected] of [
    [8, Date.UTC(2025, 2, 16)],
    [18, Date.UTC(2025, 2, 24)],
  ] as const)
    assert.equal(defaultRenewalOffset(lifetimeDays * DAY), hours(expected - issued), `${lifetimeDays}-day certificate`);
  // The switch is "lifetime < 10 days" (renewal.py:426): exactly ten days takes two thirds.
  assert.equal(defaultRenewalOffset(10 * DAY), (10 * DAY * 2) / 3);
  assert.equal(defaultRenewalOffset(10 * DAY - 1 / 3600), (10 * DAY - 1 / 3600) / 2);
});

test('renew_before_expiry and the default agree with certbot’s 7-day certificate vectors', () => {
  // certbot v5.8.0 renewal_test.py:295 and 356–385 (no ARI answer): a 7-day certificate from
  // 2014-12-11 22:34:45 UTC. Interval strings are in hours; null is "unset", so the default applies.
  const notBefore = hours(Date.UTC(2014, 11, 11, 22, 34, 45)),
    notAfter = notBefore + 7 * DAY;
  const at = (unix: number) => unix / 3600;
  const vectors: [number, number | null, boolean][] = [
    [1418472000, 168, true],
    [1418472000, null, false],
    [1418472000, 96, false],
    [1418472000, 48, false],
    [1418760000, null, true],
    [1418760000, 24, false],
    [1241179200, 8, false],
    [1241179200, 48, false],
    [1241179200, 960, false],
    [1420070400, 0, true],
    [1420070400, 10 / 3600, true],
    [1420070400, 10 / 60, true],
    [1420070400, 1680, true],
  ];
  for (const [now, interval, expected] of vectors)
    assert.equal(
      interval == null ? dueByDefault(notBefore, notAfter, at(now)) : dueByInterval(notAfter, at(now), interval),
      expected,
      `at ${now} with ${interval ?? 'no'} interval`,
    );
});

test('Certbot 3.3’s 30-day rule renews strictly inside 30 days of expiry', () => {
  // certbot v3.3.0 constants.py:155 "30 days"; storage.py:1010 `if expiry < add_time_interval(now, interval)`.
  assert.equal(FIXED_INTERVAL, 30 * DAY);
  const c = { issued: 0, notBefore: 0, notAfter: 90 * DAY };
  assert.equal(shouldRenew('fixed30', c, 60 * DAY), false, 'exactly 30 days left is not yet due');
  assert.equal(shouldRenew('fixed30', c, 60 * DAY + 1 / 3600), true);
  // For 90-day certificates two thirds is the same moment, which is why 4.1 changed nothing there.
  assert.equal(shouldRenew('fraction', c, 60 * DAY), false);
  assert.equal(shouldRenew('fraction', c, 60 * DAY + 1 / 3600), true);
});

test('Let’s Encrypt’s validity window: backdated 58.5 minutes, one second short', () => {
  // boulder issuance/cert.go:127–135 with maxValidityBackdate 1h5m (test/config-next/ca.json).
  const c = issue(100, 90 * DAY);
  assert.equal(Math.round((100 - c.notBefore) * 3600), 58.5 * 60);
  assert.equal(Math.round((c.notAfter - c.notBefore) * 3600), 90 * 86400 - 1);
  assert.equal(BACKDATE, 0.975);
});

test('the explainer’s eight cases', () => {
  const expect: Record<LifetimeKey, Record<Rule, [number, number, number]>> = {
    // [run that renews, hours after issue; renewals in 365 days; refused in 365 days]
    '90d': { fraction: [60 * DAY, 6, 0], fixed30: [60 * DAY, 6, 0] },
    '64d': { fraction: [43 * DAY, 8, 0], fixed30: [34 * DAY, 10, 0] },
    '45d': { fraction: [30 * DAY, 12, 0], fixed30: [15 * DAY, 24, 0] },
    '160h': { fraction: [84, 104, 0], fixed30: [12, 261, 468] },
  };
  for (const key of Object.keys(expect) as LifetimeKey[])
    for (const rule of ['fraction', 'fixed30'] as Rule[]) {
      const s = summarize(rule, key),
        [renewsAt, renewals, refused] = expect[key][rule];
      assert.deepEqual([s.renewsAt, s.renewalsPerYear, s.refusedPerYear], [renewsAt, renewals, refused], `${key} ${rule}`);
    }
  // The title's claim: the 30-day rule renews 45-day certificates twice as often as the default.
  assert.equal(summarize('fixed30', '45d').renewalsPerYear, 2 * summarize('fraction', '45d').renewalsPerYear);
});

test('the 160-hour, 30-day case hits the 5-per-7-days limit on the seventh renewal', () => {
  // letsencrypt.org/docs/rate-limits: 5 per exact set of identifiers, one back every 34 hours.
  assert.deepEqual(LIMIT, { capacity: 5, refillHours: 34 });
  const run = simulate('fixed30', LIFETIMES['160h'].hours, 14 * DAY);
  assert.deepEqual(run.issued.slice(0, 8), [0, 12, 24, 36, 48, 60, 72, 108]);
  assert.equal(run.refused[0], 84);
});

test('the Baseline Requirements and Let’s Encrypt tables as published', () => {
  // BR 2.3.1 §6.3.2 table, docs/BR.md:2192–2197.
  assert.deepEqual(
    BR_PHASES.map((p) => [p.from, p.before, p.days]),
    [
      [null, '2026-03-15', 398],
      ['2026-03-15', '2027-03-15', 200],
      ['2027-03-15', '2029-03-15', 100],
      ['2029-03-15', null, 47],
    ],
  );
  // Each phase starts where the last ended.
  for (let i = 1; i < BR_PHASES.length; i++) assert.equal(BR_PHASES[i]!.from, BR_PHASES[i - 1]!.before);
  // letsencrypt.org/2025/12/02/from-90-to-45, lines 23–25.
  assert.deepEqual(
    LE_DATES.map((d) => [d.date, d.profile, d.days]),
    [
      ['2026-05-13', 'tlsserver', 45],
      ['2027-02-10', 'classic', 64],
      ['2028-02-16', 'classic', 45],
    ],
  );
  // Every Let's Encrypt lifetime here fits the cap in force on its date.
  for (const d of LE_DATES) {
    const cap = BR_PHASES.find((p) => (p.from == null || p.from <= d.date) && (p.before == null || d.date < p.before))!;
    assert.ok(d.days <= cap.days, d.date);
  }
});

const lifetime = fc.integer({ min: 1, max: 400 * 24 });
test('property: renewal comes before expiry, with a third (or half) of the lifetime left', () => {
  fc.assert(
    fc.property(lifetime, (L) => {
      const c = issue(0, L),
        life = c.notAfter - c.notBefore;
      const left = c.notAfter - (c.notBefore + defaultRenewalOffset(life));
      assert.ok(Math.abs(left - (life < 10 * DAY ? life / 2 : life / 3)) < 1e-9);
      // From the shortest profile (160 hours) up, each certificate is replaced before it expires:
      // the twice-daily run reaches the due time, and renewals stay under the rate limit's refill.
      if (L >= 160) {
        const { issued } = simulate('fraction', L, 3 * L);
        for (let i = 1; i < issued.length; i++) assert.ok(issued[i]! - issued[i - 1]! < L, `${L}: gap ${issued[i]! - issued[i - 1]!}`);
      }
    }),
    params(300),
  );
});

test('property: the 30-day rule renews at least as often as the default exactly when the lifetime is at most 90 days', () => {
  fc.assert(
    fc.property(fc.integer({ min: 31 * 24, max: 200 * 24 }), (L) => {
      const a = simulate('fixed30', L, YEAR).issued.length,
        b = simulate('fraction', L, YEAR).issued.length;
      if (L <= 90 * DAY) assert.ok(a >= b, `${L / DAY} days: ${a} < ${b}`);
      else assert.ok(a <= b, `${L / DAY} days: ${a} > ${b}`);
    }),
    params(200),
  );
});

test('property: no 34-hour-refill window issues more than the bucket allows', () => {
  fc.assert(
    fc.property(lifetime, fc.constantFrom<Rule>('fraction', 'fixed30'), fc.integer({ min: 1, max: 60 }), (L, rule, span) => {
      const { issued } = simulate(rule, L, 60 * DAY),
        window = span * RUN_EVERY;
      for (const start of issued) {
        const inside = issued.filter((t) => t >= start && t < start + window).length;
        assert.ok(inside <= LIMIT.capacity + window / LIMIT.refillHours + 1e-9, `${inside} in ${window} h`);
      }
    }),
    params(200),
  );
});
