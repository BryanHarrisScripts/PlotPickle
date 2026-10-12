# Bounded Save safety/progress and correspondence — #2938

This assurance record checks an 11-state reference model of PP-SAVE-001 v1.0.0 T1/T2/T8, under the unchanged approved white paper v3.0 section 6. Every reachable state and every pending path is examined. A cycle fails even when another branch completes. Counterexamples identify the transition trace rather than only a test count.

The model separates project persistence, index persistence and approval. Lost acknowledgement is UNKNOWN with work retained, not a failed write or successful Save. Reconciliation assumes restored dependencies and independent exact readback. The finite abstract response policy does not select a product timeout or prove that it exists in the implementation.

| Claim | Scope/status |
| --- | --- |
| Reference model safety/progress | Finite model only; rerunnable checker |
| Implementation correspondence | PARTIAL, exact source/excerpt fingerprints |
| Human semantic review | PENDING, final #2943 |
| Actual Windows/workflow conformance | UNPROVEN, final #2943 |

## Concrete correspondence gaps

- Project Save and Library index synchronization are separate awaited mutations. No cross-boundary atomic transaction is established by the mapped browser code. Interruption between them cannot be abstracted away.
- The mapped privateMutation request has no finite deadline. If fetch never settles, the write queue and flush can remain pending. The reference model's finite response transition is not implemented by that promise alone.
- Captured-byte queueing, authority epochs and client revision checks have explicit mechanisms, but these do not establish server-side concurrent-write semantics, original-operation deduplication/reconciliation or full media/approval recovery.
- Existing two-process encrypted-storage proofs are bounded engineering references, not normal Human launcher and rendered Storyboard/Previs acceptance.

The JSON companion retains assumptions, all transition mappings, source hashes, catalogue targets and owned gaps. Source drift, absent mappings, unsupported atomic collapse, nontermination and model-to-product promotion invalidate the assurance record. The implementation scope is audit/checking infrastructure; no product behavior, contract meaning, provider or story data is changed. #2943 re-examines these recorded concerns and opens fresh repair issues for applicable confirmed discrepancies. #2939 owns broader composition/migration; #2940 owns measured benefit.

Run node scripts/verification-safety-progress.mjs for the integrity/model result under .artifacts/safety-progress. A VALID_ASSURANCE_RECORD is not proof that the application implemented every modeled transition.
