# #3302 — Lane A independent test-admission review packet

**State: REVIEW REQUEST / NOT ADMITTED.** This packet is prepared by the implementation actor, **not** by the independent test-governance reviewer. No test-catalogue change, worker activation, or PASS is authorized.

## Frozen review edition
- PR #3321 review head: `7dc3a07d51d160a91f97cd3e2e5dcb88a5168e85`
- Architecture Verification run: `40597635947` — failed (no exact-head green evidence).
- Test targets: `tests/issue-3302-independent-catalogue-preflight.test.mjs`, `tests/issue-3302-independent-qa-claim.test.mjs`
- Implementation inputs: `scripts/engineering-team/diagnostics/w8w9-catalogue-preflight.mjs`, `scripts/engineering-team/verification/independent-qa-claim.mjs`
- Candidate normative references: WHITE-PAPER-V3 W8/W9, **to be independently confirmed** against actual obligations and scope. Never assume all tests map to both obligations.

## Assertion review (implementation actor's observations, not independent admission)
1. Catalogue preflight: wrong head, absent source, missing catalogue binding, stale input hashes and missing W9 truth reference are tested. No successful approved-edition fixture is tested. Implementation intentionally always returns BLOCKED and cannot authorize governed execution.
2. QA claim: 12 concurrent async attempts in one Node process assert only one `open('wx')` succeeds. **Does not prove** independent processes, cross-host/NTFS, crash/restart, stale claim recovery, symlink or directory tampering, or full claim durability.
3. `writeOnce` fsyncs the file but not the containing directory; crash durability is not proven. A failed write can leave a partial file that blocks all future claims. No terminal reconciliation protocol exists.
4. `readClaim` trusts mutable on-disk JSON after creation; it does not independently attest that an earlier claim was not modified by another process.
5. `stop` is a caller-supplied boolean checked before claim creation; no persistent STOP authority or recheck immediately before side effects. No independent Windows supervisor ownership evidence.
6. Negative observation records explicitly disallow PASS. They are not signed by an independent verifier and cannot satisfy Product Gate or release authorization.
7. Existing #3311 W8/W9 catalogue input digests differ from the candidate exact source edition. The protected catalogue must not be silently overwritten by the coding actor.

## Lane A reviewer checklist and disposition
- [ ] Independent reviewer identity, authority and separation from test author/QA worker established.
- [ ] Recompute SHA-256 of **all four** test/implementation files from immutable exact commit.
- [ ] Inspect actual normative obligations and approve precise mappings, limits, scopes, catalogue IDs and source inputs.
- [ ] Evaluate assertion adequacy and adversarial negative cases; require FIX where tests overclaim durability or security.
- [ ] Record immutable independently attributable `ADMIT`, `FIX`, `REJECT` or `UNPROVEN` with rationale and frozen digests.
- [ ] Only after `ADMIT`, propose protected catalogue binding in a separate governance change and rerun exact-head CI.
- [ ] Lane B remains inactive until catalogue acceptance, actual worker runtime proof and owner-Windows acceptance.

**Requested initial disposition: FIX / UNPROVEN pending independent assessment.** This is a suggested triage, not an independent verdict. Do not turn this document into a self-issued ADMIT receipt.
