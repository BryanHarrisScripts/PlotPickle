# Issue #112 — navigation and context implementation

This branch establishes the shared contracts required to restructure PlotPickle without duplicating project state.

## Implemented foundation

- Instructions is renamed Introduction in shared product vocabulary while retaining the existing workspace ID for migration safety.
- The approved four application-shell zones are defined centrally.
- The complete creative workflow includes Dashboard, Learn, Plan, Build, Write, Storyboard, Refine, Feedback and Reports.
- Persistent project actions are defined centrally: New Project, Import, Export and Load Afterglow.
- A shared workspace context records workspace, submenu, Block, mini-block, scene, character, feedback target, inspector, filter, zoom, board position and scroll position.
- Context history supports explicit return to the previous working state.

## Runtime integration sequence

1. Extract the current top bar from `app/page.tsx` into a four-zone shell component.
2. Move the existing project-action callbacks from Dashboard into the persistent project-action zone.
3. Keep Dashboard health and Project Overview, but remove its Project actions section.
4. Add Build and Feedback renderers by reusing current structure, Block, review and diagnostic components.
5. Connect workspace transitions to the shared context history rather than direct tab replacement.
6. Standardize persistent submenus without replacing specialized workspace content.

## Migration boundary

No project schema changes are introduced in this foundation. Context is application-session state and must not create duplicate Blocks, scenes, mini-blocks, characters, visuals or review records.
