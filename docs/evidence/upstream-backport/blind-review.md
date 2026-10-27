# PR #41 blind contract review

This report preserves the earlier read-only review. It is not a re-audit of the final implementation. The reviewer inspected production implementation, documented signatures, and production callers without reading tests. No source edits were made. Findings were checked with direct production-API probes; the DOM findings used a minimal DOM adapter. The report does not claim these findings remain unresolved after subsequent implementation work.

## Findings recorded during review

1. **Clipped plates suppress real crossings** (`tools/lib/explain-layout.ts`, original line 110). Plate coverage checked geometry without applying the plate's own or ancestor clips. A plate covering text geometrically but clipped to `x ∈ [-3,-2]` suppressed a visible central Line/Text crossing. Baseline without the plate reported the crossing; adding the clipped plate returned `[]`.
2. **Collinear cubic overshoot disappears** (`tools/lib/explain-layout.ts`, original line 40). Cubic control coordinates `[-2,y, 3,y, 3,y, -1,y]` were reduced to endpoint interval `[-2,-1]`, missing the curve's crossing through central text. The direct probe returned `[]`.
3. **Native curved arrows escape inspection** (`tools/lib/explain-layout.ts`, original line 97). `CurvedArrow.arc` is `ArcBetweenPoints`, outside the Line/imported-connector admission condition. Text placed across its midpoint produced no finding.
4. **Stroke thickness is ignored** (`tools/lib/explain-layout.ts`, original line 111). A Line with stroke width `.2`, centred `.02` above the glyph bounds of `Text('M')`, visibly overlaps the glyph although its centreline misses the bounds. The probe returned `[]`.
5. **Descendant label clips are ignored** (`tools/lib/explain-layout.ts`, original lines 88–90). Clipping every glyph of `Text('MMMM')` to `x <= -.3` still reported a line crossing the clipped-away final M at approximately `x=.542`.
6. **Direct-record text updates can vanish** (`src/svg.ts`, original line 555). Two distinct immutable ElementRecords sharing the same attrs object, with text changing from `before` to `after`, left DOM text at `before`: the shared-attrs early return bypassed text patching. This was a pre-existing surrounding defect.
7. **Own `__proto__` attributes cannot be removed** (`src/svg.ts`, original lines 540 and 563–566). The attribute tracking object `{}` failed to retain the own key supplied by `JSON.parse('{"__proto__":"kept"}')`. Applying a subsequent record with empty attrs left that attribute on the DOM. This was a pre-existing surrounding defect.

## Property gaps identified

Clipped plate coverage; independently clipped glyphs; collinear nonmonotone cubic controls; native curved arrows; stroke footprints; shared-attribute record text updates; and prototype-sensitive own attribute names.

No concrete defect was found in the reviewed changes to Text advance-box centring, literal font selection, or Scene.add hierarchy batch admission.
