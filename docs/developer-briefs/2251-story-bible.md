# #2251 — Visual Story Bible beside Write

## Human product direction

PlotPickle needs a visual Story Bible immediately beside Write so the writer can keep the current story truth visible while writing.

The Story Bible is not a second authoring system. It is a read-only projection of the currently loaded Library story and the canonical authorities PlotPickle already owns.

When no story is active, the Dashboard remains visible and says:

> Please load a story.

PlotPickle must not manufacture an Untitled Bible or silently restore a previous story to satisfy this surface.

## Current v1 projection

The first Story Bible projects:

- project title and PPF revision;
- the current Marketing Reference as poster/key art when one exists;
- logline, premise, theme, tone and stakes when established in canonical PPF decisions;
- the existing 4 Act / 12 Sequence / 24 Block / 96 Mini-Block structure;
- principal Character Truth evidence, including backstory/want/need/worldview/relationships/arc material where evidence exists;
- Foundations decisions;
- World decisions;
- imported screenplay, Story Evidence Matrix and Character Truth provenance;
- the canonical Story Bible curriculum purpose as a guide to future eligible sections.

Missing information remains explicitly “Not established yet.” Character images remain “No character image yet” until an accepted/current character visual authority exists.

## OSS preflight

Before implementation, the September 13–19 OSS Radar history was reviewed.

Useful patterns were found in:
- Story Skills — explicit story-bible sections and deterministic continuity;
- SAGA — accepted-vs-draft and resumable story state;
- IdeaGraph Live — provenance and Human-reviewed knowledge state;
- WeKnora — revision-aware wiki presentation.

None of those projects replaces PlotPickle authority. No external story store, graph or wiki runtime is introduced for #2251.

## Authority boundary

Read from existing:
- Library active project;
- PPF Foundations and World;
- StoryStructureV2;
- imported screenplay/source evidence;
- Story Evidence Matrix;
- Character Truth Evidence;
- Foundations Marketing Reference.

Do not write/mutate:
- PPF;
- Story Structure;
- Character Truth;
- Marketing Reference;
- curriculum;
- screenplay;
- provider/runtime state.

## Surface boundary

- Dashboard Production order: Previs → Write → Story Bible → Edit → Feedback → Refine → Analytics.
- The Production group intentionally expands from five to six rows for this Human-approved adjacent reference surface; other Dashboard group row budgets remain unchanged.
- Story Bible is a Skin V1 state-owned surface under Dashboard.
- It is census-only in v1 so the frozen standard WebMCP set remains 30 surfaces.
- Surface Orchestrator owns global Return when active.
- The local Dashboard-host return remains the delegated state transition.
