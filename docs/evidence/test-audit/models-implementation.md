# Models lane implementation evidence

No commits made. Only owned model suites and the authorized trust-proxy model source edited. All external source vectors, frozen tool answers, live oracle checks, curated story snapshots and readout wiring were preserved. No broad suite or live mutations run; root owns serialized mutation controls and final fingerprints.

## Blind-property response

Read consolidated `out/test-audit/blind-properties.md` (files named blind-properties1/2 were absent). Item1 `/0` hypothesis corrected by pinned-source evidence rather than implemented blindly: proxy-addr2.0.8 rejects0, unlike ipaddr.js1.9.1 parseCIDR; full0..32 generation explicitly classifies this distinction. Item2 implemented: fractions, empty/whitespace, signed/exponent/junk/extra-slash prefixes and malformed octets reject. All remain in the asserted input classes; no failing valid sample was excluded. Fixed lexical classes are enumerated, arbitrary octets/fractions generated.

## Changes and keeper mapping

- trust-proxy source: validate full IPv4/prefix syntax before numeric conversion; keep1..32 range, /0 rejection and plain-address membership. Comments distinguish membership false from upstream config parser throw.
- trust-proxy tests: independently compute network block membership via unsigned arithmetic division, generate0..32, force positive base match, test compileTrust membership, malformed ranges and complete readAddresses rejection records. Hop/list oracles construct reversed input headers independently, check reqIps, and compare full trusted/answer/unread records. Mix trusted/untrusted network addresses so list tests exercise traversal beyond socket.
- WCAG: replace random finite samples with exact9/9/6/39 input products. Retain four laws and every W3C criterion/Recommendation fixture. Remove only duplicated fidelity invocation, preserve collected authored cases and actual outline description. Generic explain-fidelity remains sole state/step keeper.
- GNOME: remove duplicate state helper invocation; preserve every participant's footerLines check, which demos:check does not provide. Generic explain-fidelity remains sole state/step keeper.
- traffic-policy: compare full exact endpoint records to placement-input enumeration for both policies; eliminate vacuous Local `every` and Cluster length-only direct oracle.
- models: Unicode UTF16-generated SHA256 and PKCE versus Node crypto plus explicit padding/NUL/non-BMP/lone-surrogate/RFC anchors. Exhaustive finite reducer transitions. Arbitrary ring command traces versus independent queue, including Full/Empty nonmutation, ordered occupied slots and draining; keep curated story anchors. Quarter-token integer ledger varies rates/capacities/elapsed ticks including exact/repeated times; keep hand decision grid and picture proof. Replace sunlight integer grid with continuous finite latitude/declination property: finite range, hemisphere symmetry, opposite-season sum24 and exact altitude; keep every London/equator/polar/month anchor and existing1e-10 tolerance.
- GTFS: expected weekly flag selected with independent UTC weekday, no production weekday oracle.
- recurrence: generated weekly starts computed from independent epoch arithmetic rather than occurrences; both COUNT and UNTIL compared to independent schedule. Keep RFC, sabre and Baikal fixtures.
- tax: both exported years in cap/monotonicity properties; expected cap uses independent1791/1807 source values, preserving tolerances and OpenFisca vectors.
- gamut: generated mapping law exercises both srgb and p3, preserving accepted lightness domain, existing epsilon and Color.js fixtures.

## Natural red and focused validation

Original-source red command (before production edit):

```sh
FC_SEED=1701 node --test --test-name-pattern='malformed IPv4 ranges' test/explain-trust-proxy.test.ts
```

One intended failure, no other errors: seed1701, path0:0:0:0:0:1:0, shrunk `["0.0.0.0","1.5"]`; actual true vs expected false at inRange. 202.05ms. Full captured failure: models-cidr-red.tap. This proves the new contract assertion detects the model defect without a live mutation while other lanes run.

After fix:

| Focused command (all FC_SEED=1701) | Result | Duration | Evidence |
| --- | --- | --- | --- |
| node --test test/explain-trust-proxy.test.ts | 11pass,0fail | 548.96ms | models-trust-green.tap |
| node --test test/explain-models.test.ts test/explain-wcag-map.test.ts test/explain-traffic-policy.test.ts test/explain-gnome-files.test.ts | 43pass,1skip,0fail | 7320.17ms | models-focused.tap |
| node --test test/explain-models.test.ts after Unicode/queue changes | 13pass,0fail | 1959.20ms | models-models-green.tap |
| node --test test/explain-gtfs.test.ts test/explain-ical-recurrence.test.ts test/explain-quotient-familial.test.ts test/explain-tailwind-gamut.test.ts | 48pass,1skip,0fail | 2197.19ms | models-source-green.tap |

Skips are optional external provenance checks: missing WCAG checkout and disabled live sabre Docker, while frozen evidence still ran. No tolerance widened or baseline refreshed. Latest final pure-suite rerun includes integer token ledger and deterministic malformed classes:25pass,0fail,1849.28ms; see models-final-pure-green.tap. git diff --check passed for all owned touched files.

## Deferred bounded improvements

Certbot400 draws, PG wider tuple-size domain and Rust deep-wrapper scale probes remain as plan items rather than ad hoc rewrites; all existing declarations remain. A scale defect was not measured, so there is no unsupported performance regression assertion. The report's earlier source-inspected Rust complexity candidate is not called a confirmed bug. Broader CSV payloads and supported-start variability are further domain enhancements, not lost keepers. Root should not claim every proposed enhancement was implemented.

Root serial controls should include wrong local endpoint node, removed WCAG obsolete filter, swapped gamut branch, wrong recurrence interval, ring Empty mutation, SHA length/padding mutation, and malformed prefix Number coercion restoration. The prior matrix in models-plan.md gives intended assertion boundaries. Trust-proxy source changed, so root intentionally repins derived page receipts after semantic controls rather than this lane changing fingerprints prematurely.
