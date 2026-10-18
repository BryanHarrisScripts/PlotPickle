# #3026 — content-bound Timeline 72-frame MP4 cache

## Problem and source evidence

The existing `build/timeline-72-frame-clip.mjs` maps local provider videos to derived files using the asset name, byte count and modification timestamp. Identical values can occur for different video bytes after restore, replacement or a recovered portable asset. A formerly verified 72-frame cached output can then be returned for different source content. This is an actual cache authority defect, not evidence of a failed provider or unavailable codec.

## Bounded implementation and truth

Keep the existing saved local provider path, container header, symlink rejection and 150 MiB bound. Stream the validated provider video through SHA-256 before deriving the stable 24-character cache key; include the saved filename and `72-24` contract edition. Do not buffer the entire video in memory. Cached clips are still probed to prove 72 frames at 24 fps for approximately three seconds, and no unverified result is returned. The original provider asset remains unchanged; distinct source bytes create separate derived versions.

New deterministic counterexample: same provider URL, identical source byte count and fixed mtime, but changed content. Assert fresh output identity and rendering; identical subsequent bytes must reuse the verified clip. Retain existing native FFmpeg test when tooling is present. Bind the revised test to the already approved W8/W9 test-oracle edition, not a newly invented product truth.

## Ownership and limits

This is the Timeline media assembly owner under existing #3026; no second media engine, renderer, identity database, provider routing, UI or automatic installation. SHA-256 identifies source bytes at check time; live mutation while encoding, FFmpeg licensing, Windows operator playback and cloud provider correctness remain separate proofs. No real screenplay/PPF, signers, credentials, paid model calls or model weights are touched. Rollback is a code revert; already saved derivative clips remain nonauthoritative until re-probed.
