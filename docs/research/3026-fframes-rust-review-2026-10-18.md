# FFrames Rust maintenance and compatibility review — 18 October 2026 UTC

Parent #3026, #3022, software upgrades #3053. This is a tracked-source review and deterministic regression, not a dependency upgrade, installed-system scan or native video acceptance.

## Evidence and decision

Source baseline: main c9f95e7524583b1a40ccd1fb2d54775386956d8e; `tools/fframes-bridge/Cargo.lock` (a97466741c48d23152ab940fa3a12eb567e363571cc9d7ea63e70a36029d9737 LF SHA-256), `Cargo.toml` (e8f61e09196271d7e059980a2692ea9bb729749cad029d2b9137e0b18c47b134). The lock records 281 packages. The bridge uses stable FFrames 1.2.0 with optional `cli` and a reviewed local `lru` 0.14.0 patch. Cargo.lock remains tool-generated and unchanged in this audit.

Four RustSec INFO/Unmaintained advisories affect five reachable lock rows:

| Package | Advisory | Actual shortest locked path from bridge | Proposed alternative (not installed) |
| --- | --- | --- | --- |
| memmap 0.7.0 | RUSTSEC-2020-0077 | bridge → fframes 1.2.0 → memmap | memmap2 |
| paste 1.0.15 | RUSTSEC-2024-0436 | bridge → fframes → image 0.25.10 → exr 1.74.2 → pulp 0.22.3 → paste | pastey |
| rustybuzz 0.12.1 | RUSTSEC-2026-0206 | bridge → fframes → usvgr 0.46.1 → rustybuzz | harfrust |
| ttf-parser 0.20.0 | RUSTSEC-2026-0192 | bridge → fframes → usvgr → fontdb 0.16.2 → ttf-parser | skrifa |
| ttf-parser 0.25.1 | RUSTSEC-2026-0192 | bridge → fframes → ttf-parser | skrifa |

Authoritative notices: https://rustsec.org/advisories/RUSTSEC-2020-0077.html ; https://rustsec.org/advisories/RUSTSEC-2024-0436.html ; https://rustsec.org/advisories/RUSTSEC-2026-0206.html ; https://rustsec.org/advisories/RUSTSEC-2026-0192.html . They classify the projects as unmaintained and list no patched versions. These are maintenance obligations, not a claim of a demonstrated exploit in PlotPickle.

The latest checked *stable* FFrames is 1.2.0 (https://docs.rs/fframes/1.2.0/fframes/). The 1.2.1-rc.40 prerelease was listed on October 16, but the upstream 1.2.1 release-candidate series still declares memmap 0.7 and ttf-parser 0.25.1; the prerelease is not a verified migration. Release source: https://docs.rs/crate/fframes/1.2.1-rc.7 . Do not promote it to production without a real Cargo-generated lockfile and native build/encode/decode proof.

## Delivered verification

A versioned source-digest baseline and deterministic Cargo lock graph reader identify every reachable advisory row from the bridge; the proof records actual dependency paths and rejects stale source hashes, unknown/ambiguous Cargo dependency IDs and disappearance or reassignment without review. Existing lru patch provenance and the bridge's deterministic software encoder remain intact. Green unit/CI findings do not change the explicit `REVIEW_REQUIRED` supply-chain status.

The checked container has Node but no Cargo/rustc or network access to regenerate dependencies; no lockfile was fabricated. Existing CI media tests and historical Windows frame proof still establish their separately named versions only, not compatibility with unbuilt alternatives.

## Migration and rollback

A future version upgrade requires upstream FFrames/usvgr/fontdb/image codec compatibility review, actual Cargo lock regeneration, exact dependency/license hashes, Windows Node26 native Rust bridge compilation, physical 24fps/1280x720 MP4 encode/probe/decode of every frame including last frame, and rollback proof. Migrate memmap to memmap2, paste to pastey, rustybuzz to harfrust and font parsing to skrifa only when owning upstream consumers support them. Preserve the local reviewed lru security backport until upstream releases include both fixes. Do not introduce new model binaries, cloud jobs, signer usage, external PPF writes or automatic installers.

#3026 stays OPEN for real media-stack/provider/runtime acceptance. This audit can be reverted without PPF or media migration.
