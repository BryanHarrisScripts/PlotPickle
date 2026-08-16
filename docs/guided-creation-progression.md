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

## Canonical group order

1. Foundations
2. World
3. Structure
4. Drafting
5. Character
6. Industry
7. Responsible AI
8. Theme
9. Visual Storytelling
10. Revision
11. Dialogue
12. Collaboration

This order is defined in `modules/dashboard/guided-progression.ts`. UI surfaces must read that engine rather than create their own completion rules.

## Current implementation boundary

**Foundations is the only implemented vertical slice.**

Its contract is:

1. Complete all 11 Foundations LEARN lessons.
2. Complete the Foundations PLAN decisions / Story Foundation Brief.
3. Generate a real Foundations BUILD visual using the configured PlotPickle image-provider boundary.
4. Explicitly accept at least one real stored visual artifact.
5. Only then is Foundations complete and World progression-unlocked.

Generation alone is not approval. A fake or unknown artifact ID cannot complete BUILD. If the last accepted Foundations visual is unaccepted or rejected, BUILD is no longer complete and World is no longer progression-unlocked.

World may be shown as the next curriculum group when Foundations is complete, but World LEARN/PLAN/BUILD workspaces remain deliberately gated until the Foundations cycle is reviewed and approved.

## Dashboard responsibilities

Dashboard is a view over the same canonical project state. It may show:

- LEARN / PLAN / BUILD state for the current implemented group,
- lesson and PLAN completion counts,
- accepted BUILD artifact counts,
- per-group and overall progress,
- the recommended next action,
- all twelve curriculum groups and which are complete, current, ready-next or gated.

Dashboard must not create a second progress store or invent completion.

## Future extension

Each future curriculum slice should extend the central progression engine and canonical project contracts rather than introduce section-specific booleans. BUILD semantics can vary by curriculum group; not every group requires image generation. Storyboard and Previs are later production stages and are not part of the current Foundations implementation.
