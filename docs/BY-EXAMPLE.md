# Learn Rayner by explaining a problem

These three lessons start with a reader question. Each code excerpt comes verbatim from a linked, runnable scene or model. Open the adjacent result links to inspect the actual page; the excerpts are **not** complete scenes to paste into a file. Change the setting in the reader to test the other case. For a complete first scene, use the [tutorial](TUTORIAL.md#0-hello-world); for API lookup use the [feature tour](FEATURE-TOUR.md).

## Why does a cache hit skip the database?

The edit inserts a KV lookup before D1. What changes when KV has the row? In the [full scene](../scenes/explainers/mr-cache/scene.ts), `PATH[which]` chooses edges that exist in the captured diagram. The walk marks the chosen route before a final comparison keeps both routes visible.

Author code (excerpt from the scene):

<!-- excerpt: scenes/explainers/mr-cache/scene.ts -->
```ts
    const path = PATH[which];
    await flow.clearNotes();
    await flow.dim([...new Set(path.flat())]);
    await flow.walk(path, { trail: true });
```

Result: [hit, 0 D1 reads](https://oshineye.dev/projects/rayner/mr-cache?request=hit&step=request) · [miss, 1 D1 read](https://oshineye.dev/projects/rayner/mr-cache?request=miss&step=request). The handler and KV lookup are unchanged; only the presence of a row in KV changes. A miss still reads D1 and writes the row to KV for 300 seconds. This is a model of the cited merge request, not a latency benchmark or a guarantee about an external cache. [Code and source trail](../scenes/explainers/mr-cache/scene.ts).

## Why can `²` pass `isdigit()` but fail `int()`?

Python's numeric predicates do not all ask the same question as `int()`. Keep the input character `²` fixed; change only the guard in `if s.<guard>(): n = int(s)`. The [full scene](../scenes/explainers/isdigit/scene.ts) shows its Unicode fields, CPython flags, guard and parse result. Its [source-backed model](../scenes/explainers/lib/isdigit.ts) combines the predicate's answer with the parser's:

<!-- excerpt: scenes/explainers/lib/isdigit.ts -->
```ts
  const passes = predicates(c)[guard],
    int = intOf(c);
  return { passes, int, outcome: !passes ? 'refused' : 'value' in int ? 'parsed' : 'raised' };
```

Result: [`isdigit()` lets `²` through, then `int()` raises ValueError](https://oshineye.dev/projects/rayner/isdigit?char=super&guard=isdigit&step=outcome) · [`isdecimal()` rejects it before `int()` runs](https://oshineye.dev/projects/rayner/isdigit?char=super&guard=isdecimal&step=outcome). Superscript two has a Unicode digit value but no decimal value; `int()` requires the decimal field for a single non-ASCII digit. The model uses cited Unicode 17.0.0 rows and CPython 3.15.1 behavior checked against CPython in `test/explain-isdigit.test.ts`. For a whole string, `int()` also accepts signs, spaces and underscores, so call `int()` and catch `ValueError` rather than treating `isdecimal()` as a general parser.

## Why is a stolen authorization code insufficient?

The client sends an S256 challenge during authorization but holds onto the original verifier. In the [full scene](../scenes/explainers/oauth-pkce/scene.ts), the attacker intercepts a redirect and submits a guess. The server's comparison is the decisive operation:

<!-- excerpt: scenes/explainers/oauth-pkce/scene.ts -->
```ts
      const bad = pkceChallenge(GUESS);
      this.state.attackerChallenge = bad;
      this.state.attackerAccepted = bad === challenge;
```

Result: [attacker's guess fails](https://oshineye.dev/projects/rayner/oauth-pkce?attacker=yes&step=attack), then [the real client's verifier passes](https://oshineye.dev/projects/rayner/oauth-pkce?attacker=yes&step=exchange). Compare [an exchange with no attacker](https://oshineye.dev/projects/rayner/oauth-pkce?attacker=no&step=exchange): the legitimate exchange is the same, but no interception or failed guess occurs. This is the public-client interception scenario from [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636), not a claim that PKCE protects a stolen verifier or replaces the server's other code and client checks.

Once you can explain what changes between the two results, [write your first scene](TUTORIAL.md#1-create-the-scene). The [feature tour](FEATURE-TOUR.md) is a lookup for authoring APIs, not a substitute for these lessons.
