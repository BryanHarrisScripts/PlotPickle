# White paper coverage: review proposal

The approved white paper v3.0 is preserved unchanged. This audit accounts for 95 substantive source units and keeps 304 sentence-level review candidates, including examples and context. These counts do not establish 304 approved requirements, complete semantic decomposition or product conformance.

The companion `2936-white-paper-coverage.json` records exact source locations/digests, proposed interpretation and applicability, owner, contract/test references, expected observation, negative controls to plan, separate enforcement/observation states, limits and follow-up issues. Human review remains pending. Compound clauses may require further decomposition; explanatory statements and examples require an explicit reviewed disposition.

Bounded candidates have bounded references to existing source-level governance. Every other candidate's enforcement is UNASSESSED. Unassessed means the audit has not established enforcement; it does not assert that the application lacks the behavior. No product outcome is marked OBSERVED. Historical seven-layer CI evidence retains ENGINEERING_ONLY scope.

The baseline at merged main `96f75ff5e0c80ac72d803f8610e8bc7310f94fe7` inventories 1,287 test/fixture/catalogue-target/proof/workflow files with byte digests, catalogue ownership and existing truth bindings. All retain UNREVIEWED assertion semantics and ENGINEERING_ONLY claim scope. Three declared bindings cannot establish that the remaining legacy assertions express approved meaning.

## Review and remaining work

| Work | Record | Current status |
| --- | --- | --- |
| Requirement interpretation, applicability and legacy assertion fidelity | #2936 | Human review and semantic audit pending |
| Real device/provider/storage/restart and live verifier receipts | #2937 | Required observations UNPROVEN |
| Safety/progress and model correspondence | #2938 | Assurance audit pending |
| Composition, migration and recovery | #2939 | Guarantee audit pending |
| Reliability, rework and Human burden | #2940 | Baseline values and thresholds UNKNOWN |

Review the candidate classification and material meaning first. Link existing enforcement and observation only where it actually serves the accepted obligation. Retain disagreement, uncertainty and evidence limits. Confirmed follow-up interpretations need explicit review provenance; this integrity checker does not grant itself approval or product receipt admission.

## Reproduce integrity and read the report

Run `node scripts/verification-test-truth.mjs --base-ref origin/main --working-tree` before revised test execution. Run `node scripts/verification-white-paper-coverage.mjs` to validate source accounting, references, baseline inventory and claim scope. The command writes a detailed readable report and integrity result under `.artifacts/white-paper-coverage/`.

`VALID_AUDIT_PROPOSAL` means the records are internally consistent with their pinned source and inventory. Human interpretation review, assertion fidelity, product outcomes and measured benefit remain pending. The checker rejects stale references, missing or duplicate source meaning, altered legacy inventory, invented approvals, fixture promotion and unsupported benefit measurements. Issue #2936 stays open until the semantic review and audit acceptance are resolved.
