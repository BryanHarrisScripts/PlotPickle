# Reconcile the original ecosystem audit and agent stack

Human direction: focus on #3022, #3023 and #3024 after the Node fixture waves. Produce a durable, reviewable checkpoint tied to current main rather than continuing unrelated historical fixtures or claiming the eight audits are complete.

Scope: reuse config/third-party-oss.json, the root/nested locks and existing agent/runtime registries. Record all 30 registered systems, 24 direct dependency versions, current upstream package tags for the direct packages and agent tools/extensions, selected public release channels, existing managed version observations, static profile/role/worker/sidecar relationships and fresh security-query results. Preserve UNKNOWN/UNPROVEN and original issue status. The original Human matrix attachment is not in the checkout; do not reconstruct its 28 rows from guesses.

Impact map: documentation/research owns the report and machine-readable receipt. Their inputs are existing registry, manifest and source files, public npm/GitHub metadata and read-only version/manifest probes. No product, runtime pins, lockfiles, tests, approved truth descriptors, providers, credentials, user state, signer identity or process lifecycle changes. The receipt is an immutable dated observation, not a second configuration authority. Paths and LF hashes point to its named source commit.

Acceptance:

1. The markdown and JSON agree on partial status and source commit; #3022 and #3023–#3030 remain open.
2. Security reports distinguish npm lockfile advisory queries, GitHub CodeQL/Dependabot and the existing braces backport. No blanket vulnerability-free claim or alert dismissal.
3. Every canonical system and direct dependency has a row; licence metadata is distinguished from complete legal/use review, lockfile records from installed binaries, and checked upstream tags from unqueried channels.
4. The agent census lists all assembled named profiles, role-only Mastra specialists, supervisor/workers, developer workers, registered Skills and sidecars without calling registration healthy execution. Dynamic peers and signed transport stay unproven.
5. Version gaps and a bounded Pi/extension-first upgrade queue are concrete. Cline CLI/extension/desktop and BUZZ relay/desktop remain separate channels; retired Pi MCP remains retired.
6. Source hashes, JSON parsing, counts and existing OSS audit/truth admission pass; independent Architecture, Standards and Spec contexts inspect the exact report head; exact-head CI passes before merge.

No new or revised test is needed for this reporting-only change. Existing tests retain their prior scope. No product UAT/build or Windows run is represented as newly performed by this report. Subsequent implementation waves require their own behavior-specific regressions, gates and Windows proof.
