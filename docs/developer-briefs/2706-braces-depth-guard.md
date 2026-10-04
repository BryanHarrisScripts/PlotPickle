# Developer brief — Issue #2706 braces depth-guard mitigation

Issue: #2706

## Current security state

- Root Undici is already pinned to the compatible patched 7.29.1 line.
- Managed Pi now resolves brace-expansion 5.0.12.
- The Story Architect synthetic-provider CodeQL response boundary was repaired in merged PR #2720.
- The remaining root finding is braces CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm. The GitHub advisory still lists every published version through 3.0.3 as affected and lists no patched npm release.

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
