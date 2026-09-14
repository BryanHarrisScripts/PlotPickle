# Developer Brief — #2035 Universal Creative Transaction Provider

## Priority

This is the current architecture priority. It establishes the durable change boundary needed before further optional provider/runtime expansion.

## Product decision

PlotPickle owns creative meaning, authority and required guarantees. Transaction providers supply pipeline machinery.

```text
PlotPickle Creative Work
        ↓
Creative Change Set
        ↓
Creative Transaction Contract
        ↓
Capability Resolver
        ↓
Provider Adapter
        ↓
Transport
        ↓
Local / GitHub / Modem.dev / future provider
```

**External providers enhance PlotPickle; they never become prerequisites. PlotPickle Local is the baseline provider and must work fully offline.**

MCP, REST, GraphQL, Git, CLI, SDK and filesystem are adapter transports, not the Creative Transaction architecture.

## Problem

One visual-first change may touch PPF, story intent, Storyboard, Previs, continuity, references, render instructions, assets, provenance and Responsibility Run evidence. PlotPickle needs one reliable answer to whether the complete proposed change is verified, reviewed, durable and recoverable.

Existing authority remains unchanged:

- PPF = canon.
- Responsibility Run = bounded work and evidence.
- Creative Change Set = proposed multi-artifact change.
- Creative Transaction Provider = durability/review/commit/recovery infrastructure.

A provider commit never independently creates PlotPickle canon.

## Provider-neutral contract

The contract exposes semantics equivalent to:

`create → stage → diff → verify → requestReview → accept/reject/revise → commit → status/recover/reconcile/rollback`

Core types contain no GitHub branch/PR/check vocabulary.

## Capabilities

Providers advertise guarantees including durable revision, atomic commit, diff, verification, Human review, rollback, recovery, reconciliation, artifact storage, collaboration, remote and offline support.

Workflows request capabilities rather than provider names. Explicit provider selection fails closed rather than silently falling back.

## Local-first implementation

The Local provider uses PlotPickle's own application-data home and atomic temporary-file replacement. It does not make network calls and persists transaction records separately from canon. The Local provider can stage, verify, review, commit, reconcile and roll back without GitHub, MCP or Internet connectivity.

## PPF and Responsibility Run bridge

Creative Responsibility Run artifacts remain non-canonical. A Run may seed a Creative Change Set. A durably committed transaction may create a PPF canonical proposal only if its base revision is still current and Human review is accepted. Final canon admission still delegates to the existing writer-approved PPF apply boundary.

## Existing GitHub wheelhouse

PlotPickle already has mature Git-native project synchronization from #150: deterministic SHA-256 inventories, guarded compare, one-tree/one-commit publishing, non-forced ref updates, stale-remote protection and local connection boundaries.

Do not rewrite that machinery. A later GitHub Creative Transaction adapter should translate the universal contract into that existing infrastructure (and proposal/review infrastructure where appropriate) rather than moving GitHub semantics into core.

## InkOS lesson

InkOS is used only as an architectural comparator. The useful lesson is the guarantee that a completed production operation cannot point at partial durable state. PlotPickle implements that requirement through its own provider-neutral transaction boundary, not by copying InkOS's filesystem implementation or creative workflow.

## Implementation order

1. Architecture inventory and authority documentation.
2. Provider-neutral contract and Change Set.
3. Capability resolver.
4. Local provider and durable local store.
5. Responsibility Run bridge.
6. PPF bridge.
7. Provider-neutral creative diff.
8. Verification/recovery/reconciliation semantics.
9. GitHub adapter over existing Git-native infrastructure.
10. Second-provider proof such as Modem.dev or another provider.

## Non-goals

Do not rebuild GitHub inside PlotPickle, require cloud/MCP, create another story database, move canon outside PPF, replace Responsibility Runs, redesign 24/96/2,400, or make any transaction provider creative authority.

## Acceptance

The architecture is correct when Local can complete the lifecycle offline; capability resolution is deterministic and fail-closed; transaction status never guesses durable success; provider metadata cannot mutate canon; stale PPF revisions block admission; the same Change Set semantics can be presented to another provider adapter; and focused tests plus exact-head Architecture Verification are green.
