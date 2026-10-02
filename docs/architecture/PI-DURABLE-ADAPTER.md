# Pi Durable adapter decision

Issue #2672 prototypes `@earendil-works/pi-durable@1.0.0` behind a PlotPickle-owned durable-execution contract.

## Boundary

`PlotPickle UI → DSDD governance → PlotPickle durable-execution contract → PiDurableAdapter → Pi Durable`

DSDD remains the authority for Human intent, deterministic requirements, convergence, repository mutation policy, PR/exact-head checkpoints, and merge eligibility. Pi Durable is an execution substrate only.

No product surface imports Pi Durable. The package is loaded dynamically inside `core/sidecars/pi-durable-adapter.mjs` only when the optional adapter is explicitly constructed.

## Upstream facts reviewed

The upstream 1.0.0 package identifies itself as a durable conversation/task/document runtime and exposes persistent JSONL/SQLite storage, resumable Harness tasks, request IDs for duplicate-submission protection, per-conversation agent configuration, task ownership, abort, task graphs, and replay classification for tools.

Its package manifest declares Node `>=22.19.0`.

PlotPickle currently has CI workflows pinned to Node 22.13.0, so the Pi Durable adapter must remain **disabled by default** until PlotPickle deliberately promotes its supported Node floor and completes the Windows proof.

## Replay safety

PlotPickle classifies every durable task before handing it to the runtime:

- `safe`: interruption may resume using the same durable request identity.
- `non-replayable`: interruption requires explicit Human re-authorization before execution can continue.

Pi Durable's own replay facilities do not get to weaken this classification.

## Capability isolation

A task carries an explicit list of extensions and tools. The native driver resolves only those names supplied by the host. It does not expose an unrestricted shell, browser profile, provider credential store, or remote-control endpoint by default.

Each PlotPickle task receives its own durable storage directory/root conversation in the prototype. This gives deterministic state isolation between concurrent tasks and a simple restart boundary.

## Windows/runtime feasibility

Prototype status: **feasible with a runtime-baseline upgrade**.

Requirements before enabling on Windows:

1. Node >= 22.19.0 on the supported PlotPickle developer/runtime path.
2. Exact `@earendil-works/pi-durable@1.0.0` package proof in an isolated install.
3. JSONL crash/reopen/resume proof on Windows.
4. Controlled interruption of a replay-safe task and successful resume.
5. Controlled interruption of a non-replayable task and proof that it does not silently rerun.
6. Two simultaneous task stores proving conversation/task isolation.
7. No Human browser profile or provider credential reuse without explicit host configuration.
8. No change to DSDD or exact-head CI authority.

## Decision

**Continue as an optional adapter, disabled by default.**

The architecture is valuable and the adapter seam is now present, but PlotPickle should not promote Pi Durable into the default development path until the Node baseline and Windows resilience proof are deliberately green. The disabled adapter keeps normal PlotPickle startup and deterministic verification independent of Pi Durable.

Even after promotion, the adapter seam remains mandatory so Pi Durable can be upgraded, replaced, or disabled without changing DSDD contracts.
