# PlotPickle FFrames version and migration backlog — 2026-10-18

Production remains on FFrames 1.2.0 with the reviewed local security backport for lru 0.14.0. FFrames 1.2.1-rc.45 is a release candidate under isolated Cargo evaluation, not an upgrade already applied.

| Component | Current tracked version | Candidate version or replacement | Owner / blocker | Stage |
| --- | --- | --- | --- | --- |
| FFrames | 1.2.0 | 1.2.1-rc.45 | Pre-release; requires real Cargo graph and native media proof | #3088 |
| memmap | 0.7.0 | memmap2 0.9.11 | FFrames direct dependency | #3089 |
| paste | 1.0.15 | pastey 0.2.3 | image / exr / pulp transitive consumer | #3089 |
| rustybuzz | 0.12.1 | harfrust 0.14.0 | usvgr text shaping | #3089 |
| ttf-parser | 0.20.0 / 0.25.1 | skrifa 0.48.0 | fontdb and FFrames direct usage | #3089 |
| lru | 0.14.0 with reviewed local fixes | 0.18.5 | FFrames and usvgr constraints; retain backport | #3089 |
| Rust toolchain | 1.99.0 | Retain for reproducible Windows proof | Native toolchain already checked | #3090 |
| LGPL FFmpeg CI fixture | n9.0.2-28-g669f5ab083 | Retain SHA-256 locked | 36-frame MPEG-4 native proof passed | #3090 |

Sequence: #3088 isolated Cargo metadata probe, never changes production Cargo.lock; #3089 consumer-owned API/feature/MSRV/license compatibility; #3090 genuine generated lockfile, Windows Rust compile, 36/72-frame and 25-shot proof, rights and rollback. Parent #3026 and broader modernization #3053 remain open.

Evidence: GitHub native baseline PR #3087 (merged), FFrames docs.rs release list https://docs.rs/crate/fframes/latest . All replacement versions are proposals, not installed versions. A resolved Cargo dependency graph does not certify upgraded native video execution. Do not auto-install or bill providers.
