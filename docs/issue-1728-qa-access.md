# Issue #1728 — unrestricted QA access

PlotPickle now separates two questions that were previously coupled in several guided surfaces:

1. Is this implemented workspace available for a tester to open and inspect?
2. Has the writer canonically earned the progression state required to perform provider-backed or PPF-authority actions?

`core/progression/qa-access.ts` answers only the first question. The canonical progression engine remains unchanged.

## QA-open surfaces

- Dashboard navigation into implemented Foundations and World LEARN / PLAN / BUILD destinations.
- World PLAN, including lesson and brief editing, without claiming prior stages are complete.
- Foundations BUILD and World BUILD workshop inspection, including current plans, artifacts, provenance and provider readiness.
- Storyboard Block and Mini-Block inspection, including existing candidate review / comparison.

## Boundaries that remain protected

QA access does not unlock profile authentication, credentials, provider readiness, paid-request acknowledgement, Story Workbench canonical apply authority, or unearned PPF visual acceptance. Foundations / World BUILD generation and review mutations remain disabled while their canonical BUILD stage is locked. Storyboard Keep remains disabled when the target is only open through QA access.

Locked / available / complete status stays visible from the canonical progression and visual-readiness models. The QA layer does not write completion flags or mutate those models.

This mode is intentionally centralized and currently enabled so the application can be traversed freely during the present manual QA cycle. Before public-release hardening, this constant can be replaced by the appropriate developer/test-mode configuration without changing canonical progression semantics.
