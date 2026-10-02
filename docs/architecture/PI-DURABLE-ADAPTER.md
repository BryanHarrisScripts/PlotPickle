# Pi Durable adapter decision

Issue #2672 prototypes `@earendil-works/pi-durable@1.0.0` behind a PlotPickle-owned durable-execution contract.

## Boundary

`PlotPickle UI → DSDD governance → PlotPickle durable-execution contract → PiDurableAdapter → Pi Durable`

DSDD remains the authority for Human intent, deterministic requirements, convergence, repository mutation policy, PR/exact-head checkpoints, and merge eligibility. Pi Durable is an execution substrate only.

No product surface imports Pi Durable. The package is loaded dynamically inside `core/sidecars/pi-durable-adapter.mjs` only when the optional adapter is explicitly constructed.

## Upstream facts reviewed

The upstream 1.0.0 package identifies itself as a durable conversation/task/document runtime and exposes persistent JSONL/SQLite storage, resumable Harness tasks, request IDs for duplicate-submission protection, per-conversation agent configuration, task ownership, abort, task graphs, and replay classification for tools.

Its package manifest declares Node `>=22.19.0`.

The initial #2672 prototype was held disabled by default while Windows recovery/isolation proof was established. #2696 promotes the reviewed runtime on hosts that satisfy Pi Durable's Node >=22.19.0 requirement; older otherwise-supported PlotPickle hosts keep the core product available while the Pi Durable sidecar reports degraded.

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

**Active by default on supported hosts, with a non-blocking degraded fallback.**

The Windows recovery/isolation proof established in #2672 is retained as the promotion gate. #2696 makes the exact reviewed Pi Durable 1.0.0 runtime start asynchronously after core readiness when Node >=22.19.0 is available. Failure to install or initialize Pi Durable cannot prevent normal PlotPickle or deterministic verification from running.

The adapter seam remains mandatory so Pi Durable can be upgraded, replaced, or disabled without changing DSDD contracts.


## Runtime promotion — #2696

Pi Durable is now **active by default on supported hosts** behind the same PlotPickle-owned adapter and sidecar boundary.

Normal startup remains product-first: PlotPickle core becomes usable first, then the Pi Durable sidecar asynchronously verifies or prepares the exact reviewed `@earendil-works/pi-durable@1.0.0` managed runtime under PlotPickle local app data and opens persistent JSONL state.

Startup initialization performs **zero model/provider requests**. Model/provider work begins only after a governed task is explicitly submitted through PlotPickle policy.

Hosts below Node 22.19 remain core-compatible where otherwise supported, but Pi Durable reports degraded rather than blocking PlotPickle. On Node 22.19 or newer, the reviewed runtime is expected to converge to ready. The Windows Product Gate remains the proof for crash/reopen recovery, isolation and authority boundaries.

This promotion does not change authority: DSDD owns convergence, Human approval remains authoritative, Pi cannot approve canon or merge code, and non-replayable interrupted work still requires fresh Human authorization.
