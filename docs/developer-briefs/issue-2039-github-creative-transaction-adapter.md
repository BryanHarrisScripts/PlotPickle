# Issue #2039 — GitHub Creative Transaction Provider

## Objective

Prove the provider-neutral Creative Transaction contract from #2035 against a real external provider without making GitHub part of PlotPickle core architecture.

GitHub is optional infrastructure. PlotPickle Local remains the default first-class provider and continues to work fully offline.

## Architecture

```text
Creative Change Set
→ Creative Transaction Contract
→ capability resolver
→ GitHub Creative Transaction adapter
→ existing local GitHub Story Proposal gateway
→ GitHub
```

The adapter reuses the existing #150 Git-native synchronization and #152 Story Proposal machinery. It does not implement a second GitHub client, token store, proposal schema, serializer, or canon path.

## Authority

- Responsibility Run = bounded work and evidence.
- Creative Transaction = durability, provider lifecycle and review/commit state.
- PPF = writer-approved canon.
- GitHub = optional external collaboration/transaction infrastructure.

A completed GitHub proposal is provider state only. Canon admission remains a separate PPF operation with revision freshness and explicit Human approval.

## Provider capabilities

The first GitHub descriptor advertises only guarantees implemented by the current bridge:

- durable revision
- diff
- verification
- Human review
- recovery
- reconciliation
- artifact storage
- collaboration
- remote

It does not advertise offline or atomic commit. Rollback is advertised only when the injected bridge supplies a safe rollback implementation.

## Lifecycle

The adapter supports the same universal lifecycle as Local:

```text
create
→ stage
→ verify
→ request review
→ accept / reject / revise
→ commit
→ status / recover / reconcile
```

`requestReview` creates the existing Story Proposal through `/api/local-github/submit-proposal`. `commit` delegates to the existing semantic approval endpoint, which already guards the approved base revision before updating the canonical Git branch. Decline and revision paths reuse the existing decline operation.

## Recovery rule

Remote unavailability, missing proposals, divergence or ambiguous state never becomes success by inference.

If GitHub confirms a proposal was committed but PlotPickle lost the local durable-revision acknowledgement, reconciliation reports the committed/provider-acknowledgement gap rather than inventing a revision ID.

## Security

The adapter does not handle credentials directly. The existing loopback-only GitHub gateway owns the credential boundary and GitHub transport. Provider-native identifiers stay in transaction metadata and never become PPF identity or canon authority.

Automated tests use deterministic injected bridges and do not mutate live repositories.

## Verification

The existing `production.creative-transaction-provider` Architecture Verification catalog entry remains the owner. Its focused #2035 regression file is extended with #2039 coverage so the new external-provider proof cannot go green without actually executing the adapter tests.

Required merge gate: exact-head seven-layer Architecture Verification green.
