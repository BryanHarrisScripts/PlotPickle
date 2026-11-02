# #3142 / #3302 — Owner-Windows live acceptance gate for PR #3311 and stacked #3314

Date: 2026-10-26. Parent #3142, verification #3302, master roadmap #3274.
Decision: C: is the live execution volume; G: is archive storage only. H: is not part of PlotPickle storage.

## Why this gate exists

Hosted CI and a paired `factory-pr-head` receipt verify code/test contracts and PR identity. They do not certify owner-host execution, source-edit/model publication, process ownership, signed Windows Product Gate, or automatic queue continuation.

Current owner MAIN is `340dbeb0916a35eec37ae2aa9f078a53d9678b57`. At the time this brief was written, PR #3311 was draft at `c240bb24ec86cd6a0f4decc8e32d655301ed9004` and #3314 was draft, stacked on #3311, at `77402c8a4c297e8c9a2483a21e675e695b79788b`. These are evidence checkpoints, not evergreen authorization: every later run must re-read current GitHub PR, clean MAIN and exact SHAs.

The authenticated owner tunnel is healthy and its refreshed `factory_status` reports a fresh independent supervisor heartbeat, 70 retained candidate stages, max concurrent stage admission 1, and the canonical staging lock ABSENT. Its separate legacy Pi queue still reports OFFLINE with five blocked immutable reservations. **Do not run or replay Pi**. The MCP catalog is not the separate Engineering Dispatcher plugin.

An attempted new remote `factory-pr-stage` action was denied by the connected tool's safety checks *before Factory admission*; read-only `factory_control_receipt` for `f3c7dba3a0194a49a6f934bc3b1c742d` was `NO_REQUEST`. Do not bypass the platform safety check by repackaging its rejected action, and do not represent this as Git staging, an owner-host acceptance result or a disk failure. Obtain a supported, explicitly authorized owner-host staging/acceptance route first.

## Gate A — Approved Windows candidate admission

1. Use the existing authenticated owner-controlled lifecycle and a supported invocation path with a reviewed tool schema and explicit authorization. Preserve the original tunnel, supervisor, and intentional STOP. No arbitrary shell, GitHub-issue-text command execution, unverified PID adoption, task replacement, hidden remote credentials, or force restart.
2. Attest clean exact MAIN, trusted Git origin, current PR #3311 head and base, scoped Windows identity, and local stage/queue ownership. Re-read authentic PR metadata before/after a permitted operation. Any changed head invalidates prior acceptance.
3. Verify the read-only retained-worktree inventory and canonical parent lock. A stage may be admitted only with free-space preflight satisfying the live C: admission floor plus margin. G: may hold independently classified archives, not active registered worktrees or private receipts. No cleanup or archive migration is implicit in staging.
4. Upon a *separately approved and permitted* candidate staging operation, require a new durable one-use request and read back its exact receipt. Only `TEST_PASSED/CANDIDATE_STATIC_STAGED` with matching PR number, source head, candidate head and stage identity proves an isolated static checkout. A safety denial, `NO_REQUEST`, stale/missing/ambiguous receipt or partial checkout does **not**.
5. Keep the candidate isolated. Metadata-only stage and mocked tests never promote to Product Gate. No generated code is executed on the production MAIN checkout.

## Gate B — Real parent-PR #3311 code → draft publication pilot

The current parent implements native one-shot entry points but is not released on MAIN. Do not execute an unverified candidate script merely because it exists in GitHub. After Gate A, use the independently reviewed, owner-approved isolated candidate execution route, which must resolve the script code from the verified candidate while binding the mutable repository to the **clean MAIN** source. `gatewayAppSource` must independently verify that source; launching from a detached candidate as though it were MAIN is not authorized.

1. The Human/owner provisions a fresh private `engineering-edit-once` grant, scoped to one eligible issue, an allowed `scripts/engineering-team/**/*.mjs` path, its exact SHA-256, one existing focused test, exact MAIN SHA, bounded objective/model/output, expiry, and one request. The grant is private under the gateway root, not written in GitHub or tool arguments. The worker may neither issue nor widen its own grants.
2. Require a **real** OpenAI Responses completion through the already-reviewed restricted code-edit adapter, a unique bounded replacement and a newly committed isolated worktree. Read back `LOCAL_COMMIT_PREPARED` with exact local commit, branch, source file, issue, and `focusedTestExecuted:false`. An injected fake-model fixture does not qualify.
3. Only **after** the local commit exists, the owner separately issues a `draft-pr-publish-once` grant pinned to that exact commit, coding grant, original MAIN, issue, branch and path. The separate scoped GitHub publication credential is owner-private. Do not assume a publication grant can be preissued before a fresh model-generated commit; preserve the two-phase handoff implemented in #3314.
4. Use the parent publisher's fixed GitHub Git-data and pull-request API boundary. Independently verify the committed local blob/tree, source parent, remote MAIN, new deterministic remote ref, and newly created **DRAFT** PR. Read back confirmed publication plus correlated immutable engineering receipt. Missing/timeout/ambiguous requests remain non-replayable and are never described as successful publication.

## Gate C — Independent exact-head verification and release

1. GitHub exact-head PR Gate must pass all required seven architecture layers and applicable native Windows CI. A SKIPPED Product Gate or historical green run cannot certify the current candidate.
2. A separate verifier using different authority and credentials reads GitHub PR/commit/workflow truth, tests the actual candidate, and emits an owner-Windows witness bound to issue, request, SHA and product observations. The Ed25519 signing private key must remain outside the code-generation/publisher process and outside GitHub. An example or fixture signature is not a production witness.
3. Independently read the engineering and verifier receipts and confirm their exact binding and provenance. No self-certification, automatic merge on hosted fixtures, or use of `independentVerification:true` by the worker.
4. Mark #3311 ready and merge the **expected exact head** only when PR and Product Gates both pass and the verified behavior matches the issue. Confirm MAIN afterward, then update/rebase stacked #3314 against that accepted MAIN and re-run its exact-head gates.
5. Only after separately deploying/authorizing the six-tool #3314 plugin, prove owner token isolation, native STOP/PAUSE, durable leases and restart/no-replay. A second eligible issue must start automatically after the first accepted merge without a new manual ChatGPT turn. A one-shot bridge is not an always-on Software Factory.

## Fail-closed evidence and current release state

Keep blocked attempts and retained worktrees immutable. Never delete, reset, alter STOP, run legacy Pi, force-update shared Git history or substitute C: capacity guesses for a typed disk receipt. Treat uncertain external side effects as requiring independently reconciled read-only evidence.

At writing: Gate A has authenticated status and identity evidence but no accepted stage, Gate B has **no live paid model call or draft publication**, Gate C has hosted fixture CI but **no signed owner Windows Product Gate**. #3311 and stacked #3314 remain **DRAFT / BLOCKED**, not merge-ready.

The immediate engineering deliverable is a supported owner-authorized staging/acceptance tool surface whose schema and identity checks pass the host's safety controls. No new execution authority is granted by this document alone.
