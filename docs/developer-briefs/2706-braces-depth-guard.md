# Developer brief — Issue #2706 three dependency alerts and security closeout

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

Braces #52: the exact reviewed nesting-depth guard is installed and tested. The public advisory still lists no official patched release. Keep the existing override until an official release or a reviewed replacement resolves the finding; do not dismiss it solely to clear the count.

Rust lru #53: tools/fframes-bridge/Cargo.lock resolves lru 0.14.0 through both fframes 1.2.0 and usvgr 0.46.1. FFrames upstream still declares lru 0.14.0. The iterator fix starts at 0.16.3; the additional public panic-safety advisory RUSTSEC-2026-0253 requires >=0.18.2. Adding a direct newer lru does not remove the old transitive version. A full repair requires compatible updates of both consumers, or a provenance-reviewed backport/replacement, generated Cargo lock, --locked compilation, and the existing Windows media render proof. No Rust repair is claimed by this fflate PR.

CodeQL #65: source fix merged in #2720 and covered by the security regression; current private alert-record closure is unconfirmed. Successful CodeQL analyses do not establish that individual record's state.

Primary references:
- https://github.com/advisories/GHSA-px8p-9vwx-vf98
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://rustsec.org/advisories/RUSTSEC-2026-0002.html
- https://rustsec.org/advisories/RUSTSEC-2026-0253.html
- https://github.com/dmtrKovalenko/fframes/blob/master/fframes/Cargo.toml

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

The override is exact-commit pinned rather than a moving branch. The package lock records the exact git commit and integrity. This preserves the existing package/API surface while adding bounded nesting depth to parsing and recursive AST walkers.

This is a temporary security bridge, not a permanent fork. When upstream publishes an official patched release, remove the git override and return to the registry release after the same regression proof passes.

## Proof

- npm lock regeneration must preserve the exact patched commit.
- ordinary brace expansion must continue to work.
- a deeply nested brace string must be rejected with the new max-depth guard instead of exhausting the JavaScript stack.
- the Pi managed lock remains on brace-expansion 5.0.12.
- the Story Architect proof remains on the fixed non-sensitive JSON 500 boundary.
- exact-head CI and the applicable Windows/product checks must pass before merge.

## Closeout

Keep #2706 open until GitHub's security UI confirms the relevant alerts are resolved or superseded. Do not dismiss alerts solely because the local mitigation is present.
