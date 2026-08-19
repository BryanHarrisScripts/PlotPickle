# Guided Creation Progression

PlotPickle uses one shared progression model for the curriculum-to-production journey.

## Core loop

For curriculum groups that produce story or visual decisions, the writer advances through:

`LEARN → PLAN → BUILD → next curriculum group`

- **LEARN** teaches the relevant PlotPickle curriculum.
- **PLAN** converts that teaching into explicit decisions about the writer's project.
- **BUILD** makes those approved decisions tangible through the artifact type appropriate to that curriculum group.
- A later group does not become actionable until the prior implemented cycle is complete and approved.

The curriculum remains reusable knowledge/RAG. Project state stores the writer's decisions and accepted artifacts, not copies of the lesson bodies.

## Canonical Visual Writer group order

1. Foundations
2. World
3. Character
4. Theme
5. Structure
6. Visual Storytelling
7. Drafting
8. Dialogue
9. Revision
10. Responsible AI
11. Industry
12. Collaboration

The order is defined once by `VISUAL_WRITER_GROUP_ORDER` in `core/contracts/visual-writer-progression/index.ts`. Guided progression, curriculum presentation and later consumers must read that shared contract rather than create their own order or completion rules.

The dependency audit and rationale live in `docs/visual-writer-curriculum-audit.md`. All 81 archived curriculum lessons remain bundled; #1030A changes progression metadata/order, not lesson copy.

## Explicit output contracts

Every curriculum group declares one central output contract describing:

- prerequisite groups;
- what the writer learns;
- what project decisions the group creates/refines;
- whether those decisions affect visual generation;
- the BUILD capability unlocked by accepted decisions;
- the exact completed curriculum groups BUILD may use as context;
- artifact kinds the group may create/update;
- the writer approval required before later groups may treat the result as accepted;
- whether the group is knowledge-only, decision-producing, artifact-producing or a mixture.

`deriveGuidedLessonOutputContracts(curriculum)` then projects that contract onto every real curriculum lesson while preserving the lesson's existing numbered order and using the lesson's own objectives/application text instead of duplicating lesson bodies.

## Progressive visual boundary

The early progressive visual artifact is the **Visual Narrative Wireframe**.

It is intentionally rough, low resolution, disposable, regenerable and pre-final. It is not the later Storyboard/Previs production stage.

**BUILD may only visualize the completed project frontier.** A group may use only the accepted context named by its output contract. Future incomplete lessons/groups cannot be silently borrowed. Later groups may refine or branch earlier visuals, but provenance/history must remain reviewable.

Generation alone is never approval.

## Current implementation boundary

**Foundations is the only implemented vertical slice in PR A.**

Its current implementation contract is:

1. Complete all current Foundations presentation lessons.
2. Complete the Foundations PLAN decisions / Story Foundation Brief.
3. Generate a real Foundations BUILD visual using the configured PlotPickle image-provider boundary.
4. Explicitly accept at least one real stored visual artifact.
5. Only then is Foundations complete and World progression-unlocked.

A fake or unknown artifact ID cannot complete BUILD. If the last accepted Foundations visual is unaccepted or rejected, BUILD is no longer complete and World is no longer progression-unlocked.

World may be shown as the next curriculum group when Foundations is complete, but World LEARN/PLAN/BUILD workspaces remain deliberately gated until the World vertical slice is implemented in the later #1030 rollout.

## Dashboard responsibilities

Dashboard is a view over the same canonical project state and output contracts. It may show:

- LEARN / PLAN / BUILD state for the current implemented group,
- lesson and PLAN completion counts,
- accepted BUILD artifact counts,
- per-group and overall progress,
- the recommended next action,
- all twelve curriculum groups and which are complete, current, ready-next or gated,
- current output/frontier semantics from the canonical group contract.

Dashboard must not create a second progress store or invent completion.

## Later #1030 rollout

- **PR A — audit + contracts:** canonical order, dependency/output metadata, documentation and regressions; no new image generation.
- **PR B — Foundations wireframe BUILD:** rough provider-backed Visual Narrative Wireframe, conservative frame count, provenance and review state.
- **PR C — World vertical slice:** World LEARN/PLAN/BUILD using the same engine with additive/branching provenance.
- **PR D — Avery + Dashboard:** traverse and review the actually implemented frontier through the same canonical progression model.

Each future curriculum slice extends the central progression engine and canonical project/artifact contracts rather than introducing section-specific booleans. Image work stays behind PlotPickle's configured provider/media-routing boundary.
