# PlotPickle Product Developer Brief — Progressive BUILD Story Model

## Status

**Date:** 2026-08-23  
**Relationship to existing direction:** Focused BUILD addendum. This extends the existing LEARN → PLAN → BUILD progression, screenplay import, PPF exchange, 24-Block/96-Mini-Block system, and Story Knowledge Graph. It does not introduce a second project format or a parallel source of truth.

## Decision

BUILD becomes the persistent visual representation of the story currently supported by the canonical PPF.

The same BUILD surface must work for two entry paths:

1. **Native PlotPickle creation:** LEARN → PLAN → accepted PPF decisions → BUILD.
2. **Existing screenplay:** Final Draft/Fountain/plain screenplay → PlotPickle project → `.ppf` exchange → BUILD.

In both cases the writer should see what the story already supports, what is only inferred, and what remains underdeveloped or absent.

The PPF remains canonical. The Story Knowledge Graph remains derived, read-only, provenance-backed, stale-detectable, and rebuildable.

## Product principle

> BUILD shows what the story currently contains, why PlotPickle thinks it knows it, and what is still missing.

Empty is valid information. PlotPickle must not generate filler merely because a Block, Mini-Block, character field, structural turn, or visual layer is unresolved.

## Evidence states

BUILD uses story-evidence semantics that are distinct from production readiness:

- **Defined** — supported by accepted/native project decisions.
- **Observed** — directly supported by imported screenplay evidence.
- **Emerging** — a useful structural or semantic interpretation exists but still requires Human review.
- **Missing** — insufficient evidence exists to support the expected story requirement.
- **Locked** — a later curriculum frontier has not yet earned that level of definition.

These states are informational, not quality grades. They must not be presented as red/yellow/green judgments of artistic quality.

## Story coverage versus learning progress

Learning completion and story coverage are separate concepts.

A writer may import a mature screenplay and immediately have high story coverage while having completed zero PlotPickle lessons. Conversely, a writer may complete a lesson group while intentionally leaving creative decisions unresolved.

Story coverage must be derived from supported story requirements, not from an arbitrary percentage per lesson.

Do not display "your screenplay is X% finished." Prefer language such as "X% of the BUILD story requirements currently have usable support."

## Canon and authority

- `.ppf` / PlotPickle project state remains the creative authority.
- BUILD is a view/editor over canonical project state, not another database.
- Story Knowledge Graph data may explain and connect evidence, but may not silently become canon.
- Imported analysis marked `suggested` remains reviewable interpretation.
- Human review/acceptance remains required before an inferred interpretation becomes accepted creative truth.
- Direct screenplay evidence and derived interpretation must remain distinguishable.

## Imported screenplay behavior

The existing screenplay importer already preserves source text, normalized draft elements, block assignments, characters, locations, scenes, and reviewable suggestions. BUILD should expose that distinction instead of presenting every populated import field as equally certain.

For an imported screenplay:

- direct screenplay passages assigned to a Block are **Observed** evidence;
- importer-generated structural interpretation remains **Emerging** until reviewed;
- missing or unsupported requirements remain **Missing**;
- story coverage may be populated immediately without marking curriculum lessons complete;
- unmapped or uncertain material must be preserved rather than silently discarded or force-fit.

Assigned material is not the same as proven structure.

## Native project behavior

For native PlotPickle work, accepted project decisions are **Defined**. BUILD progressively resolves the same 24-Block/96-Mini-Block model as later curriculum groups contribute more evidence.

The complete topology may be visible early, but visibility does not imply editability, completion, or permission to invent later-frontier information.

## BUILD surface

BUILD should progressively resolve one story model rather than create unrelated workspaces for each curriculum group.

Suggested progression:

```text
FOUNDATIONS
  ↓ story identity / premise / broad dramatic shape
WORLD
  ↓ places / rules / environmental forces
CHARACTER
  ↓ wants / needs / relationships / arc evidence
THEME
  ↓ argument / motif / meaning relationships
STRUCTURE
  ↓ 24 Blocks substantially resolved
VISUAL STORYTELLING
  ↓ 96 Mini-Blocks gain visual purpose
DRAFTING
  ↓ scenes and written execution attach
DIALOGUE
  ↓ voice/subtext relationships deepen
REVISION
  ↓ contradictions, weak links and unresolved threads surface
STORYBOARD
  ↓ production representation
```

The first implementation does not need to build every layer. It establishes the evidence-aware story model and coverage semantics on the existing BUILD workspace.

## First implementation slice

### 1. Evidence-aware BUILD model

Extend the existing BUILD workspace model with a story-evidence state and evidence summary for each canonical Block.

The model must distinguish:

- direct imported screenplay evidence assigned to the Block;
- importer suggestions requiring review;
- native/manual canonical material;
- absence of usable support.

Do not overload the existing production-readiness status (`empty`, `developing`, `ready`, `locked`). Evidence state and readiness are different axes.

### 2. Story coverage

Derive a deterministic coverage summary from supported BUILD requirements.

Coverage should report:

- supported requirement count;
- expected requirement count;
- percentage;
- counts by evidence state.

The calculation must use meaningful existing story requirements (for example purpose, conflict, choice, action, consequence, emotional movement, setup/payoff, character/location linkage, and source evidence) rather than lesson count.

### 3. Explainability

A selected Block should be able to explain why it is classified as Defined, Observed, Emerging, or Missing.

At minimum surface:

- evidence state;
- concise reason;
- direct screenplay element count where applicable;
- source scene/block evidence identifiers where available;
- whether imported analysis is still `suggested` or has been reviewed.

### 4. UI integration

Update the existing BUILD workspace so the writer can see:

- Story Coverage in the BUILD rail/header;
- evidence state on Block cards;
- an evidence/explainability section for the selected Block;
- wording that distinguishes story evidence from production readiness.

Keep the existing 24-Block/96-Mini-Block navigation, editing behavior, drag/move synchronization, feedback, and recovery behavior intact.

### 5. Final Draft / PPF compatibility

A project produced by `createProjectFromScreenplay()` and then packaged as `.ppf` must retain enough screenplay source/draft-element evidence for BUILD to classify populated Blocks as Observed/Emerging rather than falsely treating importer suggestions as Human-defined canon.

No new `.PPP` or second project format may be introduced.

## Story coverage requirements

For this first slice, a Block's deterministic requirement set is:

1. dramatic purpose;
2. conflict;
3. choice;
4. visible action;
5. consequence;
6. emotional turn;
7. setup;
8. payoff;
9. character linkage;
10. location linkage;
11. direct screenplay evidence or native summary support.

A requirement is supported only when it contains usable non-placeholder content or direct source evidence.

Known importer prompts such as `Suggested question:`, `Review ...`, `Identify ...`, `Confirm ...`, and equivalent placeholder guidance must not count as fully supported creative evidence by themselves.

This requirement set is a deterministic product contract for the first slice and may evolve deliberately in later issues.

## Evidence-state derivation contract

Use the following precedence for the first slice:

1. **Observed** when the Block has direct imported screenplay draft elements/source passage evidence.
2. **Emerging** when the imported project contains reviewable suggested interpretation for the Block but no direct usable source evidence is assigned.
3. **Defined** when usable native canonical Block material exists and the project is not merely carrying importer-generated placeholder/suggestion text.
4. **Missing** when none of the above provides usable support.
5. **Locked** remains reserved for explicit curriculum-frontier locking and must not be inferred from production scene locks.

When a Block contains both direct source evidence and derived interpretation, show **Observed** as the primary evidence state and separately state that structural interpretation still requires review while screenplay analysis status is `suggested`.

## Knowledge Graph relationship

The Story Knowledge Graph remains an optional evidence/context enhancer for this slice, not a hard runtime dependency.

The first implementation should not duplicate graph extraction. It should use deterministic project/screenplay evidence already stored in the PPF. Later work may attach graph node/edge provenance to the same evidence interface.

## Pi use

Pi may be used only as a bounded implementation-review aid for this issue.

Recommended small subset:

- inspect the BUILD model derivation for accidental canon inflation;
- inspect imported-placeholder detection for false positives/negatives;
- inspect tests for missing rich-import, sparse-import, and native-project cases.

Pi must not be placed in the production request path, must not be required for CI success, and must not make canonical story decisions. GitHub Actions remains the authoritative automated verification loop.

## Acceptance criteria

- [ ] Developer brief is committed under `docs/`.
- [ ] Existing PPF remains the sole canonical project authority.
- [ ] No `.PPP`, duplicate story database, or replacement graph is introduced.
- [ ] BUILD model exposes evidence state independently from production readiness.
- [ ] BUILD model exposes deterministic story coverage based on supported story requirements, not lesson count.
- [ ] Imported screenplay Blocks with direct source passages classify as Observed.
- [ ] Importer-only suggestions without direct support classify as Emerging, not Defined.
- [ ] Native usable Block material can classify as Defined.
- [ ] Empty/placeholder-only Blocks classify as Missing.
- [ ] Production scene locks are not misreported as curriculum `Locked` evidence.
- [ ] Selected Block explainability includes reason, source evidence count, and import review status when applicable.
- [ ] BUILD UI shows Story Coverage and evidence-state badges without removing existing readiness status.
- [ ] Final Draft → PlotPickle project → `.ppf` packaging preserves the evidence used by BUILD classification.
- [ ] Learning completion is not modified by screenplay import.
- [ ] Existing Block move/recovery/feedback behavior remains intact.
- [ ] Focused tests cover native, rich imported, sparse imported, placeholder-only, and reviewed-import behavior.
- [ ] Existing BUILD workspace regressions pass.
- [ ] Production build passes.
- [ ] Exact-head GitHub Actions are green before merge.

## Non-goals

This issue does not:

- redesign the entire Foundations BUILD visual-wireframe flow;
- create all future curriculum-frontier locking rules;
- auto-accept imported structural interpretation;
- force all screenplay material into a PlotPickle structural claim;
- generate screenplay filler to improve coverage;
- automatically rewrite imported scripts;
- make the Story Knowledge Graph canonical;
- create final storyboard/shot production;
- require cloud AI or Pi at runtime.

## Definition of success

A writer can open BUILD and immediately distinguish:

> what the PPF directly contains, what the imported screenplay proves, what PlotPickle is only suggesting, and what the story still does not adequately support.

That behavior works for both a story developed inside PlotPickle and a screenplay converted into a PlotPickle `.ppf` project.
