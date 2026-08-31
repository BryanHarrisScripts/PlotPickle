# Autonomous Application Lifecycle Reference

## Purpose

This is the final application-process lifecycle proof for #1553 after the browser/MCP restart proof merged in #1559 and the real application restart controller merged through #1561.

The existing route runner proves that canonical visual surfaces can be reopened through a fresh Playwright MCP process using one persistent browser profile. The reference controller additionally owns the PlotPickle application process, verifies that process actually exits, starts a new process on the same loopback endpoint, reruns the existing autonomous route proof, and compares bounded canonical project/revision/state signatures across the application-process boundary.

The reference command also creates or reuses its deterministic Afterglow v9 working copy through the normal Library UI. It selects the packaged immutable Afterglow example through `Load & Explore`, confirms `Save & Switch`, and then verifies the resulting active Library project before route execution begins. No Human preload step or direct storage mutation is required.

## Reference command

```text
node scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs
```

Optional `--route-inputs <path>` remains available when a run has earned dynamic route inputs such as a Story Decision identifier. Missing dynamic inputs must remain truthful prerequisite skips rather than fabricated state.

The controller starts PlotPickle through the repository-local Vite entry on the configured loopback acceptance URL. It does not use `Start-PlotPickle.bat` because the reference run must remain cross-platform for CI/developer verification; the Windows launcher and installer continue to own normal Windows startup.

## Working-copy boundary

Before the route proof starts, the reference command must prove:

1. the packaged source catalog item is `afterglow-v9`;
2. the source remains immutable;
3. the working copy was created or reused through the normal Library UI;
4. the active Library card exposes a concrete working-copy project id;
5. no browser-storage, database, PPF or fixture shortcut was used by the reference controller.

## Lifecycle boundary

The reference controller requires all of the following before it can claim application restart:

1. the first PlotPickle child process became reachable;
2. that child process exited;
3. the loopback endpoint became unavailable after exit;
4. a second PlotPickle child process became reachable on the same endpoint;
5. the second process has a new bounded process identity;
6. the existing autonomous route runner succeeds before and after the restart;
7. at least two canonical visual surfaces can be compared;
8. at least one compared surface exposes both canonical project identity and PPF revision;
9. the bounded canonical surface signatures match after restart.

The final evidence boundary is named:

`managed-plotpickle-application-process-plus-fresh-playwright-mcp`

## Safety and authority boundaries

The reference controller does not:

- write PPF directly;
- mutate browser storage directly;
- mutate a database or test fixture;
- claim authenticated Human authority;
- persist hidden reasoning or model output;
- silently enable cloud or paid providers.

It owns only the local application child process and browser-driving reference harness; actual project creation occurs through Library and product-route verification remains delegated to the existing autonomous route runner.

## Verification

`tests/issue-1553-application-lifecycle.test.mjs` verifies the process lifecycle independently with a real child HTTP process. It proves the first process exits, the endpoint becomes unavailable, a new process takes ownership of the endpoint, and the new process receives a distinct bounded process identity.

`tests/issue-1553-afterglow-reference-bootstrap.test.mjs` verifies that the reference run uses Library `Load & Explore -> Save & Switch`, recognizes the immutable Afterglow source, and contains no direct project/storage mutation path.

`.github/workflows/autonomous-story-reference.yml` executes the real one-command Afterglow reference on an exact pull-request head and uploads bounded evidence even when the run finds a truthful blocker.

## Closure truth condition

#1553 should close only when the real exact-head reference workflow succeeds together with BEN, production build and the required PlotPickle CI. A contract-only pass must not be presented as a completed story reference run. Any route that cannot operate because a real prerequisite is absent must be reported as such rather than manufactured for the test.
