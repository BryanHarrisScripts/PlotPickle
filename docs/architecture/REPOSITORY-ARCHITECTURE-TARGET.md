# PlotPickle Repository Architecture Target

Ratified by Architecture Phase 0 / issue #1461 on 2026-08-26. Parent epic: #1460.

## Decision

PlotPickle will use **domain-oriented repository consolidation**. The objective is not to flatten the repository or maximize folder count. The objective is to make stable ownership obvious while keeping each domain shallow enough to navigate.

**Inventory before moving.** Phase 0 is documentation, measurement and structural-contract work only. **No production behavior changes** or broad production file moves belong in this phase.

The machine-readable authority for this document is `config/repository-architecture-target.json`. `scripts/repository-architecture-inventory.mjs` expands that contract against the exact checked-out tree and writes `.artifacts/repository-architecture/inventory.json` and `inventory.md` with current counts, fan-out, nesting, planned paths and direct consumers.

## Ownership model

| Domain | Stable responsibility |
| --- | --- |
| AI | AI routing, provider/model readiness and local/cloud compute integration |
| Auth | Human profile, session, CSRF and identity authority boundaries |
| BUZZ | Community transport, Guildhall, BUZZ identity/agents and Story Room integration |
| Story | Story Workflow, Council, Decisions, Workbench and revision-safe coordination |
| Storage | Host-owned persistence, private profile storage and portable project state |
| Projects | Project lifecycle, reference projects and PPF project adapters |
| Startup | Desktop startup, supervised runtime launch and process lifecycle |
| Runtime | Cross-domain local runtime composition and gateway registration |
| Verification | Verification Inbox, Casebook/UAT and deterministic product validation |
| UI | App routes plus private components grouped by product surface |
| Developer | Scripts, developer agents and MCP/Pi/Cline/OpenAI integration |
| Release | GitHub Actions, packaging, security and release CI |
| Shared core | Only contracts with genuine multi-domain ownership |

A file should have one primary owner. Cross-domain access should happen through a stable public contract rather than by duplicating private implementation.

## Current evidence and hotspots

The existing architecture-health audit already measures the major repository surfaces and verifies current runtime ownership boundaries. Phase 0 adds file-level fan-out/depth and consumer evidence rather than replacing that audit.

The current tree has two different structural problems:

1. **Large flat roots.** `build/` is the clearest example: BUZZ gateways, AI routing, profile/session code, project gateways and other runtime concerns sit together at one level. The Phase 0 inventory intentionally records this as evidence, not as a runtime failure.
2. **Mixed legacy and bounded Story ownership.** `modules/story-workflow/` currently has `story-council*.ts`, `buzz-story-bridge.ts` and `foundations-story-workflow.ts` beside the already-bounded `story-decisions/` directory. `core/story-workflow/` similarly has bounded Story Council/Decisions directories plus legacy bridge/runtime entry files.

`lib/` also retains explicit temporary compatibility bridges from the earlier Agents consolidation. Those shims say they are temporary and point to canonical `lib/agents/` implementations; Phase 4 owns consumer retargeting and bridge retirement rather than inventing another forwarding layer.

Generated output, static assets, documentation and issue-indexed verification have different topology needs and are handled through explicit exceptions rather than by weakening the general rule.

## Ratified target tree

Representative filenames stay unchanged during move-only phases unless a separate issue owns a rename.

```text
build/
  ai/
  auth/
  buzz/
  projects/
  runtime/
  startup/
  storage/
  story/
  verification/

core/
  auth/
  project/
  storage/
  story-workflow/
    buzz/
    council/
    decisions/
    runtime/

modules/
  story-workflow/
    bridge/
    council/
    decisions/
    runtime/
    ui/
  <other feature modules stay domain-owned>

app/
  <route directories remain in place so URLs do not change>
  _components/
    community/
    dashboard/
    learn/
    settings/
    story/
    verification/

lib/
  agents/
  buzz/
  projects/
  runtime/
  verification/
  <existing ratified domain directories>
  <root reserved for true shared platform entry points>

scripts/
  developer/
  runtime/
  verification/
  release/
  <public one-off developer commands may remain root entry points>
```

This is an ownership target, not permission to mechanically move every similarly named file. The checked-in target contract defines the first bounded batches and the inventory generator expands each selector to exact current source and target paths.

## Architecture Phase 1 — Build/runtime consolidation

Move the most obvious high-confidence families first:

- `build/buzz-*` → `build/buzz/`;
- AI/provider/runtime-prefixed files (`ai-*`, `comfyui-*`, `deepseek-*`, `ollama-*`, `local-ai-*`, `creative-compute-*`, `hardware-aware-*`, `model-*`) → `build/ai/`;
- `profile-*`, `auth-*`, `server-session-*` → `build/auth/`;
- the Afterglow/project/portable-PPF gateway family → `build/projects/`.

These batches are intentionally narrower than "move all of build". Generic runtime composition remains at the root until a later Phase 1 batch has evidence for its owner.

## Architecture Phase 2 — Story consolidation

Ratify one explainable Story path:

```text
Story Council → Story Decisions → Story Workbench
```

Current bounded Decisions directories remain canonical. The first structural batches are:

- `modules/story-workflow/story-council*.ts` → `modules/story-workflow/council/`;
- `modules/story-workflow/buzz-story-bridge.ts` → `modules/story-workflow/bridge/`;
- `modules/story-workflow/foundations-story-workflow.ts` → `modules/story-workflow/runtime/`;
- legacy root `core/story-workflow/buzz-story-bridge-core.*` → existing `core/story-workflow/buzz/`;
- legacy root `core/story-workflow/story-workflow-core.*` → `core/story-workflow/runtime/`.

PPF/canon authority, revision rules and Human/agent authority do not move with the files; they remain exactly as currently defined.

## Architecture Phase 3 — App/UI consolidation

Next.js route directories are semantic and remain in place. Phase 3 groups **private non-route components**, not routes.

The first exact families are root `community-*` and `dashboard-*` components into:

```text
app/_components/community/
app/_components/dashboard/
```

The same private-component pattern is reserved for Learn, Settings, Story and Verification only when the inventory proves current root components belong there. Visual design, labels and URLs are out of scope.

## Architecture Phase 4 — Core/modules/lib refinement

Phase 4 resolves compatibility and ambiguous shared ownership after the higher-risk runtime/UI moves settle.

The first ratified cleanup is the known Agents compatibility bridge set at `lib/` root. Those files explicitly forward to canonical `lib/agents/` implementations. Phase 4 will retarget remaining consumers to the canonical paths and remove the bridges. It must **not** replace them with another compatibility forest.

True cross-domain platform entry points such as PluginHost/Core Services may stay at `lib/` root when the inventory proves shared ownership.

## Consumer and path-impact evidence

For every declared batch the inventory artifact records, per file:

- exact current source path;
- exact target/canonical path;
- direct source importers resolved from relative and `@/` imports;
- tests, config, workflows, docs or scripts containing an exact hardcoded source path.

The move issue must use that evidence before changing a path. Import/config/test/CI fixes are part of the same structural PR as the move.

## Structural ceilings proposed for Phase 5 enforcement

For governed runtime/source roots (`build`, `core`, `modules`, `lib`), the target defaults are:

- no more than **16 direct source files** in a governed domain root;
- no more than **20 direct child directories** in a governed domain root;
- normally no more than **4 relative directory levels** beneath a governed domain root;
- avoid one-file directories unless they are stable routes, packages, protocols, generated boundaries or documented ownership seams.

These are guardrails, not aesthetics. Phase 5 enforcement must support documented exceptions. `app`, `tests`, `docs`, `public`, `.agents` and `.github` already have explicit semantic reasons not to inherit all generic ceilings mechanically.

The evidence thresholds used to identify current hotspots are deliberately slightly looser than the final target ceilings so the report highlights material pressure rather than every near-limit directory.

## Compatibility bridge policy

A compatibility bridge is allowed only when all of the following are recorded:

1. canonical target path;
2. consumers that still require the old path;
3. owning architecture phase;
4. explicit removal phase.

The Agents root shims are the current example and are assigned to Phase 4 retirement.

## Sequence and merge-conflict policy

Use this order:

```text
Phase 0 inventory/ratification
→ Phase 1 build/runtime
→ Phase 2 story
→ Phase 3 app private components
→ Phase 4 shared/core refinement
→ Phase 5 enforcement
```

Within a phase, move the smallest coherent high-confidence batch first. Avoid moving a file being actively changed by a product PR; defer that batch rather than forcing a broad rebase. Structural work may update import/config/test paths but should not opportunistically edit feature behavior.

Every structural PR follows:

```text
exact main
→ dependency/consumer map
→ move-only change
→ import/config/test updates
→ focused deterministic tests
→ BEN
→ production build
→ required CI
→ exact-head green
→ merge
```

## Exit gate for #1461

Phase 0 is complete when the generated inventory and this target map agree, every declared Phase 1–4 batch expands deterministically with consumer evidence, structural ceilings/exceptions are explicit, focused inventory tests pass, production build passes, required exact-head CI is green, and no production behavior has changed.
