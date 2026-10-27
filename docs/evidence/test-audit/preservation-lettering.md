# Independent lettering preservation review

Reviewed against `origin/main`, before root's intentional output repins. Read-only review: no test execution, production mutation, expectation regeneration, or source edits. Read the complete lettering diff, validator/cache caller, migration/provenance records, capture log, and enabled-run logs/results.

**Finding: no blocking preservation gap found.** The two retired declarations have concrete keepers with their additional contracts absorbed. Independent font/shaping, runtime and real-browser boundaries remain. Root still needs final all-26 frozen-output validation after separately reviewed repins and serialized negative controls.

## Frozen output migration

Independently compared JSON objects from git's original files with current committed-file contents (data inspection only):

- Original baseline, removed legacy inventory and new baseline each contain exactly the same **26 IDs**.
- Every original `html`, `bytes`, `headers` and canonical/partial `receipt` value is unchanged; zero differing fields.
- All 26 `fullReceipt` entries equal the removed inventory's serialized full-receipt `receipt` hashes exactly. All 26 `html` entries also equal its `page` hashes.
- Thus no original expected value was regenerated during consolidation. `lettering-pin-migration.json` agrees with this independent comparison.
- The single keeper in `test/lettering.test.ts` visits the entire catalog by default, checks exact catalog membership, no requested/outline lettering or receipt lettering fields, actual HTML byte count, HTML hash, header hash, canonical receipt excluding engineHash, and serialized full receipt including engineHash. Removing the old all-26 outline declaration and legacy JSON loses no named frozen-output field. The former short default list is expanded rather than narrowed.
- Existing UPDATE_GOLDEN behavior remains explicit; the current migration diff adds only the copied fullReceipt values. Root's future reviewed intentional repin is a separate action, not evidence this unchanged historical baseline already passes the changed engine/player tree.

## Snapshot integrity and production fix

For Arabic, Devanagari, math and style, independently compared original/current JSON keys: **only builderHash and payloadHash differ**. Glyph runs, outlines, font face bytes/licenses/hashes, sourceHash, request, version and shaper are byte/value equivalent. The logged real `explain snapshots` command ran for all four fixtures; capture provenance corroborates the unchanged fields. No glyph data was refreshed to conceal a regression.

The production validator changes only one boundary: clusters must be `<` source code-point count, and source length is calculated once per run rather than once per glyph. Empty runs remain valid; empty text with a glyph is rejected. Existing finite metrics/coordinates, command tags, header/digest formatting and face validation remain. Code-point semantics match the stored-source contract; explicit astral/combining/control/math cases and the retained independent HarfBuzz owners protect the relevant boundaries.

The checksum survivor mutates structurally valid data while preserving metadata and requires the specific `Invalid lettering snapshot payload checksum;` diagnostic. A stale fingerprint or structural rejection cannot satisfy it. The new collectProject structural regression first accepts its fresh unchanged cached snapshot, then recomputes the payload checksum after setting cluster exactly equal to source length; the specific glyph diagnostic isolates the off-by-one validator path. Schema PBT directly owns acceptance/rejection structure and intentionally does not pretend to validate payload digest agreement, which the cache integration owner separately proves.

## Retained/strengthened boundaries

- **Persistence before duplicate deletion:** the numeric-subset pipeline keeper now requests persistence, completes capture, reloads without capture, and compares the cached snapshot with the finished capture. The deleted capture/tamper declaration's unique persist/finish/reload clause is therefore retained before relying on the stronger integration checksum survivor. Numeric alphabet/source-font cmap and intermediate-value replay assertions remain.
- **Costs and notices:** four committed-snapshot gates now compare exact encoded snapshot bytes, decoded face bytes and run count with the report. Whole HTML-escaped license notices replace weak 50-character prefixes. Existing seek, motion, readability, bare-runtime, source fingerprint and closed-run failures remain.
- **Real browser:** four optional Chromium fixture paths still build actual pages, block all networking, wait for readiness, and check browser errors. The path keeper now compares sorted actual browser `d` paths against Node rendering of the requested source fixture, rather than accepting any path. This remains a transport/runtime parity contract; independent HarfBuzz glyph/advance/cluster checks are retained separately, so shared font code is not presented as an independent shaping oracle.
- **Adapter setup:** ordinary LTR span proof explicitly calls bindLettering on a provider and executes a scene, which actually installs the optional span adapter. It no longer depends on previous test ordering to install it.
- **Lease lifecycle:** a whole event-loop turn while the overlapping second task is held proves the first lease remains pending; releasing the second then proves settlement and requested provider geometry. Existing bounded wrapper, nested/ordinary concurrency, error restoration and final font-width assertions remain. This is stronger than a fixed two-microtask observation.
- **Structural PBT:** valid generated snapshots span all families, finite metrics, outline commands and JS string/code-point classes; rejecting properties separately exercise out-of-range clusters, nonfinite metrics, malformed keys and malformed commands. Six explicit boundary classes and the 100000-glyph probe retain materialized valid workloads. These are cheap schema owners, not substitutes for Python capture or browser playback.

## Validation limits

Existing enabled result logs show integration 16/16, outlines 12/12 (including offline browser and independent HarfBuzz), pipeline 3/3, runtime 7/7, Unicode 1/1, and filtered legacy 10/10. I did not rerun them. The recorded full frozen keeper failed against concurrent intentional source edits with historical pins unchanged, as expected; it must pass root's final reviewed baseline. Mutation controls remain root-owned. No hidden skip or tolerance relaxation was introduced in these diffs.
