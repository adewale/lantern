# Reader mutation controls

Isolated focused negative controls ran sequentially against `app/embed-zoom.ts` and, for reading order only, `app/embed-closeup.ts`. Each script captured the complete original file bytes before changing it, restored those bytes after each probe and in `finally`, and wrote stdout/stderr logs. No broad suite or commit. Final `app/embed-closeup.ts` has no diff; `app/embed-zoom.ts` retains only the previously reviewed obsolete-path deletion.

| Control | Focused owner and observed assertion | Exit | Seconds |
| --- | --- | --- | --- |
| Replace minimum SVG fit scale with width scale | independent readerViewBox screen projection; x projection error | 1 | .366 |
| Shift readerViewBox author x origin by one unit | independent readerViewBox screen projection; x projection error | 1 | .392 |
| Remove StageZoom painter call | recording Painter; each applied state painted once | 1 | .368 |
| Remove StageZoom changed callback | independent callback count; each painted state notifies once | 1 | .323 |
| Remove ReaderView cancelAnimationFrame | controlled RAF; Fit cancels pending glide | 1 | .282 |
| Remove horizontal pan scaling on resize | noncentral anisotropic resize; normalized centre moved | 1 | .321 |
| Reverse final reading parts | independent reading order; rows top to bottom, then left to right | 1 | .596 |

Machine-readable results: `reader-mutation-results.json`. Per-control logs: `reader-mutation-<control>.log`. Each failure is an assertion failure in the intended focused test, not a syntax/import/infrastructure failure.

## A surviving control repaired a real test gap

The initial changed-callback removal **survived** (exit 0, .303s). The recording test skipped whenever its callback had never populated `seen`, so omission of every callback escaped. Preserve this evidence in `reader-mutation-controller-callback-before-repair.log` and `reader-mutation-initial-results.json`.

Repaired only the test: record paint and callback counts independently. On each gesture that produces either signal, both counts must increment exactly once; recorded state/class/glide assertions still apply. This also proves callbacks for unchanged applied states, rather than inferring them from later state changes. Reran all four initial controls; each now fails at its intended assertion. No production behavior changed for this repair.

After all seven controls restored production, reran the two focused Node files: **29/29 pass, 766.414ms**, recorded in `reader-post-mutation-run.log`. `git diff --check` passed. No error budget or generator domain changed.
