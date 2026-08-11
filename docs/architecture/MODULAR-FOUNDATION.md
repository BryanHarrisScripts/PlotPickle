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
