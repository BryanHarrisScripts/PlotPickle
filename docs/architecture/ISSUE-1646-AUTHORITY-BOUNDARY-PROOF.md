# Issue #1646 Authority Boundary Proof

This slice proves one lifecycle authority decision path without introducing a second identity, policy, persistence or canon system.

## Existing authorities retained

- Human canonical mutation remains owned by `lib/projects/persistence/project-revisions.ts` and its explicit writer approval contract.
- Autonomous Guest delegation remains owned by `core/auth/autonomous-guest/guest-authority.ts`.
- Durable evidence-learning admission remains owned by the server-owned maintainer harness approver and `build/autonomous-guest/maintainer/durable-knowledge-store.mjs`.
- Provider/tool execution remains limited to capability references already granted by existing routes.
- The lifecycle gate only determines whether the requested handoff is compatible with the current lifecycle envelope.

## Deterministic boundaries

The focused #1646 tests prove:

1. Human, Guest, agent and system actors share one decision vocabulary.
2. Execution requires a capability already present in the lifecycle envelope.
3. Referenced evidence may inform reasoning without becoming durable knowledge or operational authority.
4. Durable knowledge requires a matching server-owned harness policy approval and cannot be self-approved by the proposing Guest/agent.
5. Canonical project mutation requires matching Human writer approval for the Human actor and stays routed through the PPF revision owner.
6. Autonomous non-canon persistence never claims Human approval.
7. Resume/reconnect must preserve the exact actor authority snapshot.
8. Actor-controlled authority change/self-promotion is denied.
9. The valid Validate/Repair -> Create/Execute edge is denied once the bounded repair budget is exhausted.

## Stopping rule

No existing agent, Guest scheduler, maintainer learner, PPF writer, BUZZ identity or provider implementation is migrated in this slice. Concrete end-to-end route composition belongs to #1649 after deterministic validation/repair integration in #1648.