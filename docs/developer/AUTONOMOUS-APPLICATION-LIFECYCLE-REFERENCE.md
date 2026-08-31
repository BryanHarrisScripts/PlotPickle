# Autonomous Application Lifecycle Reference

## Purpose

This is the final application-process lifecycle slice for #1553 after the browser/MCP restart proof merged in #1559.

The existing route runner already proves that canonical visual surfaces can be reopened through a fresh Playwright MCP process using one persistent browser profile. That proof deliberately reported `applicationProcessRestarted: false` because the PlotPickle application server itself remained alive.

This slice adds a one-command reference controller that owns the local PlotPickle application process, verifies that process actually exits, starts a new process on the same loopback endpoint, reruns the existing autonomous route proof, and compares the same bounded canonical project/revision/state signatures across the application-process boundary.

## Reference command

```text
node scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs --route-inputs <path-to-run-inputs.json>
```

The controller starts PlotPickle through the repository-local Vite entry on the configured loopback acceptance URL. It does not use `Start-PlotPickle.bat` because the reference run must remain cross-platform for CI/developer verification; the Windows launcher and installer continue to own normal Windows startup.

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

The lifecycle controller does not:

- write PPF;
- mutate browser storage directly;
- mutate a database or test fixture;
- claim authenticated Human authority;
- persist hidden reasoning or model output;
- silently enable cloud or paid providers.

It only owns the local application child process and delegates product-route verification to the already merged autonomous route runner.

## Deterministic verification

`tests/issue-1553-application-lifecycle.test.mjs` verifies the process lifecycle independently with a real child HTTP process. The test proves the first process exits, the endpoint becomes unavailable, a new process takes ownership of the endpoint, and the new process receives a distinct bounded process identity.

The same test also source-checks the real reference controller for the expected Vite, route-runner, fresh-MCP, and no-direct-state-mutation boundaries.

## Remaining truth condition

This slice makes the full application lifecycle proof executable. Closing #1553 still requires the reference command to be run against the deterministic Afterglow working-copy inputs with exact-head tests, BEN, production build, and required CI green. A contract-only pass must not be presented as a completed story reference run.
