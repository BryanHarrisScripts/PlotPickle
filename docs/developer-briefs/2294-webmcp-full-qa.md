# #2294 — Selectable WebMCP QA Profiles + Full QA

## Purpose

Extend the existing WebMCP / Playwright / Browser Verification Broker verification path with six selectable QA profiles without creating a second browser-testing framework.

The governed profiles are:

1. STANDARD — preserve the current WebMCP 30-surface visual/navigation behavior.
2. INTERACTION — real Playwright keyboard/focus/control-state checks.
3. RESILIENCE — bounded verification-only intercepted failure/latency scenarios.
4. CONTINUITY — five-stage pre-production journey plus same-context propagation and isolated-context checks.
5. RUNTIME — Browser Verification Broker health plus bounded DOM invariants.
6. FULL QA — run 1 through 5 in order and create one aggregate evidence ZIP.

## Authority boundaries

- Browser execution remains owned by the existing Browser Verification Broker.
- The canonical WebMCP standard catalogue remains 30 surfaces.
- Dashboard remains the canonical Skin V1 design reference.
- Visual Director and UI Continuity remain the rendered/continuity authorities.
- Profile 6 is orchestration, not a sixth independent verification framework.
- No new automatic PR gate is introduced.
- No paid provider call, real external-system mutation, Human credential entry, or unrestricted browser eval is permitted.

## Evidence

A Full QA run writes one run directory under `.artifacts/webmcp-full-qa/<run-id>/` and one shareable `.artifacts/webmcp-full-qa-<run-id>.zip`.

The bundle records exact commit SHA, ordered profile results, blockers/advisories, skipped dependent checks, sanitization status, the current Standard WebMCP evidence, and the Profile 2–5 reports.

## First acceptance run

The first Human Profile 6 run is also the convergence pass for the six current Visual Director advisories: two Write frame-overlap findings, Profile heading hierarchy, General spacing rhythm, Node structural dead space, and Issue Log spacing rhythm.

Each advisory must end as fixed or explicitly classified as an intentional exception/detector calibration. No advisory is silently discarded.

## Merge boundary

Implementation may merge when focused tests and the existing exact-head Architecture Verification authority are green. Issue completion still requires the first live Full QA evidence bundle so #2272 and #2226 can be closed against the same proof.
