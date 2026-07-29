# Issue #113 — Dashboard command centre

Parent roadmap: #110  
Depends on: #111 and #112

## Reuse-first implementation

The Dashboard reads the active canonical project and reuses:

- `completionFor` and `projectSectionProgress` for planning readiness;
- `deriveDashboardStorageStatus` for local, backup and GitHub synchronization language;
- canonical Blocks, scenes, mini-blocks, screenplay elements, visual frames, review threads, revisions and collaboration metadata;
- the saved PlotPickle settings model and private local AI connection status;
- the shared `ApplicationShellHeader` and `PROJECT_ACTIONS` contract from #112.

No Dashboard-only project, connection, review or report records are introduced.

## Command-centre sections

1. Five-second readiness check and recommended next action.
2. Connections: GitHub, AI, plugins, current save, storage/backups and collaboration.
3. Workflow progress: Learn, Plan, Build, Write, Storyboard and Refine.
4. Attention required with exact workspace or Settings destinations.
5. Project snapshot with draft, format, runtime, page, scene, character, location, path, save and canonical branch state.

## Project-action ownership

New Project, Import, Export and Load Afterglow are owned by the persistent application shell. They are deliberately absent from Dashboard content.

## Accessibility

Green, yellow and red states always include text and an icon. Dashboard sections use headings, labelled progress, keyboard-operable buttons, a persistent submenu and responsive single-column fallbacks.
