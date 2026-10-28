> Review notes include intermediate findings. The final verdict at the end and README.md describe the repaired state.

# Read-only test audit: geometry, fonts and scene roots

Reviewed source/tests at the PR #39 baseline `df49328556b15711a5518eaa1aa5ab02eb9e5e35`, plus upstream `d65fd1da5f11f8e902b43eaf2e1598decee9abcb`. No production/test files edited. This is a focused owner review, not a claim of a new whole-project audit.

## Why the bugs survived

### Text's initial advance-box origin

- `src/text.ts` constructor says it centres the object but shifts y by `ascent - (ascent - descent)/2`, leaving the advance-box centre at `ascent`, instead of zero.
- `test/core.test.ts:12` checks SVG dimensions, outlines and path count; its y-direction test checks a Rectangle. Neither pins Text's initial layout origin.
- `test/fonts.test.ts` checks glyph presence, width, clusters, fallback ordering and per-face metrics. Its final Text test checks advance width/order, never vertical origin.
- `test/lineage.test.ts:738` compares different constructor sizes and relative glyph/advance positions. Both Text instances share the offset, and subtracting `frameBox[0]` removes translation. `setText`/DecimalNumber tests preserve an initial anchor rather than asserting that it was correct.
- **The broad generator actively normalizes this defect away:** `test/lib/random-scene.ts:makeScene` puts every new shape through `place()`, which calls `moveTo()` before any random-scene assertions. The original constructor offset is gone before observation. Groups/Labeled also arrange or move their contents.
- `test/property.test.ts:42` protects determinism, finite output, cache-free equality, seeking and skipped traces. These remain valuable, but both sides can share a wrong initial placement. `test/manim.test.ts` has independent Manim answers for rate functions and path geometry, not typography.
- The previous engine ledger correctly retained those existing contracts, but inferred no missing origin law from their breadth. Do not describe that prior audit as proof of complete geometry correctness.

**Primary keeper:** extend `test/core.test.ts` with the constructor contract, optionally generated through `test/lib/pbt.ts`: a default-middle Text's public `anchorPoint()` is `[0,0]` before any placement; width/height stay nonnegative and finite. Include both valid fonts, ordinary/bold text, positive sizes, empty/space-only strings, ascenders/descenders and combining marks supported by the embedded faces. Pin one small `Group(Rectangle, Text)` composition to establish that this means label placement, not only internal arithmetic.

Use the **advance box**, not a claim that the ink's visual mass or bounding box must be symmetric: overhanging and asymmetric glyphs are legitimate. `anchorPoint()` is the public advance-box contract; a simple Latin `box()` example may supplement it. Zero is an independent expected value, not another newly constructed Text or production metric expression.

**Failing control:** restore the old positive-y constructor shift only. The untouched-origin law must fail; keep the font shaper and transform code unchanged. Restore bytes afterward. `moveTo`, transformed-size and seek tests remain as different lifecycle contracts.

### Runtime font-name rejection

- `src/fonts.ts:shaperFor` indexes a normal object and accepts any truthy result. Inherited function names and coercible objects pass.
- Every font-domain property in `test/fonts.test.ts` and `test/lib/random-scene.ts` chooses only `'sans'` or `'mono'`; it proves supported fonts work but contains no public JS rejection contract. TypeScript's `FontName` does not validate JavaScript callers or JSON/runtime data.
- The earlier inherited-name repairs tested snapshot families, palette names and prose lookups. Those boundaries do not reach `shaperFor`. A successful prototype guard test in one table was treated too broadly when the underlying lookup pattern existed elsewhere.

**Primary keeper:** one admission/rejection owner in `test/fonts.test.ts`, with both positive and negative directions. Supported literal strings must return working shapers; all other runtime values must reject with the documented unknown-font error. Generate arbitrary strings and heterogeneous values (`fc.anything()` plus explicit Object.prototype keys, symbols/functions and boxed/coercible values). Explicit coercion objects should throw or count calls: lookup validation must not invoke `toString`/`Symbol.toPrimitive`. Do not build expected rejection by invoking a production registry. Bounds on generated object size are a materialization cost limit, not a restriction to valid enum values.

**Failing control:** restore only `const s = shapers[font]; if (!s)...; return s`. Include `constructor`, `toString`, `__proto__` and an object coercing to `'sans'` as stable rows; the property then explores the rest. A different TypeError caused by interpolating a Symbol or coercion object is not the intended refusal.

### Scene.add root antichain / one render per leaf

- `src/scene.ts:293` says adding a child of an on-screen parent is a no-op, but implementation only removes exact roots before appending. `add(child); add(parent)` or `add(parent); add(child)` draws the same descendant through two roots.
- `test/lineage.test.ts:352` already protects `play(new Indicate(new Group(a,b)))` from duplicate rendering, but `play()` has distinct family/admission handling. Replacement tests protect `replace()`, not public `add()`.
- The operation-tape property around line 374 selects only independent top-level kids. The random-scene generator builds each hierarchy once and adds the distinct pool once; it never repeatedly promotes descendants/ancestors as roots.
- Existing copied/cached/seek comparisons can duplicate the same bad hierarchy on both sides. `Set(actualIds)` alone would also hide the defect, so equality of sets is insufficient.

**Primary keeper:** expand the scene ownership section in `test/lineage.test.ts` or core's direct admission tests with a cheap synchronous generated forest/operation trace. Generate a bounded tree independently, retaining its input adjacency model, then add leaves, internal groups and ancestors in varied orders/batches. After each public `add`, render and require every expected drawn leaf exactly once (cardinality + each identity frequency, not a normalized set). Roots must form an antichain under the *input* ancestry relation. Retain an independent disjoint top layer and assert its order is unchanged when adding an already-visible descendant. Explicit rows must cover child→parent, parent→child, `[child,parent]`, `[parent,child]`, duplicate arguments, repeated root, and nested ancestors. No animation frames are needed for this admission invariant; retain existing real animation/replacement owners for their distinct lifecycle risks.

**Failing control:** restore only old Scene.add, leaving play()/replace() correct. The direct child→parent case must fail through duplicate rendered identity. Separate mutations for exact duplicate arguments or same-batch parent/child prove generated domains reach each admission class. Restore source bytes after every control.

## Process correction

The central issue is **missing laws and missing operation classes**, not too few random cases. FULL=1 multiplies runs of the same generator and cannot create hostile font values, untouched constructor observations or hierarchy-changing add traces. Add a small boundary/domain checklist to test ownership: initial state before normalization; literal expected invariants; invalid runtime inputs despite TypeScript types; ancestor/descendant identity; and independent browser/raster output where serializer/paint behavior matters. Preserve the prior independent Manim, Unicode/HarfBuzz, browser, package and seek proof. Do not delete it to fund these inexpensive laws. The prior audit mutation list proves the mutations it sampled, not a global absence of bugs.

## Final preservation review of candidate (read-only)

Reviewed the current working-tree changes in `src/text.ts`, `src/fonts.ts`, `src/scene.ts`, `test/core.test.ts` and `test/fonts.test.ts`. No code edited. The corrected Text shift and strict font switch match the intended contracts. The adapted `admitRoots` preserves a repeated root's requested draw-order movement and prevents direct ancestor/descendant duplication across the fixed input tree. The generated render-identity frequency assertion is an independent invariant even if the exact-order model shares admission's procedural structure. Existing play/replacement and font-shaping owners remain.

### Critical findings in replacement admission

1. **Moving an earlier sibling into old's slot deletes the wrong child.** For `parent = Group(a, old, b)` on screen, `scene.replace(old, a)` computes old's child index 1, then removes `a` from index 0, then splices at stale index 1. Result: `[old,a]`; `old` still renders and `b` disappears. Expected result is `[a,b]`. Confirmed against candidate through `renderElements`, not merely parent metadata. The computed insertion point must account for replacement detachment before modifying children. This path predates the backport but remains inside the changed producer and its new preservation test scope.
2. **Mixed self replacement breaks the parent backlink.** For `parent = Group(old,b)`, `scene.replace(old, old, b)` leaves `[old,b]` in parent.children but unconditionally sets `old.parent = null`. The single-self shortcut does not handle retained old among several replacement arguments. This can invalidate later removal/replacement/cache propagation. Confirmed against candidate. Either preserve the retained old's parent, or refuse the entire input explicitly before mutating anything if the public contract deliberately forbids it.

Add explicit expected children/render-ID rows for both, plus later-sibling-to-earlier-slot, multiple siblings straddling old's slot, duplicate replacement arguments and parent-child replacement sets. These should assert order, all intended survivors, no original ghost, and child.parent consistency. Avoid deriving the expected insertion index by copying the splice algorithm. Existing one-row replacement test covers promotion, single self, extraction to a root and ancestor refusal, but misses index-shifting and retained-self-in-a-batch.

### Remaining test-quality observations (non-blocking source findings)

- The exact root-order oracle follows the producer's remove/append-or-prepend control flow fairly closely. Its input-tree ancestry and rendered identity frequency checks are independent and useful. Pin a few literal expected-order rows for `[parent,other,parent]`, front/back and descendant no-op so a shared model interpretation cannot bless a draw-order regression.
- `fc.anything()` does not literally generate every JavaScript value. Add explicit Symbol and function rows to font rejection, alongside the existing boxed and coercion-hostile objects. A Symbol is especially useful for catching an implementation that accidentally coerces only to construct its error text.
- The fresh Text property has a sound absolute-zero oracle and wide font-size range, but reads `frameBox` layout. Public default-middle `anchorPoint()` can express the origin contract without depending on corner-array representation. Do not replace the independent zero expectation with another Text/shaper-derived origin. A simple real label/rectangle composition remains useful user-facing confirmation, distinct from that cheap law.

### Follow-up preservation check after nested-sibling repair

The stale-index and mixed-self cases are repaired by the original-neighbour reconstruction, with explicit backlink/order assertions now present. The literal front/back root-order rows remove the earlier model-independence concern. The reported 90-test core/lineage/matching/view/story run is green.

One material detachment regression remains in that revised loop: it searches only visible families for a replacement's old parent. For an off-screen `source = Group(replacement)`, on-screen `target = Group(old)`, and `scene.replace(old, replacement)`, `source.children` retains replacement while replacement.parent becomes target. Adding source afterward renders replacement twice. This was confirmed through `renderElements` (two occurrences), without changing source. Detach a replacement from its actual old parent when that parent differs from the destination, including off-screen parents; preserve the original-neighbour splice and retained-old backlink logic. Add one row requiring the off-screen source to release the child and requiring a later re-add to preserve one rendered occurrence. No broader exploration was performed.

### Final bounded re-review

The off-screen source-parent regression is repaired: the nested branch now detaches through the replacement's actual previous parent whenever it differs from the destination, while reconstruction still uses the original sibling order. The new row observes the hidden source releasing the child, the destination backlink, and exactly one rendered occurrence after the hidden source is added. The reported isolated missing-detachment mutation rejects that row. The earlier stale-index, mixed-self and repeated-root-order findings are also repaired. No further material regression found in this bounded review of Scene admission/replacement; no edits or broader exploratory expansion performed. Reported validation is 92 focused tests and 40 expanded core/fonts/SVG/layout tests at seed 20261028; those result counts are supplied by the implementation owner, not rerun by this reviewer.
