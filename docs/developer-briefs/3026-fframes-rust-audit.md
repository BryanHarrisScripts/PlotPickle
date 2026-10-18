# #3026 — Review FFrames Rust maintenance debt without false remediation

Existing owner: FFrames Rust media bridge and canonical OSS verification. The checked stable runtime is fframes1.2.0. All five already locked unmaintained rows have upstream replacement projects, but no compatibility-backed version-only update. Keep Cargo.lock untouched, do not change route, asset or private user state.

Deliver source-hashed advisory/graph evidence, exact reachable dependency paths, local lru security patch guard, deterministic changed-lock / unresolved-edge negative cases, W8/W9-bound test admission, existing seven-layer/BEN/CodeQL and impact-selected Windows gating, green exact PR head before merge. Close this bounded delivery only: broader #3026, #3022 and #3053 continue.

No Cargo/rustc in this GitHub-connector execution environment; no manual lock rewrite or synthetic native build claimed. Future replacement must be produced by real Cargo, then compile/run on Windows, measure real 24fps full-clip pixels and licensing before promotion. See dated source-bound review.

## Follow-up: native-proof selection repair

The initial #3086 verification-only audit passed the general Windows installer but did not trigger the native Media / FFrames Windows proof, leaving physical Rust codec execution unchanged and unobserved on that exact head. Update the existing impact selector so Cargo/bridge changes and dated FFrames maintenance source, baseline and test changes require the existing Windows Rust 1.99.0 locked build, reviewed local lru backport tests, verified LGPL FFmpeg binary, and frame-by-frame native output proof. Keep the selector narrow: ordinary docs, OSS Radar or unrelated verification tests must not trigger the expensive media lane. The new deterministic W8/W9-bound selector test confirms both inclusion and exclusion.

This lane validates only the currently locked FFrames 1.2.0 with the reviewed lru security backport. It does not regenerate Cargo.lock, migrate deprecated transitive crates, certify external provider routes, or authorize FFmpeg redistribution. Keep #3026 open for those distinct obligations and for eventual actual maintained-crate migration.

## Follow-up: verified LGPL FFmpeg fixture repair

The newly elected Windows native media lane exposed an existing dead upstream proof artifact: the October 3 BtbN FFmpeg URL returned `Not Found`, before Cargo or frame decoding ran. Replaced the fixture URL with a published immutable BtbN release asset for `autobuild-2026-10-17-20-51`, filename `ffmpeg-n9.0.2-28-g669f5ab083-win64-lgpl-shared-9.0.zip`, asset ID `651569151`, SHA-256 `00ab3bc8fe02554bd0fffac9968bba498d1ab7e899a4871b85fbba828a50bfcc`, size 77,232,689 bytes. Source: https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/tags/autobuild-2026-10-17-20-51 (GitHub release asset metadata, checked 2026-10-18 UTC). The CI lane continues to fail closed if actual downloaded bytes disagree. Same LGPL/shared variant, same exact encoder proof; no redistribution or model installation. This is *fixture repair*, not an upgrade to user-installed FFmpeg.

## #3088 upgrade candidate metadata, without production promotion

This phase runs the exact FFrames 1.2.1-rc.45 prerelease under Rust 1.99.0 using Cargo metadata in a temporary Windows sandbox. Cargo may update only a copied lock. Outcome is classified as a resolvable graph with legacy nodes, a resolvable graph requiring native testing, or a blocked candidate resolution. All outcomes retain FFrames 1.2.0 in the authoritative Cargo.toml/Cargo.lock. A green observation is not a migrated runtime, not licence clearance, and not an assertion that all advisories were remediated. The existing Native Media/FFrames Windows job continues to prove the production version. Follow-ups: #3089 upstream integration; #3090 full native media, rollback and rights; parent #3026.

## #3089 bounded phase B compatibility build

Native Windows Rust 1.99.0 compiles the exact FFrames 1.2.1-rc.45 candidate after Cargo resolves a *temporary copy* of the reviewed bridge. Its compile result is recorded separately from the 277-package resolution and the existing stable FFrames native codec test. The same checksum-verified LGPL shared FFmpeg fixture is temporarily provisioned for linking; no media generation, user PPF, provider calls or end-user installation occurs on the candidate. Failure is reported as a build blocker without treating the PR as a production dependency migration. Even a successful compile remains COMPILED_NOT_RENDER_VERIFIED until physical synthetic decode, licensing and rollback pass under #3090. A failed compile never clears memmap, paste, rustybuzz or ttf-parser maintenance concerns. See #3089 and #3090.

## #3090 preliminary candidate native video acceptance — follow-up to #3092

Run exact FFrames 1.2.1-rc.45 candidate compiled from a disposable Rust 1.99.0 Cargo graph, with the unchanged checksum-verified LGPL/shared FFmpeg fixture. The candidate binary directly receives a temporary three-colour, 500ms-per-position media request, generates a real MP4, and is independently inspected through FFprobe and FFmpeg. Every decoded frame, final frame, frame rate, codec, duration and dimensions must agree with the canonical 36-frame/24fps/1280x720 synthetic proof. Unexpected output rejects the exact-head PR rather than merely reporting a failed result in a green run.

The production FFrames 1.2.0 native proof runs independently in the existing Windows lane. Both environments are isolated and do not operate on a Human PPF, saved Storyboard, external provider, or application settings. The candidate executable and media data are discarded on cleanup, and its output is represented by a CI proof report (including a SHA-256 digest) rather than a production artifact.

Passing this proof is an experimental RC render/readback compatibility milestone. It does not address the four remaining unmaintained Rust dependencies, the licences and software distribution obligations, 25-shot Mini-Block scale, candidate downgrade/rollback, or production migration. Keep issues #3089 and #3090 open and Cargo.toml/Cargo.lock stable.
