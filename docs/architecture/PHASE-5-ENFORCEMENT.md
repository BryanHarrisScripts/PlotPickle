# Architecture Phase 5 enforcement

Issue #1466 turns the Phase 0 architecture map into a deterministic ratchet. It does not redesign PlotPickle and it does not force a large move merely to make a directory count look neat.

The machine-readable policy is `config/repository-architecture-enforcement.json`. The deterministic gate is `scripts/developer-diagnostics/architecture/repository-architecture-enforcement.mjs`.

## Enforced rule

`core/` and `modules/` already satisfy the ratified direct-source ceiling, so they use the Phase 0 ceiling immediately. `build/` and `lib/` still contain measured migration residue, so their current debt is ratcheted: it may shrink but may not grow. No new direct source file may be added to any governed root; new implementation belongs under the owning domain directory.

The same gate enforces the ratified child-directory and practical-depth ceilings. Changed source files are also checked for the first high-confidence dependency-direction rules: `core` cannot depend on `app`, `build` or `modules`, and `modules` cannot depend on `app`.

## Transition-debt evidence

The exact pre-Phase-5 inventory at `215973e5b9dd680f62552bc81392edea4cde7d7e` measured 126 direct source files in `lib/` and 84 in `build/`. Phase 5 removed 16 explicit temporary root compatibility re-exports only after repository search showed zero active consumers. Canonical implementations remain in their owning domain paths. The `lib/` ratchet therefore starts at 110, while the `build/` ratchet remains 84 pending the already-ratified BUZZ/AI move batches.

Surviving pre-Phase-5 compatibility bridges are legacy transition debt rather than a reason for a big-bang migration. On pull requests the gate compares temporary bridge paths with the exact base commit: existing bridge paths may disappear, but a new bridge path fails. This keeps the debt moving in one direction without forcing live consumers to move merely to make Phase 5 green.

`lib/pageflow.ts` is intentionally not deleted yet. Two active routes still import it. Its canonical target, live consumers, owning issue and removal condition are recorded in the enforcement policy; the gate will fail if that consumer-level exception becomes stale instead of letting the shim remain forever.

## Where new code belongs

- `app/`: Next.js routes and app composition; private UI components should use the existing `_components/<surface>/` ownership pattern.
- `core/`: durable contracts, authority and shared inward-facing foundations. Core must not depend on app or feature/runtime implementations.
- `modules/`: product-domain implementations such as LEARN, PLAN and BUILD; modules may depend inward on core, not outward on the app shell.
- `build/`: runtime gateways and host-side implementations grouped beneath the existing domain directories such as `build/ai/`, `build/auth/`, `build/buzz/`, `build/projects/` and `build/story/`.
- `lib/`: shared runtime/domain implementation grouped beneath the existing owning domains such as `lib/agents/`, `lib/buzz/`, `lib/projects/`, `lib/runtime/` and `lib/verification/`. Do not add another generic root helper.
- `scripts/`: stable commands may remain discoverable entry points, but implementation should live under an owning developer/runtime/verification/release or existing specialized directory when practical. Architecture diagnostics live under `scripts/developer-diagnostics/architecture/` rather than increasing the flat diagnostics fan-out.

A new compatibility bridge is not an accepted migration shortcut. Existing temporary bridges remain visible transition debt and should be retired when their final consumer moves; any separately tracked exception must identify its canonical target, current consumers, owner and removal condition.

## Authority and self-support

Architecture enforcement is deterministic evidence, not an AI judge. Pi, BEN, diagnostics, Agent Skills and UAT/repair machinery may consume this evidence as part of PlotPickle's bounded self-support system, but they do not gain authority to admit durable knowledge, mutate source, install or activate skills, or increase their own operational authority. Those decisions remain harness-governed.
