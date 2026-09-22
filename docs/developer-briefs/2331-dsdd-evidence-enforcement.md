# #2331 DSDD requirement-to-evidence enforcement

## Purpose

Close the remaining DSDD proof gap without expanding the product workflow. A caller must not be able to label a locked requirement PASS merely by submitting the string PASS.

## Deterministic rule

Evidence is accepted only when it identifies the same locked intent version and digest, includes a recognized proof type and finding, names the tested source, identifies an exact 40-character commit, records the observed result, and carries a usable artifact/reference plus summary.

Status resolution is deterministic:

- PASS requires at least one validated supporting observation and no validated contradictory observation.
- FAIL requires at least one validated contradictory observation.
- Missing, malformed, mismatched, stale/invalid-build, or otherwise insufficient evidence remains UNPROVEN.
- The gateway never changes the locked Human meaning while resolving evidence.

The evidence finding is descriptive only: supports, contradicts, or insufficient. It is not an LLM score.

## Scope

Add a small reusable evidence-contract evaluator beside the DSDD gateway, route record-evidence through it, and add executable regression coverage. Keep Pi Draft read-only, preserve the current private DSDD session, and do not add Block 01 UI or general #2348 proof routing in this change.

## Proof

Focused tests must demonstrate that an empty PASS, wrong intent digest, invalid exact-head identity, or contradictory observation cannot become PASS; a validated contradiction is required for FAIL; and a fully matched supporting proof can become PASS.

The existing agent-runtime ownership and verification catalogue remain authoritative. The new focused regression is added to the existing DSDD agent-runtime test group rather than creating another permanent gate.
