# Issue 3089: native upstream lru validation

Human request: build FFrames with upstream lru 0.18.5, verify the video and compare
with the tested patched candidate baseline. Production remains FFrames 1.2.0.
Issue 3090 remains the final production migration gate.

The existing media verification owner is `scripts/media/`. Reuse the rc.45
candidate frame verifier and disposable Cargo workspace, the reviewed patch-removal
transform, and the existing Windows Product Gate lane. No app, project, PPF,
provider, production manifest, production lock, or vendor patch changes belong here.

Acceptance:

1. Resolve only registry lru 0.18.5, capture Cargo source/license/features, compile
   the actual bridge source with Rust 1.99.0 using the generated experimental lock.
2. Render and independently decode the existing synthetic 1280x720 MPEG-4 fixture:
   24 fps, 36 frames, 1.5 seconds, all-frame RGB order and final frame correct.
3. Compare measured properties with the patched rc.45 baseline rendered earlier
   in the same Windows job. Report both SHA-256 values and byte equality without
   demanding container byte identity for equivalent measured media.
4. Retain both MP4 files, the experimental Cargo lock and JSON observations as CI
   artifacts. Preserve production source and reviewed patch for rollback.
5. Fail the native job on resolution, compile, render, decode or comparison error.
   Graph-only operation continues to state native proof is unproven.

Verification: source admission against origin/main, focused Rust-maintenance
regressions (including mismatched/missing baseline refusal), focused UAT contracts,
production build, convergence, independent review and exact-head GitHub gates.

Evidence limits: the three-color fixture does not exercise cache eviction,
typography, longer sequences, real story playback, GPU execution or distribution
rights. Cargo license metadata is provenance rather than legal clearance. The
other four dependency families remain separately unresolved. No migration or
production acceptance can be inferred from this experiment.
