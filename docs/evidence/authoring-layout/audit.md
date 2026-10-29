# Adversarial audit

Three reviewers independently examined the implemented changes: font measurements and snapshot replay; spatial layout and reader stories; deployment verification and release archival. They used isolated counterexamples and source review. The implementation agents repaired the findings, and the reviewers checked the repairs.

| Finding | Repair and regression proof |
| --- | --- |
| Natural `middle` baselines used the full text frame instead of x-height, shifting a 20px Inter label by 6.64px. | Measure the active cut's x glyph ink. Absolute baseline/anchor properties reject the old implementation; the isolated defect failed with seed `20261029`. |
| Changes to measurement helpers, core shaping or embedded fallback bytes could retain a profile identity. | Hash the actual measurement/shaping sources and always include embedded font bytes alongside requested/subset inputs. Isolated helper and embedded-byte changes alter the identity. |
| Natural snapshots accepted missing/null family and advance metadata. | Require both fields. Admission tests independently delete or null each field, retaining a valid control. |
| The source-warning whitelist discarded `FLOW_IMBALANCE`. | Exclude only reference-geometry diagnostics. A solid-color Sankey capture preserves the independent inflow/outflow warning. Gradients remain unsupported. |
| The suggested capture command could repeatedly reject a stale natural profile. | Capture and watched preview rebuild mismatched natural snapshots; check/build still refuse stale inputs. The test poisons both a persisted profile and label width. |
| Updating an empty-label card after a nonuniform transform lost its horizontal scale. | Recover both axes from panel geometry. The independent final-card oracle covers empty labels/values, unequal scales, shear, rotation and highlights. The original reproduction now agrees within `8e-9`. |
| Deployment verification accepted HTML/JavaScript with unusable MIME types or download disposition. | Check media type, UTF-8 charset and inline rendering. The real HTTP tests reject the old permissive behavior. |
| `s-maxage=003600` bypassed the loader's cache check. | Parse numeric directives, including quoted and leading-zero values, and reject contradictions. The old parser fails the HTTP regression. |

Integration review also found that the measurement fingerprint's source-file lookup assumed an unbundled JavaScript module. The CLI bundles build-only modules under `dist/tools`; the lookup now follows that layout. Installed-package smoke exercises both natural-font replay and the direction example through the compiled CLI with capture dependencies deliberately unavailable.

The full catalog refresh caught a warning-ID compatibility change in Agentic Mermaid 0.5.1: warnings now number edges per endpoint pair. The adapter maps those stable IDs directly and retains the old global-index mapping for the older producer. Multigraph properties and an actual verifier capture protect both conventions. Loader verification also checks caching at every redirect hop, so an immutable redirect cannot hide behind a revalidating final response.

The direction reviewer also opened both example steps at 390×844: both cards remain together in one view, with the caption directly below. The natural-font tests retain independent HarfBuzz advances from original font files and a Resvg comparison against the original face. Pure properties supplement these boundaries.

The renderer upgrade initially exceeded the largest page's existing gzip budget. A lossless transport dictionary now shares repeated shape paths while retaining every snapshot field. A fourth reviewer checked JSON metadata and key order, float32 bits, independent restored arrays, old gzip compatibility and package inclusion. The review found that the explicit browser compatibility test had no enabled CI owner; the main check now runs it with browser support. Whole-scene SVG comparisons and the served catalog review remain separate checks.

Issue #48 remains dependent on public deployment. No reviewer approved a deployment, changed release assets or moved a tag. The new verifier supplements the served-browser checks; its byte and response-header proof does not establish reader interaction or physical-device performance.
