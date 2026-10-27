# Independent sink-cleanup regression review

Read-only inspection of src/scene.ts emitFrame/toSink, src/perf.ts public tracer semantics and the added test/perf.test.ts:112 regression. No new edits, runs or mutations.

The producer change closes the existing sink span in finally around the awaited toSink call. This preserves the original successful-call close and exception/StopScene propagation while adding cleanup on rejection. toSink itself still marks StopScene as permanently stopped and rethrows its original identity. Cleanup has no new production export or test-only hook.

The regression uses public Scene construction, public emitFrame, public StopScene, public perf.enable/span/rows/chromeTrace and an injected sink. Its only fake is performance.now, an external clock; advancing it inside the authored sink/callback independently defines 7ms sink and 3ms subsequent-call durations. Assertions pin original rejection identity, the completed sink row, subsequent independent self-time, microsecond wire conversion and inclusion of the next top-level trace event under depth 1. The final event assertion detects lingering nesting through public output rather than reading the private stack; the sink row independently fails when rejection bypasses close. Reset/disable in finally isolates singleton state and node:test scopes the external clock mock.

There is no hidden private-state or test-only premise. Both ordinary sink error and StopScene are exercised, with no assumption that arbitrary async spans can nest safely across concurrent awaits. This is a meaningful public regression for the narrow producer fix. The parent's reported failing-before/green evidence was not rerun here; this independent review validates its contract and oracle design, not a new execution result.
