# #2348 verification routing: first implementation slice

The existing architecture ownership map and test catalogue remain the source of file ownership and focused deterministic tests. This slice adds a single machine-readable change-class-to-proof contract at `config/development-verification-routing.json`.

`node scripts/verification-core.mjs plan --changed-file PATH --json` now includes `proofRoute`. A developer may add `--proof-class CLASS` for a behavior that the file path alone cannot identify. Multiple classes compose their requirements. A planned product proof always begins UNPROVEN; a successful build or an agent statement cannot satisfy it. Observed evidence needs a matching exact commit, action, observed result and an artifact reference independently supplied by a trusted observer. The actual product run remains a separate activity.

This is the verification-routing half of #2348. It does not change the seven GitHub Architecture Verification checks or execute a new expensive suite. OSS Rules enrichment follows in a separate reviewable implementation slice under the same parent issue. The current `config/verification/merge-authority.json` supersedes the older issue wording that calls PR Gate and Product Gate permanent required checks; both are manual diagnostics today.
