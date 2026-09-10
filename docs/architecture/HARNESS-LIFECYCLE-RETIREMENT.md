# Harness lifecycle transition retirement

Issue #1651 removes lifecycle transition debt only after the canonical #1644 path and the autonomous #1649 reference prove the replacement. This document records bounded retirements and the exceptions that intentionally remain.

## Responsibility compatibility bridge retirement

The first retirement group is limited to four Phase 1 root re-export shims whose canonical implementations already live under `lib/agents/responsibility/`.

Before #1651:

- `lib/responsibility-runs.ts` re-exported `lib/agents/responsibility/responsibility-runs.ts`.
- `lib/responsibility-graph.ts` re-exported `lib/agents/responsibility/responsibility-graph.ts`.
- `lib/responsibility-run-interrupts.ts` re-exported `lib/agents/responsibility/responsibility-run-interrupts.ts`.
- `lib/connector-trust-policy.ts` re-exported `lib/agents/responsibility/connector-trust-policy.ts`.

Repository search found three active runtime consumers of the Responsibility Run bridge: `app/responsibility-run-activity.tsx`, `build/run-telemetry-gateway.ts`, and `build/responsibility-run-gateway.ts`. The gateway also consumed the connector-policy bridge. The Responsibility Graph and interrupt bridges had no runtime consumers; their remaining references were CI path filters. The BUZZ orchestration and Agent Skill trust path filters also still named the old root shims.

After #1651 G1:

- all three runtime consumers import their existing contracts directly from `lib/agents/responsibility/`;
- the two affected workflow path filters follow the canonical owner paths;
- all four root compatibility shims are deleted;
- no Responsibility Run, Graph, interrupt, connector-policy, persistence, validation or continuation implementation changes;
- no new lifecycle state owner, status database or orchestration route is introduced.

The architecture enforcement gate already compares temporary bridges with the exact PR base commit, so its evidence records these paths as retired and rejects any newly introduced temporary bridge. Direct source additions to `lib/` remain forbidden, preventing the deleted root shims from being recreated under a different name merely to bypass ownership.

## Canonical lifecycle versus domain lifecycle

Responsibility Runs retain their existing bounded domain states such as `working`, `verifying`, `waiting-for-writer`, `paused` and `completed`. Those states remain useful implementation truth for the Responsibility subsystem. They are not promoted into a second PlotPickle-wide lifecycle contract.

PlotPickle-wide lifecycle truth remains the seven-stage envelope in `core/lifecycle/lifecycle-contract.mjs`, with authority in `core/lifecycle/lifecycle-authority.mjs`, validation/repair projection in `core/lifecycle/lifecycle-validation.mjs`, and plain-language presentation in `core/lifecycle/lifecycle-presentation.mjs`.

## Exceptions that remain

This slice does not remove unrelated compatibility bridges. In particular, `lib/pageflow.ts` remains the explicitly governed consumer-level exception in `config/repository-architecture-enforcement.json` until its two route consumers are migrated under its existing removal condition. Project-domain Phase 8 bridges are also outside this bounded Responsibility cleanup.

A later #1651 group may retire another route or status transition only after consumer search proves its replacement, authority, persistence, validation and continuation behavior. Aesthetic duplication alone is not a removal reason.
