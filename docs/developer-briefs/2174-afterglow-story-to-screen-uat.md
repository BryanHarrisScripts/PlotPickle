# #2174 — Afterglow Story-to-Screen CI / UAT

## Objective

Prove the current writer-to-screen architecture as one deterministic, local-first acceptance chain before broad Human UAT.

The executable reference slice is:

Afterglow: Reflections of Sentience
v9 baseline
Act 3
Block 17 — Waves of Connections
Mini-Block 1
storyboard-anchor:block:block-17:mini-1

Block 17 is deliberately used because the repository already contains real v9 screenplay evidence and original Afterglow Storyboard material for this movement. The harness therefore does not create a fake screenplay passage or fake visual merely to obtain a green test.

## Deterministic CI lane

The source of truth is:

config/verification/afterglow-story-to-screen-uat.json

The verifier is:

lib/verification/story-to-screen-acceptance.mjs

The focused regression is:

tests/issue-2174-afterglow-story-to-screen-acceptance.test.mjs

The CI chain verifies:

Story Cards
→ Write
→ Outline
→ Storyboard
→ Previs
→ Scene Workspace
→ Production
→ revision propagation

For every stage, the report names the exact stage and missing file/contract term when continuity breaks. It does not fill a missing stage with generated evidence.

## Fixture truth

The harness verifies three independent source facts before accepting the chain:

1. the #2168 fixture still reports the canonical 24 × 96 grid;
2. v9 still preserves its actual 20 titled source sections rather than being relabelled as 24 authored source Blocks;
3. Block 17 remains Waves of Connections and sits inside the 21 Blocks with original historical Storyboard material.

The current Storyboard reference for the acceptance address is:

afterglow-block-17-mini-1

This is source/reference evidence. Keeping or revising it in a Human working copy remains a Human decision.

## Production boundary

Ordinary CI stops at the provider-neutral #2173/#2064 compilation boundary.

It proves the current code still composes:

approved upstream intent
→ production intent
→ Director Specification
→ provider capability assessment
→ disposable provider instruction bundle

CI does not:

- select a paid route;
- contact a cloud provider;
- generate media;
- spend credits;
- judge artistic quality;
- promote generated media to canon.

Actual provider-backed generation belongs to an explicitly authorized UAT/Responsibility Run.

## Human / WebMCP lane

The manifest defines one address-preserving route for every current stage:

Story Cards
/?workspace=dashboard&block=17&mini=1

Write
/write?block=17&mini=1

Outline
/?workspace=dashboard&block=17&mini=1

Storyboard
/storyboard?block=17&mini=1

Previs
/previs?block=17&mini=1

Scene Workspace
/storyboard?block=17&mini=1&view=timeline

Production inspection
/storyboard?block=17&mini=1

The Outline acceptance endpoint is the current profile-owned PPF Story Map inside the authenticated Dashboard surface. The legacy /structure page is not part of the canonical UAT chain.

The Production inspection endpoint is the existing read-only generated-director-instruction inspection nested in Visual Story. #2174 does not invent another top-level Production application.

Before making changes, the Human should Load & Explore Afterglow and Save & Switch to a profile-owned working copy. Immutable reference evidence is never edited by this UAT.

## Failure rule

A truthful missing state is valid evidence.

The verifier fails the affected stage and reports the exact missing contract. It must never create a Scene, Shot, Frame, timing value, screenplay passage, provider result or acceptance state merely to satisfy CI.

## 24/96 reporting

#2168 remains the owner of full source coverage. #2174 consumes that fixture and verifies that full 24-Block / 96-Mini-Block coverage remains reportable while preserving:

- v9 20-section source topology;
- explicit missing/unresolved states;
- mapping method provenance;
- the distinction between source density and structural judgment.

## Exit criteria

#2174 is complete when:

1. Block 17.1 passes the deterministic cross-stage contract;
2. 24/96 source coverage remains reportable;
3. the Human/WebMCP route preserves Block 17.1 at every current stage;
4. ordinary CI remains local/offline and zero-spend;
5. provider-backed generation requires explicit authorization;
6. missing evidence remains truthful;
7. regression output identifies the exact broken stage and missing evidence.
