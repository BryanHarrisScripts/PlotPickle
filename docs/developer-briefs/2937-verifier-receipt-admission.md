# Independently admit workflow observations

Issue: #2937; follows merged #2941 and approved white paper v3.0 W8/W9.

## Assessment and scope

GO. Existing DSDD public intake cannot authenticate observations; Casebook already accepts verifier-owned evaluation context. Reuse both evaluators and add a shared read-only verifier receipt adapter under `lib/verification/development/`. No second truth store, new dependency, paid inference, story mutation or contract amendment.

Implement the receipt-admission part of #2937. Real normal-launcher Windows Save/Lock, local inference, fault sequences, Human semantic review and measured benefits remain open. Controlled cryptographic/admission tests do not establish those product outcomes.

## Authority and format

An independently operated verifier retains its Ed25519 private signing key outside PlotPickle. The runtime receives only a host-configured public key, verifier identity, environment/configuration identity and receipt directory. The public API cannot choose these values or install trust. Configuration defaults to disabled; missing trust means UNPROVEN. A signature authenticates the observer's record, not the fidelity of its procedure; the operator must approve that verifier and its observation scope independently of implementation claims.

Version-1 receipt files contain a base64-encoded UTF-8 JSON payload and Ed25519 signature over the exact decoded bytes. The payload binds a receipt ID, exact subject (DSDD profile/session/locked intent/requirement or Casebook case/run), source revision/environment/configuration, action, observed result, finding, scope, simulation limits, validity window and SHA-256 of the linked local artifact. Paths stay beneath the configured root. Signed unit/fixture evidence remains ineligible for real-product conformance.

DSDD accepts receipt IDs only, merges them with retained IDs, pins the payload digest, independently revalidates them on submission and read, and uses the authenticated observation contents rather than public duplicates. Unknown, replaced, corrupt, expired, wrong-key, wrong-scope or missing artifacts remain unproven with API diagnostics. Applicable contradictions outrank success/blockers; a subsequent update cannot silently remove a retained contradiction. Lost receipt validation cannot preserve a historical PASS. Public raw evidence remains explanatory only. This delivery has no automatic receipt retirement or supersession: invalid retained evidence keeps the requirement UNPROVEN. A reviewed retirement/reconciliation policy, independently operated signer integration and Human-friendly receipt controls remain follow-ups, rather than silently clearing inconvenient records.

Casebook gains an async signed-receipt evaluation adapter. It passes only admitted observation bytes/references to existing obligation evaluation and keeps missing journey/required-evidence fields unproven. No receipt manufactures completed journey steps.

## Acceptance and validation

1. Correctly signed matching observations are admitted; modified payload/artifact, wrong key/subject/revision/environment/configuration, expiry, unsafe paths and mocked scope cannot grant product PASS.
2. Public fields cannot borrow a trusted artifact reference to replace an independently observed result. Missing trust stays UNPROVEN with a bounded diagnostic.
3. DSDD revalidates saved receipt identities on read; failed/stale evidence loses applicability, and valid contradictions remain visible across ordinary updates.
4. Casebook uses the same admission boundary without certifying an incomplete journey.
5. Add exact-source truth bindings to existing Layer 7 catalogue before executing revised/new tests. Run focused admission/DSDD/Casebook regressions, focused UAT, production build, routing/convergence and independent exact-head CI. Keep #2937 open for missing real observations.

The Human's continuation authorizes implementation and PR preparation. Completion of this adapter is not completion or semantic approval of the whole audit.

## Operator integration

Configure `PLOTPICKLE_OBSERVATION_RECEIPT_ROOT` (existing directory), `PLOTPICKLE_OBSERVATION_PUBLIC_KEY` (Ed25519 SPKI PEM), `PLOTPICKLE_OBSERVATION_VERIFIER`, `PLOTPICKLE_OBSERVATION_ENVIRONMENT` and `PLOTPICKLE_OBSERVATION_CONFIGURATION` in the trusted host environment. Do not expose the private signer key to the application, agent worker or public intake. An independently operated procedure must first establish the observation; this adapter cannot establish its fidelity from a signature.

Write `<receiptId>.json` beneath that root. Its envelope is `{ "schemaVersion": 1, "payload": "<base64 UTF-8 JSON bytes>", "signature": "<base64 Ed25519 signature of those exact bytes>" }`. The decoded payload is:

```json
{
  "schemaVersion": 1,
  "receiptId": "observer-run-001",
  "subject": {
    "kind": "dsdd",
    "profileId": "test-scoped-profile",
    "sessionId": "exact-engineering-session",
    "intentVersion": 1,
    "intentDigest": "<64 lowercase hex characters>",
    "requirementId": "R1",
    "promise": "<exact locked requirement text>"
  },
  "observedAt": "<ISO timestamp>",
  "expiresAt": "<verifier-declared validity limit>",
  "artifact": { "path": "observations/readback.json", "sha256": "<exact artifact SHA-256>" },
  "observation": {
    "contractId": "dsdd:<exact intentDigest>",
    "contractVersion": "1",
    "obligationId": "R1",
    "promise": "<exact locked requirement text>",
    "testedCommit": "<exact 40-character source revision>",
    "environment": "<host-declared observed environment identity>",
    "configuration": "<host-declared observed provider/dependency configuration identity>",
    "source": "<host-trusted verifier identity>",
    "independent": true,
    "simulated": false,
    "scope": "real-product-observation",
    "finding": "supports",
    "action": "<performed supported workflow action>",
    "observedResult": "<independent comparison to the known expected result>"
  }
}
```

`finding` can be `supports`, `contradicts` or `blocked`; `blocked` also requires a nonempty `blocker`. Keep records/artifacts non-sensitive; never include story content, credentials, hidden reasoning or full model prompts/responses. Signed fixture/model evidence must declare its actual simulation/scope; it cannot satisfy real-product admission. Receipt JSON is bounded to 128 KiB, each artifact to 64 MiB and each requirement to 128 retained IDs; exceeding those limits is explicit insufficiency, not truncation or green.

The existing authenticated `record-evidence` request supplies `requirements: [{ "id": "R1", "status": "UNPROVEN", "verifierReceiptIds": ["observer-run-001"] }]` and its `intentVersion`. The requested status is not authoritative. Signed payload digests are retained by the gateway, not supplied by the request. If a receipt disappears, changes, expires or loses applicability, the API returns UNPROVEN plus `receiptDiagnostics`; any still-applicable contradiction keeps FAIL. The current UI can display the resulting status/evidence; it has no new receipt-installation controls.

For Casebook, use subject `{ "kind": "casebook", "caseId": "<exact Case ID>", "runId": "<exact manifest run ID>" }`, the approved contract ID/version/obligation/promise, and the case's independent verifier source. A trusted runner calls `evaluateCaseEvidenceWithReceipts(definition, manifest, { authority, testedCommit, receiptIds, receiptDigests })`; retain returned `receiptDigests` for subsequent evaluation. Missing approved obligations and journey evidence still prevent whole-case PASS. This delivery exposes that adapter for existing runners; it does not auto-register PP-SAVE-001 as an attended driver or auto-sign old manifests.
