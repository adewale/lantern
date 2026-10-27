# Main update authoring compatibility review

Read-only comparison a4a80d03963a86d804e2b3465ee8a7e9eb68ba6d → fad29b00a0c1984984ab4e0f4bbe363199520371 (#30). Inspected complete diffs for explain/panels.ts, explain/look.ts, explain/diagrams.ts and test/lib/scenes.ts plus new reader emphasis tests and explain/index.ts. No edits, tests or mutations during root's old-tree checks.

No blocking conflict with the strengthened authoring properties. Preserve the incoming metadata feature and all local acceptance/value/geometry oracles. Do not refresh expectations by removing default/named/narrow positive branches.

## Card and Code

Incoming Card constructor only adds `emphasises(scene, () => this.lit ? [[this.bar, row-label]] : [])` after bar construction. Width/default/natural-size calculation, font sizes, row fit/refusal threshold, placement, value rendering and mark/set/fade operations are unchanged. The positive helper's derived `0.56 + 2.5 * fontSize + EPS` condition therefore remains applicable. Its corrected representation preservation remains essential: undefined width and placement, named region string, point, and original valid narrow widths must survive; only explicit insufficient Box/defined width may be lifted. Main does not justify reintroducing blanket2/default3.2 normalization.

Incoming CodeBlock registers focus-bar and diff-mark observations. It does not change Text.text, line matching, source tabs, LCS retention, marks geometry/colors or region placement. Keep original source-line oracle and explicit tab constants, along with live identity/LCS assertions. Do not return to two extra CodeBlock oracle constructions; those would now also register unused emphasis observers in addition to unnecessary shaping. Existing good/bad color proof remains valid because outcome helpers and tint shapes do not change.

The metadata is stored in a WeakMap keyed by Scene, rather than in object style, points, children or state. Existing exact style restoration, source-value, opacity, description and scene-membership assertions should remain stable. Authoring scenarios use independent scene instances, so registrations do not mix between generated samples. A refused Card registers an inert callback before the width validation, but its lit state remains null and it cannot contribute emphasis; do not weaken refusal assertions on that account.

## Diagrams

Diagram gains one scene observer and a private inFocus extraction shared by description and metadata. The extracted condition is identical to old describe logic: a camera focus is active only while the camera remains at focusView within1e-6. Mark/dim geometry, owner propagation, walk routes, note placement, style restoration, hide/forget and morph handoff are unchanged. Keep topology-light projection only where already reviewed; full text/focus/style/real adapter keepers remain required.

A morphed target Diagram also registers an observer. The original object's parts are reassigned to target.parts, but old emphasis is cleared by plain(); target starts plain. Existing morph state/style/identity assertions must remain. Reader emphasis lifecycle tests are the correct independent owner for obsolete/new emphasis records; authoring style checks do not substitute for that new feature.

## Internal surface and support

look.ts adds Emphasis/emphasises/emphasisOf; existing contrast, regions, emphasis colors and dimensions are untouched. explain/index.ts public runtime export list is unchanged, so the closed authoring entry-point inventory should remain exact. Do not add internal look functions to that public allowlist merely because they now exist internally.

New test/lib/scenes.ts helpers collect resting geometry, select visible Card row label/value, and select labels outside Cards. They are support for the incoming reader regression and are not imported by the strengthened authoring suites. Preserve all three: the frozen PKCE statement that caption-referenced content occurs in first/next phone close-up needs this independent drawn-content boundary. They cannot replace independent Card value or Code source-line oracles.

New upstream close-up properties explicitly preserve first view and the set of views while ordering subsequent emphasis views; integration tests cover newly lit card/code bars, unlit marks, quiet steps, moved focus and actual PKCE content. Keep those incoming tests when merging local reader changes.

## Validation handoff

After integration, rerun focused authoring panels/diagrams/helpers plus root's required checks on the new tree. Mutation restoration hashes recorded for a4a80d0-owned source bytes are historical evidence, not valid expected hashes for incoming modified source files; new mutation sessions must snapshot the merged bytes rather than restoring old originals. Incoming baseline/receipt changes have a separate upstream cause and should not be conflated with weakened authoring expectations.
