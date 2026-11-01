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

## Engineering design amendment — executable boundaries and bootstrap

Owner instruction (October 31 / November 1): build the developer brief and implementation. This is one permanent capability delivered through successive governed commits, not a one-PR exemption.

### Entry points and responsibility

- `config/development-verification-routing.json` selects proof obligations. The existing `lib/verification/development/proof-routing.mjs` assesses exact-SHA evidence after independent artifact-reference validation. A routing classification is never a PASS.
- `factory_run_named_test`, already exposed by the authenticated tunnel, gains exactly one fixed `factory-windows-product-gate` suite. Its only candidate inputs are the same pinned `expectedHead`, `candidatePrNumber`, `candidateHead`, and `sourceRequestId` (the previously completed `factory-pr-stage` request). No new MCP method, arbitrary path, command, port, origin or additional token.
- `scripts/engineering-team/mcp/engineering/factory-windows-product-gate.mjs` owns trusted admission/probe coordination. It must execute from the installed, reviewed MAIN code. It cannot load an arbitrary candidate module with the owner host credentials, write to MAIN or mutate Supervisor/task scheduling.
- A candidate-host behavior probe may execute only inside the staged isolated worktree and a restricted child process with a sanitized environment and explicit resource/STOP guards. Source under test cannot write its own authoritative acceptance receipt. Native diagnostic state must originate from the owner machine, not hard-coded fixtures.
- The existing private `mcp-control-requests/<requestId>.json` reservation and immutable `-result.json` must be used. A separate evidence artifact with an independently recomputed digest is required. The existing read-only `factory_control_receipt` returns only bounded metadata; no raw host path, credential or process command line.
- A distinct trusted evaluator reads the immutable receipt and independently reads/rehashes the evidence artifact, verifies the required proof IDs, candidate identity, verifier source revision, observed native controls and PR head. It may evaluate owner-host evidence without a dedicated F00 service, but must never claim an F00 signature or global unattended merge authority.

### Fixed acceptance for the first candidate (#3362)

The first supported fixture is the source-reviewed operations/diagnostics change in PR #3362. It must observe real owner task/dispatcher/worker state via the candidate's authenticated read-only path. It must also prove the guarded migration is denied while the independently checked supervisor is running, without ever invoking the migration side effect. A guest/forged request must be denied. Before and after the test the trusted runner must confirm exact host MAIN, healthy running supervisor, no PAUSE/STOP breach, and no unexpected process ownership/port change. If the native probe cannot safely observe the changed candidate, return UNPROVEN, not a fabricated PASS. This first test does not authorize activation of Worker 1 or unattended automatic merging.

### Acceptance matrix

1. Exact clean MAIN + open PR exact candidate SHA + valid staged receipt + correct changed-path classification: eligible for observation. Source changes during run: BLOCKED.
2. No approved truth edition, dirty main, stale SHA, wrong or reused ID, unknown privileged change class, symlink, missing artifact, ambiguous stage or protected verifier disagreement: BLOCKED or UNPROVEN.
3. Actual isolated Windows candidate observation and independent read-back of its evidence: PASS only for that narrowly classified proof; unrelated or stronger proof IDs remain UNPROVEN.
4. Native failure, unauthorized status visibility, accepted supervisor migration while running, PAUSE/STOP violation or foreign-owned process stop: FAIL and preserve forensic evidence.
5. A snapshot of supervisor RUNNING, simulated health, Linux CI, an injected fake native runner or a candidate-authored pass flag cannot produce Product Gate PASS.
6. Missing or explicitly skipped required CI: no release even if host proof passes.
7. Test-timeout/crash or lost response: the durable request remains uncertain and cannot replay with the same ID; reconcile through `factory_control_receipt`.

### Initial trust bootstrap

Because the new operation is not installed on MAIN, it cannot approve its own first merge. The initial trusted implementation must first pass current exact-head CI and existing authenticated owner-Windows staging/isolated regression tests, followed by a separate attributable human review of the exact changed code and protected test truth. An independently qualified already-trusted gate may then accept the bootstrap or a distinct reviewed installer update must be used. No test may silently self-promote to release authority. Only after this independently reviewed first deployment is the permanent gate available for its first candidate; test PR #3362 with the now-installed trusted implementation and record its actual receipt. Until then, PR #3363 remains DRAFT/UNMERGED and #3362 remains OPEN/UNMERGED.

### Definition of done

The approved permanent gate, not just its routing rules, is implemented, independently reviewed and tested on a real Windows host; a source-bound positive acceptance and each mandatory negative case have a durable exact-SHA receipt; the trusted evaluator independently recomputes evidence and handles stale/missing cases; GitHub release checks consume the trustworthy result and preserve seven-layer CI, STOP, W8/W9 and owner release rights; PR #3362 is verified and merged only if every actual relevant gate passes. No live Worker 1 proof, F00 certification or unattended authority is implied by this component.

### Executable implementation checkpoint — pre-release

Current draft PR #3363 implements two allowlisted suite values under the SAME authenticated `factory_run_named_test` tool, not two new services or public MCP capabilities:

- `factory-windows-product-gate`: exact clean-MAIN/PR/stage and protected truth admission, native supervisor pre/post observation, credential-stripped Node Permission Model candidate probe and private one-use candidate observation evidence. A test fixture or failed/unsupported sandbox remains UNPROVEN. The observation result explicitly states `PRODUCT_GATE_OBSERVED_NOT_RELEASED` and has no independent/F00 or merge authority.
- `factory-windows-product-gate-verify`: a separate fixed read-only request that loads the immutable first-phase receipt and evidence file from the trusted host, rejects symlinks/stale identities/mismatched digests and recomputes proof on the same PR/head. `PRODUCT_GATE_EVIDENCE_MATCHED` never authorizes a merge or changes `factory_status.productGateVerified` on its own.

The approved source/routing classification and native fixture regressions are currently under exact-edition W8/W9 review. Prior Linux Architecture Verification and native staged owner-Windows node tests are preliminary engineering evidence; a live owner host candidate execution and externally attributable release decision have not yet passed. The permanent gate cannot commission itself: bootstrap requires reviewed current implementation and source truth before deployment to the already existing authenticated Factory connection. Preserve PR #3362 as unmerged until it obtains a genuine accepted Product Gate result under the installed trusted runner.
