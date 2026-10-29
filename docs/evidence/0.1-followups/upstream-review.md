# Lantern PRs and public forks, 29 October 2026

The closed-PR list contains three PRs, all merged. GitHub’s public fork API returns Rayner and five other forks. Each other fork has only `main`, at Lantern’s original `2c7bad533be25fbd56d26a9a2b6c5651743f011e`, with zero commits ahead of current Lantern main. Their newer metadata dates do not establish implementation work.

| PR | Relevant lesson | Rayner decision |
| --- | --- | --- |
| [#3: public viewer scene](https://github.com/ivarvong/lantern/pull/3), merged as `34359e70b7f41d952440bb3e56333272247f3fe8` | Design phone compositions deliberately. Check readable evidence, connector attachments, clipping and the actual final picture. Ground the explanation in the real program’s recorded output. | The earlier engine backport already carries the applicable constructor/admission/layout repairs. This follow-up replaces the cache/rate comparison fragments with simultaneous, large results and pins their one-view opening. It preserves Rayner’s camera and deliberate animation semantics instead of adopting Lantern’s blanket portrait/crossfade policies. |
| [#4: JSON Worker API](https://github.com/ivarvong/lantern/pull/4), merged as `06a90f3850bd4e1e5cd6a55cc648986067f609af` | Validate runtime values before rendering and check the emitted XML independently. Record the actual bytes of a vendored dependency even when its upstream source revision is unknown. | XML/runtime-value/own-property repairs and independent boundary tests were already backported. The existing `vendor/glyph.js` is byte-identical to Lantern’s recorded pin, so the pin and CI assertion are adopted. The Worker/JSON service stays out of scope for portable HTML authoring. |
| [#5: cf CLI migration](https://github.com/ivarvong/lantern/pull/5) | Pin CI actions and test a deployment procedure without requiring live credentials. Tool migration can raise the minimum runtime for reasons unrelated to the library. | Pin the existing Actions versions and disable persisted checkout credentials. Keep Node 24.0.0 authoring support; Rayner has no Worker or wrangler dependency to migrate. Do not add `actions:write` solely because the upstream PR requests it. |

The visible fork graph:

| Fork | Public branches | Default-branch difference from current Lantern main |
| --- | --- | --- |
| `moses-y/lantern` | `main` | 0 ahead, 3 behind |
| `dual1208/lantern` | `main` | 0 ahead, 3 behind |
| `wunitb/lantern` | `main` | 0 ahead, 3 behind |
| `benmikeal/lantern` | `main` | 0 ahead, 3 behind |
| `mumer92/lantern` | `main` | 0 ahead, 3 behind |
| `adewale/rayner` before this follow-up | many development branches; `main` | 352 ahead, 3 behind |

Rayner’s “3 behind” count describes Git ancestry. It does not mean that all three PRs are missing: #3/#4 were adapted and tested as backports rather than merged wholesale, while #5’s deployment stack is deliberately absent. Read patches and preserved contracts before treating a graph’s behind count as work to import. Rayner is the only visible fork with implementation divergence; these public branches supply no independent fixes or evidence of adoption by another author.

Reproduce the inventory with `gh api --paginate 'repos/ivarvong/lantern/pulls?state=closed&per_page=100'`, `gh api --paginate 'repos/ivarvong/lantern/forks?per_page=100'`, each fork’s `/branches` endpoint, and `/repos/ivarvong/lantern/compare/main...OWNER:main`. Public API results cannot establish private branch or deleted-branch activity.
