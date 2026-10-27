> Review notes include intermediate findings. The final verdict at the end and README.md describe the repaired state.

# SVG / font boundary audit for the Lantern backport

Read-only review of Rayner at `df49328556b15711a5518eaa1aa5ab02eb9e5e35` and Lantern at `d65fd1da5f11f8e902b43eaf2e1598decee9abcb`. No production files or tests were edited by this lane. Relevant current owners read: `src/svg.ts`, `src/fonts.ts`, `src/color.ts`, `test/core.test.ts`, `test/property.test.ts`, `test/fonts.test.ts`, `test/lib/random-scene.ts`, `test/explain-capture.test.ts`, `test/camera.test.ts`, `test/explain-raster.test.ts`, CI/browser launch configuration, and the previous engine-core ledger/plan. Upstream serializer tests and XML oracle were read in full.

## What escaped and why

| Contract / defect | Actual prior proof | Why it misses the defect | Primary keeper / recommended repair |
| --- | --- | --- | --- |
| Runtime width must be a valid render dimension | `core.test.ts:12` supplies width 320 and checks literal dimensions. Camera tests use normal widths through 3840. `property.test.ts:42` renders default width only. | No rejection domain; TypeScript's `number` does not exclude NaN, Infinity, zero, fractions, objects from JS callers. The broad random scene generator varies scene content, not renderer options. | One SVG boundary suite around public `toSvgString`; accept valid widths and assert exact dimensions, reject invalid runtime values before serialization. Keep camera 1280/3840 culling proof distinct. |
| Background must not create markup | All local production/test backgrounds found are fixed hex strings, normally the default or palette. | No quote/control/object input, no parsed-XML oracle. `src/svg.ts:360` interpolates background straight into a root rect string. A pure shape property never varies this option. | Same SVG boundary suite: canonical accepted hex examples and invalid type/color strings, including quote-bearing payloads; parse successful output with an independent XML parser. |
| Paint attributes must produce XML 1.0 | Cache/seek properties compare strings from the same serializer (`property.test.ts:49,55,59,69`); a regex checks NaN/Infinity/undefined at line 60. | A serializer consistently emitting illegal characters is deterministic, cache-exact and seek-exact. The escaping implementation handles markup characters but not illegal XML code points, so its own copies agree. | Same boundary suite: a bounded PBT over arbitrary UTF-16 strings as paint data plus a real XML parser. Include NUL, forbidden controls, unpaired surrogates, quotes, `<`, `&`, and legal supplementary characters. Compare parsed value to an independently specified XML-character filtering contract; do not call the production escape helper. |
| Inherited keys must not become SVG/DOM attributes | Prior release boundary tests cover inherited keys in diagram families/descriptions/palettes, but not the renderer's own attribute enumeration. | Fixes were owner-local. `serializeAttrs` uses `for..in`; DomSink also enumerates with `for..in` and uses `in` when removing attributes. Ordinary objects and benign style strings never expose a polluted prototype. API inventory only pins names, not runtime behavior. | Serialized SVG primary owner in the boundary suite. An isolated process can install one enumerable prototype sentinel and check parsed attributes contain only authored own keys, then restore it. DOM sink deserves one enabled real-browser integration because setting/removing live attributes is a different transport boundary. Avoid global pollution while async browser work is outstanding. |
| Font names must be exactly `sans` or `mono` | `fonts.test.ts:29,56,72,119` checks genuine fonts and glyph-source/advance behavior. `random-scene.ts:78` chooses only the two valid names. | The generated domain is restricted to valid `FontName` values. Unsupported glyph tests reject missing characters, not font-name lookup. `shaperFor` indexes a plain object and accepts inherited methods or coerced keys. | Extend `fonts.test.ts`, not a duplicate generic SVG test: both legal faces remain callable, and every invalid string/type rejects without coercion. Include Object.prototype names and an object coercing to `sans`; use generated invalid strings plus a finite hostile-type table. |
| Fill-only glyphs must not carry stroke-paint attributes | Real-bold tests check model style `stroke === none`; raster/origin tests run Chromium/resvg. The emitted record still writes stroke-width, opacity, joins, caps unconditionally (`svg.ts:237–247`). | Model paint state is not the wire representation. Chromium/resvg accepting the combination cannot establish Safari behavior. CI's Mac jobs also launch Chromium (`tools/lib/browser.ts:2,53`, CI lines 72–74). | Add emitted-SVG assertions to the SVG boundary owner: `stroke=none` paths omit stroke-paint fields; actually stroked shapes retain width/dashes/caps/joins at exact endpoints. Preserve fill-rule/paint-order/clip semantics. A real WebKit/Safari image check is a separate optional platform proof, not replaced by this syntax assertion. |

## Cheap decisive baseline observations

I ran a short public-API probe in the isolated `/tmp/rayner-story-control` checkout. Its SVG/font sources match the pre-backport Rayner sources (the control's unrelated scene/test modifications do not enter this probe). It observed:

- width 0, NaN, Infinity, and 1.5: all accepted;
- NUL in a rectangle's paint: emitted unchanged into SVG;
- quote-bearing background: creates an extra `data-audit` attribute;
- an enumerable `Object.prototype.auditInherited` sentinel: emitted as an SVG attribute (the probe restores the property immediately in `finally`);
- `shaperFor('constructor')`, `shaperFor('toString')`, and an object whose `toString()` returns `sans`: all return functions.

These are intended-boundary failures, not mock behavior. No actual WebKit rendering was run, and none of the observations establishes a Safari paint regression.

## Backport compatibility decisions

1. Upstream's **4096 maximum width** is a new restriction for Rayner, whose public SvgOptions previously described only a pixel width. No in-repo `toSvgString` caller above 4096 was found; 3840 is independently required by camera culling. Decide/document a cap deliberately rather than importing a Worker-era limit incidentally. At minimum require a finite positive integer and prevent rounded height from becoming zero. Avoid coercing objects into numbers.
2. Hex-only background validation similarly narrows a `string` API. Current internal callers use hex, and rejecting interpolation payloads is justified; document supported forms and preserve the default. DomSink sets a CSS style background and has a distinct CSS contract: do not silently impose a new color restriction there unless intentionally specified.
3. The upstream strict XML oracle cannot be copied as-is. It allows only svg/rect/path and exactly one rect. Rayner legitimately emits clipPath/defs/group wrappers, nested clip rectangles, and extra paints (`fill-rule`, miter, paint-order). Adapt the oracle's independently justified SVG grammar to the actual public output contracts. Do not disable clipping tests to make the oracle simpler.
4. Pure rendering boundary properties can run hundreds or thousands of cases cheaply. Materialize a bounded batch for a real XML parser; avoid a Python process per generated case or replaying every scene at all frames solely for XML proof.
5. No production-only export is required to test these changes: `toSvgString`, `renderElements`, `shaperFor`, `DomSink` already expose the relevant behavior. Do not add test-only validation hooks or duplicate public APIs just for proof.

## Preserve these existing boundaries

- `property.test.ts` cache/seek/determinism tests catch stale cached paths and lifecycle mismatches; they are valuable even though they do not prove XML correctness.
- `camera.test.ts` owns composed frame/viewBox and output-pixel-dependent culling. Width validation must not erase its 3840 case or change Rayner's Frame camera to upstream's incompatible `{w,h}` API.
- `explain-clip.test.ts` and `explain-raster.test.ts` own real resvg clipping/fading pixels, including known native rasterizer constraints. They remain necessary.
- `explain-capture.test.ts` owns lowering against actual Agentic Mermaid SVG output. It is a different oracle from a serializer allowlist or glyph style assertions.
- `lettering-styles.test.ts` owns real/faux cut painting and recolor behavior. Emitted-stroke assertions should complement it, not replace that source-font proof.
- The actual fonts/fallback/mixed-run owners remain. Runtime name rejection is a missing domain in that owner, not a reason to discard actual glyph vectors.
- Generated page/receipt byte pins detect visible/output changes but are not an independent correctness oracle. Refresh only in a separate reviewed commit, not to bless invalid XML or Safari-untested painting.

## What was wrong with the testing approach

This is primarily a contract/domain gap, not insufficient random iteration count. Most generated cases tested equivalence of two executions of the same implementation with valid options and a small color/font vocabulary. The previous audit correctly preserved those lifecycle contracts but its ledger recorded them as retained proofs without adding the missing independent acceptance/rejection and output-language boundaries. Testing that a model says `stroke: none` did not test what the SVG writer emitted, and “Mac runner” was conflated with neither Safari nor WebKit evidence. Future review should name, per property, (a) the external law, (b) dimensions held constant by the generator, and (c) one credible defect the oracle must reject. Keep the distinction between model, serialized XML, raster, browser transport, and platform behavior explicit.

## Final preservation review of the implemented backport

Read-only review of current `src/svg.ts`, `test/svg-boundary.test.ts`, `test/svg-browser.test.ts` and `package.json` routing. **No critical findings.**

- The public SVG width contract now deliberately accepts every positive safe integer, retaining 4097/8192 and wider local exports instead of importing the upstream 4096 cap. Header height is rounded exactly for the fixed 9:16 output ratio using integer arithmetic; arbitrary wide dimensions are checked as headers, not materialized into pixel buffers.
- Hex-only background admission and lowercase six-digit canonicalization are explicit in `SvgOptions` and `docs/REFERENCE.md`. CSS background setting in `DomSink` retains its different transport contract.
- XML escaping now rejects illegal XML code units without dropping valid surrogate pairs, keeps markup characters as data, and does not consult inherited escape-table properties. Attribute serialization enumerates own keys. The property has a genuinely separate Rust XML grammar parser (resvg), plus an independently specified Unicode/filter-and-value assertion; it does not call production escaping as its oracle.
- Fill-only paths omit stroke paint, including dash/reveal/miter fields; actual strokes still emit width/caps/joins. Independent fill-rule/paint-order behavior remains. Existing camera, clipping and native raster test files are untouched; `core.test.ts` and `fonts.test.ts` add missing contracts rather than deleting their prior vector/output proofs. This does not claim actual Safari rendering was executed.
- `DomSink` now uses a null-prototype own-attribute cache. Text patches happen before the same-attrs fast path. Attribute removal uses own membership. These details repair both blind-review findings without invalidating the documented immutable-record contract (`ElementRecord` remains immutable except its memoized svg string).
- The real browser property varies text independently across shared immutable attrs objects, then removes the own `__proto__` and ordinary attributes. Returning native attribute entry arrays avoids CDP/object-key transport silently stripping `__proto__`. It checks actual `textContent`, output cardinality and complete current attribute membership, not producer cache fields.
- `test:embeds` includes `test/svg-browser.test.ts`; the pure boundary file participates in the existing `test/*.test.ts` default/full glob. The disabled-repository-Actions limitation remains distinct from local routing.

Final read-only verification: `EXPLAIN_BROWSER=1 CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node --test test/svg-boundary.test.ts test/svg-browser.test.ts` on Node 24.22.1 passes **7/7, no skips or failures**. Log: `/tmp/rayner-svg-preservation-review.log`. No production/test files were edited by this reviewer.
