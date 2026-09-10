---
name: character-visual-development
description: Develop a revision-bound candidate visual package for one canonical PlotPickle character from approved and observed evidence without changing canon or accepting generated work.
license: MIT
metadata:
  author: PlotPickle
  version: "1.2.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/character-visual-development
  progressiveDisclosure: true
---

# Character Visual Development

Use this skill when PlotPickle needs coherent visual studies for one existing canonical character. PPF remains the story and canon authority. The skill produces candidates for the existing visual artifact acceptance path; it never accepts its own output.

## Procedure

1. Require the project ID, exact PPF revision, canonical character ID, relevant canonical evidence references, current approved visual identity, clearly labelled observed references, requested studies, and the host-approved provider route.
2. Keep canonical, approved visual, observed, and generated candidate evidence in separate fields. Never promote a provider-invented trait into canonical evidence.
3. Build only the requested studies from the shared package: reference board, turnaround, expressions, movement, wardrobe/props, powers/effects when applicable, palette/materials, and environment interaction.
4. For generated studies, require an explicit revision-bound study specification. The runtime may send that bounded specification to PlotPickle's existing `/api/local-ai/generate/image` route only when the active Settings route and configured model/checkpoint still match the package. The skill never changes the active route.
5. For OpenAI or MiniMax image generation, require the package's current cloud consent and budget approval plus exact per-job paid-request consent for the number of studies being sent. No missing approval may be inferred from an earlier run.
6. Record each generated study output against the exact package revision and same host-approved provider route. Store only returned local candidate asset references, bounded coverage labels, safe summary text, provider/model route provenance and a safe specification fingerprint. Do not store prompts, credentials, or hidden reasoning.
7. Treat a requested study as resolved only when it has generated candidate references or an evidence-backed not-applicable result. A board is ready for review only when every requested study is resolved, no study is stale, and no blocking consistency finding remains. Ready for review is not accepted.
8. Preserve a dependency list for every study. When upstream evidence changes, mark only studies that cite the changed evidence stale and name the exact changed references.
9. Compare the resulting studies for face/head, proportions, apparent age, costume, props, palette/materials, powers/effects, canonical contradiction, and provider drift. Return concrete discrepancies with the affected study IDs; do not substitute an opaque score.
10. Return the candidate package and its board projection to the host. Read [references/candidate-package.md](references/candidate-package.md) when constructing, revising, or validating the package contract.

## Provider boundary

Use the provider route supplied by the host and already selected in Settings. Local/private capability is preferred when configured. Cloud generation requires current consent, and paid cloud generation also requires current budget approval and exact request-count acknowledgement. Never silently fall back to another provider, switch model/checkpoint, or expand the spend boundary. A generated study output from a different provider route is rejected rather than silently adopted.

Only PlotPickle-local approved or observed image assets may be sent as provider reference images by the Character Visual Development runner. Repository IDs and external reference labels remain provenance and are not silently uploaded as media.

## Authority boundary

The skill does not mutate PPF, store a second character database, accept visual artifacts, unlock visual readiness, select or pay providers, store credentials, impersonate an authenticated Human, or write hidden reasoning. A delegated autonomous run may request and evaluate candidates only under its supplied run policy.

Only an artifact already accepted through PlotPickle's existing visual artifact acceptance path may be linked back to the package and exposed to visual readiness as accepted evidence. Storyboard, Production Shots, and Previs continue to consume their existing readiness contracts.
