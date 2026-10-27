# Test ownership

Use `lib/pbt.ts` for seeded fast-check runs. Keep the input domain as wide as the documented contract; bound expensive materialization rather than silently dropping input classes. A cheaper oracle must still check values, exact endpoints and ordering. Keep independent source vectors, Manim fixtures, raster comparisons, real browser transport/layout checks and package smoke tests at their existing boundaries.

When consolidating tests, name the keeper and move each assertion before removing its former owner. Prove repaired assertions reject a deliberate defect, restore production bytes, and record the result. Test names must describe the assertions actually made. Count expected outputs before using `every`, and distinguish a documented refusal from an unrelated exception.

Use controlled external clocks for timing bookkeeping. Browser latency and paint need real browser evidence. Do not add production exports or reset hooks just for tests.

`lettering.test.ts` owns one build per catalog entry for immutable HTML, byte count, header recipe, canonical receipt and full receipt. Refresh these pins only for an explained product change, in a separate commit from lettering implementation changes. Capture actual outline fixtures with the real pipeline; do not repair their metadata by hand to hide stale inputs. Optional browser/font/video tests must report skips explicitly.

Record benchmark or oracle speed comparisons with identical inputs, seeds and environment. Keep elapsed-time claims separate from semantic proof. The audit and retained boundaries are documented in `../docs/TESTING.md`.
