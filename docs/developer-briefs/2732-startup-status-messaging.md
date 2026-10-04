# Developer brief — Issue #2732

## Purpose

Make normal PlotPickle startup and closeout messaging truthful and calm without hiding real failures.

The October 4 normal launcher proof showed a healthy lifecycle: core PlotPickle became ready, six registered modular services converged afterward, the optional media renderer remained non-blocking, and shutdown stopped the owned services and app window cleanly. The console presentation nevertheless made the healthy run look broken because registered-but-not-yet-started services were initially reported as `unavailable`, and the optional media service used the generic `degraded` wording without enough context.

## Required behavior

1. A registered sidecar that has not been started yet is `waiting`, not `unavailable`.
2. Before core readiness the supervisor emits one concise summary that registered services are waiting, rather than six false unavailable lines.
3. `unavailable` remains reserved for an actual missing/disabled/unusable runtime after launch is evaluated.
4. Once core PlotPickle is ready, sidecars still start asynchronously and report their real states.
5. Media Runtime may remain internally `degraded` when the optional renderer is absent, but its Human-facing console message must say the renderer is optional and that core PlotPickle plus Flip Book, Graphic Novel and WebP remain available.
6. Real supervisor startup errors, missing entrypoints, warnings and failures remain visible.
7. Existing clean shutdown truth remains unchanged: the launcher must continue to confirm saved session, managed-service shutdown and owned-window closure only after those actions complete.
8. Keep normal Human startup concise. READY/SUCCESS and actionable warnings should visually outrank routine compatibility chatter.

## Scope

- `core/sidecars/contract.ts`
- `core/sidecars/local-supervisor.ts`
- `scripts/runtime-sidecar-supervisor.mjs`
- `scripts/sidecars/media-runtime-service.mjs`
- `Start-PlotPickle.bat`
- focused regression/catalog/convergence evidence

No provider, Agent, canon, media-generation, browser-profile or shutdown authority changes are permitted.

## Acceptance

- The initial runtime status document contains `waiting` for registered services before core readiness.
- Normal startup does not print `unavailable` for services that merely have not started yet.
- A genuinely missing registered entrypoint still becomes and prints `unavailable`.
- Optional Media Runtime output explicitly distinguishes optional renderer readiness from core application readiness.
- Existing real failure output remains present.
- Existing shutdown success confirmation remains present.
- Focused regressions, seven-layer Architecture Verification and the exact-head modular-runtime Windows proof pass before merge.
