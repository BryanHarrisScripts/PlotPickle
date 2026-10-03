# Story Architect recovery in Outline

Issue #2711; parent #2707. Application adoption of merged worker/controller slices #2712 and #2713.

## Approved behavior and owners

Assess Act starts a protected host task rather than a browser-memory loop. The existing configured provider resolver supplies the Story Architect's quality route without fallback. Elowen's profile capability intersection supplies bounded read/proposal grants. The existing authenticated profile/CSRF boundary protects discovery and mutations; owning profile, approved active project and strong material identity are checked before work and admission. Single-Block assessment remains on its current compatibility path.

An encrypted profile-owned index makes tasks discoverable after reopen. Repeated starts for the same active input, route and ordered Blocks reuse the protected admission. Each task has an isolated native Pi JSONL scheduler; no scheduler opens on discovery, polling or normal startup. Only explicit start/resume activates a transient session lease. Cancellation persists before acknowledgment, aborts the worker and closes the task scheduler. Profile cleanup revokes only that profile's schedulers.

Outline's existing Assessment History shows completed/remaining Blocks and explicit Resume/Cancel controls. Polling imports validated proposal collections with a stable receipt identity, never accepted story material. Input/material validation and the original Block citation/fingerprint contract remain intact. History bookkeeping does not invalidate unchanged material; writer edits do.

## Accounting and limits

The application reuses the controller's crash-safe reservations and responsibility run. Its host limits are 12 attempts, 2,000,000 reserved tokens, $12 reserved cloud cost, a 24-hour elapsed recovery deadline and 12,000 request characters. Each worker call reserves the canonical worker’s upper bound: serialized system/schema plus worst-case six-byte escaping of each of the 12,000 permitted input code units, framing allowance, 1800 output tokens and one Mastra retry. Unknown actual usage stays unknown and never replenishes the reservation.

Local/Ollama routes receive a zero cloud quote only for loopback endpoints. Other routes require an encrypted, host-approved `settings/outline-provider-quote-v1` object containing the exact provider, model, baseUrl, future expiresAt and a positive `maxCostPerAttemptUsd` of at most $1. This is an upper bound for the complete worker call including its retry, not advertised token pricing. There is no browser-supplied quote or implicit free cloud execution. The compute receipt covers provider configuration, quote, grants and a credential-rotation digest without persisting credentials in Pi. Expired/missing quotes fail closed.

A stopped terminal Pi task cannot silently gain a new scheduler identity or budget. The writer can cancel that run and explicitly start a new review. Interrupted nonterminal checkpoints reuse the original scheduler admission and remaining steps; an interrupted uncommitted provider call may be repeated and charged.

## Acceptance and proof

- Same HTTP auth/CSRF adapter in production and executable fixtures rejects missing CSRF, foreign origins, wrong task/project/profile claims before inference.
- Discovery has zero inference; concurrent starts share admission and one scheduler; cancellation denies late findings.
- Advisory imports are validated, idempotent, reject changed material and survive gateway reopen without modifying accepted structure.
- Native Pi plus actual Mastra retains encrypted proposals, unknown/spent reservations and original checkpoint admission after reopen.
- The Windows Product Gate invokes `outline-product-proof.mjs` through normal `PlotPickle.ps1 -HumanTesting`, uses the configured Mastra route with a synthetic loopback provider, interrupts during Block 2, reopens, observes the rendered Resume action, and proves only Blocks 2–6 run. It also clicks the rendered Cancel action and verifies cancellation survives reload.
- Product proof stays UNPROVEN until that executable gate passes on the exact PR head. Synthetic provider evidence is explicitly labelled; no live user-selected provider or the user's hardware is claimed by the fixture.
- Focused regressions, focused UAT, convergence, architecture and Windows production build remain independent required gates.

No other agent rollout, canon acceptance, repository mutation, external publishing, or Pi/FFrames/Hunk upgrade occurs in this phase. Issue #2717 follows after #2711 is green and mergeable.
