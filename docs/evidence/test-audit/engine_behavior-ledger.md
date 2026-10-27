# Engine behavior declaration ledger

Pinned baseline: a4a80d03963a86d804e2b3465ee8a7e9eb68ba6d. Read-only discovery under OpenClaw test-audit and Hegel skill/checklist. Source and test files were not edited and no broad suite was run.

Scope: 12 test files, 123 declarations, 2,717 test LOC. Marks: {'R': 112, 'F': 11, 'C': 0, 'D': 0}. A mark is one declaration (existing table rows remain together when they share a contract). No deletion is proposed without a named stronger owner; this lane currently recommends no wholesale retirement.

Baseline: reused tree-identical main proof documented in baseline.md: 733 global cases / 694 pass / 39 optional skips / 0 failures. These are whole-project results, not a fabricated lane-only run. No new runtime failures were observed because discovery remained read-only.

History inspected: 53c5add fixes updater seeking, copy ordering, and cut-in exemptions; bc9bbc4 introduces matching/diff/emphasis/views/code spans; 916b0a9 records an earlier boundary-focused audit. These explain why replay/continuity and snapshot/reference ownership tests are retained despite partial conceptual overlap.

Every test/table was read in full. Production owners/callers and documented contracts were inspected in src/animation.ts, src/mobject.ts, src/text.ts, src/view.ts, src/scene.ts, src/diff.ts, explain/stage.ts, explain/trace.ts, and docs/ANIMATIONS.md, MATCHING.md, EMPHASIS.md, CODE.md and VIEWS.md. Shipped callers include state-machine, ring-buffer, token-bucket, mr-cache, exgit and glyph. Shared support belongs to the corresponding boundary and is not a removal candidate here.


## test/anim-utils.test.ts

Production owners: src/mobject.ts saveState/restore/adoptState; src/animation.ts Restore/TransformFromCopy/Succession; src/scene.ts play and seek.

- **R** `test/anim-utils.test.ts:42` — 'restore() returns points, style and text to the saved state, keeping the children'. Pins the saved points/styles/text and same-structure object identity, parent links, part references and repeated restore. A shallow saved state or stale child alias would fail.
- **R** `test/anim-utils.test.ts:69` — 'restore() on a Code keeps \`lines\` naming its own children, not the saved copy\'s'. Pins Code.lines to live restored children and exercises Restore too; prevents detached-copy spans/double drawing. This is a concrete restore regression, distinct from Code.copy.
- **R** `test/anim-utils.test.ts:90` — 'restore() after the family changed shape takes the saved children wholesale'. Pins changed-structure adoption, preserved parent and missing-save rejection; same-shape restore cannot cover the wholesale-child path.
- **R** `test/anim-utils.test.ts:106` — 'copy() does not carry the saved state'. Checks the explicit public no-saved-state-on-copy promise for a root and a descendant; catches accidental saved-state graph duplication.
- **R** `test/anim-utils.test.ts:115` — 'Restore after Indicate and after an .animate change lands on the saved frame byte for byte'. Checks exact saved endpoint after several public transformations against both cached and copied-cache-free SVG. Keeps restore data and rendering/cache contracts distinct.
- **R** `test/anim-utils.test.ts:143` — 'Restore without saveState() says what to do'. Checks the public error when Restore begins without a saved state, not just an internal flag.
- **R** `test/anim-utils.test.ts:149` — 'TransformFromCopy leaves the source alone and the scene holding the target'. Checks source and target data preservation and scene membership after copy-transform; catches mutating the source or leaking the temporary copy.
- **R** `test/anim-utils.test.ts:162` — 'TransformFromCopy and an animation on the source share a play'. Checks independent source animation can share the play and preserves final membership, a concurrency/lifecycle risk not covered by isolated copy-transform.
- **R** `test/anim-utils.test.ts:173` — 'TransformFromCopy copies its source before anything in its play begins, in either argument order'. Checks argument-order invariance around Create.begin hiding, for existing/new source objects, plus replay. The two argument paths are meaningfully independent metamorphic paths.
- **R** `test/anim-utils.test.ts:222` — 'a Succession runs like consecutive plays: same frames, same step times'. Compares Succession with the documented equivalent consecutive plays, including all SVG frames, scene endpoint and step indices. Retain this strong lifecycle oracle.
- **R** `test/anim-utils.test.ts:234` — 'a lagRatio passed to play() leaves a Succession sequential'. Checks play-level lag cannot override sequential member windows. The integer timing example is public scheduling behavior, not copied implementation inventory.
- **R** `test/anim-utils.test.ts:242` — 'seeking into a Succession whose member brings an updater matches the full run'. Checks late-introduced updaters disable seek skipping at the right time; the full-run oracle exercises integration state absent from endpoint-only tests.
- **R** `test/anim-utils.test.ts:262` — 'Succession run time is the sum of its members'. Cheap independent fractional sum of member durations; guards constructor runTime without rendering. Overlap with scheduling is useful distinct failure localization.
- **R** `test/anim-utils.test.ts:267` — 'a Succession of groups runs like consecutive plays of them'. Checks nested AnimationGroup/LaggedStart/Succession behaves like equivalent consecutive public plays; contains cleanup and membership paths not in a flat chain.
- **R** `test/anim-utils.test.ts:286` — 'a Succession inside a group runs beside the other members'. Pins concurrent outer-group duration, order of membership and final pose; protects sequential members sharing a group with parallel animation.
- **R** `test/anim-utils.test.ts:301` — 'play() still refuses two animations on one mobject, through a Succession'. Checks overlapping drivers are rejected through nested groups, but sequential re-use is accepted; both reject and accept directions matter.
- **R** `test/anim-utils.test.ts:344` — 'Restore, TransformFromCopy and Succession seek to the frame a full run produces'. Checks replay at boundaries and midpoints across Restore/copy/sequencing in a combined scene; keep a representative composition smoke even if cheaper pure properties are added.
- **R** `test/anim-utils.test.ts:358` — 'the motion verifier finds no teleport, pop or cut in these animations'. Uses the independent motion verifier on three lifecycle scenarios; protects actual painted continuity, which endpoint or replay equality cannot establish.
- **F** `test/anim-utils.test.ts:378` — 'a copy over its source is no cut, but a brighter shape over a faint one still is'. Title promises a copy control, but the assertions exercise brighter-over-faint and remote cut-ins only. Keep these distinct negative controls and rename accurately; copy-exemption proof is at line 398.
- **R** `test/anim-utils.test.ts:398` — 'a cut-in is exempt over a staying leaf only when it is a copy of it or looks the same'. Contains the actual positive copy/text-copy exemptions and negative bare/outline intrusion cases. Prevents broad overlap exemptions that hide real cut-ins.
- **R** `test/anim-utils.test.ts:430` — 'play() with a lone .animate builder animates it (it is not the options object)'. Pins lone-builder option parsing through the public play boundary, including duration and final pose; catches a historical trailing-options classification bug.

## test/code-spans.test.ts

Production owners: src/text.ts Code/CodeSpan; tools/lib/tokenize.ts; tools/tokens.ts; SVG merged records.

- **R** `test/code-spans.test.ts:21` — 'span.box() is the advance cells of [from, to) by the line\'s ascent and descent, unioned with the ink'. Pins advance-cell geometry and ink containment under scale/translation, including whitespace with no glyph; expected positions are independently computed from mono-cell metrics.
- **R** `test/code-spans.test.ts:36` — 'token() finds the nth occurrence\'s glyphs, by source index'. Pins occurrence ordinal, source indices, real glyph selection, whole/empty line spans and invalid line/range/token rejection. Public addressing contract is the owner.
- **R** `test/code-spans.test.ts:56` — 'spans of adjacent ranges tile the line in x, with no gaps'. Pins exact adjacent-edge tiling; generic containment does not catch a sub-cell gap or duplicated boundary.
- **R** `test/code-spans.test.ts:65` — 'a span is a view: it recolours and moves the real glyphs, and goes stale with its line'. Checks live glyph recoloring/movement, parent ownership, ancestor bounds invalidation and invalidated source addresses; distinguishes spans from copies.
- **R** `test/code-spans.test.ts:81` — 'span.animate plays on its line, so the span never joins the scene'. Checks animate routes through the owning line and does not duplicate scene members; last-builder option parsing is a sibling regression of the generic builder test.
- **R** `test/code-spans.test.ts:98` — 'a copy of a Code addresses its own lines'. Checks Code.copy rebinds line references and subsequent span styling cannot touch the source. This class-specific alias contract is not redundant with generic copy tests.
- **R** `test/code-spans.test.ts:112` — 'Code paints its spans at construction, over the base colour'. Pins construction-time ColorSpan application and independent invalid range rejection; prevents silently ignored/overbroad syntax coloring.
- **R** `test/code-spans.test.ts:125` — 'a one-colour line is one <path>; a coloured line is one <path> per colour run, with the same ink'. Pins renderer cost in element counts and exact concatenated ink; merging by style rather than paint-order run would violate this transport/renderer contract.
- **R** `test/code-spans.test.ts:153` — 'seeking a coloured Write and Transform renders the frames a full run produces, in both path modes'. Checks colored Write/Transform replay in both SVG and absolute DOM-record modes. The different render paths and partial drawing justify this integration proof.
- **R** `test/code-spans.test.ts:176` — 'the fallback lexer: ts'. Independent literal TypeScript lexer output including multiline comments and template/string boundaries; retain as an explicit classifier grammar example.
- **R** `test/code-spans.test.ts:186` — 'the fallback lexer: python'. Independent literal Python lexer output including docstrings, formatted strings, constants and comments; retain this language variant.
- **R** `test/code-spans.test.ts:195` — 'the fallback lexer: bash'. Independent literal shell lexer output includes an embedded # that is not a comment and single-quote behavior; retain this language-specific control.
- **R** `test/code-spans.test.ts:205` — 'the fallback lexer: elixir'. Independent literal Elixir lexer output covers module/function forms and atom/constant handling; retain this grammar variant.
- **R** `test/code-spans.test.ts:216` — 'tokenize() maps kinds to the palette, leaves punctuation uncoloured and merges touching runs'. Pins palette mapping, punctuation omission/custom palette, merging, deterministic data and CRLF equivalence plus language rejection. Strong exact values make the metamorphic checks meaningful.
- **R** `test/code-spans.test.ts:235` — 'tools/tokens.ts prints the spans JSON for stdin'. Checks the real executable stdin/JSON/stderr boundary. Delegated token values are covered independently by lexer/palette fixtures; this is distinct CLI wiring proof, not a reason to duplicate classifier rules.
- **R** `test/code-spans.test.ts:245` — 'shiki and the fallback lexer cover the same ranges on simple code'. Checks the documented limited simple-code agreement against pinned Shiki, with explicit language rows. It is an external oracle and must not be replaced by two calls to the fallback lexer.

## test/code-tabs.test.ts

Production owners: src/text.ts shapedForm/CodeSpan and src/animation.ts text/diff matching.

- **R** `test/code-tabs.test.ts:16` — "token(1, 'return') on a tabbed line selects exactly the glyphs of 'return'". Pins UTF-16 source indices and actual return glyph selection after a tab, guarding expanded-column/source-index confusion.
- **R** `test/code-tabs.test.ts:26` — 'lineSpan() of a tabbed line holds every glyph of the line'. Checks lineSpan includes all tabbed-line glyphs and token lookup remains consistent on another line; covers a sibling accessor rather than one occurrence only.
- **R** `test/code-tabs.test.ts:32` — 'box() of a span on a tabbed line is its cells in the laid-out line: the tab takes its columns'. Pins default tab-stop cell widths under scale/translation and ink containment, including a later partial tab stop.
- **R** `test/code-tabs.test.ts:48` — 'ColorSpans on a tabbed line colour the characters they name'. Pins ColorSpan selection to source indices rather than expanded columns, with expected literal let text.
- **R** `test/code-tabs.test.ts:54` — 'a span after an astral character selects the right glyphs'. Pins astral UTF-16 cluster offsets, coloring and later token selection; this Unicode variant is not covered by ASCII/tab-only cases.
- **R** `test/code-tabs.test.ts:67` — 'TransformDiff: an unchanged tabbed line pairs every glyph'. Checks whole-line, neighboring-edit and rewritten-line diff pairing with tabs; independent expected counts/characters protect source-offset mapping.
- **R** `test/code-tabs.test.ts:84` — 'TransformMatchingText keys tabbed and astral glyphs by their own character'. Checks character-key matching across tab/astral reorderings with explicit expected match counts and character agreement, a sibling matching path of TransformDiff.

## test/diff.test.ts

Production owners: src/diff.ts; src/animation.ts TransformDiff; Scene.record and trace/text output.

- **R** `test/diff.test.ts:35` — 'diffLines: empty, identical, all changed, insert at top, a moved block'. Pins unified numbering, empty/identity/full-change cases and move behavior with literal hunks. Cheap value examples should remain alongside broader generative replay.
- **R** `test/diff.test.ts:52` — 'diffTokens: shared tokens in order, ranges into each line'. Pins tokenization and source ranges, rebuilds both sides, and names actual additions/removals. This is a value oracle, not merely token validity.
- **R** `test/diff.test.ts:73` — 'parseUnifiedDiff: headers, context, omitted counts, no-newline markers; malformed input throws'. Pins parser values and separate malformed/second-file rejection paths; catches permissive parser changes that valid-only roundtrips miss.
- **R** `test/diff.test.ts:88` — 'git agrees: parse(git diff) equals diffLines on random edits, and git round-trips through the parser'. Uses the actual git CLI as an independent oracle with unique and repeated-line edit families. Keep a small external conformance sample; use pure replay/minimality PBT for larger counts and shrinking.
- **R** `test/diff.test.ts:130` — 'TransformDiff: unchanged lines travel whole to where the diff puts them, glyph for glyph'. Pins TransformDiff line/token ownership and final geometry, with independent expected plan for the cache rewrite. Public plan/evidence is intentional documented output.
- **R** `test/diff.test.ts:162` — 'TransformDiff: given hunks are the truth, and hunks that do not describe the texts throw at begin()'. Checks author-provided hunks are authoritative, including an alternate valid minimal diff, and malformed/mismatched hunks fail at begin. Both accepting an alternate plan and rejecting bad plans are needed.
- **R** `test/diff.test.ts:201` — 'seeking into a TransformDiff renders the frame a full run renders'. Checks representative diff animation replay at first/middle/last and step boundaries against full playback; retain transport/lifecycle proof.
- **R** `test/diff.test.ts:252` — 'TransformDiff in a scene: the recorded hunks are git\'s, and no unchanged line moves off its line in the after block'. Checks recorded hunks against git and observes handoff geometry in real scene frames; it protects endpoint continuity and external evidence, not just internal pairing arrays.
- **R** `test/diff.test.ts:298` — 'TransformDiff is free of motion discontinuities'. Uses motion analysis on the diff scene; replay equality alone could agree on a discontinuous animation.
- **R** `test/diff.test.ts:304` — 'evidence: the trace and the text frame carry what each transform paired, and hash the same every run'. Pins trace/text evidence values and deterministic repeated traces; semantic literal expectations precede the hash equality, so this is not an isolated self-comparison.
- **R** `test/diff.test.ts:322` — 'every matching transform records its counts when it begins in a scene'. Pins nested-group evidence recording, free-transform behavior and JSON snapshotting. Public scene evidence has real trace/fidelity callers.

## test/emphasis.test.ts

Production owners: src/shapes.ts emphasis shapes; src/animation.ts Circumscribe/Create; motion verifier.

- **R** `test/emphasis.test.ts:24` — 'SurroundingRectangle is the target box grown by buff, for a mobject or a Box'. Pins SurroundingRectangle defaults, independent expanded bounds, Box target and snapshot/copy behavior; retain public geometry contract.
- **R** `test/emphasis.test.ts:39` — 'Underline runs along the bottom edge, buff below it, left to right'. Pins the independently calculated underline endpoints on mobject and Box targets; catches wrong edge/direction/buff.
- **R** `test/emphasis.test.ts:48` — 'Cross diagonals span the box corners; scale shrinks them about the center'. Pins both diagonal endpoints, default stroke and centered scale geometry, guarding a cross drawn with the wrong orientation or extent.
- **R** `test/emphasis.test.ts:57` — 'Brace tip: middle of the chosen edge, buff + depth out, in all four directions'. Pins brace tip/end/direction for all four sides plus custom dimensions. The direction table covers advertised sibling variants.
- **R** `test/emphasis.test.ts:77` — 'a vertical brace is the horizontal one, rotated'. Checks rotational equivalence of independently constructed horizontal/vertical braces, a geometry metamorphism beyond fixed anchor examples.
- **R** `test/emphasis.test.ts:86` — 'Brace: tip and direction follow the points through copies and moves; short braces stay well formed'. Checks moved/copied/rotated tip identity and a narrow-width non-reversing curve. Small braces have a distinct degenerate geometry risk.
- **R** `test/emphasis.test.ts:98` — 'BraceLabel puts its label beyond the tip; parts read by index on copies'. Pins label placement beyond the tip, custom color and copied child getters. Retain because the compound shape has ownership and layout promises.
- **R** `test/emphasis.test.ts:113` — 'matchers box a span of code lines given as a Box'. Checks a Box spanning two code lines excludes the third, protecting a real Code-span/geometry composition.
- **R** `test/emphasis.test.ts:135` — 'Create draws braces and brace labels in without jumps'. Checks Create paints emphasis families without motion discontinuities. Keep one representative renderer integration for compound shape draw order.
- **R** `test/emphasis.test.ts:146` — 'Circumscribe draws in, then fades and is gone; nothing jumps'. Checks real alpha history rises and falls through partial values, removal and reusable endpoint state; catches a cut rather than fade.
- **R** `test/emphasis.test.ts:165` — 'Circumscribe keep: the outline stays drawn and stays in the scene'. Checks keep mode remains visible through hold and can later fade, plus circle mode remains a scene member. This is an independent kept-lifecycle promise.
- **F** `test/emphasis.test.ts:188` — 'Circumscribe variants: circle, retract instead of fade, a Box target, inside a group'. Only checks no motion events, although the title advertises retract-vs-fade and grouping/shape variants. An implementation ignoring fadeOut:false may satisfy it and replay equality. Add a value-pinning retraction-progress oracle; retain no-jump composition only if separately named.
- **R** `test/emphasis.test.ts:198` — 'Circumscribe fits the target where it is when the play starts'. Pins late target measurement and independent circle-through-corners bounds; catches construction-time fit or incorrect circle radius.
- **R** `test/emphasis.test.ts:230` — 'seeking into and past Circumscribe renders the frame a full run produces'. Checks replay across pulse/keep/retract/removal at representative boundaries and intermediate frames. Retain as the composition keeper after strengthening mode semantics.

## test/explain-emphasis.test.ts

Production owners: explain/stage.ts; explain/diagrams.ts; explain/trace.ts and language words.

- **F** `test/explain-emphasis.test.ts:50` — 'the heading follows step titles; a fixed or absent heading is still possible'. Pins dynamic titles and fixed heading, but absent heading is only claimed in the title: no stage(...,{heading:false}) assertion is exercised. Add that row here or name the existing owner that proves it; do not infer absence from an untitled dynamic step.
- **R** `test/explain-emphasis.test.ts:76` — 'a note follows its part through focus; clear() leaves paper and heading, and a cleared diagram can be drawn again'. Checks note following, stage-only clearing, and redraw of a formerly cleared diagram through real Stage/Diagram owners. These lifecycle contracts differ from raw emphasis shapes.
- **R** `test/explain-emphasis.test.ts:103` — 'the time a player, poster or screenshot shows for a step renders that step’s resting frame'. Checks the resting-time/frame API lands on the actual final drawn frame before the next step changes it. Keep the real frame oracle.
- **R** `test/explain-emphasis.test.ts:131` — 'descriptions read chart values as written, name marks by their word, and report drawings with no words'. Pins English chart values, marks, note words, undescribed geometry, faint text exclusion and explicit descriptions. Literal expected language is an independent accessibility contract.
- **R** `test/explain-emphasis.test.ts:178` — "a participant's bare name and its actor id name the same part, so dimming to two participants keeps their message". Checks equivalent participant names resolve to the same public part and preserve connecting messages when dimming. This alias/graph behavior is not a parser-only claim.
- **R** `test/explain-emphasis.test.ts:205` — 'a picture names what is new since the step began, and records nothing new when everything is'. Pins delta descriptions and emphasized-name deduplication against independently built prior-name sets, including all-new omission.
- **R** `test/explain-emphasis.test.ts:216` — 'a description separates its items and sentences once, even when an item ends in a comma'. Pins punctuation and code/state change presentation with literal strings; prevents machine-readable captions from acquiring duplicated separators.
- **R** `test/explain-emphasis.test.ts:231` — 'a summary counts the emphasised parts it leaves out once, at the end, in either language'. Pins one aggregate omitted count across mark groups in English/French, including singular/plural threshold rows.
- **R** `test/explain-emphasis.test.ts:250` — 'a link names its ends by their labels: a service by its label, a class or entity by its name, an end with none by its id'. Pins endpoint label resolution and language for architecture, classes and ER aliases/cardinality. The family rows represent distinct external snapshot structures.

## test/matching.test.ts

Production owners: src/animation.ts matching/assignment; src/vmobject.ts shapeKey; scene animation lifecycle.

- **R** `test/matching.test.ts:59` — 'every part ends matched, morphed, removed or added, exactly once, and the pairing is deterministic'. Checks independent source/target bucket partitions and determinism under separately reconstructed inputs across shape/text and mismatch modes. Retain; strengthen with independent key/cost value properties rather than treating the determinism half alone as sufficient semantics.
- **R** `test/matching.test.ts:77` — 'a moved, scaled and shuffled copy of a group pairs every part with its own copy'. Checks the distinct positive uniform-scale/translation copy-matching law on seeded data. Replace random-comparator shuffle with shrinkable permutation data in a targeted follow-up; ambiguous duplicate centers require minimum-cost rather than own-copy identity.
- **R** `test/matching.test.ts:92` — 'inserting or deleting a character keeps every other glyph'. Pins the value of insertion/deletion through expected matched/added/removed counts. Seed loops are meaningful but can become shrinkable fast-check cases; no need to remove the readable fixed example below.
- **R** `test/matching.test.ts:106` — "Text('cache') -> Text('cached'): five glyphs keep their letters, the d fades in, the scene ends holding the target". Pins cache->cached pairing, target handoff and half-grown insertion semantics against exact glyph/count expectations.
- **R** `test/matching.test.ts:134` — 'an inserted line of code leaves the other lines in place, and its glyphs join it'. Pins matching across inserted lines and the rewritten return token; line containment is an independent high-value value contract.
- **R** `test/matching.test.ts:147` — 'mono and sans letters, and bold and normal, do not match'. Pins font and weight separation. Ordinary equal-character cases cannot catch crossing these compatibility classes.
- **R** `test/matching.test.ts:160` — 'shapes: shared nodes travel to the target, others fade out, new ones fade in'. Pins concrete shape matches/additions/removals, endpoints and replacement membership; preserves a readable end-to-end example.
- **R** `test/matching.test.ts:176` — 'an explicit key; fadeMismatches: false morphs leftovers; replace: false keeps the source'. Pins caller-defined keys, mismatch morphing and replace:false behavior with an independent exact assignment. Retain for public configuration variants.
- **R** `test/matching.test.ts:194` — 'one animation of the source: plays inside a group, and play() refuses a second animation of its parts'. Checks nested-group addition/cleanup and overlapping-driver rejection, a real scene lifecycle boundary.
- **R** `test/matching.test.ts:231` — 'seeking into a matching transform renders the frame a full run renders'. Checks all matching variants and representative boundaries against full playback. Retain one scene-level replay keeper even after pure matching properties expand.
- **R** `test/matching.test.ts:244` — 'matching transforms are free of motion discontinuities'. Keeps actual motion-verifier proof; equal replay could reproduce a visually discontinuous path.
- **R** `test/matching.test.ts:250` — 'shapeKey: same shape at any position and size, nothing else'. Pins shape-key equality/inequality examples, including aspect/direction/closedness and point degeneracy. Respect documented quantization limits before generalizing arbitrary scale invariance.

## test/matching-motion.test.ts

Production owners: src/animation.ts TransformMatchingText/fadeInsideLines; src/verify.ts motion heuristics.

- **R** `test/matching-motion.test.ts:37` — 'the cases the verifier caught: a removed glyph past the end, a lagged morph that moves and grows'. Retains four minimized concrete continuity regressions for removed glyphs and moved/resized lagged morphs in both font families.
- **F** `test/matching-motion.test.ts:55` — 'property: a text morph (removals, insertions, resize, move, lag) has no motion discontinuities'. The generator intentionally limits lag to <=0.2 because higher lag can trigger the motion heuristic on genuinely fast motion; the name overstates the domain. Name the bounded motion profile explicitly and add a separate broad supported-lag endpoint/replay property that does not assert every fast trajectory is gentle.
- **R** `test/matching-motion.test.ts:59` — 'seeking into a lagged text morph renders the frame a full run renders'. Checks higher-lag replay at boundaries and intermediates using a minimized known fixture; retain because the bounded motion property does not cover this lifecycle path.
- **R** `test/matching-motion.test.ts:70` — 'a Code block morphs without jumps too'. Keeps Code as a distinct text-container variant, with multiline extents that raw Text cannot exercise.

## test/scene-hooks.property.test.ts

Production owners: src/scene.ts onStep/addDescriber/describe/endCurrentStep; trace serialization.

- **F** `test/scene-hooks.property.test.ts:43` — 'a captioned step lasts at least its reading time at 160 words a minute'. Pins the documented default 160-word reading floor across generated captions/fps/authored durations. Use skipped execution for this timing law, with the played-vs-skipped keeper retained at line 110.
- **R** `test/scene-hooks.property.test.ts:56` — 'the hold follows Scene.captionWpm: 12 words at 120 a minute hold 6 s, and Infinity holds nothing'. Pins configurable reading pace and Infinity disabling the hold with independent numeric expectations; short readable fixed rows are useful.
- **F** `test/scene-hooks.property.test.ts:69` — 'a caption hold adds at most one frame beyond the reading time'. Pins the independently bounded extra hold (at most one frame); repeated full NullSink playback is unnecessary when the skip-equivalence keeper proves that mode.
- **F** `test/scene-hooks.property.test.ts:83` — 'a hold is recorded exactly when the step waited for its caption, and lies inside the step'. Pins presence and interval of the hold marker against observed authored time; retain the distinct marker contract but avoid rendering each plan solely to read clocks.
- **F** `test/scene-hooks.property.test.ts:97` — 'a caption with no words needs no hold'. Pins whitespace-only captions to no extra hold, with exact duration comparison; keep hostile whitespace rows rather than dropping them from generators.
- **R** `test/scene-hooks.property.test.ts:110` — 'holds are the same whether the run is played or skipped'. Primary keeper for played(0) vs skipped(Infinity) timing equivalence. If the shared helper default changes, explicitly pass 0 on the played side so this cannot collapse to skipped-vs-skipped.
- **F** `test/scene-hooks.property.test.ts:120` — "a trace carries each step's boundaries and hold, to the millisecond, as the run recorded them". Pins trace rounding/fields against independently observed scene boundaries. The trace API is a distinct serialization risk; run its non-reference side cheaply.
- **F** `test/scene-hooks.property.test.ts:145` — 'steps tile the timeline: each ends where the next begins, and the last ends the scene'. Pins step adjacency and last-step closure. This pure timeline invariant does not require another complete rendered NullSink run.
- **R** `test/scene-hooks.property.test.ts:171` — 'each onStep registration runs once per step, in order, after the sink, until its own remover'. Uses a live-registration reference list to pin dispatch multiplicity/order, sink-before-listener and independent remover handles under generated operation sequences.
- **R** `test/scene-hooks.property.test.ts:210` — 'a listener removed during a step does not run for it, and one added during it waits for the next'. Pins removal/addition during dispatch against an independently calculated next-dispatch list; ordinary registration tests miss reentrant updates.
- **R** `test/scene-hooks.property.test.ts:248` — 'describe is the state merged, left to right, with each live describer, every key kept'. Pins ordered JSON merge and hostile own keys, with defineProperty reference construction rather than the production merge method.
- **R** `test/scene-hooks.property.test.ts:269` — 'describe returns a copy: changing it leaves the state alone'. Pins copy isolation for returned state values currently exercised at top-level. Add a nested-value mutation row if deep JSON snapshot isolation is intended; production describe already JSON-copies.
- **R** `test/scene-hooks.property.test.ts:283` — 'registering the same describer twice and removing one leaves the other'. Pins duplicate registration handle identity: removing one registration must not remove the other even when function references are equal.
- **R** `test/scene-hooks.property.test.ts:296` — 'a describer that does not return an object is refused with a clear error'. Pins reject direction for non-object describer outputs; retain explicit invalid-value families, not crash-only checks.

## test/timeline.test.ts

Production owners: src/timeline.ts; Scene stop lifecycle; src/trace.ts/text output.

- **R** `test/timeline.test.ts:9` — 'the golden trace of the fixture is unchanged (UPDATE_GOLDEN=1 rewrites it after a deliberate change)'. Keeps the checked-in full trace bytes as an independent serialization/timing/evidence compatibility fixture. UPDATE_GOLDEN is explicit maintenance, not an excuse to bless failures.
- **R** `test/timeline.test.ts:16` — 'text renderer shows the lit code line, the arrow and the dot'. Pins human-readable ASCII/text output to actual highlighted code, arrow, dot and title in the fixture; a distinct output boundary from SVG.
- **R** `test/timeline.test.ts:36` — 'a swallowed StopScene cannot emit frames: a seek still renders the played frame'. Pins StopScene swallowing defense with exactly one forwarded frame and played-frame equality; catches continuation after a seek stop.
- **R** `test/timeline.test.ts:49` — 'after a stop, play(), wait() and step() reject at once without reaching the sink'. Pins stopped-state rejection across play/wait/step siblings, unchanged clock/sink and no newly begun object. Keep accept/reject ownership here.

## test/view-readouts.test.ts

Production owners: src/view.ts plus ring-buffer/token-bucket scene readout factories.

- **R** `test/view-readouts.test.ts:30` — 'ring-buffer: the readout pairs head, tail and length with their traced values at every step'. Independent state-to-literal-readout mapping across both ring-buffer cases, including an anti-vacuity head!=tail control. This protects against renderer and model agreeing on the same wrong mapping.
- **R** `test/view-readouts.test.ts:48` — 'token-bucket: the readout pairs tokens, lastRefill, allowed and rejected with their traced values at every step'. Independent formatter/value-to-label mapping across all token rates and five steps, including empty rejection lists. Keep beside generic view fidelity, which uses the renderer itself as its expected-picture factory.

## test/view.test.ts

Production owners: src/view.ts; StateReadout; animation/scene composition; test/lib/view-fidelity.ts.

- **R** `test/view.test.ts:70` — 'a sync rebuilds from the state, morphs by glyph, and keeps the View, its parent and its anchor'. Pins final state text, identity/parent membership, glyph summaries, anchors and no-op duration. Literal final text makes the integration meaningful beyond internal plan comparisons.
- **F** `test/view.test.ts:99` — 'sync() inside a Succession builds from the state at its turn, not at construction'. Monkeypatches ViewSync.prototype.begin and inspects next to prove lazy construction. Replace this with observations from the documented public render/build callback; it can record the state used at each real invocation without a production seam or prototype mutation.
- **R** `test/view.test.ts:109` — 'no updaters: seeking skips the frames of plays with syncs, and renders the frame a full run renders'. Pins no-updater/skip optimization and exact frames at sync kinds and sequence boundaries. Keep replay proof; a cheap sink-work counter can supplement rather than replace pixels.
- **R** `test/view.test.ts:133` — 'syncs are free of motion discontinuities'. Keeps real motion proof for sync transitions, distinct from matching-key and replay equality.
- **R** `test/view.test.ts:139` — 'the fidelity helper: the picture at every step is what the traced state renders'. Pins the fidelity helper against both a deliberately wrong builder and forgotten sync, plus the direct viewMismatch API. Negative controls reach intended mismatches.
- **R** `test/view.test.ts:155` — 'match: index morphs by position (a DecimalNumber counts), shapes and keys pair parts'. Pins index numeric interpolation, shape matching, default non-text strategy and custom keys through the public View API. Separate properties per strategy would shrink diagnostics, but retain every advertised match variant.
- **R** `test/view.test.ts:194` — 'placement: a moved and scaled View stays moved and scaled; place: false leaves it to build()'. Pins right/false placement and scale preservation, independent literal endpoint text and rejection of a reused picture. Add left/center and parented/non-mobject rejection siblings rather than deleting this boundary proof.
- **R** `test/view.test.ts:217` — 'a StateReadout copy() names its own value Texts'. Pins copied StateReadout.values aliases and literal value text. The class getter contract differs from generic Group.copy.
- **R** `test/view.test.ts:227` — 'stateView: a StateReadout of the scene\'s state whose keys stay put as values grow'. Pins live state values, key alignment, state fidelity and motion through a real multi-step scene. Keep representative composition; expand cheap stateView formatting/configuration properties separately.
