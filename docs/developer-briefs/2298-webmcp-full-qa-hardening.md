# #2298 — WebMCP Full QA Runtime + Evidence ZIP Hardening

## Purpose

Repair the defects exposed by the first Human Profile 6 run without changing the governed startup order or mixing UI advisory cleanup into harness work.

## Confirmed failures

- Profile 5 RUNTIME calls an undefined `visible(active)` helper even though the evaluator already defines `isRendered()`.
- Full QA writes a run-specific ZIP, but the Human could not reliably locate an obvious shareable bundle afterward.
- Manually creating/opening a ZIP under `.artifacts` while Vite is active can produce Windows `EBUSY` because generated QA output is not ignored by the development watcher.

## Build

- Use the existing Runtime rendered-state helper for hidden-focus detection.
- Preserve the provenance ZIP `.artifacts/webmcp-full-qa-<run-id>.zip`.
- Also create `.artifacts/webmcp-full-qa-latest.zip` after each Full QA run.
- Verify both archives exist, are non-empty, readable, and have a ZIP signature before exposing them as completed evidence.
- Print the predictable shareable ZIP first and the run archive second.
- Ignore generated `.artifacts` output in Vite watch configuration.
- Add focused regression coverage.

## Boundaries

Do not change Vite-before-WebMCP startup ordering. Do not alter Profile 1–6 semantics or advisory severity. Do not route this through Repair-PlotPickle. Do not add a second artifact system.

## Merge boundary

Focused tests plus the existing exact-head CI / Architecture Verification authority must be green before merge. After merge, stop for the Human to rerun Profile 6 from main.
