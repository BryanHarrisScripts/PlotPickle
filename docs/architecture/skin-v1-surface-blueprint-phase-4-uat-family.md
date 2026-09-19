# Issue #2226 Phase 4 — UAT/pre-production family normalization

Status: implementation candidate.

This phase applies the Human-approved Phase 3 Skin V1 shell to the production/UAT family without changing PPF, Block/Mini, Storyboard, Previs, Write or PageFlow authority.

## Normalized surfaces

- Story Map
- Storyboard
- Visual Story
- Scene Workspace / Timeline
- Previs
- Write
- PageFlow

## Visible convergence

- shared production/context shells use `--pp-skin-shell-max` rather than the old 1500px width;
- desktop shell geometry therefore converges on the approved 1180px maximum;
- selected states use `--pp-skin-accent-deep` + the existing light-green focus/frame vocabulary rather than a stark white inversion;
- Visual Story uses the approved strong outer + thin inset layered frame;
- Visual Story structural placeholder frames are solid rather than undeclared dashed structural borders;
- Storyboard, Previs and Visual Story titles identify the loaded project;
- existing Storyboard → Visual Story → Scene Workspace hierarchy remains intact;
- Write remains Block-native PPF authority;
- PageFlow remains a read-only diagnostic and retains its origin/Outline return behavior.

## Non-goals

No story/canon migration, no new router, no new production surface, no new layout archetype and no baseline promotion are part of this change.

The generated WebMCP candidate corpus is the Human review artifact for this phase.
