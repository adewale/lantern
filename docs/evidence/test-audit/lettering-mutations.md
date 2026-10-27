# Lettering mutation controls

Both focused controls passed against the real implementation and failed at their strengthened assertion after a deliberate production mutation. No broad suite or frozen keeper ran. Both production files were restored byte for byte in a Python finally block; SHA-256 proofs and timings are in lettering-mutation-results.json. The temporary test copy was removed.

Checksum diagnostic: control passed (2.174s). Changed only the checksum error text at tools/lib/lettering.ts:77 to the stale-snapshot diagnostic. The focused checksum test failed (1.889s) because its anchored checksum regexp rejected the stale diagnostic, despite “checksum” appearing in the temporary folder name. The stack identifies line77, so this reached the intended checksum guard. To preserve freshness while mutating a builder input, a temporary copy of the test updated only the copied snapshot's builderHash from the actual production input files; glyph data and source fingerprints stayed unchanged. No checksum was recomputed, because the test deliberately corrupts the payload. Control and mutant used the same helper adjustment. Logs: /tmp/lettering-checksum-control.log and /tmp/lettering-checksum-mutant.log.

Lease ownership: control passed (0.285s). Removed only the activeTasks drain loop in src/lettering-outlines.ts. The focused lease test failed (0.285s) at “the first lease waits for its overlapping task”: actual true versus expected false. The failure occurred after both tasks were released and awaited, so cleanup completed. Logs: /tmp/lettering-lease-control.log and /tmp/lettering-lease-mutant.log.

Restored production SHA-256 values:

- tools/lib/lettering.ts: 4a88817e3c9bb7c9a68d2b43a7a02ffc6ab2e52da217fa003939602fea632438
- src/lettering-outlines.ts: 09482b50a66b8024ccf330a9a70ede184b9478f5d7c7b108a3d348631e19f07a
