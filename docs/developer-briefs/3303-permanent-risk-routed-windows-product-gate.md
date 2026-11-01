# #3303 — Permanent risk-routed owner-Windows Product Gate

Owner decision: October 31 / November 1, 2026.
Status: Approved engineering specification; NOT an operational Product Gate or release waiver.
Owners: #3303 (native acceptance), #2348 (canonical proof routing), #3142 (Worker 1), #3302 (separate engineering and verification receipts).
First demonstration: existing PR #3362 at exact candidate commit 65dbc433b963c0eb680efecf12606f69046fde11.

## Problem and operating intent

Owner rejects a one-PR exception. A repeated requirement must be a permanent capability, not a human repeating PowerShell or bypassing checks. Reuse the current authenticated Factory MCP tunnel, existing Windows supervisor, isolated candidate staging, proof routing, GitHub CI and accepted evidence. Do not introduce another Windows service, external tunnel, verifier authority or generic remote-shell endpoint.

The minimal governed flow is:

  PR exact head -> canonical change classification -> required proof IDs -> existing authenticated fixed Factory operation -> isolated Windows observation -> durable source-bound evidence receipt -> independent read-back / human exact-edition review -> PR Gate + Product Gate -> owner-authorized exact-head merge.

Risk classification identifies required evidence but does not certify that evidence occurred. The code author, a synthetic test, or a candidate-controlled program cannot certify its own independent acceptance.

## Canonical classification — Solution 1

Extend the existing `config/development-verification-routing.json` (#2348), do not fork or shadow its rules. A mixed change receives the union of all applicable proofs. Unknown privileged Factory changes fail closed or receive the higher-confidence owner-Windows proof; documentation-only remains light. Existing UI, device, provider, media and installer proofs are preserved.

- Documentation-only: existing ordinary documentation review; owner Windows Product Gate NOT_REQUIRED.
- Ordinary deterministic backend: relevant focused regression, production build and exact-head CI according to existing classes; add real product proof only when the behavior crosses a runtime boundary.
- Authenticated Factory MCP, operator status and source migration: native-owner-Windows Factory acceptance, including actual authenticated status and safe denial of a migration on a RUNNING supervisor.
- Queue dispatch, grant creation, worker source mutation, credential/authorization, STOP/PAUSE, automatic merging or high-privilege service operations: native owner Windows operational proof and a distinct release-authorization/verifier decision; a local fixture is not sufficient.
- UI, device, media, provider, installer changes: their existing respective real-product proof obligations continue to apply.

A proof-class override may add but may not remove inferred obligations. A SKIPPED CI lane is not a PASS for an independently required owner-host proof.

## Trusted runner — Solution 2

Keep the existing `factory_run_named_test` MCP tool and add a fixed, allowlisted suite named `factory-windows-product-gate`. This is NOT `factory_engineering_run`; the latter runs candidate-authored scripts and always reports independentVerification=false. The fixed suite implementation and expectation table MUST be sourced from a trusted, reviewed, unmodified base revision / verified installed runtime, not from the PR under review. No remote arbitrary executable/path/arguments from the caller, PR, issue or user-generated model response. Existing authenticated capability, one-use request ID and immutable receipt infrastructure must be reused.

Input binding: expected clean MAIN head, exact PR number, exact candidate SHA, previously confirmed isolated stage receipt ID, approved proof IDs selected by canonical routing, approved verifier source revision, and stop/pause/supervisor checks. Reject stale/mismatched PR, changed source/receipt, unapproved truth, occupied foreign port, unverified lock/identity, insufficient disk, stage uncertainty or replay. Never run candidate code on MAIN, operate another owned app session, migrate a running supervisor, reenable STOP, start workers or attempt a merge.

An approved owner-host acceptance script selects a bounded, predetermined behavior for the relevant change class and observes the real Windows boundary. For the first operations case it uses authenticated status, correct version/worker/dispatcher/task fields, rejection of unauthenticated requests, rejection of migration while RUNNING, and unchanged owned supervisor heartbeat/STOP and unrelated process state. A synthetic status fixture or candidate test PASS must not be promoted to product proof.

The durable receipt records: schema version, requestId, candidate PR number and SHA, trusted MAIN SHA, verifier source SHA/digest, Windows environment identity (sanitized), proof/class identifiers, action and observed result, acceptance result (PASS/FAIL/BLOCKED/UNPROVEN), output/artifact digest and URI/ID, STOP/PAUSE/process identity observations, executedAt, replayAuthorized=false, ownerMachineObserved=true only for actual owner host, and independentVerification claim only when separately justified. No credentials, story data, hidden prompts, private paths, unbounded logs or credentials in GitHub.

## Independent evaluation, CI and merge

Reconcile the receipt through the installed read-only `factory_control_receipt` and a trustworthy artifact-reference verifier, rather than trusting a raw claim or a PR comment. Re-read current PR head and required GitHub CI on exactly that same SHA. `assessProductProof` from the existing routing module is the reusable evaluator: only validated trusted artifact refs for the exact tested revision count. Human owner review is attributable source/intent approval for the supervised first Worker 1 phase; do not represent it as F00-signed cryptographic independence. Fully unattended autonomous merges require separately credentialed independent release authority per #3302/#3302 high-assurance stage.

The release gate outputs exactly PASS, FAIL, BLOCKED or UNPROVEN with reasons. No missing receipt, skipped required check, review comment alone, simulated test, timeout, contradictory result, second agent message, stale PR or source mismatch is green. Preserve existing exact-head W8/W9 test truth admission, seven architecture layers, native Windows CI and branch protection. Neither this specification nor owner approval of architecture authorizes merging #3362.

## First acceptance and dependency order

1. Ratify this contract in a reviewable draft PR and add deterministic route rules to the existing configuration.
2. Implement the fixed trusted acceptance suite and sanitized immutable receipt on the SAME existing tunnel; expose receipt read-back and status without new public tools or a new service.
3. Run positive/negative tests: identity and forged input; expired/mismatched/stale SHA; STOP/PAUSE/foreign process; evidence replay and fake provenance; correct PASS/FAIL/BLOCKED; no unowned shutdown. Admit changed tests through the protected catalogue W8/W9 process, do not author-approve.
4. Test a genuine candidate of PR #3362 on actual owner Windows, without touching MAIN, and independently verify its artifact refs, owner decision and exact-head CI.
5. Merge the exact eligible PR only when canonical PR and Product Gates both PASS. Safely synchronize Windows source and supervisor using existing guarded mechanisms. Never replay old reserved issues.
6. Prove ONE genuine authorized Worker 1 issue -> model source edit -> commit -> tests -> Windows acceptance -> PR -> approved exact-head merge/receipt. Then immediately build Elara Agent Workspace #3355 before any worker fleet expansion.

Development gate design and new classification alone are not product acceptance; until the trusted runtime operation and independent read-back work, report Product Gate UNPROVEN.
