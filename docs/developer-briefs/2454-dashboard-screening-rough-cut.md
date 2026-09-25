# Developer Brief — Dashboard Screening, Reports Move and Rough Cut

Issue: #2454

## Scope

Dashboard-only information architecture change.

## Human-approved Dashboard taxonomy

EXPLORE:
- Learn
- Library
- Community
- Screening
- Reports

DEVELOP:
- unchanged

VISUALIZE:
- Outline
- Storyboard
- Previs
- Timeline
- Rough Cut

SOUND:
- unchanged

PITCH:
- Package
- Deck
- Feedback

PLAY:
- unchanged

SYSTEM:
- unchanged

## Implementation rules

- Keep the existing `production` id, route and underlying surface. Only the Dashboard-facing label changes from Production to Rough Cut.
- Keep Previs and Timeline unchanged.
- Move the existing Reports item, identity and shortcut from PITCH to EXPLORE after Library.
- Add Screening as a Dashboard-only row. Use shortcut `9` so all Dashboard shortcuts remain unique.
- Lock completed Dashboard surfaces green by removing MindMap, WorldMap, Outline and Storyboard from the in-review/yellow set. WorldMap was already green on the base branch; preserve that state.
- Keep Previs, Timeline and Rough Cut in the in-review/yellow set.
- Use the one-word `MINDMAP` header when the MindMap surface opens.
- Screening is intentionally unavailable in this issue and must remain selectable without opening a surface.
- Do not add a Screening workspace or alter Reports/Production internals.
- Preserve keyboard-first Dashboard navigation and the existing seven group headings.

## Acceptance

- EXPLORE renders exactly: Learn, Library, Community, Screening, Reports.
- VISUALIZE renders exactly: Outline, Storyboard, Previs, Timeline, Rough Cut.
- PITCH renders exactly: Package, Deck, Feedback.
- Screening is in the unavailable lifecycle set.
- Rough Cut still routes through the existing `production` id when that surface is selected.
- MindMap, WorldMap, Outline and Storyboard show the connected/green locked state.
- MindMap opens with the one-word MINDMAP header.
- Existing Sound, Develop, Play and System rows are otherwise unchanged.
