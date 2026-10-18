# #3026 — Review FFrames Rust maintenance debt without false remediation

Existing owner: FFrames Rust media bridge and canonical OSS verification. The checked stable runtime is fframes1.2.0. All five already locked unmaintained rows have upstream replacement projects, but no compatibility-backed version-only update. Keep Cargo.lock untouched, do not change route, asset or private user state.

Deliver source-hashed advisory/graph evidence, exact reachable dependency paths, local lru security patch guard, deterministic changed-lock / unresolved-edge negative cases, W8/W9-bound test admission, existing seven-layer/BEN/CodeQL and impact-selected Windows gating, green exact PR head before merge. Close this bounded delivery only: broader #3026, #3022 and #3053 continue.

No Cargo/rustc in this GitHub-connector execution environment; no manual lock rewrite or synthetic native build claimed. Future replacement must be produced by real Cargo, then compile/run on Windows, measure real 24fps full-clip pixels and licensing before promotion. See dated source-bound review.

## Follow-up: native-proof selection repair

The initial #3086 verification-only audit passed the general Windows installer but did not trigger the native Media / FFrames Windows proof, leaving physical Rust codec execution unchanged and unobserved on that exact head. Update the existing impact selector so Cargo/bridge changes and dated FFrames maintenance source, baseline and test changes require the existing Windows Rust 1.99.0 locked build, reviewed local lru backport tests, verified LGPL FFmpeg binary, and frame-by-frame native output proof. Keep the selector narrow: ordinary docs, OSS Radar or unrelated verification tests must not trigger the expensive media lane. The new deterministic W8/W9-bound selector test confirms both inclusion and exclusion.

This lane validates only the currently locked FFrames 1.2.0 with the reviewed lru security backport. It does not regenerate Cargo.lock, migrate deprecated transitive crates, certify external provider routes, or authorize FFmpeg redistribution. Keep #3026 open for those distinct obligations and for eventual actual maintained-crate migration.

## Follow-up: verified LGPL FFmpeg fixture repair

The newly elected Windows native media lane exposed an existing dead upstream proof artifact: the October 3 BtbN FFmpeg URL returned `Not Found`, before Cargo or frame decoding ran. Replaced the fixture URL with a published immutable BtbN release asset for `autobuild-2026-10-17-20-51`, filename `ffmpeg-n9.0.2-28-g669f5ab083-win64-lgpl-shared-9.0.zip`, asset ID `651569151`, SHA-256 `00ab3bc8fe02554bd0fffac9968bba498d1ab7e899a4871b85fbba828a50bfcc`, size 77,232,689 bytes. Source: https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/tags/autobuild-2026-10-17-20-51 (GitHub release asset metadata, checked 2026-10-18 UTC). The CI lane continues to fail closed if actual downloaded bytes disagree. Same LGPL/shared variant, same exact encoder proof; no redistribution or model installation. This is *fixture repair*, not an upgrade to user-installed FFmpeg.
