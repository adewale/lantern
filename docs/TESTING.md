# Testing Rayner

Run `npm run check` and `npm test` on Node 24 or later. `npm run test:full` increases generated-case counts. `npm run test:embeds` enables the real Chromium reader tests; set `CHROMIUM_EXECUTABLE_PATH` when Chromium is installed outside Playwright's cache. Lettering capture tests additionally need the pinned fonts and Python requirements described in [LETTERING.md](LETTERING.md). A skipped optional check supplies no pass evidence.

The suite uses fast-check for generated inputs and shrinking. `test/lib/pbt.ts` owns the seed and run-count policy. Generated tests complement the checked-in upstream vectors, Manim/raster references, browser integration and installed-package checks. These boundaries catch different failures; agreement between two calls to the same implementation is a weak substitute for an independent expected value.

The [2026-10 test audit](evidence/test-audit/README.md) accounts for all 679 original test declarations in 68 files. It records retained contracts, strengthened assertions, named consolidation keepers and remaining gaps. It applies OpenClaw's [test-audit workflow](https://github.com/openclaw/openclaw/tree/main/.agents/skills/test-audit) and Hegel's [property-testing and review guidance](https://github.com/hegeldev/hegel-skill) with Rayner's existing fast-check runner.

When changing tests, compare their proof before comparing their count. Check both acceptance and rejection, exact endpoint values and state transitions. Validate an important repaired assertion by deliberately breaking its producer, then restore the source. Keep optional integration results separate from pure property results. [test/AGENTS.md](../test/AGENTS.md) records the ownership rules from this audit.
