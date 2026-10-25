# #3302 — independent engineering and verification receipts

Date: 2026-10-25. Parent: #3142; roadmap: #3274.

## Decision and scope

One owner-authorized engineering request produces two independently governed, durable replies. The first is the engineering execution receipt, sourced from existing private owner grants, a real local source commit, and the separately authorized published draft PR. The second is an independent verifier receipt, never another model-authored assertion. The verifier reads GitHub PR/commit/CI evidence and requires a separately signed owner-Windows witness. Neither receipt authorizes merge.

Canonical implementation: `scripts/engineering-team/gateway/verification/two-receipt-verifier.mjs`. The prior overlapping hosted-CI-only observer was removed from the PR diff to avoid two competing verifier authorities. Reuse the existing `privateGatewayRoot` and fixed GitHub API boundaries; do not add another runtime or dispatcher.

## Correlation and durable storage

The engineering receipt binds one 32-hex request/grant ID, issue, exact clean source head, one source path and focused test, local commit/tree, independent publication grant, remote commit and draft PR number. It is derived from private owner-issued grant and result files, not GitHub issue text, and written once to `engineering-receipts/<requestId>.json`.

The verifier uses a distinct 32-hex attempt ID, records the engineering receipt ID and exact candidate head, reserves the attempt before any remote observation, and writes `verification-receipts/<attemptId>.result.json` exactly once. Missing/uncertain results remain blocked or waiting; retrying the same attempt is forbidden. A later read-only observation may use a NEW verifier attempt ID without replaying coding or publication.

## Independent acceptance requirements

Read-only GitHub checks must verify the exact PR branch/head/base, remote commit parent/tree, latest matching Architecture Verification run, all seven required architecture jobs, and the applicable hosted native-Windows coding-worker step. Cancelled, timed-out, skipped required, failed, missing, stale, or incomplete jobs never become green. A hosted-Windows CI job is not proof that the owner's Windows task or product worked.

A separate owner-Windows verifier must issue an Ed25519-signed witness bound to request ID, issue, source SHA, candidate SHA, PR number, proof digest, timestamp and explicit PASS. The public key is loaded from an owner-controlled local path; no signing key is supplied to the coding worker or model. Missing, invalid, stale, tampered or mismatched signatures block the independent verifier result.

Even a fully corroborated two-receipt result has `automaticMergeAuthorized:false`. The actual merge still requires all current required checks, relevant product acceptance, exact-head convergence and existing owner authorization. The verifier never executes shell, code, a provider, Pi, Task Scheduler, or GitHub mutation.

## Test scope and current limitations

`tests/issue-3302-two-receipt-verifier.test.mjs` uses disposable private directories, real Node Ed25519 signing, and a deterministic fixed GitHub read-only HTTPS fixture. It checks positive/negative receipt correlation, tampering, duplicate reservations, exact PR/CI identity, skipped/cancelled/timed-out jobs and missing Windows witness. Its W8/W9 truth binding is in `config/verification/test-catalog.json`. These fixtures do not prove a real owner-host signer, live GitHub credentials, live model work, or unattended factory execution.

As of this brief, the paired owner MAIN is `d94c535d8d54db4abd9d1c27db06cce0d20142c8`, Factory OFFLINE and the independent Windows supervisor task is installed but has not yet run. Three draft PR heads passed metadata-only authenticated owner-Windows `factory-pr-head` checks; the staged execution control remains blocked and is not product acceptance. The owner-Windows signer, protected key lifecycle, restart/reconnect reconciliation, tunnel watchdog and automatic dispatcher are still to be implemented and independently tested.

## Next acceptance slices

1. Finish exact-head GitHub CI and native Windows regression for this PR, fix any truth or implementation failures.
2. Implement a separately owned Windows verifier signer with protected private key and independently measured product/STOP evidence; demonstrate signed witness production, key rotation and negative authorization.
3. Reconcile existing stage capacity/ownership and authenticated stage control without deleting uncertain worktrees or replaying blocked queue reservations.
4. Exercise one live, scoped owner-granted source edit → focused tests → draft PR → GitHub checks → signed Windows verifier receipt. Only then evaluate green-only merge and supervised unattended scheduling.
5. Build the owner-authorized Windows tunnel watchdog with bounded recovery and durable health receipts. Establish a supported plugin reconnection strategy; never assume the ChatGPT plugin can be refreshed by an unsupported background browser action.

Do not mark #3142 or #3302 complete until a real, independently verified end-to-end cycle exists.
