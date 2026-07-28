# Issue #171 — Settings responsibility boundaries

## GitHub

GitHub now presents two explicit responsibilities over the existing collaboration foundation:

1. **Connection & Configuration** owns GitHub App setup, account and repository identity, approved-branch selection, five readiness checks, advanced fine-grained-token setup, repository access, testing and disconnect/revoke.
2. **Collaboration & Approval Controls** owns contributor onboarding, bounded Story Proposals, Project Lead semantic-group approval, canonical-content protection, conflict and command recovery, project synchronization and approved history.

Credentials remain outside `.ppf` projects, exports, reports, logs and commits. This change does not introduce a second GitHub connection or proposal model.

## Storage & Backups

The combined Settings label remains **Storage & Backups**, with three visible responsibilities:

1. **Disk Files** is primary project storage. It shows the exact project-folder location, readable `.ppf` files, file size, integrity status, save, open-folder, preview and export controls. `PLOTPICKLE_HOME` remains the one existing mechanism for relocating the complete local data home before launch.
2. **Rolling Backups** shows the exact backup-folder location, save behavior, clamped retention, the newest chronological restore point, open-folder control and the active project's restore-point list. “Create backup now” records the current in-memory project; ordinary save can preserve the previous disk version.
3. **Restore & Recovery** previews tracked differences before applying anything, then allows recovery of the whole project or selected story areas while preserving the active GitHub connection.

The existing local-project gateway remains the canonical save service. A narrow local-storage safety gateway adds chronological restore-point listing and current-project snapshots without creating a second project model.

## Safety boundary

Preview never changes the active project. Whole-project, selected-area and legacy-GitHub restores require confirmation. A disk restore is allowed only when the stored project ID matches the active project ID, preventing content from one story from inheriting another story's GitHub connection. A different project must be opened or imported instead. GitHub repository recovery remains within Collaboration & Approval Controls and is not presented as a disk backup.

## Application navigation

The application shell now uses the same ordered ten-item workflow with a smaller visual footprint:

`Dashboard · Learn · Plan · Storyboard · Write · Pitch | Build · Feedback · Refine · Reports`

Workflow group names remain structural and accessible, but are no longer displayed as large outer containers. Thin dividers separate the workflow groups, project actions and Settings. The active workspace uses restrained text emphasis and an ice-green underline. New Project, Import, Export and Load Afterglow remain available as flat utility actions.