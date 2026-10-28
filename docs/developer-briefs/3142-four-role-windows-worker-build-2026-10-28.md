# #3142 — four-role Windows Software Factory worker build
Date: October 28, 2026. **SOURCE CANDIDATE / NOT INSTALLED / NOT RELEASED.**

## One installer, one trust architecture

Reuse existing independent Windows Supervisor and authenticated Factory tunnel. This slice adds *no new tunnel* or Pi agent and does not replace the one-installer/Service Manager architecture (#3268). Four roles share one externally bounded work-order contract, but **do not share reviewer authority**:

| Worker role | Existing / new implementation | Owner Windows deployment | Current permission |
| --- | --- | --- | --- |
| F00 Independent Reviewer | Existing distinct `PlotPickleLaneAService.cs` and read-only F00 verification candidate on draft #3322 | Separate signed Windows SCM service `PlotPickleLaneA`, distinct restricted token, external registrar and protected key | **NOT QUALIFIED; no ADMIT/sign** |
| Coding Dispatcher | `worker-pool/worker-host.mjs`, owner work order schema, and new disabled Task Scheduler definition | `PlotPickleCodingDispatcher` under owner identity | **NOT RELEASED; durable queue scan/grant broker remains unimplemented** |
| Coding Worker 1 | `worker-pool.mjs` atomic one-use claim, existing `authorized-coding-once.mjs` and separately granted draft publisher | `PlotPickleCodingWorker1`, disabled until signed W8/W9 and owner Product Gate | **NOT RELEASED; source candidate only** |
| Coding Worker 2 | Same code, separate logical worker slot | `PlotPickleCodingWorker2`, registered **disabled** | **PARKED** until two genuine consecutive cycles, race/STOP/crash/resource proof |

The implementation exposes a pure four-role *status* projection which **never** labels F00 qualified or a coding worker online based on text or a heartbeat. The candidate single-job path has a canonical owner ticket with exact clean MAIN SHA, fixed issue number, one coding grant ID and a DIFFERENT publication-grant ID. It claims a write-once private `factory-worker-claims/<requestId>.json` with `open(wx)`, fsyncs and never steals/replays it. The caller must separately observe current supervisor STOP/PAUSE and **independently grounded release authority** before and after the claim and the one-shot operation. The owner host deliberately hard-denies that release callback until a signed, external F00 verifier is actually implemented and admitted. Candidate code alone does NOT mint grants or run models.

The reviewer uses a separate **Windows service**, never the coding identity's task registration. This script does not generate, copy or use F00 signing material; a signed independent trust bootstrap remains an explicit prerequisite and is not provided by another ChatGPT message. The existing Lane A service is currently inert.

## Candidate Windows management command (READ-ONLY after an approved merge)

From a reviewed clean MAIN checkout **only after the release PR is independently admitted/merged**:

```powershell
cd C:\Users\bryan\PlotPickle
powershell.exe -NoProfile -File ".\scripts\engineering-team\windows\workers\Install-PlotPickleFactoryWorkers.ps1" -Plan
powershell.exe -NoProfile -File ".\scripts\engineering-team\windows\workers\Install-PlotPickleFactoryWorkers.ps1" -Status
```

The eventual `-Install -Consent ENABLE_PLOTPICKLE_FACTORY_WORKER_POOL` may **register only disabled** owner-account Task Scheduler entries after exact clean MAIN and legacy Pi checks. It never installs F00, starts workers, overrides STOP, grants model tokens, or enables merge. `-Start` deliberately reports `SIGNED_F00_W8W9_AND_OWNER_WINDOWS_RELEASE_REQUIRED` and starts **zero** tasks. `-Stop` defers to the already-owned independent Supervisor STOP control and does not assert child termination. Do **not** run the new installer from the open draft branch or use `-ExecutionPolicy Bypass` as a substitute for independently trusted release provenance.

The dispatcher task argument `--serve coding-dispatcher` is **explicitly fail-closed** in this candidate. An actual supervised queue polling/lease loop and owner-grant broker are NOT yet admitted; this source change does not falsely label a process as coding throughput.

## Candidate focused test evidence

Author-side isolated Node test run (container Linux, Node 22): `node --test tests/issue-3142-factory-worker-pool.test.mjs` — **5/5 passed** including STOP/no-op, owner ticket schema widening, simultaneous claims, permanent no-replay after ambiguity and role confinement. Local Node parsing passed for the two new `.mjs` files. This is **not** source-bound GitHub CI, not owner-Windows Task Scheduler acceptance and **not independently signed W8/W9 test admission**. The proposed new test is itself governed: no protected catalogue edits by the author; a separate reviewer must examine all changed assertions and imported production source.

## Mandatory activation path, no shortcut

1. **#3302 / draft #3322:** obtain genuinely separate F00 registrar/reviewer signing identity, signed root policy, protected one-use nonce ledger, independent W8/W9 semantic review and a signed, source-specific admission.
2. Separately authorized maintainer reconciles the protected test catalogue with current MAIN (#3311 conflict, including stale test hashes) and obtains exact-head seven-layer architecture CI and Windows Product Gate.
3. Merge authorized exact-head releases only when all gates are green; stage via single vendor-reviewed installer and exact-owner ACL. The new `-Install` only registers disabled coding tasks and does **not** activate the reviewer.
4. Implement and independently approve the real queue-to-owner-grant broker, long-lived dispatcher/service supervision, cancellation/descendant verification, protected F00 release callback and owner-machine Task Scheduler/SCM acceptance. First launch exactly ONE coding worker.
5. Prove **two separate real** issue → source edit → tests → independently verified receipt → reviewable PR → green merge → automatic next issue, with correct STOP/no-replay/cost accounting.
6. Only then review actual contention, crash recovery and resource budgets and independently enable the *second* coding worker. No automatic merge or Worker 2 until those proofs.

**Observed source baseline:** current owner clean MAIN `233efe098cd0751a81ae16f3b58f86a96d237be2`, independent Supervisor RUNNING/fresh; legacy Pi queue five blocked/reserved/no replay. Coding dispatcher currently OFFLINE / `CHATGPT_ONLY_DISPATCHER_NOT_IMPLEMENTED`, automaticMergeEnabled=false. Four-role source and installer are **not** deployed to Windows.


## October 28: exact-owner job/result correlation repair (candidate only)

The first worker-pool implementation treated a `DRAFT_PR_CREATED` outcome with a valid remote commit/PR number/engineering receipt as sufficient without checking that the result referred to the **same** claimed issue and exact owner grants. This was a source-level false-success risk. The new candidate additionally requires the returned `grantId`, `publicationId`, `issueNumber` and `sourceHead` to match the immutable claimed ticket, plus `pullRequestCreated=true`, `focusedTestExecuted=false`, `independentVerification=false`, `automaticMergeAuthorized=false`, `replayAuthorized=false`. A mismatch leaves the permanent job claim reserved and returns `CLAIM_RETAINED_CODING_OR_PUBLICATION_UNPROVEN` (no retry, no merge).

A new **proposed/unadmitted** negative test uses nine incompatible reply variants (other grant, other publication, wrong issue, stale head and forbidden privilege/state claims). It does not execute on the owner Windows host until separate approved W8/W9 binding. Candidate source edition at code/test commit `6a9c0b0e178bc02616ed59d775e2067baf2ae34c`:

| File | UTF-8 SHA-256 (author-side; known-vector self-check) | Git blob |
| --- | --- | --- |
| `scripts/engineering-team/gateway/worker-pool/worker-pool.mjs` | `5f6f3155160843b5b2c30ea029242e910fbe4844703dc9fb4e7d704b1abac964` | `448757eaee6ffc78399e83fb6e612805e21d94c7` |
| `tests/issue-3142-factory-worker-pool.test.mjs` | `b5d4e0764bb5ca65fa15433904d8fdb3dde0347f98d46a1f3786658d256acdc7` | `7899a382f03cd688a50caf43799de599e25054a8` |

These are author-computed editions, not externally accepted truth. Review all direct/transitive inputs and rehash at the final source head. This PR remains DRAFT and conflicted with current MAIN's protected `config/verification/test-catalog.json`; no author-side catalogue correction or force-merge is authorized. The live Windows Supervisor is correctly RUNNING on clean MAIN `4311a26ee49ae97f8f94c9bde008eb6b62fdfa2f`, while coding dispatcher and workers are NOT installed. Independently trusted F00 signing, catalogue-maintainer binding, exact-head CI and native owner Product Gate remain prerequisites.
