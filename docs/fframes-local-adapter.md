# FFrames local adapter notes (#2663)

PlotPickle owns the media-engine contract. FFrames is an optional local implementation pinned to Rust crate version 1.2.0 through tools/fframes-bridge/Cargo.toml.

The adapter does not install Rust, Cargo, FFrames, FFmpeg, codecs, or any cloud service. Capability detection reports unavailable when the local toolchain is absent, and normal PlotPickle startup and the existing Previs renderer remain unchanged.

Execution is isolated in a temporary workspace. Only authoritative locked Storyboard image files are copied into that workspace. Requests are capped at 25 positions. The child process has a bounded timeout and AbortSignal cancellation, runs without a shell, captures bounded/redacted diagnostics, hashes source assets for evidence, and removes the temporary workspace in a finally block.

The bridge is render-only. It receives staged copies and a generated request manifest; it has no PPF/canon path or write contract.

Dependency review: FFrames 1.2.0 is the pinned prototype dependency. FFrames' own rendering stack may require a Rust/Cargo toolchain and FFmpeg/codec support depending on the render path and target machine. Those remain optional local prerequisites and are not silently installed or redistributed by PlotPickle in this phase. Before packaging or redistribution, re-check the exact FFrames/FFmpeg/codec licenses and binary redistribution obligations for the chosen build.

Phase 1 intentionally does not replace Previs or integrate Timeline, Rough Cut, or Screening.

The 1.2.0 bridge selects the FFmpeg mpeg4 software encoder explicitly, retains 24 fps and 1280×720, and commits Cargo.lock. Windows proof uses a checksum-verified LGPL shared FFmpeg build in the CI fixture only. Every decoded frame in a three-color sequence is checked, including the final frame and duration. This does not establish GPU acceleration or authorize redistribution.
