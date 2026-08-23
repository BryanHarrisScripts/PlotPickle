# PlotPickle `lib/` Domain Inventory and Naming Contract

Issue: #1301  
Parent: #1287  
Inventory baseline: `main` at `1461fba8583a1d1be6b9c95f25816c0e07ddebd3`  
Date: 2026-08-23

## Purpose

Freeze the current `lib/` ownership map before any production file is moved.

This is Phase 0 analysis only. It does not authorize a behavior change, framework, service layer, product redesign, identity change, provider change, or speculative abstraction.

The machine-readable file map is:

`docs/architecture/lib-domain-inventory-2026-08-23.csv`

## Accounting

The baseline contains exactly **142** files under `lib/`:

- **88** remain in reorganized library domains;
- **50** are product-feature/workflow files that should leave generic `lib/` ownership;
- **4** Afterglow legacy/reference files require an evidence-backed disposition in Phase 8.

Every baseline file appears exactly once in the CSV map.

## Target library shape

```text
lib/
  agents/
  buzz/
  projects/
  integrations/
  runtime/
    ai/
  verification/
  platform/
```

`lib/platform/` is deliberately exceptional and tiny. The current candidates are only `core-services.ts` and `plugin-platform.ts`. If migration evidence establishes a more specific owner, they should move there instead. This directory must never become a synonym for `shared`, `common`, or `utils`.

## Naming contract

1. Directory names and filenames use lowercase kebab-case.
2. Directory names communicate product/domain ownership.
3. Filenames communicate responsibility.
4. Preserve useful semantic prefixes such as `agent-*`, `buzz-*`, `project-*`, and `github-*` when they improve repository-wide search and stack-trace discoverability.
5. Stable suffix meanings where appropriate:
   - `*-contracts` — data/API contract;
   - `*-registry` — registered items;
   - `*-policy` — rules or permissions;
   - `*-runtime` — runtime execution;
   - `*-gateway` — external/system boundary;
   - `*-adapter` — interface translation;
   - `*-store` — persistence/state store;
   - `*-model` — domain model;
   - `*-status` — readiness/status;
   - `*-audit` — deterministic inspection;
   - `*-uat` — UAT-specific behavior.
6. Do not create catch-all `utils`, `helpers`, `common`, `misc`, `stuff`, or generic `core` directories.
7. The Phase 0 default naming action is **preserve**. Do not rename files during the migration merely for aesthetics.
8. Prefer direct imports. `index.ts` is allowed only as a small intentional public entrypoint, never as a broad re-export barrel.
9. Product workflow code belongs with its product owner rather than in a new `lib/<feature>/` directory.
10. A proposed target path does not authorize new framework behavior. The owning migration phase must verify that the target remains the correct product owner before moving the file.

## Consumer-class legend

The CSV uses a compact consumer class so the complete map stays diffable.

- `A` — Agents: LEARN roster, startup diagnostics, Agent UI, Agent/BUZZ gateways, provisioning/UAT/tests.
- `B` — BUZZ: BUZZ settings/profile routes, BUZZ gateways, PlotPicklePlayhouse consumers, tests.
- `P` — Projects: app workspaces, project/build/collaboration/GitHub gateways, modules, tests.
- `I` — Integrations: settings/collaboration UI, connector/GitHub gateways, tests.
- `R` — Runtime: provider setup, LEARN AI routing, build/runtime consumers, tests.
- `V` — Verification: UAT scripts, repair/developer tooling, docs and tests.
- `X` — Platform: cross-domain plugin/project service consumers and tests.
- `FB` — Build product feature.
- `FD` — Dashboard product feature.
- `FP` — PLAN product feature.
- `FL` — LEARN product feature.
- `FC` — Creative Room product feature.
- `FW` — Write/Edit/Reports screenplay workflow.
- `FG` — Graphic Novel product feature.
- `FV` — Build visual-development workflow.
- `FF` — Feedback/Reports product feature.
- `FQ` — Build/Pitch feature.
- `FS` — application shell/navigation.
- `L` — legacy/reference; exact live consumers must be proven before final disposition.

Representative consumer classes are not a claim that every import has already been exhaustively rewritten. Before each migration PR merges, it must perform a repository-wide search for the old path and leave no stale consumer unless a temporary compatibility bridge is explicitly documented.

## Risk-class legend

- `HIGH_AGENT` — broad fan-out; context/responsibility and Agent authority must remain unchanged.
- `HIGH_BUZZ` — Human/Agent/Node signer and Community/room authority boundary.
- `HIGH_PROJECT` — persistence, PPF/canon, project isolation and collaboration consumers.
- `HIGH_INTEGRATION` — connector trust, authorization and GitHub recovery boundary.
- `HIGH_RUNTIME` — provider routing, local/cloud behavior, telemetry and secret boundary.
- `HIGH_VERIFY` — deterministic gates/evidence; production must not depend upward on verification.
- `HIGH_PLATFORM` — cross-domain fan-out; keep tiny and prove no cycle.
- `MED_FEATURE` — product workflow ownership; behavior must remain unchanged during extraction.
- `UNKNOWN_LEGACY` — no deletion or permanent ownership decision until exact consumers are proven.

## Current cross-domain observations

Targeted repository-wide consumer searches on the baseline head establish these important edges:

### Agents

`agent-profiles.ts` is consumed by LEARN roster code, startup Agent diagnostics, Agent portrait/settings surfaces, Agent orchestration/context code, BUZZ Agent gateways, connector trust policy, provisioning scripts, UAT/config and tests.

Implication: Agents is a high-fan-out first migration. A path-only change must preserve Agent profiles, roster meaning, context behavior, responsibility semantics and Human/Agent authority.

### BUZZ

`buzz-default-community.ts` is consumed by BUZZ settings, authenticated profile presentation, BUZZ profile identity gateways and tests.

Implication: the BUZZ move is identity-sensitive. Human identity, official Agent identity/signers, PlotPickle Node/runtime identity and PlotPicklePlayhouse plugin ownership must remain separate.

### Projects / Integrations

`story-project-repository.ts` is consumed by collaboration access, GitHub app/review/project-sync/recovery gateways, app collaboration surfaces and tests.

`github-collaboration.ts` is consumed by app GitHub collaboration/project-sync/settings surfaces and collaboration tests.

Implication: Projects owns canonical project/repository contracts; Integrations owns the external GitHub/trust boundary. Correct the import direction rather than duplicating project state or inventing a service layer.

### Integrations / Agents

`connector-trust-policy.ts` is consumed by Agent activity/settings and connector/plugin build gateways and itself touches Agent profile concepts.

Implication: Integrations may consume bounded Agent identity/profile contracts where current trust behavior requires it, but must not become Agent identity authority.

### Runtime

`ai/providers.ts` is consumed by provider setup UI, LEARN AI provider routing and tests.

Implication: Runtime remains beneath product surfaces. Product UI/modules may consume Runtime; Runtime must not import upward into product feature code merely to preserve a path.

### Verification

`uat-autopilot.mjs` is consumed by UAT runners, closed-loop/semantic repair tooling, developer-agent MCP integration, docs and tests.

Implication: Verification may observe and evaluate production behavior. Production code must not depend upward on Verification.

### Feature ownership evidence

Current app surfaces establish clear owners for the main feature groups:

- Graphic Novel → `app/graphic-novel-studio-host.tsx`, queue/viewer surfaces and tests;
- Write/Edit screenplay workflow → `app/script-workspace.tsx` and review surfaces;
- Feedback/Reports → `app/feedback-workspace.tsx`, review panels, Writers Room/Build consumers;
- Pitch → `app/ai-pitch-deck-workspace.tsx`;
- visual development → creative-direction/storyboard surfaces and visual-writer UAT;
- product direction/navigation → application shell, settings, welcome/about surfaces.

The CSV proposes coherent `modules/` targets for non-React workflow logic rather than moving it into the Next.js `app/` root by default. Phase 7 must confirm the named owner immediately before the move. This is reuse of the existing modules architecture, not a new module framework.

## Dependency direction contract

The migration should make these relationships explicit and acyclic:

- `app/`, `modules/`, `build/`, `plugins/`, and `scripts/` may consume library-domain contracts.
- `lib/projects/` is foundational project/canon state. It must not depend upward on product UI/workflow code, BUZZ publication, or Verification.
- `lib/runtime/` must not depend on product features or Verification.
- `lib/agents/` may consume bounded Projects/Runtime contracts required by current behavior; it must not gain project/canon authority.
- `lib/buzz/` may consume Agent profile/identity contracts required by current Community behavior; it must not merge Human, Agent or Node authority.
- `lib/integrations/` may consume bounded Projects/Agents contracts required by current trust/collaboration behavior; it must not become project or identity authority.
- `lib/verification/` may observe/execute production contracts; production domains must not depend upward on Verification.
- `lib/platform/` remains exceptional and tiny. Any cross-domain dependency involving it must be reviewed for cycles rather than treated as automatically valid shared ownership.

## Cycle status

Phase 0 targeted source/consumer inspection has found **cross-domain coupling risks**, but it has not established a specific circular dependency that should be changed in this documentation phase.

Therefore the migration rule is:

1. before each Phase 1–7 PR, inspect the exact mapped slice for reciprocal imports;
2. reject a move that introduces a new cycle;
3. if an existing cycle is proven, record it and correct ownership/import direction in the smallest relevant migration phase;
4. do not invent a service layer merely to conceal a cycle.

No claim of “cycle free” should be made until the exact post-migration dependency check runs.

## Product-feature extraction targets

The CSV intentionally distinguishes library contracts from product workflow behavior.

Existing owners are reused directly where already present:

- Build → `modules/build/`
- Dashboard → `modules/dashboard/`
- PLAN → `modules/plan/`
- LEARN → `modules/learn/`
- Creative Room → `modules/creative-room/`

For cohesive product surfaces that currently lack a module directory, the proposed Phase 7 targets are:

- Write workflow → `modules/write/`
- Edit workflow → `modules/edit/`
- Reports workflow → `modules/reports/`
- Graphic Novel → `modules/graphic-novel/`
- Feedback → `modules/feedback/`
- Build visual development → `modules/build/visual-development/`
- Pitch → `modules/build/pitch/`

Application-shell contracts `product-direction.ts` and `support-navigation.ts` are proposed to co-locate with the application shell under `app/` because their current consumers are application-shell/navigation surfaces.

These target paths are structural ownership proposals only. Phase 7 may adjust a physical path if exact dependency inspection demonstrates a better existing owner; any change must retain the same product ownership intent and be recorded against #1301/#1308.

## Legacy/reference contract

The following files are explicitly **not** a new permanent Afterglow domain:

- `afterglow-example.ts`
- `afterglow-legacy-visuals.ts`
- `afterglow-persistence.ts`
- `afterglow-reference-ppf.ts`

Phase 8 must prove exactly one disposition for each:

1. runtime-required → move to the actual owner and keep tested;
2. fixture/reference-only → move to the appropriate fixture/reference area;
3. obsolete/unconsumed → delete only with repository-wide consumer and test evidence.

## Migration gates derived from this map

Every production migration slice follows:

```text
review mapped slice
→ inspect exact dependencies/reciprocal imports
→ move only the mapped files
→ update all consumers
→ search repository-wide for old paths
→ run focused tests
→ run BEN
→ run production build
→ verify no new cycle
→ fix concrete migration regressions
→ rerun exact head
→ merge only green
```

Temporary compatibility re-exports are a last resort. If a phase requires one, it must be explicitly marked and removed by Phase 8.

## Phase 0 completion checklist

- [x] Every current `lib/` file appears exactly once in the inventory.
- [x] 88 library-domain files have an explicit target owner/path.
- [x] 50 product-feature files have an explicit product owner and proposed target path.
- [x] 4 legacy/reference files are isolated for evidence-backed Phase 8 disposition.
- [x] Naming contract is documented and unambiguous.
- [x] Generic catch-all directories are rejected.
- [x] Representative consumers and high-risk cross-domain edges are documented.
- [x] Current coupling/cycle-risk areas are documented without making an unsupported cycle-free claim.
- [x] No production source file has moved, been renamed, refactored or deleted.
- [ ] Documentation/CI is green on the exact Phase 0 PR head.

When the final item is green and merged, Phase 1 (#1302 Agents) may begin. Do not begin multiple migration domains in parallel.
