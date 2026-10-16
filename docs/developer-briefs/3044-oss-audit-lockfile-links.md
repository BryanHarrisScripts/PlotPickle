# #3044 — OSS audit linked metadata and attribution

Human direction: begin bounded ecosystem upgrades, tests and PRs under #3022.
This prerequisite repair belongs to #3023; it does not complete the ecosystem audit.

## Problem and assessment

The unchanged #1892/#1895 regressions fail on current main. npm records the
vendored braces dependency as a link; its version and MIT licence are recorded at
the target package entry. The audit incorrectly reads the link as metadata.
Pi Durable's registered acknowledgement and Color Expert's influence marker are
also missing from the surfaces audited by the existing contracts.

## Acceptance and implementation

- Resolve a linked dependency against its recorded target in the same lockfile
  for both direct checks and transitive licence counting. Missing metadata still
  fails; do not infer licence/version or open external files.
- Add Color Expert's marker to its existing provenance notice and scan only its
  bounded procedure directory in addition to the existing architecture root.
- Add Pi Durable's existing managed-adapter role and MIT acknowledgement.
- Preserve the existing tests and their expected outcomes. Demonstrate the
  original failures and the repaired passing audit, then run focused UAT,
  production build, BEN, convergence and independent review.

## Impact map and boundaries

Owner: existing OSS audit script and registry. Consumers: public readiness,
release validation and OSS regression tests. No product runtime, providers,
PPF/canon, authentication, persistence or user interface behavior changes.
No dependency installation/version changes or copied reference corpus.
README's separate product-truth edit in the primary checkout stays separate.

Rollback: revert this repair commit. Lockfile and vendored files are unchanged.
Evidence is repository/engineering scope, not authenticated Windows product proof.
