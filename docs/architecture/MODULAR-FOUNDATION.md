# PlotPickle modular foundation

Status: accepted foundation for the architecture reset.

## Product entry

PlotPickle opens directly into LEARN. The permanent workspace has three columns:

1. Left: curriculum only.
2. Centre: the active lesson.
3. Right: a persistent Creative Room conversation with an agent grounded in the complete PlotPickle curriculum.

A new installation opens empty. It does not load, import, or bundle a sample story.

## Shape

PlotPickle is a modular monolith: one repository, one distributable application, and independently owned feature modules.

```
app shell
  -> core contracts
  -> core project, storage, events, providers and jobs
  -> feature modules
  -> external adapters
```

Dependencies only point downward. Modules may use public core contracts. They may not import another module's internal files. Provider-specific code belongs in adapters, never in LEARN or Creative Room.

## Canonical project

One PPF project is the source of truth. LEARN and Creative Room issue typed commands against that project rather than keeping private copies. Commands are pure, reviewable and revisioned. Storage uses optimistic revision checks so stale saves cannot silently overwrite newer work.

## Initial vertical slice

The first complete slice contains only:

- the application shell;
- an empty PPF project;
- project storage;
- LEARN;
- the persistent Creative Room;
- one interaction that opens or completes a lesson and persists the result.

The curriculum remains source content. The Creative Room may retrieve relevant curriculum material, but it cannot change story canon without an explicit approved command.

## Module contract

Every feature module declares:

- a stable id and version;
- its route;
- the capabilities it provides;
- the project data it owns;
- explicit dependencies;
- focused tests.

New feature work belongs in `modules/<name>`. Shared behavior moves into `core` only after at least two modules need the same stable contract.

## Speed contract

- `npm test` runs the focused foundation checks.
- `npm run test:full` retains the historical suite during migration.
- Module tests do not build the entire application.
- Full build, packaging and platform checks run only at release boundaries.
- Workspaces and curriculum content load lazily.
- No module owns a duplicate copy of project state.
- No feature may add an unbounded polling loop or whole-project rerender.

## Legacy boundary

Existing application code remains available as migration source, but it is not the architecture for new work. It should not receive new cross-feature dependencies. Each useful capability moves behind a core contract or into a module before being reintroduced.

## Global coherence without global mutable state

PlotPickle is globally coherent because it uses shared contracts, ownership rules and policy. That does not permit process-global mutable Human, Project, Agent, provider, BUZZ signer or future Memory authority.

The invariant is:

```text
shared executable / runtime / immutable registry
  !=
shared Human or project state
```

Human, Project, Agent, Node, BUZZ and future Memory state stays explicitly scoped through its canonical host-owned authority.

## Current ownership map

This map records current owners; it does not create another service registry.

| Concern | Canonical owner / boundary |
| --- | --- |
| Application composition | `app/` plus the modular LEARN workspace |
| Public module/domain contracts | `core/contracts/` and existing canonical host contracts |
| Project / PPF / canon | host-owned project/PPF services; PPF remains canonical creative truth |
| Auth / Human profile | authenticated Profile/Auth services and profile-private storage |
| BUZZ Community/social state | BUZZ-native social contracts consumed through PlotPickle Community adapters |
| BUZZ local coordination/evidence | local BUZZ coordination contract; transport is not project authority |
| PluginHost / Core Services | `lib/plugin-platform.ts` and `lib/core-services.ts` |
| Agent roles | host-owned Agent Profiles/runtime registrations |
| Agent Skills | `config/agent-skills.json` plus `.agents/skills/*`; Skills provide procedure, not authority |
| Context / RAG | host-owned Context Engine and bounded evidence assembly |
| Semantic agent execution | the #1218 host-owned semantic execution contract |
| Provider integration | provider/runtime adapters behind host-owned routing and consent |
| Runtime lifecycle | `config/runtime-manifest.json` and the PlotPickle Runtime Supervisor |
| Developer Harness | bounded developer capability/router/worktree contracts; worker output is not PASS authority |
| MCP | `.mcp.json` -> `scripts/developer-agent-mcp.mjs`; MCP is an interoperability surface, not a second runtime |
| Deterministic engineering authority | focused tests, BEN, production build, UAT and Full Verification |

## Architecture health / anti-bloat rule

Repository size, directory count and test count are not defects by themselves. Architecture health work must measure first.

For each suspected bloat or duplication finding:

```text
prove the current owner
  -> prove a real duplication / performance / maintenance cost
  -> remove or consolidate only the duplicate
  -> preserve the public contract
  -> rerun focused regressions
  -> measure again
```

Healthy subsystem default: **leave it alone**.

Do not respond to repository growth by adding another framework, service container, orchestration engine, plugin system, agent system, memory system, MCP layer or directory hierarchy.

`scripts/architecture-health-audit.mjs` is a reproducible audit/measurement tool, not a new PASS authority. It checks current ownership invariants, classifies major directories, reports historical issue-linked command surface separately from production runtime, records optional build-output size when present, and emits evidence under `.artifacts/architecture-health/`. BEN/build/UAT/Full Verification remain release authority.
