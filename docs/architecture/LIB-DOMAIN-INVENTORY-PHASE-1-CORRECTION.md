# PlotPickle `lib/` Domain Inventory — Phase 1 Ownership Correction

Issue: #1302  
Parent: #1287  
Baseline inventory: `docs/architecture/lib-domain-inventory-2026-08-23.csv`

Phase 1 source/dependency inspection found two ownership corrections before the Agents migration.

## 1. `connector-trust-policy.ts` belongs with Agents

Baseline assignment:

`lib/connector-trust-policy.ts` → Integrations

Corrected assignment:

`lib/connector-trust-policy.ts` → `lib/agents/responsibility/connector-trust-policy.ts`

Reason:

- `responsibility-runs.ts` consumes `ConnectorPolicyScope`;
- `responsibility-graph.ts` consumes `ConnectorPolicyScope`;
- `connector-trust-policy.ts` directly consumes `agent-profiles.ts` and `context-engine.ts`.

Leaving this file in Integrations would create an Agents → Integrations → Agents dependency cycle. The policy is the host-owned bounded tool/execution trust contract used by Responsibility Runs/Graph, so Agents is the cohesive owner.

This correction removes `connector-trust-policy.ts` from Phase 4 (#1305).

## 2. `specialist-labs.ts` belongs with Projects

Baseline assignment:

`lib/projects/specialist-labs.ts` → Agents

Corrected assignment:

`lib/projects/specialist-labs.ts` → `lib/projects/specialist-labs.ts` in Phase 3 (#1304)

Reason:

- it imports/clones `PlotPickleProject`;
- it applies specialist suggestions by transforming project state;
- it attaches project documents to canon/provenance structures;
- its UI surface distributes lab capabilities across PLAN, Storyboard, Refine and Feedback rather than representing Agent runtime infrastructure.

Moving it into Agents would force project/canon workflow behavior into the Agent execution domain.

## Accounting

The two corrections swap ownership between existing library-domain files, so the baseline totals remain unchanged:

- 88 library-domain files;
- 50 product-feature/workflow files leaving generic `lib/` later;
- 4 legacy/reference files.

## Corrected Phase 1 slice

`lib/agents/` receives exactly these ten implementations, split below the eight-file fan-out limit:

- `context/adaptive-context-strategies.ts`
- `context/adaptive-context-strategy-core.mjs`
- `agent-orchestration.ts`
- `agent-profiles.ts`
- `agent-window-status.mjs`
- `context/context-engine.ts`
- `responsibility/connector-trust-policy.ts`
- `responsibility/responsibility-graph.ts`
- `responsibility/responsibility-run-interrupts.ts`
- `responsibility/responsibility-runs.ts`

`specialist-labs.ts` remains at its current path until the Projects phase.

## Compatibility bridge policy

Phase 1 may retain narrow root-path forwarding files for consumers that are deliberately migrated later. Each bridge must contain no behavior and only re-export the canonical `lib/agents/` implementation. Phase 8 (#1309) removes all such bridges after every domain/product-owner slice has been migrated.

No bridge is an ownership exception: the implementation authority is `lib/agents/` after Phase 1.
