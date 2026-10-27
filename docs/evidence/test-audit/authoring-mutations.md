# Authoring deliberate mutation checks

Root authorized serialized mutations only in authoring-owned sources. Each mutation was applied alone, a focused selected contract ran with FC_SEED=1701, and original source bytes were restored in finally before the next check. No broad suite, commit, other-lane source mutation or retained production edit. Structured results and before/after hashes: authoring-mutation-initial-results.json and authoring-mutation-repaired-results.json.

| Mutation | Focused keeper | Result and meaningful failure |
|---|---|---|
| tools/lib/explain-share.ts: disable dimension mismatch branch | checkCards missing/mis-sized test | Killed,701.14ms. Exact array assertion got [] instead of two specific page/image dimension messages. Proves repair catches original every([]) vacuity. |
| explain/panels.ts: reject options.width===undefined with documented no-room error | set shows each new value | Killed,1698.55ms; property failed sample1, shrank to undefined width/default placement and one __proto__ row. Direct positive construction rejected; defaults remain exercised. |
| explain/panels.ts: reject a valid explicit Box whenever resulting card width<2 | after set each row shows exactly one value | Killed,1694.53ms; failed sample3, shrank to Box[0,0,1.1600100000000002,0], default fontSize/width. Positive stateful narrow-box surface remains exercised. |
| explain/panels.ts: replace LCS line matching with matchLines([],[]) | morph maximality/source contract | Killed,1844.70ms; sample6 shrank before['a'], after['a','']; retained line count0 disagreed with independent maximum1. |
| explain/panels.ts: convert tabs to spaces in next morph lines | morph maximality/source contract | Initially survived,2090.71ms. Random grapheme/binary text rarely generated a tab; constant alphabet had none. Added explicit '\\tb' and 'a\\tb' line constants, retaining all old branches. Rerun killed,1585.42ms; sample1 shrank to before[''], after['a\\tb','a']; source-text deep equality detected a space replacing tab. |

The survivor caused a generator-domain expansion, not a weaker oracle or tolerance. New direct source-array morph oracle preserves tabs independently of Code construction; actual glyph tab stops remain covered in code-tabs tests owned by the behavior lane.

## Restoration proof

Both mutation passes restored source files byte-for-byte:

- tools/lib/explain-share.ts SHA256 before=after `de0066986d59533928ab125fd5bdd37b203b72531c034f6c5d938f59354201b5`.
- explain/panels.ts SHA256 before=after `c4e132b5e8bf2df12e52871f0170b7634103fe81935b41830c837a4a95bc0eb5`.

`git diff -- tools/lib/explain-share.ts explain/panels.ts` is empty after restoration. Final clean focused runs: selected morph/set/after-set properties3/3 passed,2642.97ms (/tmp/authoring-mutations-restored-panels.log); share dimension contract1/1 passed,461.56ms (/tmp/authoring-mutations-restored-share.log).

## Final Card domain inspection

Helper leaves undefined width/placement, named region strings and points unchanged. Explicit Box is copied before optional widening; only defined insufficient width is lifted. Per-sample minimum derives from padding+2.5*fontSize+EPS, retaining formerly accepted widths1.2..<2 at small sizes. EPS boundary margin is explicitly documented in authoring-actions.md rather than claimed as exact preservation. Broad arbitrary construction/refusal domain remains unchanged. Default-width and narrow-box mutation failures above demonstrate those branches are present in stateful positive properties; prior blanket2/default3.2 generator loss is repaired.
