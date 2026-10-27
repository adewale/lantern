> Review notes include intermediate findings. The final verdict at the end and README.md describe the repaired state.

# Lantern verifier backport: read-only adaptation review

Scope: Rayner at PR #39 (`df49328`) versus fetched `upstream/main` (`d65fd1d`), with focus on `src/verify.ts`, `src/layout.ts` upstream, `tools/lib/explain-check.ts`, imported diagrams, native panels and reader close-ups. No production or test files were changed by this review. Recommendations are source-inspection findings; the root agent owns executing candidate and negative controls.

## Why the tests missed the visual defects

1. **An incorrect contract explicitly preserved a blind spot.** `test/explain-tools.property.test.ts:112` is named “two diagram labels never collide with each other”. It generates arbitrary overlapping non-native labels and requires no collision. This is not inadequate random-case count: the asserted contract is wrong for a reader. Its producer `restingTextProblems()` in `tools/lib/explain-check.ts:124` intentionally skips pairs where neither object is `instanceof Text`. Actual imported labels are text-bearing `Group`s with `mergeLeaves` and `labelOf` metadata (`explain/diagrams.ts:350–360`), so their collisions are exempt. The test's synthetic imported label is a Rectangle with a `text` field; it proves the exemption but not real import/render behavior.
2. **The checker tested words against words, not ink against words.** `restingTextProblems` collects text-like objects, then checks text pair boxes and frame/heading bounds. It never considers a connector's paint. Therefore a route through a label can satisfy every existing collision, label-size and close-up test. Upstream Mermaid capture oracles compare geometry/importing before Rayner's later walks/marking and do not establish final overlay readability. The newer `test/explain-story.test.ts` is the correct retained raster boundary for marked final diagrams.
3. **A layout gate intentionally deduplicates objects, whereas the renderer paints duplicate roots.** The property at `test/explain-tools.property.test.ts:58` (“a text listed twice is still one text”) is fine as checker idempotence but cannot prove `Scene.add` render uniqueness. It hides that defect if interpreted as a scene-graph invariant. Renderer/root uniqueness requires its own owner and actual emitted occurrence assertion. The point is distinct proof obligations, not deleting the gate's dedupe.
4. **Case/width enumeration was mistaken for semantic coverage.** Existing reader checks establish sizes, views, navigation and reachable changed regions. A view can obey all those laws while opening on a less relevant changed object. Some player model expectations intentionally call the same `closeUps`/`stepLayouts` producers, which proves orchestration but is not an independent caption-meaning oracle. Preserve those state-machine checks; supplement with independently named narrative targets, as PR39's three attack-arrow screen-projection assertion does.
5. **Motion was not layout.** Rayner's `MotionSink`/`analyzeMotion` covers seven discontinuity kinds and good copy/handoff behavior. Smoothly drawn overlapping labels are not jumps. A clean motion result must not be presented as a no-occlusion result.

## Concrete safe patch now

### A. Extend the existing resting-text owner

Use `tools/lib/explain-check.ts::restingTextProblems`, already called for every completed frame in `checkProject`, rather than introducing another disconnected verifier.

- Remove `if (!a.native && !b.native) continue`. All visible, top-level text-like objects must participate in text-to-text overlap. Preserve its distinct-object dedupe, ancestor-alpha checks, blank/nested-text exclusion, clipping and heading handling.
- Apply camera clipping consistently to overlap comparisons: the same pair may overlap in world space wholly outside a moved camera. Existing native edge/camera rules should remain distinct; do not expand off-camera text into a false positive.
- Keep semantic ownership exclusion structural: glyph children inside a text run are one label, not a collision. Do not exempt all labels from the same diagram or all same-owner connectors.
- Replace the “two diagram labels never collide” property with one independent rectangle-intersection contract across native/native, native/imported and imported/imported pairs. Use the same positive overlap + disjoint control, and retain hidden/ancestor/clip/order properties.
- Keep one real captured/imported fixture demonstrating two imported semantic labels that overlap after a production transform; verify `checkProject` refuses that fixture, not only a direct helper call. Extend `test/explain-gates.test.ts`'s table rather than duplicating its setup.

Removing the blind spot may expose real existing diagram issues. Record and fix those outputs; do not automatically introduce whole-family exemptions to preserve a green catalog.

### B. Add route-vs-label visibility to that gate

This can use existing VMobject paths, semantic labels, scene camera and renderer output; it does not need a broad public layout API.

- Use `renderElements(scene, {relative:true})` for the actual emitted leaf IDs, paint order and inherited `clipBox`. Relative mode emits one leaf per glyph/path rather than merging whole text runs; map IDs back through the real scene tree. The gate should not inspect an invisible route-helper path (`Part.route`, intentionally opacity zero) and call it visible ink.
- Collect labels structurally as today/with `labelOf`, so imported Groups count. Exclude their glyph descendants from path candidates: glyph contours are not connector routes.
- For native geometry, recognize actual Line/Arrow shafts/open Arc paths. For imported connectors, use `SnapshotPart.from/to/kind` at Diagram construction to retain small internal semantic ownership metadata or a module-local WeakMap; that is a production checker caller, not a test-only seam, and need not become a root export. Guessing every open path is a connector falsely catches decorative ruling/hand-drawn box strokes. Prefix-only key heuristics are also less robust than already-known snapshot semantics.
- Exclude fixed stage paper/ruling (`__paper`); the diagram can legitimately sit over ruled paper. Respect effective paint, stroke width and ancestor clipping. Work in world coordinates consistently, or transform both path and box through `toView`; do not mix camera-view boxes with world points.
- Backport the small line-segment/box interval law from upstream `layout.ts` (`segmentInterval` / `segmentBlocked`) at an internal production owner. End attachment clearance belongs only to the full connector's two ends; it must not reset at every polyline joint. For cubics, use a bounded, documented flattening error or subdivision based on control hulls; fixed eight samples alone cannot prove arbitrary curve clearance. Preserve conservative bounds and prove a bent crossing, not only straight links.
- Crucially, **paint order matters**. PR39 intentionally draws a connector geometrically behind its own label and then masks it with opaque paper. The mask is correct output. Subtract the segment interval covered by a recognised opaque rectangle painted after the route and before the lettering; a plate behind the route or translucent plate must not excuse it. A global stage background is not a mask. The existing actual Lantern raster owner remains the final paint proof; a box-only geometry check must not replace it.

This patch catches foreign native/diagram paths crossing labels and unmasked own-label routes without penalising the correctly protected PR39 case. If exact painted-path adaptation is too large for the current patch, land the imported/imported text fix and pure segment law with a production use in a scoped connector check, explicitly document what remains unsupported, and retain the raster boundary. Do not claim that a native-only port now covers imported trails.

### C. Primary test owners and controls

- `test/explain-tools.property.test.ts`: independent pairwise box laws for all three text kinds, off-camera and nested clip controls, no changes to existing state/case oracles.
- `test/explain-gates.test.ts`: one imported-label overlap rejection and route/label refusal at the real `checkProject` boundary. Count expected labels/routes, assert the specific gate message; missing snapshots must not satisfy rejection.
- `test/explain-story.test.ts`: retain the real marked Lantern/cache raster checks. They prove the paper gap is painted and the route remains visible outside the words.
- Pure segment law owner: translation/uniform-scale covariance, positive crossing, disjointness, endpoint-only attachments, a short central crossing and a multihop stair whose joint is not an attachment. Expected intersections come from independent axis-aligned/literal fixtures, not from calling the production helper twice.
- Negative controls: restore the imported/imported skip; disable path intersection; misclassify invisible route helpers as painted; treat any background as a mask regardless of order/opacity; apply attachment end pad to every segment. Each should fail its intended assertion, followed by byte-restored source and a pass.

## What should not be copied wholesale

- Upstream `sampleLayout` begins with `instanceof Text`, and geometry collects `Line`, `Arc`, `Rectangle`. Rayner's imported semantic labels/paths do not fit those classes, so copying it would still miss the exact Lantern defect.
- Upstream flags overlapping partially opaque texts as `ghost`. Rayner explicitly documents and uses crossfades (`explain/panels.ts::Card.set`, `src/view.ts` and matching transforms). Making every crossfade fail would silently change a documented animation contract; keep that policy separate or scope to same-root accidental double paint, which `Scene.add` correctness should prevent.
- Upstream portrait `scale`, `void`, `span`, `anchor` rules assume `scene.frame` is `{w,h}` and a true portrait canvas. Rayner's `scene.frame` is a Camera Mobject with `.box()`, and the phone reader composes close-up zoom over the author's 16:9 world. Its stage is 358px wide inside a 390px page. Upstream's `390/16` pixel constant is wrong for that stage and cannot replace Rayner's `stageScale`/`toView`/screen projection.
- Upstream `fill`/maximum-box-padding/maximum-type rules are composition policy, not universal geometry correctness. Rayner has content containing other content, headers, gauge shells/fills, code focus bars, graph clusters, chart regions, scene art and deliberately large glyph examples. A native rectangle containing text is not automatically a too-large card.
- Do not add blanket `allowOverlap=true` to all imported parts or highlighted shapes. Use structural ownership and actual paint to distinguish containment/highlight from label obstruction. A broad author opt-out can hide the regression the new gate is meant to catch.
- The upstream `analyzeMotion` version drops Rayner's copy-look/from handling and would regress preserved TransformFromCopy and partial-shape handoff proofs. Keep the existing motion producer and add layout checks rather than replacing it.

## Remaining limits

Neither upstream nor this safe slice can infer arbitrary caption meaning. Maintain semantic fixture assertions and visual review as separate obligations. Browser overlay controls such as the overview map are outside the scene tree, so no VMobject verifier can detect their DOM overlap; keep the actual browser rectangle check. Native WebKit painting also needs real WebKit evidence; a syntactic SVG assertion is not a Safari pass.

# Final candidate review (working tree follow-up)

Reviewed the new `tools/lib/explain-layout.ts`, its `checkProject` hook, private connector Symbol metadata in `explain/diagrams.ts`, and `test/explain-layout.test.ts` plus changed gates/tools-property/story owners. Also reviewed actual annotation and Seasons repairs. The all-catalog resting audit reported by root is separate execution evidence; this reviewer reproduced the controls below directly.

## Two blocking correctness findings

### 1. Intermediate cubic joints inherit endpoint attachment exceptions

`restingRouteProblems` calls `attachment(curve, box, half)` for every cubic in an open path. `attachment` cannot know whether that cubic endpoint is the actual connector endpoint. An internal joint can therefore borrow the exception intended for a source/target attachment.

Reproduced with a native `Line` whose path is built as:

```ts
line.subpaths = []; line.closed = [];
line.startNewPath([1, 1]).addLineTo([0.5, 0]).addLineTo([1, -1]);
```

Use `strokeWidth: 0.1` and the existing synthetic imported label fixture: a solid rectangle of width 1, height 0.4 centred at zero with text metadata. `restingRouteProblems` returns `[]`, despite the thick stroke entering the label at the interior joint `[0.5,0]`. Each adjacent cubic treats that joint as its own permitted end/start. Repro is saved in ignored `out/review-route-joint.ts`.

Pass explicit start/end permission derived from the first/last cubic of the full connector path (and correct connector grouping where a polyline is split into Line children). An interior joint may not inherit either cap exemption. Extend the literal attachment regression with this joined path; the existing single-cubic boundary-riding test does not distinguish the bug.

### 2. An allegedly opaque plate can be transparent SVG paint

Plate selection checks `fill !== 'none'`, `fillOpacity >= .999`, ancestor opacity and draw fraction. It does not consider the alpha encoded in `Style.fill`, whose type is unrestricted `string`. SVG background validation does not constrain shape styles.

Reproduced using a route through the same label, with a 2 × 1 Rectangle between the route and the label, `fillOpacity:1`. Each of these fills incorrectly suppresses the crossing:

- `transparent`
- `#00000000`
- `rgba(0,0,0,0)`
- `url(#unknown)`

`fill:'none'` correctly reports it, and `fill:'#000'` correctly masks it. Repro is saved in ignored `out/review-route-transparent.ts`.

Opaque-mask exemptions must be limited to paints proven opaque. Conservative recognition of `#rgb`/`#rrggbb` and alpha-hex only when alpha is `f`/`ff` is sufficient for the actual authored plates. Do not call existing `parseColor` as an opacity oracle: its comment and code intentionally ignore alpha. Unknown colours or unresolved paint URLs must not earn an occlusion exemption. Add these rows to the existing plate table with actual raster evidence for the transparent case if practical.

The same classification issue affects route visibility in the other direction: a Line with `stroke:'transparent'`, `'#00000000'` or `'rgba(0,0,0,0)'` is reported as an obstruction. Ignored `out/review-route-alpha.ts` reproduces this false positive. If these style forms remain legal, a shared known-paint-alpha calculation should be used for route/glyph visibility as well. Unknown paint should remain conservative, but never be considered proven opaque.

## Preservation and quality assessment apart from these findings

- The hook extends the existing completed-frame production gate; it is not test-only verification.
- Private connector metadata survives `Mobject.copy` because `Object.assign` copies the enumerable Symbol field. The real imported VMobject + copied diagram regression is appropriate proof distinct from the synthetic label law.
- Existing motion sampling/copy-handoff rules remain intact. The adaptation does not indiscriminately forbid documented Card/View crossfades.
- Replacing the imported/imported exemption property restores a reader contract. Order, hidden/ancestor, nested clipping and native-camera properties remain rather than being traded for the new proof.
- The actual Lantern/cache raster owner remains, with a stronger exact paper-colour assertion for fully opaque labels. Its inactive cache-branch exception retains the prior light-background requirement rather than erasing that case. The new Seasons cases count their expected labels and settings variants before testing pixels.
- Individual glyph ink boxes are a justified correction over logical advances: leading space is not painted obstruction. Descendant clip checks and actual stroke width are appropriate boundary cases. The conservative cubic hull subdivision catches overshooting handles without assuming the endpoint chord bounds a Bézier.
- The geometry gate remains a resting authored-scene check. It does not inspect DOM controls over the SVG or infer whether a close-up includes the caption's semantic evidence; the existing browser map and attack-arrow contracts must stay.

Recommendation: repair and demonstrate caught controls for the two blockers above before calling the route verifier ready. No source/test edits were made by this reviewer.

## Re-review after endpoint and paint repairs

The revised candidate now limits cap attachment to first/last cubics and disallows joined endpoints across route objects. It also restricts masking plates to truly opaque hex fills with opaque ancestors, and handles transparent route/glyph paint. The original internal-joint, split-Line, transparent-mask and transparent-stroke cases have dedicated table rows. These address the two prior blockers.

One new material parser issue remains in the paint-alpha helper: it uses the last comma/slash token as alpha without checking component count. Valid CSS Color aliases `rgba(255,0,0)` and `hsla(0,100%,50%)` have **implicit alpha 1**, but are treated as alpha 0 and 0.5 respectively. Their visible routes are consequently omitted.

Direct actual-raster control (`out/review-rgba-alias.ts`) draws a route through native text and renders through resvg at 1280px. All four route paints produce 2612 red pixels:

| Paint | Gate result |
| --- | --- |
| `rgba(255,0,0)` | Incorrectly no crossing |
| `hsla(0,100%,50%)` | Incorrectly no crossing |
| `rgba(255,0,0,1)` | Crossing reported |
| `rgb(255,0,0)` | Crossing reported |

Conservative repair: parse legacy comma alpha only when there are exactly four comma components, or parse an explicit slash alpha. A three-component rgba/hsla alias can be treated as opaque or unknown; the existing unknown-visible fallback is safe for detection. Add these valid aliases as positive controls beside the transparent rows. The strict opaque-mask recognition itself is now safe.

## Bounded final verdict

The final parser now recognises explicit slash alpha or exactly four comma components; the three-component RGB/HSL aliases remain visible. I reran the existing independent actual-resvg alias reproduction: all four aliases report a crossing and retain identical 2612-red-pixel output. I also reran the internal-joint and transparent/unresolved-plate reproductions: the joined path now reports its crossing; every transparent/unresolved plate reports the crossing; the opaque hex control still masks it.

The three identified correctness blockers are closed. The added table controls exercise each repaired boundary, including split lines, first/last cubic attachment and copied imported diagrams. I found no remaining material introduced issue in this bounded read-only review of the changed checker. This verdict does not expand the checker into a full CSS parser, arbitrary caption-semantic oracle, DOM-overlay detector or complete raster-occlusion proof; the preserved raster/browser owners still supply their distinct evidence. No production or test edits were made by this reviewer.
