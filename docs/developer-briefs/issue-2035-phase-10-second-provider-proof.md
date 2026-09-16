# #2035 Phase 10 — Second-provider universality proof

## Objective

Prove that PlotPickle's existing Creative Transaction Contract is genuinely provider-neutral by attaching a second external provider shape that does not use repository / branch / review-request primitives.

The proof uses a **versioned object-store service** behind an injected bridge. A concrete implementation could use an S3-compatible versioned service or another immutable object-revision system later; transport credentials and SDK/API details remain outside the Creative Transaction contract.

## Architecture

```text
Creative Change Set
→ existing Creative Transaction Contract
→ existing capability resolver
→ Versioned Object Store adapter
→ injected versioned-object service bridge
→ external durable object revisions
```

No core transaction vocabulary changes are required.

## Why this is a useful second proof

The first external adapter, GitHub Story Proposals, maps naturally to repository review and commit primitives. A versioned object store exercises a materially different provider model:

- reviewed PlotPickle Change Sets are staged as immutable remote bundles;
- remote state is inspected by transaction identity and Change Set fingerprint;
- durable provider revisions are recorded only after explicit writer acceptance and confirmed remote commit;
- recovery/reconciliation does not depend on branches, pull requests or check runs;
- provider-native object/revision identifiers stay transaction metadata and never become PPF identities.

If this provider required rewriting the core lifecycle or Creative Change Set semantics, Phase 10 would fail. It does not.

## Authority boundaries

- **Responsibility Run** = bounded work/evidence.
- **Creative Transaction** = durability, verification/review lifecycle and recovery.
- **PPF / Human approval** = canonical creative truth.
- **Versioned object service** = optional remote durability infrastructure.

Provider commit does not admit canon. The existing PPF bridge remains the only writer-approved canonical admission path.

## Capabilities

The base adapter advertises only:

- durable revision;
- diff;
- verification;
- Human review;
- recovery;
- reconciliation;
- artifact storage;
- remote.

It does **not** advertise offline, collaboration or atomic commit. Rollback is added only when the injected bridge supplies an explicit safe rollback operation.

PlotPickle Local remains the preferred baseline provider when it satisfies the requested capabilities and remains fully offline.

## Fingerprint rule

Every remote bundle carries the existing provider-neutral `creativeChangeSetFingerprint()` value. Staging, commit and reconciliation fail closed if the remote fingerprint does not match the reviewed Creative Change Set.

This is the key universality check: the same creative semantics and fingerprint survive provider routing while provider-native metadata remains outside the creative payload.

## Recovery rule

Missing, unavailable, ambiguous, changed or fingerprint-mismatched remote state never becomes success by inference.

A provider-reported committed state without an exact durable revision ID is surfaced as a committed acknowledgement gap with `authoritative: false`; PlotPickle does not invent the missing revision.

## Verification

The existing `production.creative-transaction-provider` verification owner remains authoritative. Phase 10 extends its focused #2035 regression coverage to prove:

1. Local remains the default/offline route.
2. Explicit versioned-object selection resolves through the same capability resolver.
3. The same Change Set fingerprint and creative diff survive the adapter lifecycle.
4. Human review remains explicit.
5. Remote divergence/unavailability fails closed.
6. Provider commit remains separate from PPF canon admission.
7. No versioned-object/S3 vocabulary is added to the core Creative Transaction contract.

Automated coverage uses a deterministic in-memory bridge and performs no network or credential operations.
