# Focused model mutation controls

Three deliberate model-source mutations were applied sequentially, never together. For each, the original source bytes were saved, the mutation was executed only with its intended test name, and `finally` restored the exact bytes before an unchanged-source control ran. All three mutants failed at the intended semantic assertion; all three unchanged controls passed. FC_SEED=1701, no broad tests, no commits. Sources are restored and frozen for root's derived fingerprint repin.

| Mutation | Intended failure / independent oracle | Mutant process seconds | Restored control seconds |
| --- | --- | --- | --- |
| endpointsOn returns every correct pod id with node incremented1 | New exact endpoint-record assertion, Cluster node0 for placement[1,0]: actual node1 vs expected0. The prior Cluster length-only direct assertion would miss this wrong record. Seed1701/path0:0:0:0. | .392 | .391 |
| inVersion drops obsolete/removal filtering | Retained independent W3C Recommendation count keeper: WCAG2.2 A actual32 vs published31. This external source keeper matters: exhaustive conservation properties alone can agree with jointly wrong membership. | .355 | .430 |
| Empty pop increments head before throwing | New queue property checks unchanged complete snapshot on Empty: capacity2, commands[pop], actual head1 vs expected0. Seed1701/path0:1:0:0:0:0:3:1:2. | .393 | .388 |

Focused commands (run once with mutant, then again after restoration):

```sh
FC_SEED=1701 node --test --test-name-pattern='for any placement, the shares sum to 1 and follow each policy’s rule' test/explain-traffic-policy.test.ts
FC_SEED=1701 node --test --test-name-pattern='the counts per level are the Recommendations’ own, level by level' test/explain-wcag-map.test.ts
FC_SEED=1701 node --test --test-name-pattern='ring wraps into freed slots and Full changes no state' test/explain-models.test.ts
```

Source mutations:

- `scenes/explainers/lib/traffic-policy.ts`: map the returned endpoints to `{...p,node:p.node+1}` without changing ids/cardinality.
- `scenes/explainers/lib/wcag-map.ts`: replace `rank(c.added)<=rank(v) && (!c.removed || rank(v)<rank(c.removed))` with only the added-version condition.
- `scenes/explainers/lib/models.ts`: replace Empty's immediate throw with head increment then the same throw. This tests state atomicity, not error spelling.

Full individual failure/control outputs: `models-mutant-{endpoint-record,wcag-obsolete,ring-empty-nonmutation}.tap` and corresponding `models-control-*.tap`. Structured results, exact source paths, names and exit codes: models-mutation-results.json. Every mutant exit1; every control exit0; restored_exactly=true for every source.

The malformed trust-parser defect already had a natural pre-fix red rather than a deliberate mutant; its independent focused unchanged-source control is recorded in models-implementation.md and models-cidr-red.tap. No additional source change is left by this mutation pass.
