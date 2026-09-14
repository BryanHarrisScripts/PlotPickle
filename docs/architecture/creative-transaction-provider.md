# Creative Transaction Provider Architecture

## Authority model

PlotPickle separates four questions that must not collapse into one system:

| Boundary | Question answered |
| --- | --- |
| PPF | What has the writer accepted as story canon? |
| Responsibility Run | What bounded work happened and what evidence was produced? |
| Creative Change Set | What multi-artifact creative change is being proposed? |
| Creative Transaction Provider | Did that proposed change move through durable stage, verification, review, commit and recovery infrastructure? |

A provider's success signal is operational evidence. It is never PPF authority.

## Universal plug

```text
PlotPickle surface / Agent
        ↓
Creative Change Set
        ↓
Creative Transaction Contract
        ↓
Capability Resolver
        ↓
Provider Adapter
        ↓
transport chosen by adapter
        ↓
provider infrastructure
```

The permanent vocabulary is the contract. Provider and transport vocabulary stays behind the adapter.

## Local baseline

`plotpickle-local` is the baseline provider. It advertises offline support plus durable revision, atomic commit, diff, verification, Human review, rollback, recovery, reconciliation and local artifact storage.

Its transaction ledger is operational state under the PlotPickle application-data home. PPF remains the canonical story record. Local transaction persistence uses temporary-file flush/sync plus rename so a transaction record is never intentionally replaced by a partial JSON write.

## Capability resolution

Provider selection is requirement-driven. When the user explicitly selects a provider, an unsupported requirement fails closed rather than silently changing providers. When no provider is selected, Local is preferred when it satisfies the requested guarantees.

## Change lifecycle

```text
created
  ↓
staged
  ↓
verified
  ↓
awaiting-review
  ├── revise → revising → staged
  ├── reject → rejected
  └── accept → approved → committed
                              ↓
                         rolled-back
```

Unknown durable state is represented as `unknown`; reconciliation must never infer `committed` from missing evidence.

## Canon admission

A committed Creative Transaction is still only durable provider state. To enter canon:

1. its Change Set must have accepted Human review;
2. its original PPF base revision must still be current;
3. a canonical proposal is created with the Change Set fingerprint;
4. final application delegates to the existing explicit writer-approved PPF revision boundary.

If the PPF revision changed, the transaction remains durable evidence but is stale for canon admission.

## GitHub

GitHub is an adapter candidate, not a core dependency. PlotPickle already owns Git-native synchronization machinery with deterministic inventories, compare/diff, guarded one-commit publishing, non-forced ref updates and stale-remote protection. The GitHub adapter should reuse those capabilities rather than recreate them.

A future mapping can translate provider-neutral operations into GitHub branch/commit/PR/check/review primitives, but those names never enter the core Creative Transaction types.

## MCP and other transports

MCP can be used by an adapter when it is the best transport exposed by a provider. REST, GraphQL, Git, CLI, SDK and local filesystem are equally valid transports. The contract is intentionally independent of all of them.
