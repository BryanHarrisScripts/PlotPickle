# #3142 — safe MAIN / coding candidate three-way truth reconciliation
October 28, 2026. **REVIEW-ONLY, NOT A PROTECTED-CATALOGUE UPDATE OR RELEASE APPROVAL.**

## Immutable comparison coordinates

- Common merge ancestor: `340dbeb0916a35eec37ae2aa9f078a53d9678b57`.
- Verified clean owner-host / GitHub MAIN: `233efe098cd0751a81ae16f3b58f86a96d237be2`.
- Existing DRAFT PR #3311 candidate: `8fdd2116853ec68ca6cab6f188a6addf63203ceb`. Comparison: 163 commits ahead of MAIN and eight behind; mergeable=false. Do **not** force-push, fast-forward either head blindly, or change the owner-host checkout to candidate.
- Protected `config/verification/test-catalog.json` blob IDs: ancestor `57b3171849f773de7e9bb89f8eb769d49cdfe651`; MAIN `bbcc49ea45f2ab2237e39080562a1d4ae9f26675`; candidate `b789d18373e201b3af71b6c98d1a213d1bc90d4b`.
- Binding counts: ancestor 178, MAIN 179, candidate 183. These counts are evidence of differing editions, **not** a reason to take the union or mark anything approved.

## Actual overlap and critical drift

Only one changed *file path* overlaps across MAIN and candidate source changes: `config/verification/test-catalog.json`. **Its contents are independently governed and semantically conflict.** In particular, the same two existing test-truth binding targets are modified on both sides:

| Existing target | MAIN approved source-input edition | Candidate older input edition | Candidate additionally changed |
| --- | --- | --- | --- |
| `tests/issue-3222-verified-pr-launch.test.mjs` | `factory-readonly-server.mjs` `2b9e01d8f2f031b1ffe764fea024ed564e551875ae8f44f9ea2b372e2e6943c1` | `412088470a65d0d75dc689ce712aff3247399dfb7d1a4ccda725eb6ac3e1f199` | `architecture-shadow.yml` `740746de789d6f551c696788c678ab38569b98e223b0105c003df1b58df5c55b` instead of MAIN `97b3f8747958b699332cd66a96099c5aa44de7bdc410570f069fb7a4f8d1c7cc` |
| `tests/issue-3222-factory-concurrent-session.test.mjs` | Same updated MAIN server input | Same old candidate server input | Same workflow edition difference |

MAIN also changes existing bindings for Factory, App, gateway, storage and OSS Radar tests, and **adds** `tests/issue-2034-oss-radar-discovery-recall.test.mjs`. None may be dropped. Candidate modifies old #3058, #2338 and #3110 sources/inputs and **adds five proposed new governed bindings**: `tests/issue-3142-authorized-coding-once.test.mjs`, `tests/issue-3142-authorized-publish-once.test.mjs`, `tests/issue-3142-authorized-pr-publish-once.test.mjs`, `tests/issue-3302-two-receipt-verifier.test.mjs`, and `tests/issue-3142-owner-windows-acceptance-broker.test.mjs`. Candidate also adds these targets to `agent.autonomous-factory-queue-3110`.

**Additional drift:** at least two candidate newly proposed binding hashes are stale relative to the candidate's edited test bytes. The last author-side full-file SHA-256 computation gave `4bfc092815c7b80d236a6d158efc7f0b5440d55e0503a77436de8e0f37eedfb8` for `tests/issue-3142-authorized-coding-once.test.mjs`, versus candidate catalogue digest `613de37ede166c572e5b58d22ea42216b68d4bd994746310ed0b7a2f02bafa9c`. For `tests/issue-3142-authorized-pr-publish-once.test.mjs`, actual `c0bff2d3e180255ec3e67cdaf41ddce7cd5c5907036111af027dd11b6681299c` versus proposed binding `8bc97dfd17660fe836d246af964c5026a6228b2d0d6c8c4f318c5de3eff56903`. The coding/publication implementation inputs also changed. These were **not** independently recomputed. Do not run or approve tests against stale digests.

## Mandatory non-destructive release resolution sequence

1. Treat current MAIN catalogue as the approved baseline. Preserve every MAIN binding and entry unless a separately authorized, source-specific approval explicitly changes it.
2. Complete independent F00 review against WHITE-PAPER-V3 W8/W9 of every changed #3142/#3302 test edition and all transitive input files; trusted signer and registrar must be distinct from author. The current PR changes themselves and any author-side digest computation are **not ADMIT**.
3. A distinct protected-catalogue maintainer obtains a real signed exact-source ADMIT and independently recomputes current head, true test SHA-256 and every input SHA-256. Resolve two existing #3222 bindings against the source code/workflow that will actually exist after branch reconciliation. Do not simply take the old candidate versions, paste a union of both arrays, or certify a changed test by naming its old digest.
4. Prepare a non-force, reviewable integration update on a controlled branch/worktree based on **current** MAIN. Reconcile the guarded catalogue by the verified binding-specific result above and bring over all intended non-catalogue changes; inspect clean resulting tree and original candidate commits. Keep separate branch until independent acceptance. No speculative MAIN checkout reset, force-ref update, automatic publication or merge.
5. Run unchanged exact-head seven-layer architecture CI, authorized owner-Windows Product Gate and signed separate verification receipt against this **final** integration head. No missing/queued/failed check is green. Only then review green-only merge authority.
6. After successful release only, use a separately authorized, owner-credentialed persistent dispatcher to attempt two distinct real issue cycles. Existing five blocked reservations remain nonreplayable, Pi remains retired and the independent supervisor's heartbeat alone is not coding proof.

## Last observed limits

PR #3311 remains DRAFT/unmergeable, with no exact-head GitHub workflow run returned. Its standalone NON-RELEASE Windows syntax workflow is a source proposal, **not a syntax result**. Authenticated `factory-pr-head` checks compare candidate identity only, not source execution or Windows Product Gate. Neither author nor coding identity may self-update protected truth under the pretext of resolving a Git conflict.
