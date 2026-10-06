# Developer brief — Issue #2706 three dependency alerts and security closeout

## October 6, 2026 Windows startup transport repair (#2789)

A real Normal PlotPickle cold start exposed a transport conflict in the temporary braces mitigation. The reviewed source was correct, but the root lock resolved it through `git+ssh://git@github.com/FSDevelop/braces.git`. npm 12.2.0 correctly rejects Git package fetching in the production local-runtime policy with `EALLOWGIT`, so the same dependency could never converge through the Windows persistent-runtime installer.

The security source does not change. PlotPickle retains the exact reviewed braces 3.0.3 depth-guard source from commit `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`, tree `0ffbc33a63a6f2365865e69b4217683268067847`. The package is now repository-owned under `vendor/braces-3.0.3-depth-guard`. `SECURITY-PROVENANCE.json` records the exact upstream commit, tree, Git blob SHA for every shipped package file, and a canonical SHA-256 manifest digest. The Windows runtime manager verifies those hashes before staging the package beside the copied manifests in the persistent runtime.

The root manifest uses a local file dependency and `$braces` override so every root braces consumer resolves the reviewed package without a Git transport. The lock contains no Git URL for braces. PlotPickle keeps the Git-package restriction enabled; #2789 does not weaken that boundary.

This remains the same temporary security bridge. When an official compatible patched braces release exists, replace the vendored bridge with that registry release and rerun the hostile-nesting and Windows cold-runtime proofs.

## October 6, 2026 bounded Rust lru repair

A fresh upstream review still finds FFrames 1.2.0 declaring `lru = "0.14.0"`; no compatible FFrames release has removed that constraint. Public RustSec records require lru >=0.16.3 for RUSTSEC-2026-0002 and >=0.18.2 for RUSTSEC-2026-0253, so a normal Cargo update cannot satisfy the existing 0.14.x consumers.

PlotPickle therefore vendors the exact upstream lru 0.14.0 release source from commit `5ec44f564f561abf4b93f7c41764ced496d4bbb6` and applies only the two already-merged upstream fixes:
- PR #224 / patch head `25669e76110133c73d72f1db0069934ba590162a` for the `IterMut` Stacked Borrows violation.
- PR #238 / patch head `2776ded569ee89a99c515bca8194f65639182c96` for `LruCache::pop` panic safety.

`tools/fframes-bridge/Cargo.toml` uses `[patch.crates-io]` so both FFrames 1.2.0 and usvgr 0.46.1 resolve the same repository-reviewed source. The lock no longer points lru at the vulnerable registry tarball. The vendored crate retains the upstream MIT license and records provenance in `SECURITY-BACKPORT.md`.

Acceptance for this repair:
- the repository security regression proves both consumers depend on the patched lru package and the lock contains no lru registry source/checksum;
- the vendored regression exercises mutable iteration and the panicking-key `pop` recovery path;
- Windows Product Gate runs the vendored Rust tests, then builds the FFrames bridge with `--locked`, then completes the real media render proof;
- exact-head Architecture Verification is green before merge.

This remains a compatibility bridge. Replace the vendored backport when both FFrames and usvgr accept an upstream lru release containing both fixes.

## October 6, 2026 braces recheck

The public GitHub advisory still lists braces <=3.0.3 as affected with **Patched versions: None**, and npm still publishes 3.0.3 as the upstream package release. Keep the exact reviewed depth-guard source bridge. The transport may be repository-owned and Git-free, but the reviewed patch itself must not be removed merely to make Dependabot disappear.



## Current requested outcome — October 5, 2026

The latest Human screenshot shows three open Dependabot alerts: braces #52 (high), fflate #26 (moderate), and Rust lru #53 (low). Close #2706 only when these are resolved or superseded with verified evidence; retain the already merged CodeQL #65 repair and confirm its alert state separately.

### This bounded repair: fflate #26

Root satori 0.33.5 pins fflate 0.7.3; @shuding/opentype.js also requests the 0.7 line. GHSA-px8p-9vwx-vf98 lists 0.7.5 as the patched release on that same line. Override transitive fflate to exact 0.7.5 and regenerate the lock without lifecycle scripts. Preserve all other package versions and platform metadata.

Acceptance:
- Every root fflate lock entry resolves to 0.7.5.
- Fresh installed fflate round-trips a valid ZIP and rejects a malformed ZIP64 directory missing its required extra field, within a bounded child-process timeout.
- The new behavior regression fails on the vulnerable baseline instead of freezing the test runner.
- Existing six security regressions, focused UAT, production/Windows build and exact-head architecture/scanning checks pass.
- Merge only the tested head. Do not equate a merge with private alert closure.

### Remaining blockers to full closeout

Braces #52: the exact reviewed nesting-depth guard is installed and tested. The public advisory still lists no official patched release. Keep the repository-owned reviewed source bridge until an official release or a reviewed replacement resolves the finding; do not dismiss it solely to clear the count.

Rust lru #53: tools/fframes-bridge/Cargo.lock resolves lru 0.14.0 through both fframes 1.2.0 and usvgr 0.46.1. FFrames upstream still declares lru 0.14.0. The iterator fix starts at 0.16.3; the additional public panic-safety advisory RUSTSEC-2026-0253 requires >=0.18.2. Adding a direct newer lru does not remove the old transitive version. A full repair requires compatible updates of both consumers, or a provenance-reviewed backport/replacement, generated Cargo lock, --locked compilation, and the existing Windows media render proof. No Rust repair is claimed by this fflate PR.

CodeQL #65: source fix merged in #2720 and covered by the security regression; current private alert-record closure is unconfirmed. Successful CodeQL analyses do not establish that individual record's state.

Primary references:
- https://github.com/advisories/GHSA-px8p-9vwx-vf98
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://rustsec.org/advisories/RUSTSEC-2026-0002.html
- https://rustsec.org/advisories/RUSTSEC-2026-0253.html
- https://github.com/dmtrKovalenko/fframes/blob/main/fframes/Cargo.toml

---

# Developer brief — Issue #2706 braces depth-guard mitigation

Issue: #2706

## Current security state

- Root Undici is already pinned to the compatible patched 7.29.1 line.
- Managed Pi now resolves brace-expansion 5.0.12.
- The Story Architect synthetic-provider CodeQL response boundary was repaired in merged PR #2720.
- The remaining root finding is braces CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm. The GitHub advisory still lists every published version through 3.0.3 as affected and lists no patched npm release.

## October 5, 2026 public upstream recheck

The public GitHub Advisory Database still reports GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 as affecting braces <= 3.0.3 with **Patched versions: None**. npm still lists 3.0.3 as the latest published braces release. The exact reviewed depth-guard commit therefore remains the smallest compatible repository-side mitigation; there is no official registry release to migrate to yet.

This PR does not claim that GitHub's private Code Scanning or Dependabot alert records are closed. Those repository Security UI states still require direct confirmation. The repository proof now covers every root braces install path, both managed Pi locks, the Undici 7 floor, the live hostile-nesting behavior, and the Story Architect fixed JSON error boundary.

## Bounded mitigation

Until upstream publishes a fixed npm release, replace transitive braces with the reviewed upstream patch candidate from micromatch/braces PR #72 at exact commit:

28d440b5dd449dbf1fe6f3506cf94ecca4d02660

The repository-owned package is sourced from that exact commit rather than a moving branch. Its provenance record pins the upstream commit and tree, every reviewed upstream runtime-file Git blob SHA, the byte-identical upstream package metadata, a canonical source-manifest digest, and the SHA-256 of PlotPickle's production-only local package metadata. The root lock resolves the reviewed package through a local file dependency, so production installation does not require Git or SSH. This preserves the existing package/API surface while adding bounded nesting depth to parsing and recursive AST walkers.

This is a temporary security bridge, not a permanent fork. When upstream publishes an official patched release, remove the vendored bridge and return to the registry release after the same regression proof passes.

## Proof

- repository provenance must preserve the exact patched commit, tree, shipped file hashes, and manifest digest; the production lock must remain free of Git package transport.
- ordinary brace expansion must continue to work.
- a deeply nested brace string must be rejected with the new max-depth guard instead of exhausting the JavaScript stack.
- the Pi managed lock remains on brace-expansion 5.0.12.
- the Story Architect proof remains on the fixed non-sensitive JSON 500 boundary.
- exact-head CI and the applicable Windows/product checks must pass before merge.

## Closeout

#2706 was closed after the repository-side security work completed. GitHub Security UI alert state remains a separate external record; do not treat repository closure alone as proof that a private alert was automatically resolved or superseded.
