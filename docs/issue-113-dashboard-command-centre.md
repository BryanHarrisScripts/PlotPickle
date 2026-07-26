# Issue #113 — Dashboard command centre

## Purpose

Redesign Dashboard as PlotPickle's re-entry and project-readiness command centre without creating a second project model or duplicating Settings, reports, review, collaboration or project-action logic.

## Reused canonical sources

- `completionFor`, `projectSectionProgress` and `sectionHasAlert` for readiness and workflow progress.
- `deriveDashboardStorageStatus` for local, backup and GitHub synchronization language.
- The canonical `PlotPickleProject` records for Blocks, scenes, mini-blocks, screenplay elements, frames, review threads, revisions, rights and collaboration.
- The existing `plotpickle.settings.v1` settings record and private local AI connection endpoint.
- The shared `ApplicationShellHeader` and `PROJECT_ACTIONS` contract for persistent New Project, Import, Export and Load Afterglow actions.

## Dashboard surfaces

1. Five-second readiness check with a calculated recommended action.
2. Connections cards for GitHub, AI, plugins, current save, storage/backups and collaboration.
3. Learn, Plan, Build, Write, Storyboard and Refine workflow progress.
4. Attention-required items that route to the exact workspace or Settings subsection.
5. Project snapshot with draft, format, runtime, page estimate, scenes, characters, locations, path, save time and canonical branch state.

## Accessibility and layout

- Green, yellow and red states always include an icon and status text.
- Dashboard has a persistent left submenu on wide screens and a responsive stacked layout on narrower screens.
- Project actions are not duplicated inside Dashboard.

## Validation

- Targeted issue #113 regression tests pass.
- Lint passes.
- Full application build and complete regression suite pass.
- PlotPickle Quality passes.
- Phase 1 validation passes.
- Windows, macOS and Linux release-candidate packaging, clean-machine extraction and checksum steps pass.
